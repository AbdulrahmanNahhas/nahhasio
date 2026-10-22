//! Server-owned, write-only provider credentials. No secrets in API status or diagnostics.
use crate::{Result, invalid};
use serde::{Deserialize, Serialize};
use std::{
    fs::{self, File, OpenOptions},
    io::{Read, Write},
    os::unix::fs::{DirBuilderExt, MetadataExt, OpenOptionsExt},
    path::{Path, PathBuf},
};

#[derive(Clone, Copy, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Provider {
    Tmdb,
    Fanart,
}
impl Provider {
    fn environment(self) -> &'static str {
        match self {
            Self::Tmdb => "TMDB_API_READ_ACCESS_KEY",
            Self::Fanart => "FANART_API_KEY",
        }
    }
}
#[derive(Deserialize, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct Document {
    #[serde(default = "format_version")]
    version: u8,
    revision: u64,
    tmdb: Option<String>,
    fanart: Option<String>,
    updated_by: Option<String>,
}
fn format_version() -> u8 {
    1
}
impl Default for Document {
    fn default() -> Self {
        Self {
            version: format_version(),
            revision: 0,
            tmdb: None,
            fanart: None,
            updated_by: None,
        }
    }
}
impl Document {
    fn value(&self, provider: Provider) -> &Option<String> {
        match provider {
            Provider::Tmdb => &self.tmdb,
            Provider::Fanart => &self.fanart,
        }
    }
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Status {
    pub revision: u64,
    pub editable: bool,
    pub tmdb: KeyStatus,
    pub fanart: KeyStatus,
}
#[derive(Serialize)]
pub struct KeyStatus {
    pub configured: bool,
    pub source: &'static str,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct Update {
    pub expected_revision: u64,
    pub provider: Provider,
    pub action: Action,
    pub key: Option<String>,
}
#[derive(Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Action {
    Set,
    Disable,
    Environment,
}

