//! Authenticated, bounded facade for the shared Rust catalog editor.
use crate::auth::User;
use axum::{
    Extension, Json, Router,
    extract::{DefaultBodyLimit, State},
    http::{HeaderMap, StatusCode},
    middleware,
    response::{IntoResponse, Response},
    routing::post,
};
use nahhasio_catalog::{Error, editor, planets};
use serde::Deserialize;
use serde_json::{Value, json};
use sqlx::PgPool;
use std::{sync::Arc, time::Duration};
use tokio::sync::Semaphore;
#[derive(Clone)]
struct EditorState {
    pool: PgPool,
    secret: Arc<[u8; 32]>,
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
    Router::new()
        .route("/api/v1/admin/editor", post(call))
        .route_layer(middleware::from_fn_with_state(
            pool.clone(),
            crate::auth::require_admin,
        ))
        .layer(DefaultBodyLimit::max(16 * 1024 * 1024))
        .layer(middleware::from_fn(super::no_store))
        .with_state(EditorState {
            pool,
            secret: Arc::new(secret),
            workers: Arc::new(Semaphore::new(2)),
        })
}
async fn call(
    State(state): State<EditorState>,
    Extension(user): Extension<User>,
    headers: HeaderMap,
    Json(input): Json<Call>,
) -> Result<Response, super::Error> {
    if !planets::Request::handles(&input.operation) && !editor::handles(&input.operation) {
        return Err(super::Error(
            StatusCode::BAD_REQUEST,
            "عملية محرر غير صالحة.",
        ));
    }
    let _permit = tokio::time::timeout(Duration::from_secs(2), state.workers.acquire())
        .await
        .map_err(|_| {
            super::Error(
                StatusCode::SERVICE_UNAVAILABLE,
                "المحرر مشغول. أعد المحاولة.",
            )
        })?
        .map_err(|_| super::Error(StatusCode::SERVICE_UNAVAILABLE, "المحرر غير متاح."))?;
    tokio::time::timeout(
        Duration::from_secs(45),
        execute(&state, &headers, &user.account_id, input),
    )
    .await
    .map_err(|_| {
        super::Error(
            StatusCode::GATEWAY_TIMEOUT,
            "انتهت مهلة المحرر؛ أعد تحميل المستند قبل إعادة الحفظ.",
        )
    })?
}
async fn execute(
    state: &EditorState,
    headers: &HeaderMap,
    account_id: &str,
    input: Call,
) -> Result<Response, super::Error> {
    let planet = if planets::Request::handles(&input.operation) {
        Some(
            serde_json::from_value::<planets::Request>(
                json!({"operation":input.operation,"data":input.data}),
            )
            .map_err(|_| super::Error(StatusCode::BAD_REQUEST, "طلب كوكب غير صالح."))?,
        )
    } else {
        None
    };
    let writes = planet.as_ref().map_or_else(
        || editor::writes(&input.operation),
        planets::Request::writes,
    );
    let mut tx = state.pool.begin().await.map_err(|_| {
        super::Error(
            StatusCode::SERVICE_UNAVAILABLE,
            "تعذّر الوصول إلى قاعدة البيانات.",
        )
    })?;
    let statement = if writes {
        "SET TRANSACTION ISOLATION LEVEL SERIALIZABLE, READ WRITE"
    } else {
        "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY"
    };
    sqlx::query(statement)
        .execute(&mut *tx)
        .await
        .map_err(|_| super::Error(StatusCode::SERVICE_UNAVAILABLE, "تعذّر بدء عملية المحرر."))?;
    let actor = if writes {
        Some(
            crate::auth::lock_admin_session(&mut tx, headers)
                .await
                .map_err(|_| {
                    super::Error(
                        StatusCode::FORBIDDEN,
                        "انتهت الجلسة أو تغيّرت صلاحيات الإدارة.",
                    )
                })?,
        )
    } else {
        None
    };
    let result = if let Some(planet) = planet {
        planets::execute(&mut tx, planet, actor.as_deref()).await
    } else {
        editor::execute(
            &mut tx,
            &input.operation,
            input.data,
            actor.as_deref().unwrap_or(account_id),
            state.secret.as_ref(),
        )
        .await
    };
    match result {
        Ok(result) => {
            // Match the former worker response bound before committing any database mutation.
            if serde_json::to_vec(&result)
                .map_err(|_| {
                    super::Error(StatusCode::SERVICE_UNAVAILABLE, "استجابة المحرر غير صالحة.")
                })?
                .len()
                > 32 * 1024 * 1024
            {
                return Err(super::Error(
                    StatusCode::BAD_REQUEST,
                    "الاختيار أكبر من حد المحرر. ضيّق النطاق.",
                ));
            }
            tx.commit().await.map_err(|_| {
                super::Error(
                    StatusCode::CONFLICT,
                    "تعذّر تأكيد الحفظ. أعد تحميل البيانات قبل المحاولة.",
                )
            })?;
            Ok(Json(json!({"result":result})).into_response())
        }
        Err(error) => {
            tx.rollback().await.map_err(|_| {
                super::Error(StatusCode::SERVICE_UNAVAILABLE, "تعذّر إغلاق عملية المحرر.")
            })?;
            let (status, message) = match error {
                Error::Invalid(message) => (StatusCode::BAD_REQUEST, message),
                Error::Conflict(message) => (StatusCode::CONFLICT, message),
                Error::Json(_) => (
                    StatusCode::BAD_REQUEST,
                    "صيغة JSON غير صالحة. صحّحها قبل المراجعة.".into(),
                ),
                Error::Database(error) => {
                    match error.as_database_error().and_then(|e| e.code()).as_deref() {
                        Some("23503" | "23505" | "40001" | "40P01") => (
                            StatusCode::CONFLICT,
                            "تغيّرت البيانات أو ترتبط بسجلات أخرى. أعد تحميلها قبل المحاولة.".into(),
                        ),
                        Some("23514" | "23502" | "22P02" | "22007" | "22008") => (
                            StatusCode::BAD_REQUEST,
                            "تخالف بعض الحقول قيود البيانات؛ راجع القيم والتواريخ.".into(),
                        ),
                        _ => (
                            StatusCode::SERVICE_UNAVAILABLE,
                            "تعذّر تنفيذ عملية المحرر.".into(),
                        ),
                    }
                }
                _ => (
                    StatusCode::SERVICE_UNAVAILABLE,
                    "تعذّر تنفيذ عملية المحرر.".into(),
                ),
            };
            Ok((status, Json(json!({"message":message}))).into_response())
        }
    }
}
