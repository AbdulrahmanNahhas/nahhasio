//! File retirement preserves catalog identities and records the reversible filesystem operation.
use super::{Error, MediaState, Result, storage};
use axum::{
    Json,
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
};
use serde::Deserialize;
use serde_json::{Value, json};
use sqlx::{PgPool, Row, types::Json as SqlJson};
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct Action {
    action: String,
    work_id: Option<String>,
    installment_id: Option<String>,
    episode_id: Option<String>,
    expected_revision: Option<String>,
}
pub(super) async fn enqueue(
    State(state): State<MediaState>,
    Path(id): Path<String>,
    headers: HeaderMap,
    Json(input): Json<Action>,
) -> Result<Json<Value>> {
    storage::uuid(&id)?;
    if !matches!(
        input.action.as_str(),
        "trash" | "restore" | "purge" | "verify" | "reassign"
    ) {
        return Err(storage::invalid());
    }
    if input.action == "reassign" {
        if input
            .expected_revision
            .as_ref()
            .is_none_or(|r| r.is_empty() || r.len() > 100)
        {
            return Err(storage::invalid());
        }
        storage::uuid(input.work_id.as_deref().ok_or_else(storage::invalid)?)?;
        storage::uuid(
            input
                .installment_id
                .as_deref()
                .ok_or_else(storage::invalid)?,
        )?;
        if let Some(id) = &input.episode_id {
            storage::uuid(id)?;
        }
    }
    let mut tx = state.pool.begin().await?;
    sqlx::query("set transaction read write")
        .execute(&mut *tx)
        .await?;
    let actor = crate::auth::lock_admin_session(&mut tx, &headers)
        .await
        .map_err(|_| Error(StatusCode::FORBIDDEN, "Administrator session expired"))?;
    let revision: Option<String> =
        sqlx::query_scalar("select updated_at::text from media_files where id=$1::uuid for update")
            .bind(&id)
            .fetch_optional(&mut *tx)
            .await?;
    if revision.is_none() {
        return Err(Error(StatusCode::NOT_FOUND, "Media file not found"));
    }
    if input.expected_revision.is_some() && input.expected_revision != revision {
        return Err(Error(
            StatusCode::CONFLICT,
            "File changed; reload its registration before reviewing again",
        ));
    }
    let job:String=sqlx::query_scalar("insert into background_jobs(created_by_account_id,type,payload) values($1::uuid,'media.file',$2) returning id::text").bind(actor).bind(SqlJson(json!({"fileId":id,"action":input.action,"workId":input.work_id,"installmentId":input.installment_id,"episodeId":input.episode_id,"expectedRevision":input.expected_revision}))).fetch_one(&mut *tx).await?;
    tx.commit().await?;
    Ok(Json(json!({"id":job})))
}
pub(super) async fn execute(
    pool: &PgPool,
    input: &Value,
    actor: &str,
) -> std::result::Result<(), &'static str> {
    let id = input["fileId"].as_str().ok_or("Invalid file identity")?;
    storage::uuid(id).map_err(|_| "Invalid file identity")?;
    let action = input["action"].as_str().ok_or("Invalid file action")?;
    if action == "reassign" {
        return reassign(pool, id, input, actor).await;
    }
    let library = storage::root("NAHHASIO_LIBRARY_ROOT").map_err(|_| "Library root unavailable")?;
    if action == "verify" {
        return verify(pool, id, actor, &library).await;
    }
    let trash = storage::root("NAHHASIO_TRASH_ROOT").map_err(|_| "Trash root unavailable")?;
    let journals =
        storage::root("NAHHASIO_MEDIA_OPERATIONS_ROOT").map_err(|_| "Media journal unavailable")?;
    let mut tx = pool
        .begin()
        .await
        .map_err(|_| "Media database unavailable")?;
    sqlx::query("set transaction read write")
        .execute(&mut *tx)
        .await
        .map_err(|_| "Cannot begin file action")?;
    super::worker::authorize(&mut tx, actor).await?;
    let row = sqlx::query(
        "select relative_path,probe_metadata,sha256,byte_size from media_files where id=$1::uuid for update",
    )
    .bind(id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|_| "Cannot inspect file")?
    .ok_or("Media file missing")?;
    let relative: String = row
        .get::<Option<String>, _>("relative_path")
        .ok_or("File is outside managed storage")?;
    storage::relative(&relative).map_err(|_| "Invalid managed path")?;
    let metadata = row.get::<SqlJson<Value>, _>("probe_metadata").0;
    let trash_name = format!("{id}.video");
    tokio::fs::create_dir_all(&trash)
        .await
        .map_err(|_| "Cannot prepare trash")?;
    tokio::fs::create_dir_all(&journals)
        .await
        .map_err(|_| "Cannot prepare file journal")?;
    let journal = journals.join(format!("file-{id}.json"));
    storage::journal(
        &journal,
        &json!({"fileId":id,"action":action,"relativePath":relative}),
    )
    .await
    .map_err(|_| "Cannot save file operation")?;
    match action {
        "trash" => {
            if metadata["trash"].is_object() {
                return Ok(());
            }
            let destination = trash.join(&trash_name);
            let source = library.join(&relative);
            if tokio::fs::try_exists(&destination)
                .await
                .map_err(|_| "Cannot inspect trash")?
            {
                let checked = storage::existing(&trash, &trash_name)
                    .await
                    .map_err(|_| "Unsafe trash path")?;
                let hash = super::worker::digest(&checked).await?;
                if row
                    .get::<Option<String>, _>("sha256")
                    .is_some_and(|expected| expected != hash)
                {
                    return Err("Trash recovery conflict; bytes preserved");
                }
                if tokio::fs::try_exists(&source)
                    .await
                    .map_err(|_| "Cannot inspect source")?
                {
                    let checked_source = storage::existing(&library, &relative)
                        .await
                        .map_err(|_| "Unsafe source path")?;
                    if super::worker::digest(&checked_source).await? != hash {
                        return Err("Source changed during trash recovery; both copies preserved");
                    }
                    tokio::fs::remove_file(checked_source)
                        .await
                        .map_err(|_| "Cannot remove retired source link")?;
                }
            } else {
                let checked = storage::existing(&library, &relative)
                    .await
                    .map_err(|_| "File missing or unsafe")?;
                tokio::fs::hard_link(&checked, &destination)
                    .await
                    .map_err(|_| "Trash destination conflict or different filesystem")?;
                tokio::fs::remove_file(checked)
                    .await
                    .map_err(|_| "Cannot remove original link; journal retained")?;
            }
            sqlx::query("update media_files set availability='missing',probe_metadata=probe_metadata||jsonb_build_object('trash',jsonb_build_object('relativePath',relative_path,'expiresAt',now()+interval '7 days')),updated_at=now() where id=$1::uuid").bind(id).execute(&mut *tx).await.map_err(|_|"Cannot retire file")?;
            sqlx::query("insert into background_jobs(created_by_account_id,type,payload,run_after) values($1::uuid,'media.file',$2,now()+interval '7 days')").bind(actor).bind(SqlJson(json!({"fileId":id,"action":"purgeExpired"}))).execute(&mut *tx).await.map_err(|_|"Cannot schedule trash expiration")?;
        }
        "restore" => {
            if !metadata["trash"].is_object() {
                return Err("File is not in trash");
            }
            let target = library.join(&relative);
            let parent = target.parent().ok_or("Invalid restore destination")?;
            if parent != library {
                storage::existing(
                    &library,
                    parent
                        .strip_prefix(&library)
                        .map_err(|_| "Invalid restore path")?
                        .to_str()
                        .ok_or("Invalid restore path")?,
                )
                .await
                .map_err(|_| "Restore directory is missing or unsafe")?;
            }
            let source = trash.join(&trash_name);
            if tokio::fs::try_exists(&target)
                .await
                .map_err(|_| "Cannot inspect restore destination")?
            {
                let target = storage::existing(&library, &relative)
                    .await
                    .map_err(|_| "Unsafe restore destination")?;
                let hash = super::worker::digest(&target).await?;
                let expected = row.get::<Option<String>, _>("sha256");
                if expected.as_ref().is_some_and(|expected| *expected != hash) {
                    return Err("Restore conflict; existing video preserved");
                }
                if tokio::fs::try_exists(&source)
                    .await
                    .map_err(|_| "Cannot inspect trash source")?
                {
                    let source = storage::existing(&trash, &trash_name)
                        .await
                        .map_err(|_| "Unsafe trash source")?;
                    if super::worker::digest(&source).await? != hash {
                        return Err("Restore conflict; both copies preserved");
                    }
                } else if expected.is_none() {
                    return Err("Cannot verify interrupted restore; bytes preserved");
                }
            } else {
                let source = storage::existing(&trash, &trash_name)
                    .await
                    .map_err(|_| "Trash file missing")?;
                tokio::fs::hard_link(source, &target)
                    .await
                    .map_err(|_| "Restore conflict; existing video preserved")?;
            }
            match tokio::fs::remove_file(source).await {
                Ok(()) => {}
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
                Err(_) => return Err("Cannot finish restore"),
            }
            sqlx::query("update media_files set availability='present',probe_metadata=probe_metadata-'trash',updated_at=now() where id=$1::uuid").bind(id).execute(&mut *tx).await.map_err(|_|"Cannot restore registration")?;
        }
        "purge" | "purgeExpired" => {
            if !metadata["trash"].is_object() {
                return Ok(());
            }
            if action == "purgeExpired" {
                let expired:bool=sqlx::query_scalar("select (probe_metadata->'trash'->>'expiresAt')::timestamptz<=now() from media_files where id=$1::uuid").bind(id).fetch_one(&mut *tx).await.map_err(|_|"Cannot inspect trash expiration")?;
                if !expired {
                    return Ok(());
                }
            }
            if tokio::fs::try_exists(trash.join(&trash_name))
                .await
                .map_err(|_| "Cannot inspect trash")?
            {
                let source = storage::existing(&trash, &trash_name)
                    .await
                    .map_err(|_| "Unsafe trash file")?;
                tokio::fs::remove_file(source)
                    .await
                    .map_err(|_| "Cannot purge video")?;
            }
            sqlx::query("update media_files set probe_metadata=probe_metadata-'trash',availability='missing',updated_at=now() where id=$1::uuid").bind(id).execute(&mut *tx).await.map_err(|_|"Cannot record purge")?;
        }
        _ => return Err("Invalid file operation"),
    }
    sqlx::query("insert into audit_logs(actor_account_id,action,target_type,target_id,summary) values($1::uuid,$2,'media_files',$3,'Managed video file operation; catalog preserved')").bind(actor).bind(format!("media.file.{action}")).bind(id).execute(&mut *tx).await.map_err(|_|"Cannot audit file action")?;
    tx.commit()
        .await
        .map_err(|_| "Cannot commit file action; inspect journal")?;
    Ok(())
}

