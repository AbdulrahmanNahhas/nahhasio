use std::path::{Component, Path, PathBuf};

use axum::{
    body::Body,
    extract::{Path as RoutePath, State},
    http::{StatusCode, header},
    response::Response,
};
use sqlx::PgPool;

use super::{ApiError, ApiResult, validate_id};

const MAX_ARTWORK_BYTES: i64 = 10 * 1024 * 1024;

// Paths come from registered assets, never from a client-supplied filesystem path.
// Canonical containment also rejects symlinks leading outside the configured media root.
async fn registered_path(path: &str) -> ApiResult<PathBuf> {
    let relative = path
        .strip_prefix("/media/")
        .ok_or(ApiError(StatusCode::NOT_FOUND, "Artwork unavailable"))?;
    if Path::new(relative)
        .components()
        .any(|c| !matches!(c, Component::Normal(_)))
    {
        return Err(ApiError(StatusCode::NOT_FOUND, "Artwork unavailable"));
    }
    let roots = nahhasio_catalog::storage::ArtworkRoots::configured();
    let (uploads, public) = (roots.uploads, roots.public);
    let (root, suffix) = relative
        .strip_prefix("uploads/")
        .map_or((public, relative), |suffix| (uploads, suffix));
    let root = tokio::fs::canonicalize(root)
        .await
        .map_err(|_| ApiError(StatusCode::NOT_FOUND, "Artwork unavailable"))?;
    let file = tokio::fs::canonicalize(root.join(suffix))
        .await
        .map_err(|_| ApiError(StatusCode::NOT_FOUND, "Artwork unavailable"))?;
    if !file.starts_with(root) {
        return Err(ApiError(StatusCode::NOT_FOUND, "Artwork unavailable"));
    }
    Ok(file)
}

pub(super) async fn serve(
    State(pool): State<PgPool>,
    RoutePath(id): RoutePath<String>,
) -> ApiResult<Response> {
    validate_id(&id)?;
    let (path, mime, size) = sqlx::query_as::<_, (String, String, i32)>(
        "select path,mime_type,byte_size from media_assets where id=$1::uuid",
    )
    .bind(id)
    .fetch_optional(&pool)
    .await?
    .ok_or(ApiError(StatusCode::NOT_FOUND, "Artwork not found"))?;
    if ![
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
        "image/avif",
    ]
    .contains(&mime.as_str())
        || !(1..=MAX_ARTWORK_BYTES as i32).contains(&size)
    {
        return Err(ApiError(StatusCode::NOT_FOUND, "Artwork unavailable"));
    }
    let file = registered_path(&path).await?;
    let metadata = tokio::fs::metadata(&file)
        .await
        .map_err(|_| ApiError(StatusCode::NOT_FOUND, "Artwork unavailable"))?;
    if !metadata.is_file() || metadata.len() > MAX_ARTWORK_BYTES as u64 {
        return Err(ApiError(StatusCode::NOT_FOUND, "Artwork unavailable"));
    }
    let bytes = tokio::fs::read(file)
        .await
        .map_err(|_| ApiError(StatusCode::NOT_FOUND, "Artwork unavailable"))?;
    Response::builder()
        .header(header::CONTENT_TYPE, mime)
        .header(header::CACHE_CONTROL, "private, max-age=3600")
        .header("x-content-type-options", "nosniff")
        .body(Body::from(bytes))
        .map_err(|_| ApiError(StatusCode::INTERNAL_SERVER_ERROR, "Artwork unavailable"))
}
