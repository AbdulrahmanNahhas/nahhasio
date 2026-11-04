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
// The installed read-only container has a 64 MiB /tmp. Leave room for concurrent writes.
const THUMBNAIL_CACHE_BUDGET: u64 = 32 * 1024 * 1024;
const THUMBNAIL_REVISION: &str = "v2";

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
    let etag = format!("\"{revision}-{width}-{THUMBNAIL_REVISION}\"");
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
        let cached = tokio::task::spawn_blocking({
            let revision = revision.clone();
            move || read_cached_thumbnail(&thumbnail_cache_root()?, &revision, width)
        })
        .await
        .map_err(|_| ApiError(StatusCode::SERVICE_UNAVAILABLE, "Artwork unavailable"))??;
        if let Some(cached) = cached {
            cached
        } else {
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
        }
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
static CACHE_WRITES: std::sync::Mutex<()> = std::sync::Mutex::new(());
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
    // Variants describe pixel width, including portrait posters; never upscale originals.
    let image = image.thumbnail(width.min(image.width()), image.height());
    let mut output = Cursor::new(Vec::new());
    let transparent =
        image.color().has_alpha() && image.to_rgba8().pixels().any(|pixel| pixel[3] != 255);
    let mime = if transparent {
        image
            .write_to(&mut output, image::ImageFormat::WebP)
            .map_err(|_| invalid())?;
        "image/webp"
    } else {
        image::codecs::jpeg::JpegEncoder::new_with_quality(&mut output, 82)
            .encode_image(&image.to_rgb8())
            .map_err(|_| invalid())?;
        "image/jpeg"
    };
    let output = output.into_inner();
    if output.len() > MAX_ARTWORK_BYTES as usize {
        return Err(invalid());
    }
    Ok((output, mime.into()))
}

fn cache_unavailable() -> ApiError {
    ApiError(StatusCode::SERVICE_UNAVAILABLE, "Artwork cache unavailable")
}

fn thumbnail_cache_root() -> ApiResult<PathBuf> {
    use std::os::unix::fs::PermissionsExt;
    let root = std::env::var_os("NAHHASIO_ARTWORK_CACHE_ROOT")
        .map(PathBuf::from)
        .unwrap_or_else(|| std::env::temp_dir().join("nahhasio-artwork-thumbnails-v2"));
    if !root.is_absolute() {
        return Err(cache_unavailable());
    }
    std::fs::create_dir_all(&root).map_err(|_| cache_unavailable())?;
    let stat = std::fs::symlink_metadata(&root).map_err(|_| cache_unavailable())?;
    if !stat.is_dir() || stat.file_type().is_symlink() {
        return Err(cache_unavailable());
    }
    std::fs::set_permissions(&root, std::fs::Permissions::from_mode(0o700))
        .map_err(|_| cache_unavailable())?;
    Ok(root)
}

fn thumbnail_cache_path(root: &Path, revision: &str, width: u32) -> ApiResult<PathBuf> {
    if revision.len() != 64 || !revision.bytes().all(|b| b.is_ascii_hexdigit()) {
        return Err(cache_unavailable());
    }
    Ok(root.join(format!("{revision}-{width}-{THUMBNAIL_REVISION}.image")))
}

fn read_cached_thumbnail(
    root: &Path,
    revision: &str,
    width: u32,
) -> ApiResult<Option<(Vec<u8>, String)>> {
    let path = thumbnail_cache_path(root, revision, width)?;
    let stat = match std::fs::symlink_metadata(&path) {
        Ok(stat) => stat,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(_) => return Err(cache_unavailable()),
    };
    if !stat.is_file() || stat.file_type().is_symlink() || stat.len() > MAX_ARTWORK_BYTES as u64 {
        return Err(cache_unavailable());
    }
    let bytes = match std::fs::read(&path) {
        Ok(bytes) => bytes,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(_) => return Err(cache_unavailable()),
    };
    let mime = match image::guess_format(&bytes) {
        Ok(image::ImageFormat::Jpeg) => "image/jpeg",
        Ok(image::ImageFormat::WebP) => "image/webp",
        _ => return Err(cache_unavailable()),
    };
    // Only disposable derivatives are touched; originals and retained offline files are separate.
    match std::fs::File::open(path).and_then(|file| {
        file.set_times(std::fs::FileTimes::new().set_modified(std::time::SystemTime::now()))
    }) {
        Ok(()) => {}
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
        Err(_) => return Err(cache_unavailable()),
    }
    Ok(Some((bytes, mime.into())))
}

