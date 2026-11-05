//! Bounded resumable uploads. A row lock serializes offsets and fsync precedes acknowledgement.
use super::{Error, MediaState, Result, storage};
use axum::{
    Json,
    extract::Request,
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
};
use serde::Deserialize;
use serde_json::{Value, json};
use sqlx::{Row, types::Json as SqlJson};
use tokio::io::{AsyncSeekExt, AsyncWriteExt};
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct Start {
    name: String,
    byte_size: u64,
    idempotency_key: String,
    sha256: String,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct Offset {
    offset: u64,
}
pub(super) async fn start(
    State(state): State<MediaState>,
    headers: HeaderMap,
    Json(input): Json<Start>,
) -> Result<Json<Value>> {
    if input.name.len() > 255
        || input.name.contains(['/', '\\'])
        || input.name.chars().any(char::is_control)
        || !storage::video(&input.name)
        || input.byte_size == 0
        || input.byte_size > 100 * 1024 * 1024 * 1024
        || input.idempotency_key.is_empty()
        || input.idempotency_key.len() > 100
        || input.sha256.len() != 64
        || !input.sha256.bytes().all(|c| c.is_ascii_hexdigit())
    {
        return Err(storage::invalid());
    }
    let mut tx = state.pool.begin().await?;
    sqlx::query("set transaction read write")
        .execute(&mut *tx)
        .await?;
    let actor = crate::auth::lock_admin_session(&mut tx, &headers)
        .await
        .map_err(|_| Error(StatusCode::FORBIDDEN, "Administrator session expired"))?;
    let extension = std::path::Path::new(&input.name)
        .extension()
        .and_then(|s| s.to_str())
        .ok_or_else(storage::invalid)?
        .to_ascii_lowercase();
    let payload = json!({"name":input.name,"byteSize":input.byte_size,"extension":extension,"offset":0,"sha256":input.sha256.to_ascii_lowercase()});
    let row=sqlx::query("insert into background_jobs(type,created_by_account_id,payload,idempotency_key) values('media.upload',$1::uuid,$2,$3) on conflict do nothing returning id::text,payload,status::text").bind(&actor).bind(SqlJson(&payload)).bind(&input.idempotency_key).fetch_optional(&mut *tx).await?;
    let row=match row {Some(row)=>row,None=>sqlx::query("select id::text,payload,status::text from background_jobs where type='media.upload' and created_by_account_id=$1::uuid and idempotency_key=$2").bind(&actor).bind(&input.idempotency_key).fetch_one(&mut *tx).await?};
    let existing = row.get::<SqlJson<Value>, _>("payload").0;
    if existing["name"] != payload["name"]
        || existing["byteSize"] != payload["byteSize"]
        || existing["sha256"] != payload["sha256"]
    {
        return Err(Error(StatusCode::CONFLICT, "Upload identity changed"));
    }
    tx.commit().await?;
    Ok(Json(
        json!({"id":row.get::<String,_>("id"),"offset":existing["offset"],"complete":row.get::<String,_>("status")=="completed"}),
    ))
}
pub(super) async fn chunk(
    State(state): State<MediaState>,
    Path(id): Path<String>,
    Query(offset): Query<Offset>,
    request: Request,
) -> Result<Json<Value>> {
    let _permit = state.uploads.clone().try_acquire_owned().map_err(|_| {
        Error(
            StatusCode::SERVICE_UNAVAILABLE,
            "Upload workers are busy; retry this chunk",
        )
    })?;
    let headers = request.headers().clone();
    let bytes = axum::body::to_bytes(request.into_body(), 8 * 1024 * 1024)
        .await
        .map_err(|_| storage::invalid())?;
    storage::uuid(&id)?;
    if bytes.is_empty() || bytes.len() > 8 * 1024 * 1024 {
        return Err(storage::invalid());
    }
    let root = storage::root("NAHHASIO_IMPORT_ROOT")?;
    let output = tokio::time::timeout(
        std::time::Duration::from_secs(5),
        tokio::process::Command::new("df")
            .args(["-Pk"])
            .arg(&root)
            .kill_on_drop(true)
            .output(),
    )
    .await
    .map_err(|_| storage::unavailable())?
    .map_err(|_| storage::unavailable())?;
    let free = String::from_utf8_lossy(&output.stdout)
        .lines()
        .last()
        .and_then(|line| line.split_whitespace().nth(3))
        .and_then(|value| value.parse::<u64>().ok())
        .ok_or_else(storage::unavailable)?
        * 1024;
    if !output.status.success() || free < 5 * 1024 * 1024 * 1024 + bytes.len() as u64 {
        return Err(Error(
            StatusCode::INSUFFICIENT_STORAGE,
            "Upload paused to preserve the 5 GiB reserve",
        ));
    }
    let mut tx = state.pool.begin().await?;
    sqlx::query("set transaction read write")
        .execute(&mut *tx)
        .await?;
    let actor = crate::auth::lock_admin_session(&mut tx, &headers)
        .await
        .map_err(|_| Error(StatusCode::FORBIDDEN, "Administrator session expired"))?;
    let row=sqlx::query("select payload from background_jobs where id=$1::uuid and type='media.upload' and created_by_account_id=$2::uuid and status='queued' for update").bind(&id).bind(actor).fetch_optional(&mut *tx).await?.ok_or(Error(StatusCode::NOT_FOUND,"Upload missing or complete"))?;
    let payload = row.get::<SqlJson<Value>, _>("payload").0;
    let expected = payload["offset"].as_u64().ok_or_else(storage::invalid)?;
    let total = payload["byteSize"].as_u64().ok_or_else(storage::invalid)?;
    if offset.offset != expected || expected + bytes.len() as u64 > total {
        return Err(Error(
            StatusCode::CONFLICT,
            "Upload offset changed; resume from acknowledged offset",
        ));
    }
    let dir = root.join(".uploads");
    tokio::fs::create_dir_all(&dir)
        .await
        .map_err(|_| storage::unavailable())?;
    storage::existing(&root, ".uploads").await?;
    let path = dir.join(format!("{id}.part"));
    if tokio::fs::symlink_metadata(&path)
        .await
        .is_ok_and(|m| m.file_type().is_symlink())
    {
        return Err(storage::invalid());
    }
    let mut file = tokio::fs::OpenOptions::new()
        .create(true)
        .truncate(false)
        .write(true)
        .open(path)
        .await
        .map_err(|_| storage::unavailable())?;
    if file
        .metadata()
        .await
        .map_err(|_| storage::unavailable())?
        .len()
        < expected
    {
        return Err(Error(
            StatusCode::CONFLICT,
            "Upload staging changed; restart this upload",
        ));
    }
    file.set_len(expected)
        .await
        .map_err(|_| storage::unavailable())?;
    file.seek(std::io::SeekFrom::Start(expected))
        .await
        .map_err(|_| storage::unavailable())?;
    file.write_all(&bytes)
        .await
        .map_err(|_| storage::unavailable())?;
    file.sync_all().await.map_err(|_| storage::unavailable())?;
    let next = expected + bytes.len() as u64;
    sqlx::query("update background_jobs set payload=jsonb_set(payload,'{offset}',to_jsonb($2::bigint)),progress=$3,updated_at=now() where id=$1::uuid").bind(id).bind(next as i64).bind((next*100/total) as i32).execute(&mut *tx).await?;
    tx.commit().await?;
    Ok(Json(json!({"offset":next})))
}
pub(super) async fn complete(
    State(state): State<MediaState>,
    Path(id): Path<String>,
    headers: HeaderMap,
) -> Result<Json<Value>> {
    let _permit = state.uploads.clone().try_acquire_owned().map_err(|_| {
        Error(
            StatusCode::SERVICE_UNAVAILABLE,
            "Upload verification is busy; retry",
        )
    })?;
    storage::uuid(&id)?;
    let root = storage::root("NAHHASIO_IMPORT_ROOT")?;
    let mut tx = state.pool.begin().await?;
    sqlx::query("set transaction read write")
        .execute(&mut *tx)
        .await?;
    let actor = crate::auth::lock_admin_session(&mut tx, &headers)
        .await
        .map_err(|_| Error(StatusCode::FORBIDDEN, "Administrator session expired"))?;
    let row=sqlx::query("select payload,status::text from background_jobs where id=$1::uuid and type='media.upload' and created_by_account_id=$2::uuid for update").bind(&id).bind(&actor).fetch_optional(&mut *tx).await?.ok_or(Error(StatusCode::NOT_FOUND,"Upload not found"))?;
    let data = row.get::<SqlJson<Value>, _>("payload").0;
    let extension = data["extension"].as_str().ok_or_else(storage::invalid)?;
    let name = data["name"].as_str().ok_or_else(storage::invalid)?;
    let stem = std::path::Path::new(name)
        .file_stem()
        .and_then(|s| s.to_str())
        .ok_or_else(storage::invalid)?;
    let readable = storage::slug(&stem.chars().take(40).collect::<String>());
    let relative = format!("uploads/{readable}--{id}.{extension}");
    if row.get::<String, _>("status") == "completed" {
        return Ok(Json(json!({"relativePath":relative})));
    }
    if row.get::<String, _>("status") != "queued" {
        return Err(Error(
            StatusCode::CONFLICT,
            "Upload is canceled or requires review",
        ));
    }
    if data["offset"] != data["byteSize"] {
        return Err(Error(StatusCode::CONFLICT, "Upload is incomplete"));
    }
    let source = storage::existing(&root, &format!(".uploads/{id}.part")).await?;
    let hash = super::worker::digest(&source)
        .await
        .map_err(|_| storage::unavailable())?;
    if data["sha256"].as_str() != Some(&hash)
        || tokio::fs::metadata(&source)
            .await
            .map_err(|_| storage::unavailable())?
            .len()
            != data["byteSize"].as_u64().ok_or_else(storage::invalid)?
    {
        return Err(Error(
            StatusCode::CONFLICT,
            "Uploaded bytes differ from the selected source; staging preserved",
        ));
    }
    let folder = root.join("uploads");
    tokio::fs::create_dir_all(folder)
        .await
        .map_err(|_| storage::unavailable())?;
    storage::existing(&root, "uploads").await?;
    let target = root.join(&relative);
    if !tokio::fs::try_exists(&target)
        .await
        .map_err(|_| storage::unavailable())?
    {
        tokio::fs::hard_link(&source, &target)
            .await
            .map_err(|_| storage::unavailable())?;
    } else {
        let target = storage::existing(&root, &relative).await?;
        if super::worker::digest(&target)
            .await
            .map_err(|_| storage::unavailable())?
            != hash
        {
            return Err(Error(
                StatusCode::CONFLICT,
                "Upload publication conflict; existing bytes preserved",
            ));
        }
    }
    sqlx::query("update background_jobs set status='completed',progress=100,result=$2,finished_at=now(),updated_at=now() where id=$1::uuid").bind(&id).bind(SqlJson(json!({"relativePath":relative}))).execute(&mut *tx).await?;
    tx.commit().await?;
    tokio::fs::remove_file(source)
        .await
        .map_err(|_| storage::unavailable())?;
    Ok(Json(json!({"relativePath":relative})))
}
