use std::path::{Component, Path, PathBuf};

use axum::{
    body::Body,
    extract::{Path as RoutePath, Query, State},
    http::{HeaderMap, StatusCode, header},
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
    Query(variant): Query<Variant>,
    headers: HeaderMap,
) -> ApiResult<Response> {
    validate_id(&id)?;
    let width = variant.width()?;
    let (path, mime, size, revision) = sqlx::query_as::<_, (String, String, i32, String)>(
        "select path,mime_type,byte_size,sha256 from media_assets where id=$1::uuid",
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
    let etag = format!("\"{revision}-{width}-v1\"");
    // The enclosing authentication middleware runs before even a conditional response.
    if headers
        .get(header::IF_NONE_MATCH)
        .and_then(|v| v.to_str().ok())
        == Some(&etag)
    {
        return Response::builder()
            .status(StatusCode::NOT_MODIFIED)
            .header(header::ETAG, &etag)
            .header(header::CACHE_CONTROL, "private, max-age=60")
            .body(Body::empty())
            .map_err(|_| ApiError(StatusCode::INTERNAL_SERVER_ERROR, "Artwork unavailable"));
    }
    let (bytes, mime) = if width > 0 && mime != "image/avif" {
        let _permit = TRANSFORMS
            .acquire()
            .await
            .map_err(|_| ApiError(StatusCode::SERVICE_UNAVAILABLE, "Artwork busy"))?;
        tokio::task::spawn_blocking({
            let revision = revision.clone();
            move || cached_thumbnail(&revision, &file, width)
        })
        .await
        .map_err(|_| ApiError(StatusCode::SERVICE_UNAVAILABLE, "Artwork unavailable"))??
    } else {
        let bytes = tokio::fs::read(file)
            .await
            .map_err(|_| ApiError(StatusCode::NOT_FOUND, "Artwork unavailable"))?;
        (bytes, mime)
    };
    Response::builder()
        .header(header::ETAG, etag)
        .header("x-artwork-revision", revision)
        .header("x-artwork-widths", "320,640,1280,1920")
        .header(header::CONTENT_TYPE, mime)
        .header(header::CACHE_CONTROL, "private, max-age=3600")
        .header("x-content-type-options", "nosniff")
        .body(Body::from(bytes))
        .map_err(|_| ApiError(StatusCode::INTERNAL_SERVER_ERROR, "Artwork unavailable"))
}

static TRANSFORMS: tokio::sync::Semaphore = tokio::sync::Semaphore::const_new(2);
#[derive(Default, serde::Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct Variant {
    width: Option<u32>,
}
impl Variant {
    fn width(&self) -> ApiResult<u32> {
        match self.width.unwrap_or(0) {
            width @ (0 | 320 | 640 | 1280 | 1920) => Ok(width),
            _ => Err(ApiError(
                StatusCode::BAD_REQUEST,
                "Unsupported artwork width",
            )),
        }
    }
}
fn thumbnail(bytes: &[u8], width: u32) -> ApiResult<(Vec<u8>, String)> {
    use std::io::Cursor;
    let invalid = || {
        ApiError(
            StatusCode::UNPROCESSABLE_ENTITY,
            "Artwork cannot be decoded safely",
        )
    };
    let mut reader = image::ImageReader::new(Cursor::new(bytes))
        .with_guessed_format()
        .map_err(|_| invalid())?;
    let mut limits = image::Limits::default();
    limits.max_image_width = Some(8192);
    limits.max_image_height = Some(8192);
    limits.max_alloc = Some(128 * 1024 * 1024);
    reader.limits(limits);
    let image = reader.decode().map_err(|_| invalid())?;
    let image = image.thumbnail(width.min(image.width()), width.min(image.height()));
    let mut output = Cursor::new(Vec::new());
    image
        .write_to(&mut output, image::ImageFormat::WebP)
        .map_err(|_| invalid())?;
    let output = output.into_inner();
    if output.len() > MAX_ARTWORK_BYTES as usize {
        return Err(invalid());
    }
    Ok((output, "image/webp".into()))
}

fn cached_thumbnail(revision: &str, source: &Path, width: u32) -> ApiResult<(Vec<u8>, String)> {
    use std::{
        io::Write,
        os::unix::fs::{OpenOptionsExt, PermissionsExt},
    };
    let unavailable = || ApiError(StatusCode::SERVICE_UNAVAILABLE, "Artwork cache unavailable");
    if revision.len() != 64 || !revision.bytes().all(|b| b.is_ascii_hexdigit()) {
        return Err(unavailable());
    }
    let root = std::env::var_os("NAHHASIO_ARTWORK_CACHE_ROOT")
        .map(PathBuf::from)
        .unwrap_or_else(|| std::env::temp_dir().join("nahhasio-artwork-thumbnails-v1"));
    if !root.is_absolute() {
        return Err(unavailable());
    }
    std::fs::create_dir_all(&root).map_err(|_| unavailable())?;
    let stat = std::fs::symlink_metadata(&root).map_err(|_| unavailable())?;
    if !stat.is_dir() || stat.file_type().is_symlink() {
        return Err(unavailable());
    }
    std::fs::set_permissions(&root, std::fs::Permissions::from_mode(0o700))
        .map_err(|_| unavailable())?;
    let path = root.join(format!("{revision}-{width}.webp"));
    if let Ok(meta) = std::fs::symlink_metadata(&path) {
        if !meta.is_file() || meta.file_type().is_symlink() || meta.len() > MAX_ARTWORK_BYTES as u64
        {
            return Err(unavailable());
        }
        return Ok((
            std::fs::read(path).map_err(|_| unavailable())?,
            "image/webp".into(),
        ));
    }
    let bytes = std::fs::read(source).map_err(|_| unavailable())?;
    if bytes.len() > MAX_ARTWORK_BYTES as usize {
        return Err(unavailable());
    }
    let result = thumbnail(&bytes, width)?;
    let mut random = [0; 16];
    getrandom::fill(&mut random).map_err(|_| unavailable())?;
    let temp = root.join(format!("{}.tmp", hex::encode(random)));
    let mut file = std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .mode(0o600)
        .open(&temp)
        .map_err(|_| unavailable())?;
    file.write_all(&result.0).map_err(|_| unavailable())?;
    file.sync_all().map_err(|_| unavailable())?;
    std::fs::rename(temp, path).map_err(|_| unavailable())?;
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn variants_are_bounded_and_preserve_transparency_and_aspect() {
        assert!(Variant { width: Some(321) }.width().is_err());
        let original = image::DynamicImage::new_rgba8(1200, 600);
        let mut png = std::io::Cursor::new(Vec::new());
        original
            .write_to(&mut png, image::ImageFormat::Png)
            .unwrap();
        let (bytes, mime) = thumbnail(png.get_ref(), 320).unwrap();
        let decoded = image::load_from_memory(&bytes).unwrap();
        assert_eq!(mime, "image/webp");
        assert_eq!((decoded.width(), decoded.height()), (320, 160));
        assert_eq!(decoded.to_rgba8().get_pixel(0, 0)[3], 0);
        assert!(thumbnail(b"invalid", 320).is_err());
    }
}
