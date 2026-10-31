//! Disposable artwork bytes, isolated from retained offline artwork and video files.
use crate::{bridge::Error, private_state};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    io::Write,
    os::unix::fs::{OpenOptionsExt, PermissionsExt},
    path::{Path, PathBuf},
};
use tokio::sync::Mutex;
const BUDGET: u64 = 512 * 1024 * 1024;
const LIMIT: usize = 10 * 1024 * 1024;
#[derive(Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Metadata {
    pub etag: String,
    pub mime: String,
    pub revision: String,
    #[serde(default)]
    pub verified_at: u64,
}
pub struct Cached {
    pub metadata: Metadata,
    pub bytes: Vec<u8>,
}
#[derive(Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Metrics {
    pub requests: u64,
    pub cache_hits: u64,
    pub network_bytes: u64,
    pub queue_micros: u64,
    pub response_micros: u64,
}
pub struct Cache {
    root: PathBuf,
    lock: Mutex<()>,
    flights: Mutex<std::collections::BTreeMap<String, std::sync::Weak<Mutex<()>>>>,
    pub metrics: Mutex<Metrics>,
}
fn error() -> Error {
    Error::new("artwork_cache", "تعذّر قراءة ذاكرة الصور المؤقتة أو حفظها.")
}
fn digest(input: &str) -> String {
    hex::encode(Sha256::digest(input.as_bytes()))
}
fn blob(key: &str, meta: &Metadata) -> String {
    format!("{key}-{}.bin", digest(&meta.etag))
}
impl Cache {
    pub fn new(root: &Path) -> Self {
        Self {
            root: root.join("artwork-cache-v1"),
            lock: Mutex::new(()),
            flights: Mutex::new(std::collections::BTreeMap::new()),
            metrics: Mutex::new(Metrics::default()),
        }
    }
    pub async fn flight(&self, key: &str) -> tokio::sync::OwnedMutexGuard<()> {
        let lock = {
            let mut flights = self.flights.lock().await;
            flights.retain(|_, lock| lock.strong_count() > 0);
            if let Some(lock) = flights.get(key).and_then(std::sync::Weak::upgrade) {
                lock
            } else {
                let lock = std::sync::Arc::new(Mutex::new(()));
                flights.insert(key.into(), std::sync::Arc::downgrade(&lock));
                lock
            }
        };
        lock.lock_owned().await
    }
    pub fn key(scope: &str, id: &str, width: u32) -> String {
        digest(&format!("{scope}:{id}:{width}"))
    }
    fn prepare(&self) -> Result<(), Error> {
        std::fs::create_dir_all(&self.root).map_err(|_| error())?;
        if std::fs::symlink_metadata(&self.root)
            .map_err(|_| error())?
            .file_type()
            .is_symlink()
        {
            return Err(error());
        }
        std::fs::set_permissions(&self.root, std::fs::Permissions::from_mode(0o700))
            .map_err(|_| error())
    }
    pub async fn read(&self, key: &str) -> Result<Option<Cached>, Error> {
        let _lock = self.lock.lock().await;
        let Some(meta) = private_state::read::<Metadata>(&self.root, &format!("{key}.json"))?
        else {
            return Ok(None);
        };
        let file = self.root.join(blob(key, &meta));
        let Ok(stat) = std::fs::symlink_metadata(&file) else {
            return Ok(None);
        };
        if !stat.is_file() || stat.file_type().is_symlink() || stat.len() > LIMIT as u64 {
            return Err(error());
        }
        let bytes = std::fs::read(file).map_err(|_| error())?;
        Ok(Some(Cached {
            metadata: meta,
            bytes,
        }))
    }
    pub async fn save(&self, key: &str, meta: Metadata, bytes: &[u8]) -> Result<(), Error> {
        if bytes.len() > LIMIT {
            return Err(error());
        }
        let _lock = self.lock.lock().await;
        self.prepare()?;
        let name = blob(key, &meta);
        let file = self.root.join(&name);
        if !file.exists() {
            let mut random = [0; 16];
            getrandom::fill(&mut random).map_err(|_| error())?;
            let temporary = self.root.join(format!("{}.tmp", hex::encode(random)));
            let mut output = std::fs::OpenOptions::new()
                .write(true)
                .create_new(true)
                .mode(0o600)
                .open(&temporary)
                .map_err(|_| error())?;
            output.write_all(bytes).map_err(|_| error())?;
            output.sync_all().map_err(|_| error())?;
            std::fs::rename(temporary, file).map_err(|_| error())?;
        }
        private_state::write(&self.root, &format!("{key}.json"), &meta)?;
        self.prune(BUDGET)?;
        Ok(())
    }
    pub async fn touch(&self, key: &str, meta: &Metadata) -> Result<(), Error> {
        let _lock = self.lock.lock().await;
        // Metadata mtime records access without rewriting large image bytes.
        private_state::write(&self.root, &format!("{key}.json"), meta)
    }
    fn prune(&self, budget: u64) -> Result<(), Error> {
        let mut files = Vec::new();
        let mut total = 0;
        for entry in std::fs::read_dir(&self.root).map_err(|_| error())? {
            let entry = entry.map_err(|_| error())?;
            let meta = entry.metadata().map_err(|_| error())?;
            if entry.file_type().map_err(|_| error())?.is_file()
                && entry.path().extension().is_some_and(|e| e == "bin")
            {
                let name = entry.file_name().to_string_lossy().into_owned();
                let key = name.split('-').next().unwrap_or("");
                let touched = std::fs::metadata(self.root.join(format!("{key}.json")))
                    .and_then(|m| m.modified())
                    .or_else(|_| meta.modified())
                    .map_err(|_| error())?;
                total += meta.len();
                files.push((touched, entry.path(), meta.len()));
            }
        }
        files.sort_by_key(|f| f.0);
        for (_, file, size) in files {
            if total <= budget {
                break;
            }
            let name = file
                .file_name()
                .and_then(|n| n.to_str())
                .ok_or_else(error)?;
            let key = name.split('-').next().ok_or_else(error)?;
            let meta_name = format!("{key}.json");
            if let Some(meta) = private_state::read::<Metadata>(&self.root, &meta_name)?
                && blob(key, &meta) == name
            {
                private_state::remove(&self.root, &meta_name)?;
            }
            std::fs::remove_file(file).map_err(|_| error())?;
            total -= size;
        }
        Ok(())
    }
    pub async fn status(&self) -> Result<serde_json::Value, Error> {
        let _lock = self.lock.lock().await;
        self.prepare()?;
        let mut bytes = 0;
        for entry in std::fs::read_dir(&self.root).map_err(|_| error())? {
            let e = entry.map_err(|_| error())?;
            if e.file_type().map_err(|_| error())?.is_file() {
                bytes += e.metadata().map_err(|_| error())?.len();
            }
        }
        Ok(
            serde_json::json!({"bytes":bytes,"budgetBytes":BUDGET,"metrics":*self.metrics.lock().await}),
        )
    }
    pub async fn clear(&self) -> Result<(), Error> {
        let _lock = self.lock.lock().await;
        self.prepare()?;
        self.prune(0)?;
        for entry in std::fs::read_dir(&self.root).map_err(|_| error())? {
            let entry = entry.map_err(|_| error())?;
            if entry.file_type().map_err(|_| error())?.is_file()
                && entry.path().extension().is_some_and(|e| e == "json")
            {
                std::fs::remove_file(entry.path()).map_err(|_| error())?;
            }
        }
        Ok(())
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[tokio::test]
    async fn cache_scope_revision_and_eviction_do_not_touch_saved_files() {
        let root = std::env::temp_dir().join(format!("nahhasio-cache-{}", std::process::id()));
        std::fs::create_dir_all(&root).unwrap();
        std::fs::write(root.join("retained-video"), b"keep").unwrap();
        let c = Cache::new(&root);
        let key = Cache::key("server:a/account:a", "asset", 320);
        assert_ne!(key, Cache::key("server:a/account:b", "asset", 320));
        let meta = Metadata {
            etag: "rev1".into(),
            mime: "image/webp".into(),
            revision: "rev1".into(),
            verified_at: 0,
        };
        c.save(&key, meta, b"image").await.unwrap();
        assert_eq!(c.read(&key).await.unwrap().unwrap().bytes, b"image");
        c.clear().await.unwrap();
        assert!(c.read(&key).await.unwrap().is_none());
        assert!(root.join("retained-video").exists());
        std::fs::remove_dir_all(root).unwrap();
    }
}