fn prune_thumbnails(root: &Path, incoming: u64) -> ApiResult<()> {
    let mut total = incoming;
    let mut files = Vec::new();
    for entry in std::fs::read_dir(root).map_err(|_| cache_unavailable())? {
        let entry = entry.map_err(|_| cache_unavailable())?;
        if entry.path().extension().is_none_or(|ext| ext != "image") {
            continue;
        }
        let metadata = match entry.metadata() {
            Ok(metadata) => metadata,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => continue,
            Err(_) => return Err(cache_unavailable()),
        };
        if !entry
            .file_type()
            .map_err(|_| cache_unavailable())?
            .is_file()
        {
            continue;
        }
        total += metadata.len();
        files.push((
            metadata.modified().map_err(|_| cache_unavailable())?,
            entry.path(),
            metadata.len(),
        ));
    }
    files.sort_by_key(|file| file.0);
    for (_, path, size) in files {
        if total <= THUMBNAIL_CACHE_BUDGET {
            break;
        }
        match std::fs::remove_file(path) {
            Ok(()) => total -= size,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => total -= size,
            Err(_) => return Err(cache_unavailable()),
        }
    }
    Ok(())
}

fn cached_thumbnail(revision: &str, source: &Path, width: u32) -> ApiResult<(Vec<u8>, String)> {
    cached_thumbnail_at(&thumbnail_cache_root()?, revision, source, width)
}

