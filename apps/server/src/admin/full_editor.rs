//! Authenticated facade for the preserved whole-document reconciliation service.
//! Temporary Node catalog worker: no listener, no client credentials, fixed executable/entrypoint.
use crate::auth::User;
use axum::{
    Extension, Json, Router,
    extract::{DefaultBodyLimit, State},
    http::{HeaderMap, StatusCode},
    middleware,
    response::{IntoResponse, Response},
    routing::post,
};
use serde::Deserialize;
use serde_json::{Value, json};
use sqlx::PgPool;
use std::{path::PathBuf, process::Stdio, sync::Arc, time::Duration};
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    process::Command,
    sync::Semaphore,
};
#[derive(Clone)]
struct WorkerState {
    pool: PgPool,
    root: PathBuf,
    secret: Arc<String>,
    workers: Arc<Semaphore>,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Call {
    operation: String,
    data: Value,
}
pub(super) fn routes(pool: PgPool) -> Router {
    let mut secret = [0; 32];
    getrandom::fill(&mut secret).expect("Editor signing requires OS randomness");
    let root = std::env::var_os("NAHHASIO_EDITOR_ROOT")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../.."));
    Router::new()
        .route("/api/v1/admin/editor", post(call))
        .route_layer(middleware::from_fn_with_state(
            pool.clone(),
            crate::auth::require_admin,
        ))
        .layer(DefaultBodyLimit::max(16 * 1024 * 1024))
        .layer(middleware::from_fn(super::no_store))
        .with_state(WorkerState {
            pool,
            root,
            secret: Arc::new(hex::encode(secret)),
            workers: Arc::new(Semaphore::new(2)),
        })
}
async fn call(
    State(state): State<WorkerState>,
    Extension(user): Extension<User>,
    headers: HeaderMap,
    Json(input): Json<Call>,
) -> Result<Response, super::Error> {
    if nahhasio_catalog::planets::Request::handles(&input.operation) {
        return planet(&state.pool, &headers, input).await;
    }
    if ![
        "planetDetail",
        "planetSave",
        "planetDelete",
        "planetOptions",
        "planetWorks",
        "planetMove",
        "entityOptions",
        "entityRoleCreate",
        "entityDeletePreview",
        "entityBulkDelete",
        "entityJsonRead",
        "entityJsonReview",
        "entityJsonSave",
        "entityList",
        "entitySelection",
        "entityDetail",
        "entitySave",
        "assets",
        "assetDetail",
        "assetOwners",
        "assetAssign",
        "assetUnlink",
        "assetDelete",
        "assetRenamePreview",
        "assetRename",
        "read",
        "review",
        "save",
        "create",
        "parse",
        "links",
        "refs",
        "schema",
        "vocabulary",
        "media",
        "search",
        "season",
        "episodeImages",
        "ingest",
        "upload",
        "preview",
    ]
    .contains(&input.operation.as_str())
    {
        return Err(super::Error(
            StatusCode::BAD_REQUEST,
            "عملية محرر غير صالحة.",
        ));
    }
    let key = crate::auth::bearer(&headers)
        .map_err(|_| super::Error(StatusCode::UNAUTHORIZED, "انتهت الجلسة."))?;
    let _permit = state
        .workers
        .clone()
        .acquire_owned()
        .await
        .map_err(|_| super::Error(StatusCode::SERVICE_UNAVAILABLE, "المحرر غير متاح."))?;
    let payload=serde_json::to_vec(&json!({"operation":input.operation,"data":input.data,"context":{"accountId":user.account_id,"sessionKey":key}})).map_err(|_|super::Error(StatusCode::BAD_REQUEST,"طلب غير صالح."))?;
    let mut child = Command::new("node")
        .arg("--import")
        .arg("tsx")
        .arg("src/editor/worker.ts")
        .current_dir(state.root.join("packages/cli"))
        .env("NAHHASIO_EDITOR_SECRET", state.secret.as_ref())
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .kill_on_drop(true)
        .spawn()
        .map_err(|_| {
            super::Error(
                StatusCode::SERVICE_UNAVAILABLE,
                "تعذّر بدء خدمة تحرير المستندات.",
            )
        })?;
    let mut stdin = child.stdin.take().ok_or(super::Error(
        StatusCode::SERVICE_UNAVAILABLE,
        "قناة المحرر غير متاحة.",
    ))?;
    let mut stdout = child.stdout.take().ok_or(super::Error(
        StatusCode::SERVICE_UNAVAILABLE,
        "قناة المحرر غير متاحة.",
    ))?;
    let operation = async {
        stdin.write_all(&payload).await?;
        drop(stdin);
        let mut bytes = Vec::new();
        (&mut stdout)
            .take(32 * 1024 * 1024 + 1)
            .read_to_end(&mut bytes)
            .await?;
        if bytes.len() > 32 * 1024 * 1024 {
            return Err(std::io::Error::other("Editor response limit exceeded"));
        }
        let status = child.wait().await?;
        if !status.success() {
            return Err(std::io::Error::other("Editor worker failed"));
        }
        Ok::<_, std::io::Error>(bytes)
    };
    let bytes = tokio::time::timeout(Duration::from_secs(45), operation)
        .await
        .map_err(|_| {
            super::Error(
                StatusCode::GATEWAY_TIMEOUT,
                "انتهت مهلة المحرر؛ أعد تحميل المستند قبل إعادة الحفظ.",
            )
        })?
        .map_err(|_| super::Error(StatusCode::SERVICE_UNAVAILABLE, "تعذّر تنفيذ عملية المحرر."))?;
    let result: Value = serde_json::from_slice(&bytes)
        .map_err(|_| super::Error(StatusCode::SERVICE_UNAVAILABLE, "استجابة المحرر غير صالحة."))?;
    if result["ok"] == true {
        return Ok(Json(json!({"result":result["result"]})).into_response());
    }
    let status = match result["status"].as_u64() {
        Some(403) => StatusCode::FORBIDDEN,
        Some(409) => StatusCode::CONFLICT,
        Some(503) => StatusCode::SERVICE_UNAVAILABLE,
        _ => StatusCode::BAD_REQUEST,
    };
    Ok((
        status,
        Json(json!({"message":result["message"].as_str().unwrap_or("تعذّر تنفيذ العملية.")})),
    )
        .into_response())
}

async fn planet(pool: &PgPool, headers: &HeaderMap, input: Call) -> Result<Response, super::Error> {
    use nahhasio_catalog::{Error, planets};
    let request: planets::Request =
        serde_json::from_value(json!({"operation":input.operation,"data":input.data}))
            .map_err(|_| super::Error(StatusCode::BAD_REQUEST, "طلب كوكب غير صالح."))?;
    let mut transaction = pool.begin().await.map_err(|_| {
        super::Error(
            StatusCode::SERVICE_UNAVAILABLE,
            "تعذّر الوصول إلى قاعدة البيانات.",
        )
    })?;
    let actor = if request.writes() {
        sqlx::query("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE, READ WRITE")
            .execute(&mut *transaction)
            .await
            .map_err(|_| {
                super::Error(StatusCode::SERVICE_UNAVAILABLE, "تعذّر بدء عملية التحرير.")
            })?;
        Some(
            crate::auth::lock_admin_session(&mut transaction, headers)
                .await
                .map_err(|_| {
                    super::Error(
                        StatusCode::FORBIDDEN,
                        "انتهت الجلسة أو تغيّرت صلاحيات الإدارة.",
                    )
                })?,
        )
    } else {
        sqlx::query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY")
            .execute(&mut *transaction)
            .await
            .map_err(|_| {
                super::Error(StatusCode::SERVICE_UNAVAILABLE, "تعذّر بدء عملية القراءة.")
            })?;
        None
    };
    match planets::execute(&mut transaction, request, actor.as_deref()).await {
        Ok(result) => {
            transaction.commit().await.map_err(|_| {
                super::Error(
                    StatusCode::CONFLICT,
                    "تعذّر تأكيد الحفظ. أعد تحميل البيانات قبل المحاولة.",
                )
            })?;
            Ok(Json(json!({"result":result})).into_response())
        }
        Err(error) => {
            transaction.rollback().await.map_err(|_| {
                super::Error(StatusCode::SERVICE_UNAVAILABLE, "تعذّر إغلاق عملية التحرير.")
            })?;
            let (status, message) = match error {
                Error::Invalid(message) => (StatusCode::BAD_REQUEST, message),
                Error::Conflict(message) => (StatusCode::CONFLICT, message),
                Error::Database(error)
                    if error
                        .as_database_error()
                        .and_then(|error| error.code())
                        .is_some_and(|code| {
                            matches!(code.as_ref(), "23503" | "23505" | "40001" | "40P01")
                        }) =>
                {
                    (
                        StatusCode::CONFLICT,
                        "تغيّرت البيانات أو ترتبط بسجلات أخرى. أعد تحميلها قبل المحاولة.".into(),
                    )
                }
                _ => (
                    StatusCode::SERVICE_UNAVAILABLE,
                    "تعذّر تنفيذ عملية الكوكب.".into(),
                ),
            };
            Ok((status, Json(json!({"message":message}))).into_response())
        }
    }
}
