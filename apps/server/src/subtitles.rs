use axum::{
    Json, Router,
    extract::{DefaultBodyLimit, Path, State},
    http::{HeaderValue, StatusCode, header},
    middleware,
    response::{IntoResponse, Response},
    routing::{get, post},
};
use nahhasio_catalog::opensubtitles::{self, Search, Service};
use serde_json::{Value, json};
use sqlx::PgPool;
use std::{sync::Arc, time::Duration};
use tokio::sync::Semaphore;

#[derive(Clone)]
struct Services {
    provider: Arc<Service>,
    permits: Arc<Semaphore>,
    downloads: Arc<Semaphore>,
}

pub(super) fn routes(pool: PgPool) -> Router {
    Router::new()
        .route("/api/v1/subtitles/status", get(status))
        .route("/api/v1/subtitles/search", post(search))
        .route("/api/v1/subtitles/{file_id}/download", post(download))
        .route_layer(middleware::from_fn_with_state(
            pool,
            crate::auth::require_viewer,
        ))
        .layer(DefaultBodyLimit::max(4096))
        .with_state(Services {
            provider: Arc::new(Service::default()),
            permits: Arc::new(Semaphore::new(4)),
            downloads: Arc::new(Semaphore::new(1)),
        })
}

async fn status() -> Response {
    (
        [(header::CACHE_CONTROL, "no-store")],
        Json(opensubtitles::status()),
    )
        .into_response()
}

fn failure(status: StatusCode, code: &str, message: &str) -> Response {
    (
        status,
        [(header::CACHE_CONTROL, "no-store")],
        Json(json!({"code": code, "message": message})),
    )
        .into_response()
}

fn provider_error(error: opensubtitles::Error) -> Response {
    let status = match error.code {
        "bad_request" => StatusCode::BAD_REQUEST,
        "subtitle_quota" => StatusCode::TOO_MANY_REQUESTS,
        "subtitle_disconnected" | "subtitle_login_required" => StatusCode::SERVICE_UNAVAILABLE,
        _ => StatusCode::BAD_GATEWAY,
    };
    failure(status, error.code, &error.message)
}

fn busy() -> Response {
    failure(
        StatusCode::TOO_MANY_REQUESTS,
        "busy",
        "خدمة الترجمة مشغولة. أعد المحاولة بعد قليل.",
    )
}

fn timeout() -> Response {
    failure(
        StatusCode::GATEWAY_TIMEOUT,
        "subtitle_timeout",
        "انتهت مهلة طلب الترجمة. تحقق من الحصة قبل إعادة التنزيل.",
    )
}

async fn search(State(state): State<Services>, Json(input): Json<Search>) -> Response {
    let Ok(_permit) = state.permits.try_acquire() else {
        return busy();
    };
    match tokio::time::timeout(Duration::from_secs(30), state.provider.search(input)).await {
        Ok(Ok(items)) => {
            ([(header::CACHE_CONTROL, "no-store")], Json::<Value>(items)).into_response()
        }
        Ok(Err(error)) => provider_error(error),
        Err(_) => timeout(),
    }
}

async fn download(State(state): State<Services>, Path(file_id): Path<u64>) -> Response {
    let (Ok(_permit), Ok(_download)) = (state.permits.try_acquire(), state.downloads.try_acquire())
    else {
        return busy();
    };
    match tokio::time::timeout(Duration::from_secs(30), state.provider.download(file_id)).await {
        Ok(Ok((bytes, remaining))) => {
            let mut response = (
                [
                    (header::CACHE_CONTROL, "no-store"),
                    (header::CONTENT_TYPE, "application/x-subrip"),
                    (
                        header::CONTENT_DISPOSITION,
                        "attachment; filename=subtitle.srt",
                    ),
                    (header::X_CONTENT_TYPE_OPTIONS, "nosniff"),
                ],
                bytes,
            )
                .into_response();
            if let Some(remaining) = remaining {
                response
                    .headers_mut()
                    .insert("x-subtitle-remaining", HeaderValue::from(remaining));
            }
            response
        }
        Ok(Err(error)) => provider_error(error),
        Err(_) => timeout(),
    }
}
