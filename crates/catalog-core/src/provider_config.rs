//! Environment-managed provider credentials with a read-only fallback for existing servers.
use crate::{Result, invalid};
use serde::{Deserialize, Serialize};
use std::{
    fs::{self, File},
    io::Read,
    os::unix::fs::MetadataExt,
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
#[derive(Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct Document {
    #[serde(default = "format_version")]
    version: u8,
    revision: u64,
    tmdb: Option<String>,
    fanart: Option<String>,
    #[serde(rename = "updatedBy")]
    _updated_by: Option<String>,
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
            _updated_by: None,
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
fn environment(provider: Provider) -> Option<String> {
    std::env::var(provider.environment())
        .ok()
        .filter(|value| !value.trim().is_empty())
}

fn key_status(document: &Document, provider: Provider) -> KeyStatus {
    if environment(provider).is_some() {
        return KeyStatus {
            configured: true,
            source: "environment",
        };
    }
    match document.value(provider) {
        Some(key) => KeyStatus {
            configured: !key.is_empty(),
            source: if key.is_empty() { "disabled" } else { "server" },
        },
        None => KeyStatus {
            configured: false,
            source: "environment",
        },
    }
}

pub fn status(root: Option<&Path>) -> Result<Status> {
    let document =
        if environment(Provider::Tmdb).is_some() && environment(Provider::Fanart).is_some() {
            Document::default()
        } else {
            load(root)?
        };
    Ok(Status {
        revision: document.revision,
        editable: false,
        tmdb: key_status(&document, Provider::Tmdb),
        fanart: key_status(&document, Provider::Fanart),
    })
}

pub async fn credential(provider: Provider) -> Result<Option<String>> {
    if let Some(key) = environment(provider) {
        return Ok(Some(key));
    }
    tokio::task::spawn_blocking(move || {
        let document = load(root().as_deref())?;
        Ok(document
            .value(provider)
            .as_ref()
            .filter(|key| !key.is_empty())
            .cloned())
    })
    .await
    .map_err(|_| invalid("Provider configuration unavailable"))?
}
