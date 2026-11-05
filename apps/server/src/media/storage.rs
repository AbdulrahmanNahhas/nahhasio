//! Paths originate in server configuration or bounded relative import selections.
use super::{Error, Result};
use axum::http::StatusCode;
use std::path::{Component, Path, PathBuf};

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum SourceRoot {
    #[default]
    Incoming,
    Library,
}
impl SourceRoot {
    pub fn path(self) -> Result<PathBuf> {
        root(match self {
            Self::Incoming => "NAHHASIO_IMPORT_ROOT",
            Self::Library => "NAHHASIO_LIBRARY_ROOT",
        })
    }
    pub fn validate(self, value: &str) -> Result<()> {
        let path = relative(value)?;
        if path
            .components()
            .any(|c| c.as_os_str().to_string_lossy().starts_with('.'))
            || (self == Self::Library
                && !matches!(
                    path.components()
                        .next()
                        .and_then(|c| c.as_os_str().to_str()),
                    Some("series" | "movies")
                ))
        {
            return Err(invalid());
        }
        Ok(())
    }
}

pub(super) fn unavailable() -> Error {
    Error(
        StatusCode::SERVICE_UNAVAILABLE,
        "Media storage is unavailable",
    )
}
pub(super) fn invalid() -> Error {
    Error(StatusCode::BAD_REQUEST, "Invalid media selection")
}
pub(super) fn root(name: &str) -> Result<PathBuf> {
    let value = std::env::var_os(name)
        .map(PathBuf::from)
        .ok_or_else(unavailable)?;
    if !value.is_absolute() {
        return Err(unavailable());
    }
    Ok(value)
}
pub(super) fn relative(value: &str) -> Result<&Path> {
    let path = Path::new(value);
    if value.is_empty()
        || value.len() > 2048
        || value.chars().any(char::is_control)
        || path
            .components()
            .any(|c| !matches!(c, Component::Normal(_)))
    {
        return Err(invalid());
    }
    Ok(path)
}
pub(super) async fn existing(root: &Path, value: &str) -> Result<PathBuf> {
    let relative = relative(value)?;
    let canonical = tokio::fs::canonicalize(root)
        .await
        .map_err(|_| unavailable())?;
    let mut path = canonical.clone();
    for component in relative.components() {
        path.push(component);
        let metadata = tokio::fs::symlink_metadata(&path)
            .await
            .map_err(|_| Error(StatusCode::NOT_FOUND, "Media file is missing"))?;
        if metadata.file_type().is_symlink() {
            return Err(invalid());
        }
    }
    if !path.starts_with(&canonical) {
        return Err(invalid());
    }
    Ok(path)
}
pub(super) async fn directory(root: &Path, value: &str) -> Result<PathBuf> {
    let relative = relative(value)?;
    let mut path = tokio::fs::canonicalize(root)
        .await
        .map_err(|_| unavailable())?;
    for component in relative.components() {
        path.push(component);
        match tokio::fs::create_dir(&path).await {
            Ok(()) => {}
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {}
            Err(_) => return Err(unavailable()),
        }
        let stat = tokio::fs::symlink_metadata(&path)
            .await
            .map_err(|_| unavailable())?;
        if !stat.is_dir() || stat.file_type().is_symlink() {
            return Err(invalid());
        }
    }
    Ok(path)
}
pub(super) fn slug(value: &str) -> String {
    let mut result = String::new();
    for c in value.chars().take(70) {
        if c.is_alphanumeric() {
            result.push(c.to_ascii_lowercase());
        } else if !result.ends_with('-') && !result.is_empty() {
            result.push('-');
        }
    }
    let result = result.trim_matches('-');
    if result.is_empty() {
        "work".into()
    } else {
        result.into()
    }
}
pub(super) async fn readable_folder(parent: &Path, name: &str, id: &str) -> Result<String> {
    uuid(id)?;
    let mut entries = tokio::fs::read_dir(parent)
        .await
        .map_err(|_| unavailable())?;
    let mut found = None;
    while let Some(entry) = entries.next_entry().await.map_err(|_| unavailable())? {
        let name = entry.file_name().to_string_lossy().into_owned();
        if name == id || name.ends_with(&format!("--{id}")) {
            if found.is_some() || !entry.file_type().await.map_err(|_| unavailable())?.is_dir() {
                return Err(invalid());
            }
            found = Some(name);
        }
    }
    Ok(found.unwrap_or_else(|| format!("{}--{id}", slug(name))))
}
pub(super) fn video(value: &str) -> bool {
    let path = Path::new(value);
    !path
        .components()
        .any(|c| c.as_os_str().to_string_lossy().starts_with('.'))
        && path.extension().and_then(|s| s.to_str()).is_some_and(|s| {
            [
                "mkv", "mp4", "webm", "mov", "m4v", "avi", "ts", "m2ts", "mpg", "mpeg", "wmv",
            ]
            .contains(&s.to_ascii_lowercase().as_str())
        })
}
pub(super) fn uuid(value: &str) -> Result<()> {
    if value.len() != 36
        || !value.bytes().enumerate().all(|(i, c)| {
            if [8, 13, 18, 23].contains(&i) {
                c == b'-'
            } else {
                c.is_ascii_hexdigit()
            }
        })
    {
        return Err(invalid());
    }
    Ok(())
}

pub(super) async fn journal(path: &Path, value: &serde_json::Value) -> std::io::Result<()> {
    use tokio::io::AsyncWriteExt;
    let parent = path
        .parent()
        .ok_or_else(|| std::io::Error::other("Invalid journal root"))?;
    let mut nonce = [0; 16];
    getrandom::fill(&mut nonce).map_err(std::io::Error::other)?;
    let temporary = parent.join(format!(".journal-{}.tmp", hex::encode(nonce)));
    let result = async {
        let mut file = tokio::fs::OpenOptions::new()
            .create_new(true)
            .write(true)
            .mode(0o600)
            .open(&temporary)
            .await?;
        file.write_all(&serde_json::to_vec(value)?).await?;
        file.sync_all().await?;
        tokio::fs::rename(&temporary, path).await?;
        tokio::fs::File::open(parent).await?.sync_all().await
    }
    .await;
    if result.is_err() {
        let _ = tokio::fs::remove_file(temporary).await;
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn paths_and_companions_are_rejected() {
        for path in ["", "../file.mp4", "/file.mp4", "a/../../file", "a\n.mp4"] {
            assert!(relative(path).is_err());
        }
        assert!(relative("series/Season 01/video.mkv").is_ok());
        assert!(!video("series/._episode.mkv"));
        assert!(!video(".hidden/video.mp4"));
        assert!(video("series/E001.MKV"));
        assert_eq!(slug("Spy × Family / 2022"), "spy-family-2022");
        assert_eq!(slug("عائلة الأستاذ شلش"), "عائلة-الأستاذ-شلش");
    }
    #[tokio::test]
    async fn symlink_escape_is_rejected() {
        let base = std::env::temp_dir().join(format!("nahhasio-media-path-{}", std::process::id()));
        std::fs::create_dir_all(&base).unwrap();
        std::os::unix::fs::symlink(std::env::temp_dir(), base.join("escape")).unwrap();
        assert!(existing(&base, "escape/file.mp4").await.is_err());
        assert!(directory(&base, "escape/unwanted-directory").await.is_err());
        std::fs::remove_dir_all(base).unwrap();
    }
}