async fn verify(
    pool: &PgPool,
    id: &str,
    actor: &str,
    library: &std::path::Path,
) -> std::result::Result<(), &'static str> {
    let row=sqlx::query("select relative_path,sha256,byte_size,updated_at::text revision,probe_metadata ? 'trash' retired from media_files where id=$1::uuid").bind(id).fetch_optional(pool).await.map_err(|_|"Cannot inspect video")?.ok_or("Video not found")?;
    if row.get::<bool, _>("retired") {
        return Err("Restore video before verification");
    }
    let relative: String = row
        .get::<Option<String>, _>("relative_path")
        .ok_or("Video is outside managed storage")?;
    let checked = match storage::existing(library, &relative).await {
        Ok(path) => match tokio::fs::metadata(&path).await {
            Ok(stat) if stat.is_file() && stat.len() > 0 => {
                match super::worker::digest(&path).await {
                    Ok(hash) => {
                        let valid = row
                            .get::<Option<String>, _>("sha256")
                            .is_none_or(|expected| expected == hash)
                            && row
                                .get::<Option<i64>, _>("byte_size")
                                .is_none_or(|expected| expected as u64 == stat.len());
                        if valid {
                            ("present", Some(hash), Some(stat.len() as i64))
                        } else {
                            ("unreadable", None, None)
                        }
                    }
                    Err(_) => ("unreadable", None, None),
                }
            }
            _ => ("missing", None, None),
        },
        Err(_) => ("missing", None, None),
    };
    let mut tx = pool
        .begin()
        .await
        .map_err(|_| "Media database unavailable")?;
    sqlx::query("set transaction read write")
        .execute(&mut *tx)
        .await
        .map_err(|_| "Cannot begin verification")?;
    super::worker::authorize(&mut tx, actor).await?;
    let updated=sqlx::query("update media_files set availability=$2,sha256=coalesce(sha256,$3),byte_size=coalesce(byte_size,$4),last_verified_at=now(),updated_at=now() where id=$1::uuid and updated_at::text=$5").bind(id).bind(checked.0).bind(checked.1).bind(checked.2).bind(row.get::<String,_>("revision")).execute(&mut *tx).await.map_err(|_|"Cannot record verification")?;
    if updated.rows_affected() != 1 {
        return Err("Video changed during verification; retry");
    }
    sqlx::query("insert into audit_logs(actor_account_id,action,target_type,target_id,summary) values($1::uuid,'media.file.verify','media_files',$2,$3)").bind(actor).bind(id).bind(checked.0).execute(&mut *tx).await.map_err(|_|"Cannot audit verification")?;
    tx.commit()
        .await
        .map_err(|_| "Cannot commit verification")?;
    if checked.0 != "present" {
        return Err("Video missing, unreadable, or changed; registration preserved");
    }
    Ok(())
}

