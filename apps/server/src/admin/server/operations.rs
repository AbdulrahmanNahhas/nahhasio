//! Fixed, administrator-authorized requests to the independent host maintenance worker.
use super::super::{Error, no_store};
use axum::{
    Json, Router,
    extract::State,
    http::{HeaderMap, StatusCode},
    middleware,
    routing::get,
};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sqlx::PgPool;
use std::{
    fs::{self, OpenOptions},
    io::{Read, Write},
    os::unix::fs::{OpenOptionsExt, PermissionsExt},
    path::{Path, PathBuf},
};

pub(super) fn routes(pool: PgPool) -> Router {
    Router::new()
        .route("/api/v1/admin/server/operations", get(status).post(request))
        .route_layer(middleware::from_fn_with_state(
            pool.clone(),
            crate::auth::require_admin,
        ))
        .layer(axum::extract::DefaultBodyLimit::max(4096))
        .layer(middleware::from_fn(no_store))
        .with_state(pool)
}

fn unavailable() -> Error {
    Error(
        StatusCode::SERVICE_UNAVAILABLE,
        "خدمة صيانة الخادم غير متاحة. تحقق من تشغيلها ثم أعد المحاولة.",
    )
}
fn private(path: &Path, directory: bool) -> Result<(), Error> {
    let meta = fs::symlink_metadata(path).map_err(|_| unavailable())?;
    if meta.file_type().is_symlink()
        || meta.is_dir() != directory
        || meta.permissions().mode() & 0o077 != 0
    {
        return Err(unavailable());
    }
    Ok(())
}
fn root() -> Result<Option<PathBuf>, Error> {
    let Some(value) = std::env::var_os("NAHHASIO_OPERATIONS_ROOT") else {
        return Ok(None);
    };
    let path = PathBuf::from(value);
    if !path.is_absolute() {
        return Err(unavailable());
    }
    private(&path, true)?;
    Ok(Some(path))
}
fn bounded_json(path: &Path) -> Result<Value, Error> {
    private(path, false)?;
    let mut bytes = Vec::new();
    fs::File::open(path)
        .map_err(|_| unavailable())?
        .take(1024 * 1024 + 1)
        .read_to_end(&mut bytes)
        .map_err(|_| unavailable())?;
    if bytes.len() > 1024 * 1024 {
        return Err(unavailable());
    }
    serde_json::from_slice(&bytes).map_err(|_| unavailable())
}

async fn status() -> Result<Json<Value>, Error> {
    tokio::task::spawn_blocking(|| {
        let Some(root) = root()? else { return Ok(Json(json!({"version":1,"available":false,"backups":[],"update":{"state":"unavailable","currentVersion":env!("CARGO_PKG_VERSION")},"activeJob":null,"lastJob":null}))) };
        let value = bounded_json(&root.join("status.json"))?;
        // Project the worker document through a fixed schema; never return installation paths/secrets.
        let status: Status = serde_json::from_value(value).map_err(|_| unavailable())?;
        Ok(Json(serde_json::to_value(status).map_err(|_| unavailable())?))
    }).await.map_err(|_| unavailable())?
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Job {
    id: String,
    operation: String,
    state: String,
    #[serde(default)]
    stage: String,
    #[serde(default)]
    message: String,
}
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Backup {
    id: String,
    created_at: String,
    reason: String,
    byte_size: u64,
    version: String,
    schema: String,
}
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Update {
    state: String,
    current_version: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    available_version: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    message: Option<String>,
}
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Status {
    version: u8,
    available: bool,
    backups: Vec<Backup>,
    update: Update,
    active_job: Option<Job>,
    last_job: Option<Job>,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
enum Operation {
    Backup,
    Restore,
    CheckUpdate,
    Update,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Input {
    id: String,
    operation: Operation,
    backup_id: Option<String>,
    confirmation: Option<String>,
}
fn valid_id(value: &str) -> bool {
    value.len() == 36
        && value.bytes().enumerate().all(|(i, b)| {
            if [8, 13, 18, 23].contains(&i) {
                b == b'-'
            } else {
                b.is_ascii_digit() || (b'a'..=b'f').contains(&b)
            }
        })
}
fn valid_backup(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 80
        && value
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-')
}
async fn request(
    State(pool): State<PgPool>,
    headers: HeaderMap,
    Json(input): Json<Input>,
) -> Result<Json<Value>, Error> {
    if !valid_id(&input.id)
        || match input.operation {
            Operation::Restore => input
                .backup_id
                .as_deref()
                .is_none_or(|id| !valid_backup(id) || input.confirmation.as_deref() != Some(id)),
            _ => input.backup_id.is_some() || input.confirmation.is_some(),
        }
    {
        return Err(Error(
            StatusCode::BAD_REQUEST,
            "راجع العملية ومعرّف النسخة وتأكيد الاستعادة.",
        ));
    }
    // Authorization linearizes at the audited transaction commit, before dispatching host work.
    // Own the task even on HTTP cancellation: an accepted request must not lose its publication.
    tokio::spawn(async move {
        let mut tx = pool.begin().await?;
        sqlx::query("set transaction read write").execute(&mut *tx).await?;
        let actor = crate::auth::lock_admin_session(&mut tx, &headers).await.map_err(|_| Error(StatusCode::FORBIDDEN,"Administrator session is no longer valid"))?;
        let requested_at: String = sqlx::query_scalar("select to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"')").fetch_one(&mut *tx).await?;
        let job = json!({"version":1,"id":input.id,"operation":input.operation,"requestedAt":requested_at,"actorAccountId":actor,"backupId":input.backup_id,"confirmation":input.confirmation});
        let returned = job.clone();
        sqlx::query("insert into audit_logs(actor_account_id,action,target_type,summary) values($1::uuid,'server.maintenance.request','server','Requested a fixed host maintenance operation')").bind(actor).execute(&mut *tx).await?;
        tx.commit().await?;
        tokio::task::spawn_blocking(move || enqueue(&job)).await.map_err(|_| unavailable())??;
        Ok(Json(json!({"id":returned["id"],"state":"queued"})))
    }).await.map_err(|_| unavailable())?
}
fn enqueue(job: &Value) -> Result<(), Error> {
    let root = root()?.ok_or_else(unavailable)?;
    // Refuse requests when the worker has never published its installation status.
    if bounded_json(&root.join("status.json"))?["available"] != true {
        return Err(unavailable());
    }
    let inbox = root.join("inbox");
    private(&inbox, true)?;
    let id = job["id"].as_str().ok_or_else(unavailable)?;
    let target = inbox.join(format!("{id}.json"));
    if target.exists() || root.join("jobs").join(format!("{id}.json")).exists() {
        return Err(Error(
            StatusCode::CONFLICT,
            "هذا الطلب مسجّل بالفعل. حدّث الحالة.",
        ));
    }
    let temporary = inbox.join(format!(".{id}.pending"));
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .mode(0o600)
        .open(&temporary)
        .map_err(|_| unavailable())?;
    let result = (|| {
        file.write_all(&serde_json::to_vec(job).map_err(|_| unavailable())?)
            .map_err(|_| unavailable())?;
        file.sync_all().map_err(|_| unavailable())?;
        // hard_link atomically publishes without replacing an existing request.
        fs::hard_link(&temporary, target).map_err(|_| unavailable())?;
        fs::File::open(&inbox)
            .and_then(|f| f.sync_all())
            .map_err(|_| unavailable())
    })();
    let _ = fs::remove_file(temporary);
    result
}
