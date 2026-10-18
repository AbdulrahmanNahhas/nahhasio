//! Serve our packaged UI without granting WebKit access to the surrounding filesystem.
use gtk::{gio, glib};
use std::{
    fs::File,
    io::Read,
    path::{Path, PathBuf},
};

pub const ENTRY: &str = "nahhasio://app/";
const LIMIT: u64 = 8 * 1024 * 1024;
fn locate(root: &Path, uri: &str) -> Result<(PathBuf, &'static str), String> {
    let uri = url::Url::parse(uri).map_err(|_| "Invalid asset URI")?;
    if uri.scheme() != "nahhasio"
        || uri.host_str() != Some("app")
        || !uri.username().is_empty()
        || uri.password().is_some()
        || uri.port().is_some()
        || uri.query().is_some()
        || uri.path().contains('%')
    {
        return Err("Invalid packaged asset address".into());
    }
    let relative = if uri.path() == "/" {
        "index.html"
    } else {
        uri.path().strip_prefix('/').ok_or("Invalid asset path")?
    };
    if relative
        .split('/')
        .any(|part| part.is_empty() || part == "." || part == "..")
    {
        return Err("Invalid asset path".into());
    }
    let file = root
        .join(relative)
        .canonicalize()
        .map_err(|_| "Packaged asset not found")?;
    if !file.starts_with(root) || !file.is_file() {
        return Err("Asset is outside the packaged UI".into());
    }
    let mime = match file.extension().and_then(|extension| extension.to_str()) {
        Some("html") => "text/html; charset=utf-8",
        Some("js") => "text/javascript; charset=utf-8",
        Some("css") => "text/css; charset=utf-8",
        Some("woff2") => "font/woff2",
        Some("woff") => "font/woff",
        Some("ttf") => "font/ttf",
        Some("png") => "image/png",
        Some("jpg" | "jpeg") => "image/jpeg",
        Some("webp") => "image/webp",
        Some("svg") => "image/svg+xml",
        Some("ico") => "image/x-icon",
        _ => return Err("Unsupported packaged asset".into()),
    };
    Ok((file, mime))
}
pub fn install(context: &webkit6::WebContext, root: PathBuf) {
    if let Some(security) = context.security_manager() {
        security.register_uri_scheme_as_secure("nahhasio");
        security.register_uri_scheme_as_cors_enabled("nahhasio");
        security.register_uri_scheme_as_display_isolated("nahhasio");
    }
    context.register_uri_scheme("nahhasio", move |request| {
        let result = (|| {
            let uri = request.uri().ok_or("Missing asset URI")?;
            let (path, mime) = locate(&root, &uri)?;
            let file = File::open(path).map_err(|_| "Cannot open packaged asset")?;
            if file
                .metadata()
                .map_err(|_| "Cannot inspect packaged asset")?
                .len()
                > LIMIT
            {
                return Err("Packaged asset exceeds the size limit".to_owned());
            }
            let mut bytes = Vec::new();
            file.take(LIMIT + 1)
                .read_to_end(&mut bytes)
                .map_err(|_| "Cannot read packaged asset")?;
            if bytes.len() as u64 > LIMIT {
                return Err("Packaged asset exceeds the size limit".to_owned());
            }
            // Authorize only trusted editor style modules, with a fresh nonce for each HTML load.
            // Script/origin restrictions remain unchanged; no unsafe-inline policy is added.
            if mime.starts_with("text/html") {
                let mut random = [0u8; 32];
                getrandom::fill(&mut random).map_err(|_| "Cannot initialize editor style nonce")?;
                let html = String::from_utf8(bytes).map_err(|_| "Invalid packaged HTML")?;
                bytes = html
                    .replace("NAHHASIO_STYLE_NONCE", &hex::encode(random))
                    .into_bytes();
            }
            let length = bytes.len() as i64;
            let stream = gio::MemoryInputStream::from_bytes(&glib::Bytes::from_owned(bytes));
            request.finish(&stream, length, Some(mime));
            Ok::<_, String>(())
        })();
        if let Err(message) = result {
            request.finish_error(&mut glib::Error::new(gio::IOErrorEnum::NotFound, &message));
        }
    });
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn packaged_assets_cannot_read_neighbor_files_or_symlinks() {
        let path = std::env::temp_dir().join(format!("nahhasio-asset-test-{}", std::process::id()));
        std::fs::create_dir_all(path.join("ui")).expect("test root");
        std::fs::write(path.join("ui/index.html"), "<html></html>").expect("entry");
        std::fs::write(path.join("outside.html"), "private").expect("neighbor");
        std::os::unix::fs::symlink(path.join("outside.html"), path.join("ui/escape.html"))
            .expect("test symlink");
        let root = path.join("ui").canonicalize().expect("canonical root");
        assert!(locate(&root, ENTRY).is_ok());
        // Refresh retains the local route fragment; it is not part of the asset path.
        assert!(locate(&root, "nahhasio://app/#/browse?group=planet").is_ok());
        assert!(locate(&root, "nahhasio://app/?path=outside.html").is_err());
        assert!(locate(&root, "nahhasio://app/escape.html").is_err());
        assert!(locate(&root, "nahhasio://other/index.html").is_err());
        assert!(locate(&root, "nahhasio://app/%2e%2e/outside.html").is_err());
        assert!(locate(&root, "file:///etc/passwd").is_err());
        std::fs::remove_dir_all(path).expect("test cleanup");
    }
}
