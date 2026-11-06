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
#[derive(Default, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MissingContents {
    #[serde(default)]
    missing_video: bool,
    #[serde(default)]
    missing_sidecars: Vec<usize>,
}
async fn check_video(
    path: &std::path::Path,
    size: Option<i64>,
    checksum: Option<&str>,
) -> std::result::Result<String, &'static str> {
    let stat = tokio::fs::metadata(path)
        .await
        .map_err(|_| "Cannot inspect video")?;
    if !stat.is_file() || size.is_some_and(|size| size < 0 || size as u64 != stat.len()) {
        return Err("Video bytes changed; originals preserved");
    }
    let actual = super::worker::digest(path).await?;
    if checksum.is_some_and(|expected| actual != expected) {
        return Err("Video bytes changed; originals preserved");
    }
    Ok(actual)
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct Action {
    action: String,
    work_id: Option<String>,
    installment_id: Option<String>,
    episode_id: Option<String>,
    expected_revision: Option<String>,
    replacement_file_id: Option<String>,
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
        "trash" | "restore" | "purge" | "verify" | "reassign" | "replace"
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
    if input.action == "replace" {
        storage::uuid(
            input
                .replacement_file_id
                .as_deref()
                .ok_or_else(storage::invalid)?,
        )?;
        if input.replacement_file_id.as_deref() == Some(&id)
            || input
                .expected_revision
                .as_ref()
                .is_none_or(|revision| revision.is_empty() || revision.len() > 100)
        {
            return Err(storage::invalid());
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
        sqlx::query_scalar("select updated_at::text from media_files where id=$1::uuid and not probe_metadata ? 'purgedAt' for update")
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
    let job:String=sqlx::query_scalar("insert into background_jobs(created_by_account_id,type,payload) values($1::uuid,'media.file',$2) returning id::text").bind(actor).bind(SqlJson(json!({"fileId":id,"action":input.action,"workId":input.work_id,"installmentId":input.installment_id,"episodeId":input.episode_id,"expectedRevision":input.expected_revision,"replacementFileId":input.replacement_file_id}))).fetch_one(&mut *tx).await?;
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
    if let Some(job) = input["jobId"].as_str() {
        let applied: bool = sqlx::query_scalar("select exists(select 1 from audit_logs where target_type='media_files' and target_id=$1 and action=$2 and changes->>'jobId'=$3)")
            .bind(id).bind(format!("media.file.{action}")).bind(job).fetch_one(&mut *tx).await.map_err(|_| "Cannot inspect file operation recovery")?;
        if applied {
            return Ok(());
        }
    }
    let row = sqlx::query(
        "select f.relative_path,f.probe_metadata,f.sha256,f.byte_size,f.episode_id::text,f.installment_id::text,f.updated_at::text revision from media_files f join library_roots r on r.id=f.library_root_id where f.id=$1::uuid and r.path=$2 and r.is_active for update of f for share of r",
    )
    .bind(id)
    .bind(library.to_str().ok_or("Invalid managed root")?)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|_| "Cannot inspect file")?
    .ok_or("Media file is missing or outside the active managed root")?;
    let relative: String = row
        .get::<Option<String>, _>("relative_path")
        .ok_or("File is outside managed storage")?;
    storage::relative(&relative).map_err(|_| "Invalid managed path")?;
    let metadata = row.get::<SqlJson<Value>, _>("probe_metadata").0;
    let expected_checksum = row.get::<Option<String>, _>("sha256");
    let expected_size = row.get::<Option<i64>, _>("byte_size");
    let companions = super::sidecars::decode(&metadata)?;
    let retired: MissingContents = metadata
        .get("trash")
        .map(|value| serde_json::from_value(value.clone()))
        .transpose()
        .map_err(|_| "Invalid trash receipt")?
        .unwrap_or_default();
    if metadata.get("purgedAt").is_some() {
        return if matches!(action, "purge" | "purgeExpired") {
            Ok(())
        } else {
            Err("Video was permanently purged")
        };
    }
    if action == "replace"
        && metadata["trash"]["replacedBy"] == input["replacementFileId"]
        && metadata["trash"].is_object()
    {
        return Ok(());
    }
    if let Some(expected) = input["expectedRevision"].as_str()
        && expected != row.get::<String, _>("revision")
    {
        return Err("Video changed after review; review the replacement again");
    }
    if action == "replace" {
        let replacement = input["replacementFileId"]
            .as_str()
            .ok_or("Invalid replacement identity")?;
        storage::uuid(replacement).map_err(|_| "Invalid replacement identity")?;
        if replacement == id || metadata["trash"].is_object() {
            return Err("Replacement requires a current video and a different verified copy");
        }
        let alternative = sqlx::query("select f.relative_path,f.sha256,f.byte_size from media_files f join library_roots r on r.id=f.library_root_id where f.id=$1::uuid and f.availability='present' and f.last_verified_at is not null and not f.probe_metadata ? 'trash' and f.episode_id is not distinct from $2::uuid and f.installment_id is not distinct from $3::uuid and r.path=$4 and r.is_active for share of f,r")
            .bind(replacement).bind(row.get::<Option<String>,_>("episode_id")).bind(row.get::<Option<String>,_>("installment_id")).bind(library.to_str().ok_or("Invalid library root")?).fetch_optional(&mut *tx).await.map_err(|_| "Cannot inspect replacement")?.ok_or("Replacement is unavailable or belongs to another episode; originals preserved")?;
        let path = storage::existing(
            &library,
            &alternative
                .get::<Option<String>, _>("relative_path")
                .ok_or("Replacement is outside managed storage")?,
        )
        .await
        .map_err(|_| "Replacement file is missing or unsafe")?;
        let size = tokio::fs::metadata(&path)
            .await
            .map_err(|_| "Cannot inspect replacement bytes")?
            .len();
        if alternative
            .get::<Option<i64>, _>("byte_size")
            .is_none_or(|expected| expected < 1 || expected as u64 != size)
            || alternative.get::<Option<String>, _>("sha256").as_deref()
                != Some(super::worker::digest(&path).await?.as_str())
        {
            return Err("Replacement bytes changed; verify the new copy first");
        }
    }
    let operation = if action == "replace" { "trash" } else { action };
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
    match operation {
        "trash" => {
            if metadata["trash"].is_object() {
                return Ok(());
            }
            let original = storage::optional_existing(&library, &relative)
                .await
                .map_err(|_| "Video source is unsafe or unreadable")?;
            let archived = storage::optional_existing(&trash, &trash_name)
                .await
                .map_err(|_| "Trash video is unsafe or unreadable")?;
            let missing_video = original.is_none() && archived.is_none();
            let mut checksum = None;
            for path in [original, archived].into_iter().flatten() {
                let hash = check_video(&path, expected_size, expected_checksum.as_deref()).await?;
                if checksum.as_ref().is_some_and(|expected| *expected != hash) {
                    return Err("Trash recovery conflict; both copies preserved");
                }
                checksum = Some(hash);
            }
            let (missing_sidecars, _) =
                super::sidecars::retirement_contents(&companions, &library, &trash, id).await?;
            storage::journal(&journal, &json!({"fileId":id,"action":action,"relativePath":relative,"missingVideo":missing_video,"missingSidecars":missing_sidecars})).await.map_err(|_| "Cannot save missing-file receipt")?;
            super::sidecars::retire(
                &companions,
                &library,
                &trash,
                id,
                "trash",
                &missing_sidecars,
            )
            .await?;
            let (missing_sidecars, subtitle_bytes) =
                super::sidecars::retirement_contents(&companions, &library, &trash, id).await?;
            let destination = trash.join(&trash_name);
            let source = library.join(&relative);
            if !missing_video {
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
                            return Err(
                                "Source changed during trash recovery; both copies preserved",
                            );
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
            }
            let video_bytes = if missing_video {
                if storage::optional_existing(&library, &relative)
                    .await
                    .map_err(|_| "Unsafe video source")?
                    .is_some()
                    || storage::optional_existing(&trash, &trash_name)
                        .await
                        .map_err(|_| "Unsafe trash video")?
                        .is_some()
                {
                    return Err("Video appeared during cleanup; review it again");
                }
                0
            } else {
                tokio::fs::metadata(&destination)
                    .await
                    .map_err(|_| "Cannot inspect retired video")?
                    .len()
            };
            sqlx::query("update media_files set availability='missing',sha256=coalesce(sha256,$5::text),probe_metadata=probe_metadata||jsonb_build_object('trash',jsonb_build_object('relativePath',relative_path,'expiresAt',now()+interval '7 days','missingVideo',$2::boolean,'missingSidecars',$3::jsonb,'byteSize',$4::bigint)),updated_at=now() where id=$1::uuid").bind(id).bind(missing_video).bind(SqlJson(&missing_sidecars)).bind((video_bytes+subtitle_bytes) as i64).bind(checksum).execute(&mut *tx).await.map_err(|_|"Cannot retire file")?;
            if action == "replace" {
                sqlx::query("update media_files set probe_metadata=jsonb_set(probe_metadata,'{trash,replacedBy}',to_jsonb($2::text)) where id=$1::uuid").bind(id).bind(input["replacementFileId"].as_str()).execute(&mut *tx).await.map_err(|_| "Cannot record replacement receipt")?;
            }
            sqlx::query("insert into background_jobs(created_by_account_id,type,payload,run_after) values($1::uuid,'media.file',$2,now()+interval '7 days')").bind(actor).bind(SqlJson(json!({"fileId":id,"action":"purgeExpired"}))).execute(&mut *tx).await.map_err(|_|"Cannot schedule trash expiration")?;
        }
        "restore" => {
            if !metadata["trash"].is_object() {
                return Err("File is not in trash");
            }
            super::sidecars::retire(
                &companions,
                &library,
                &trash,
                id,
                "restore",
                &retired.missing_sidecars,
            )
            .await?;
            let target = library.join(&relative);
            let missing_video = retired.missing_video
                && storage::optional_existing(&library, &relative)
                    .await
                    .map_err(|_| "Unsafe restore destination")?
                    .is_none()
                && storage::optional_existing(&trash, &trash_name)
                    .await
                    .map_err(|_| "Unsafe trash source")?
                    .is_none();
            if !missing_video {
                if retired.missing_video && expected_checksum.is_none() {
                    return Err("Recovered video has no verification receipt; bytes preserved");
                }
                let parent = target.parent().ok_or("Invalid restore destination")?;
                if parent != library {
                    storage::directory(
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
                    check_video(&source, expected_size, expected_checksum.as_deref()).await?;
                    tokio::fs::hard_link(source, &target)
                        .await
                        .map_err(|_| "Restore conflict; existing video preserved")?;
                }
                match tokio::fs::remove_file(source).await {
                    Ok(()) => {}
                    Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
                    Err(_) => return Err("Cannot finish restore"),
                }
            }
            sqlx::query("update media_files set availability=$2,probe_metadata=probe_metadata-'trash',updated_at=now() where id=$1::uuid").bind(id).bind(if missing_video { "missing" } else { "present" }).execute(&mut *tx).await.map_err(|_|"Cannot restore registration")?;
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
            super::sidecars::retire(
                &companions,
                &library,
                &trash,
                id,
                "purge",
                &retired.missing_sidecars,
            )
            .await?;
            if let Some(source) = storage::optional_existing(&trash, &trash_name)
                .await
                .map_err(|_| "Cannot inspect trash safely")?
            {
                if retired.missing_video && expected_checksum.is_none() {
                    return Err("Unexpected video in trash; bytes preserved");
                }
                check_video(&source, expected_size, expected_checksum.as_deref()).await?;
                tokio::fs::remove_file(source)
                    .await
                    .map_err(|_| "Cannot purge video")?;
            }
            sqlx::query("update media_files set probe_metadata=(probe_metadata-'trash')||jsonb_build_object('purgedAt',now()),availability='missing',updated_at=now() where id=$1::uuid").bind(id).execute(&mut *tx).await.map_err(|_|"Cannot record purge")?;
        }
        _ => return Err("Invalid file operation"),
    }
    sync_parents(&library, &trash, &relative, &companions).await?;
    sqlx::query("insert into audit_logs(actor_account_id,action,target_type,target_id,summary,changes) values($1::uuid,$2,'media_files',$3,'Managed video file operation; catalog preserved',$4)").bind(actor).bind(format!("media.file.{action}")).bind(id).bind(SqlJson(json!({"jobId":input["jobId"]}))).execute(&mut *tx).await.map_err(|_|"Cannot audit file action")?;
    tx.commit()
        .await
        .map_err(|_| "Cannot commit file action; inspect journal")?;
    Ok(())
}

async fn sync_parents(
    library: &std::path::Path,
    trash: &std::path::Path,
    video: &str,
    companions: &[super::sidecars::Sidecar],
) -> std::result::Result<(), &'static str> {
    let mut directories =
        std::collections::BTreeSet::from([library.to_path_buf(), trash.to_path_buf()]);
    for relative in
        std::iter::once(video).chain(companions.iter().map(|file| file.relative_path.as_str()))
    {
        let mut parent = std::path::Path::new(relative).parent();
        while let Some(path) = parent.filter(|path| !path.as_os_str().is_empty()) {
            if let Some(path) =
                storage::optional_existing(library, path.to_str().ok_or("Invalid media directory")?)
                    .await
                    .map_err(|_| "Unsafe media directory")?
            {
                directories.insert(path);
            }
            parent = path.parent();
        }
    }
    for directory in directories {
        tokio::fs::File::open(directory)
            .await
            .map_err(|_| "Cannot open media directory")?
            .sync_all()
            .await
            .map_err(|_| "Cannot persist file operation; journal retained")?;
    }
    Ok(())
}

async fn verify(
    pool: &PgPool,
    id: &str,
    actor: &str,
    library: &std::path::Path,
) -> std::result::Result<(), &'static str> {
    let row=sqlx::query("select f.relative_path,f.sha256,f.byte_size,f.updated_at::text revision,f.probe_metadata ? 'trash' retired from media_files f join library_roots r on r.id=f.library_root_id where f.id=$1::uuid and not f.probe_metadata ? 'purgedAt' and r.path=$2 and r.is_active").bind(id).bind(library.to_str().ok_or("Invalid managed root")?).fetch_optional(pool).await.map_err(|_|"Cannot inspect video")?.ok_or("Video not found")?;
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
    let row=sqlx::query("select installment_id::text,episode_id::text,updated_at::text revision from media_files where id=$1::uuid and not probe_metadata ? 'purgedAt' for update").bind(id).fetch_one(&mut *tx).await.map_err(|_|"Cannot inspect source mapping")?;
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