pub fn root() -> Option<PathBuf> {
    std::env::var_os("NAHHASIO_CONFIG_ROOT").map(PathBuf::from)
}
fn private(metadata: &fs::Metadata, directory: bool) -> Result<()> {
    if metadata.mode() & 0o077 != 0
        || (directory && !metadata.is_dir())
        || (!directory && !metadata.is_file())
    {
        return Err(invalid(
            "Provider configuration must be private to the server user",
        ));
    }
    Ok(())
}
fn directory(root: &Path) -> Result<()> {
    if !root.is_absolute() {
        return Err(invalid("NAHHASIO_CONFIG_ROOT must be absolute"));
    }
    match fs::symlink_metadata(root) {
        Ok(info) => private(&info, true),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(error.into()),
    }
}
fn load(root: Option<&Path>) -> Result<Document> {
    let Some(root) = root else {
        return Ok(Document::default());
    };
    directory(root)?;
    let path = root.join("providers.json");
    match fs::symlink_metadata(&path) {
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return Ok(Document::default());
        }
        Err(error) => return Err(error.into()),
        Ok(info) => {
            private(&info, false)?;
            if info.len() > 16384 {
                return Err(invalid("Provider configuration is too large"));
            }
        }
    }
    let mut body = Vec::new();
    File::open(path)?.take(16385).read_to_end(&mut body)?;
    if body.len() > 16384 {
        return Err(invalid("Provider configuration is too large"));
    }
    let document: Document = serde_json::from_slice(&body)?;
    if document.version != format_version() {
        return Err(invalid("Unsupported provider configuration version"));
    }
    Ok(document)
}
fn key_status(document: &Document, provider: Provider) -> KeyStatus {
    match document.value(provider) {
        Some(key) => KeyStatus {
            configured: !key.is_empty(),
            source: if key.is_empty() { "disabled" } else { "server" },
        },
        None => KeyStatus {
            configured: environment(provider).is_some(),
            source: "environment",
        },
    }
}
fn environment(provider: Provider) -> Option<String> {
    std::env::var(provider.environment())
        .ok()
        .filter(|value| !value.trim().is_empty())
}
fn status_document(document: &Document, editable: bool) -> Status {
    Status {
        revision: document.revision,
        editable,
        tmdb: key_status(document, Provider::Tmdb),
        fanart: key_status(document, Provider::Fanart),
    }
}
pub fn status(root: Option<&Path>) -> Result<Status> {
    Ok(status_document(&load(root)?, root.is_some()))
}
pub async fn credential(provider: Provider) -> Result<Option<String>> {
    tokio::task::spawn_blocking(move || {
        let document = load(root().as_deref())?;
        Ok(match document.value(provider) {
            Some(key) => (!key.is_empty()).then(|| key.clone()),
            None => environment(provider),
        })
    })
    .await
    .map_err(|_| invalid("Provider configuration unavailable"))?
}
/// Caller must hold a revalidated admin session lock until this operation completes.
/// Atomic replacement is the commit boundary; updated_by and revision are stored with the keys.
pub fn update(root: &Path, update: Update, actor: &str) -> Result<Status> {
    let value = match update.action {
        Action::Set => Some(
            update
                .key
                .filter(|key| {
                    (8..=4096).contains(&key.len()) && key.bytes().all(|c| c.is_ascii_graphic())
                })
                .ok_or_else(|| invalid("Invalid provider credential"))?,
        ),
        Action::Disable | Action::Environment if update.key.is_none() => match update.action {
            Action::Disable => Some(String::new()),
            _ => None,
        },
        _ => return Err(invalid("Only replacement accepts a credential")),
    };
    directory(root)?;
    if !root.exists() {
        fs::DirBuilder::new().mode(0o700).create(root)?;
    }
    let lock_path = root.join("providers.lock");
    if let Ok(info) = fs::symlink_metadata(&lock_path) {
        private(&info, false)?;
    }
    let lock = OpenOptions::new()
        .create(true)
        .truncate(false)
        .read(true)
        .write(true)
        .mode(0o600)
        .open(lock_path)?;
    lock.try_lock()
        .map_err(|_| crate::Error::Conflict("Provider settings are being updated".into()))?;
    let mut document = load(Some(root))?;
    if update.expected_revision != document.revision {
        return Err(crate::Error::Conflict(
            "Provider settings changed; reload before saving".into(),
        ));
    }
    match update.provider {
        Provider::Tmdb => document.tmdb = value,
        Provider::Fanart => document.fanart = value,
    }
    document.revision = document
        .revision
        .checked_add(1)
        .ok_or_else(|| invalid("Provider revision exhausted"))?;
    document.updated_by = Some(actor.to_owned());
    let mut file = tempfile::NamedTempFile::new_in(root)?;
    file.write_all(&serde_json::to_vec(&document)?)?;
    file.as_file().sync_all()?;
    file.persist(root.join("providers.json"))
        .map_err(|error| crate::Error::Io(error.error))?;
    File::open(root)?.sync_all()?;
    Ok(status_document(&document, true))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn private_atomic_keys_reject_stale_writes_and_never_return_values() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().join("private");
        let change = || Update {
            expected_revision: 0,
            provider: Provider::Tmdb,
            action: Action::Set,
            key: Some("fixture-private-key".into()),
        };
        let status = update(&root, change(), "fixture-admin").unwrap();
        let json = serde_json::to_string(&status).unwrap();
        assert!(!json.contains("fixture-private-key"));
        assert!(status.tmdb.configured);
        assert_eq!(
            fs::metadata(root.join("providers.json")).unwrap().mode() & 0o777,
            0o600
        );
        assert!(matches!(
            update(&root, change(), "fixture-admin"),
            Err(crate::Error::Conflict(_))
        ));
        let disabled = update(
            &root,
            Update {
                expected_revision: 1,
                provider: Provider::Tmdb,
                action: Action::Disable,
                key: None,
            },
            "fixture-admin",
        )
        .unwrap();
        assert!(!disabled.tmdb.configured);
        assert_eq!(disabled.tmdb.source, "disabled");
        // A future artifact must not silently reinterpret or overwrite a newer private format.
        let next = root.join("providers.json");
        let original = fs::read(&next).unwrap();
        let mut newer: serde_json::Value = serde_json::from_slice(&original).unwrap();
        newer["version"] = serde_json::json!(99);
        fs::write(&next, serde_json::to_vec(&newer).unwrap()).unwrap();
        assert!(update(&root, change(), "fixture-admin").is_err());
        assert_eq!(
            fs::read(&next).unwrap(),
            serde_json::to_vec(&newer).unwrap()
        );
        fs::write(&next, original).unwrap();
        let outside = dir.path().join("outside");
        fs::write(&outside, "unchanged").unwrap();
        fs::remove_file(root.join("providers.json")).unwrap();
        std::os::unix::fs::symlink(&outside, root.join("providers.json")).unwrap();
        assert!(load(Some(&root)).is_err());
        assert_eq!(fs::read_to_string(outside).unwrap(), "unchanged");
    }
}