fn cached_thumbnail_at(
    root: &Path,
    revision: &str,
    source: &Path,
    width: u32,
) -> ApiResult<(Vec<u8>, String)> {
    use std::{io::Write, os::unix::fs::OpenOptionsExt};
    // Recheck after waiting for the transform permit: a previous request may have generated it.
    if let Some(cached) = read_cached_thumbnail(root, revision, width)? {
        return Ok(cached);
    }
    let bytes = std::fs::read(source).map_err(|_| cache_unavailable())?;
    if bytes.len() > MAX_ARTWORK_BYTES as usize {
        return Err(cache_unavailable());
    }
    let result = thumbnail(&bytes, width)?;
    // Serialize only eviction/publication, so concurrent resizes cannot exceed the cache budget.
    let _write = CACHE_WRITES.lock().map_err(|_| cache_unavailable())?;
    prune_thumbnails(root, result.0.len() as u64)?;
    let path = thumbnail_cache_path(root, revision, width)?;
    let mut random = [0; 16];
    getrandom::fill(&mut random).map_err(|_| cache_unavailable())?;
    let temporary = root.join(format!("{}.tmp", hex::encode(random)));
    let write = || -> std::io::Result<()> {
        let mut file = std::fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .mode(0o600)
            .open(&temporary)?;
        file.write_all(&result.0)?;
        std::fs::rename(&temporary, path)
    };
    if write().is_err() {
        // Caching is disposable: an exhausted cache must not break an already decoded image.
        match std::fs::remove_file(temporary) {
            Ok(()) => {}
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(_) => tracing::warn!("Could not remove temporary artwork cache file"),
        }
        tracing::warn!("Could not cache artwork thumbnail; serving generated bytes");
    }
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
    #[test]
    fn opaque_portraits_use_compressed_jpeg_at_the_requested_width() {
        let original =
            image::DynamicImage::ImageRgb8(image::RgbImage::from_fn(600, 900, |x, y| {
                image::Rgb([(x % 256) as u8, (y % 256) as u8, ((x + y) % 256) as u8])
            }));
        let mut source = std::io::Cursor::new(Vec::new());
        original
            .write_to(&mut source, image::ImageFormat::Png)
            .unwrap();
        let (bytes, mime) = thumbnail(source.get_ref(), 320).unwrap();
        let decoded = image::load_from_memory(&bytes).unwrap();
        assert_eq!(mime, "image/jpeg");
        assert_eq!((decoded.width(), decoded.height()), (320, 480));
        assert!(bytes.len() < source.get_ref().len());
        let (larger, _) = thumbnail(source.get_ref(), 1280).unwrap();
        assert_eq!(image::load_from_memory(&larger).unwrap().width(), 600);
    }

    #[test]
    fn warm_cache_reuses_bytes_and_eviction_preserves_originals() {
        let mut random = [0; 16];
        getrandom::fill(&mut random).unwrap();
        let root =
            std::env::temp_dir().join(format!("nahhasio-thumbnails-test-{}", hex::encode(random)));
        std::fs::create_dir(&root).unwrap();
        let source = root.join("original.png");
        image::DynamicImage::new_rgb8(600, 900)
            .save(&source)
            .unwrap();
        let revision = "a".repeat(64);
        let cold = cached_thumbnail_at(&root, &revision, &source, 320).unwrap();
        // A warm hit must not decode or read the original again.
        let warm = cached_thumbnail_at(&root, &revision, &root.join("absent"), 320).unwrap();
        assert_eq!(cold, warm);
        assert_eq!(cold.1, "image/jpeg");
        assert!(
            read_cached_thumbnail(&root, &revision, 640)
                .unwrap()
                .is_none()
        );
        assert!(thumbnail_cache_path(&root, "../invalid", 320).is_err());
        prune_thumbnails(&root, THUMBNAIL_CACHE_BUDGET).unwrap();
        assert!(
            read_cached_thumbnail(&root, &revision, 320)
                .unwrap()
                .is_none()
        );
        assert!(source.is_file());
        std::fs::remove_dir_all(root).unwrap();
    }
    #[test]
    #[ignore = "read-only local artwork benchmark; requires NAHHASIO_ARTWORK_BENCH_ROOT"]
    fn local_thumbnail_benchmark() {
        use std::time::Instant;
        let root = PathBuf::from(
            std::env::var_os("NAHHASIO_ARTWORK_BENCH_ROOT")
                .expect("explicit private sample directory"),
        );
        assert!(root.is_absolute());
        let cache = root.join("disposable-cache");
        std::fs::create_dir(&cache).unwrap();
        let mut samples: Vec<_> = std::fs::read_dir(&root)
            .unwrap()
            .map(|entry| entry.unwrap().path())
            .filter(|path| path.is_file())
            .collect();
        samples.sort();
        assert!(!samples.is_empty());
        for (index, path) in samples.iter().take(3).enumerate() {
            let source = std::fs::read(path).unwrap();
            assert!(source.len() <= MAX_ARTWORK_BYTES as usize);
            let image = image::load_from_memory(&source).unwrap();
            let mut previous = std::io::Cursor::new(Vec::new());
            image
                .thumbnail(640.min(image.width()), 640.min(image.height()))
                .write_to(&mut previous, image::ImageFormat::WebP)
                .unwrap();
            for width in [320, 640] {
                let revision = format!("{index:064x}");
                let started = Instant::now();
                let result = cached_thumbnail_at(&cache, &revision, path, width).unwrap();
                let cold = started.elapsed();
                let started = Instant::now();
                let warm = read_cached_thumbnail(&cache, &revision, width)
                    .unwrap()
                    .unwrap();
                let warm_time = started.elapsed();
                assert_eq!(result, warm);
                println!(
                    "sample={} variant={} original_bytes={} old_640_bytes={} new_bytes={} cold_ms={:.2} warm_ms={:.2}",
                    index + 1,
                    width,
                    source.len(),
                    previous.get_ref().len(),
                    result.0.len(),
                    cold.as_secs_f64() * 1000.0,
                    warm_time.as_secs_f64() * 1000.0
                );
            }
        }
        std::fs::remove_dir_all(cache).unwrap();
    }
}