async fn reassign(
    pool: &PgPool,
    id: &str,
    input: &Value,
    actor: &str,
) -> std::result::Result<(), &'static str> {
    let mut tx = pool
        .begin()
        .await
        .map_err(|_| "Media database unavailable")?;
    sqlx::query("set transaction read write")
        .execute(&mut *tx)
        .await
        .map_err(|_| "Cannot begin reassignment")?;
    super::worker::authorize(&mut tx, actor).await?;
    let work = input["workId"].as_str().ok_or("Invalid target work")?;
    let part = input["installmentId"]
        .as_str()
        .ok_or("Invalid target installment")?;
    let episode = input["episodeId"].as_str();
    let valid:bool=sqlx::query_scalar("select exists(select 1 from installments i where i.id=$1::uuid and i.title_id=$2::uuid and (($3::uuid is null and i.kind!='season') or exists(select 1 from episodes e where e.id=$3::uuid and e.installment_id=i.id)))").bind(part).bind(work).bind(episode).fetch_one(&mut *tx).await.map_err(|_|"Cannot validate media target")?;
    if !valid {
        return Err("Target no longer belongs to this work");
    }
    let row=sqlx::query("select installment_id::text,episode_id::text,updated_at::text revision from media_files where id=$1::uuid for update").bind(id).fetch_one(&mut *tx).await.map_err(|_|"Cannot inspect source mapping")?;
    let before = json!({"installmentId":row.get::<Option<String>,_>("installment_id"),"episodeId":row.get::<Option<String>,_>("episode_id")});
    if input["expectedRevision"].as_str() != Some(row.get::<String, _>("revision").as_str()) {
        let replay:bool=sqlx::query_scalar("select exists(select 1 from audit_logs where action='media.file.reassign' and target_id=$1 and changes->>'jobId'=$2)").bind(id).bind(input["jobId"].as_str().ok_or("Missing reassignment job identity")?).fetch_one(&mut *tx).await.map_err(|_|"Cannot inspect reassignment recovery")?;
        if replay {
            return Ok(());
        }
        return Err("File mapping changed after review; reload and review again");
    }
    sqlx::query("update media_files set installment_id=$2::uuid,episode_id=$3::uuid,updated_at=now() where id=$1::uuid").bind(id).bind(if episode.is_none(){Some(part)}else{None}).bind(episode).execute(&mut *tx).await.map_err(|_|"Cannot save media mapping")?;
    sqlx::query("insert into audit_logs(actor_account_id,action,target_type,target_id,summary,changes) values($1::uuid,'media.file.reassign','media_files',$2,'Explicit video reassignment',$3)").bind(actor).bind(id).bind(SqlJson(json!({"jobId":input["jobId"],"before":before,"after":{"workId":work,"installmentId":part,"episodeId":episode}}))).execute(&mut *tx).await.map_err(|_|"Cannot audit reassignment")?;
    tx.commit()
        .await
        .map_err(|_| "Cannot commit media reassignment")?;
    Ok(())
}
