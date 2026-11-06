//! Native-owned upload paths and resumable offsets; the UI receives only opaque IDs.
use crate::{bridge::Error, media_storage::Roots, private_state, services::Services};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use std::{path::PathBuf, sync::Arc};
use tokio::{
    io::{AsyncReadExt, AsyncSeekExt},
    sync::{Mutex, Semaphore},
};
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Entry {
    id: String,
    scope: String,
    path: PathBuf,
    name: String,
    bytes: u64,
    modified: u64,
    #[serde(default)]
    sha256: Option<String>,
    offset: u64,
    remote_id: Option<String>,
    status: String,
    error: Option<String>,
}
#[derive(Clone)]
pub struct Uploads {
    root: PathBuf,
    services: Services,
    serial: Arc<Mutex<()>>,
    active: Arc<Mutex<std::collections::BTreeSet<String>>>,
    slots: Arc<Semaphore>,
}
impl Uploads {
    pub fn new(services: Services, roots: &Roots) -> Self {
        Self {
            root: roots.state.join("uploads"),
            services,
            serial: Arc::new(Mutex::new(())),
            active: Arc::new(Mutex::new(std::collections::BTreeSet::new())),
            slots: Arc::new(Semaphore::new(2)),
        }
    }
    fn load(&self) -> Result<Vec<Entry>, Error> {
        Ok(
            private_state::read_limit(&self.root, "transfers.json", 1024 * 1024)?
                .unwrap_or_default(),
        )
    }
    async fn update(&self, id: &str, change: impl FnOnce(&mut Entry)) -> Result<(), Error> {
        let _lock = self.serial.lock().await;
        let mut entries = self.load()?;
        let entry = entries.iter_mut().find(|e| e.id == id).ok_or_else(failed)?;
        change(entry);
        private_state::write_limit(&self.root, "transfers.json", &entries, 1024 * 1024)
    }
    pub async fn status(&self) -> Result<Value, Error> {
        let revision = self.services.revision();
        let scope = self.services.catalog_scope().await?;
        let active = self.active.lock().await.clone();
        let _lock = self.serial.lock().await;
        let entries = self.load()?;
        self.services.check_revision(revision)?;
        Ok(json!(entries.into_iter().filter(|entry|entry.scope==scope).map(|entry| {
            let interrupted=matches!(entry.status.as_str(),"queued"|"uploading"|"verifying"|"verifying-server") && !active.contains(&entry.id);
            json!({"id":entry.id,"name":entry.name,"bytes":entry.bytes,"offset":entry.offset,"status":if interrupted{"paused"}else{entry.status.as_str()},"error":entry.error})
        }).collect::<Vec<_>>()))
    }
    pub async fn start(&self, paths: Vec<PathBuf>) -> Result<Value, Error> {
        let scope = self.services.catalog_scope().await?;
        let mut added = Vec::new();
        for path in paths {
            let metadata = tokio::fs::metadata(&path).await.map_err(|_| failed())?;
            let name = path
                .file_name()
                .and_then(|n| n.to_str())
                .ok_or_else(failed)?
                .to_string();
            if !metadata.is_file()
                || metadata.len() == 0
                || !media_transfer::is_video(&name)
                || name.starts_with("._")
            {
                return Err(failed());
            }
            let mut random = [0; 16];
            getrandom::fill(&mut random).map_err(|_| failed())?;
            added.push(Entry {
                id: hex::encode(random),
                scope: scope.clone(),
                path,
                name,
                bytes: metadata.len(),
                modified: metadata
                    .modified()
                    .ok()
                    .and_then(|m| m.duration_since(std::time::UNIX_EPOCH).ok())
                    .map_or(0, |m| m.as_nanos() as u64),
                sha256: None,
                offset: 0,
                remote_id: None,
                status: "queued".into(),
                error: None,
            });
        }
        {
            let _lock = self.serial.lock().await;
            let mut entries = self.load()?;
            if entries.len() + added.len() > 500 {
                return Err(failed());
            }
            entries.extend(added.clone());
            private_state::write_limit(&self.root, "transfers.json", &entries, 1024 * 1024)?;
        }
        for entry in added {
            self.spawn(entry);
        }
        self.status().await
    }
    pub async fn retry(&self, id: &str) -> Result<Value, Error> {
        let scope = self.services.catalog_scope().await?;
        let entry = {
            let _lock = self.serial.lock().await;
            self.load()?
                .into_iter()
                .find(|e| e.id == id && e.scope == scope)
                .ok_or_else(failed)?
        };
        if self.active.lock().await.contains(id) {
            return Err(Error::new("busy", "الرفع قيد التنفيذ."));
        }
        self.spawn(entry);
        self.status().await
    }
    fn spawn(&self, entry: Entry) {
        let owner = self.clone();
        tokio::spawn(async move {
            let id = entry.id.clone();
            if !owner.active.lock().await.insert(id.clone()) {
                return;
            }
            let Ok(_slot) = owner.slots.acquire().await else {
                return;
            };
            if let Err(error) = owner.transfer(entry).await {
                let _ = owner
                    .update(&id, |entry| {
                        entry.status = "failed".into();
                        entry.error = Some(error.message);
                    })
                    .await;
            }
            owner.active.lock().await.remove(&id);
        });
    }
    async fn transfer(&self, mut entry: Entry) -> Result<(), Error> {
        if self.services.catalog_scope().await? != entry.scope {
            return Err(failed());
        }
        let revision = self.services.revision();
        let transport = self.services.snapshot()?;
        let metadata = tokio::fs::metadata(&entry.path)
            .await
            .map_err(|_| failed())?;
        let modified = metadata
            .modified()
            .ok()
            .and_then(|m| m.duration_since(std::time::UNIX_EPOCH).ok())
            .map_or(0, |m| m.as_nanos() as u64);
        if metadata.len() != entry.bytes || modified != entry.modified {
            return Err(Error::new(
                "upload_changed",
                "تغيّر الملف الأصلي. اختره من جديد لبدء رفع مستقل.",
            ));
        }
        self.update(&entry.id, |e| {
            e.status = "verifying".into();
            e.error = None;
        })
        .await?;
        let hash = checksum(&entry.path).await?;
        if entry
            .sha256
            .as_ref()
            .is_some_and(|expected| *expected != hash)
        {
            return Err(Error::new(
                "upload_changed",
                "تغيّرت بايتات الملف الأصلي؛ اختره من جديد لبدء رفع مستقل.",
            ));
        }
        self.services.check_revision(revision)?;
        self.update(&entry.id, |e| e.sha256 = Some(hash.clone()))
            .await?;
        let reply = transport
            .upload_start(
                json!({"name":entry.name,"byteSize":entry.bytes,"idempotencyKey":entry.id,"sha256":hash}),
            )
            .await?;
        let id = reply["id"]
            .as_str()
            .filter(|id| crate::bridge::valid_id(id))
            .ok_or_else(failed)?
            .to_string();
        let mut offset = reply["offset"]
            .as_u64()
            .filter(|n| *n <= entry.bytes)
            .ok_or_else(failed)?;
        entry.remote_id = Some(id.clone());
        self.update(&entry.id, |e| {
            e.remote_id = Some(id.clone());
            e.offset = offset;
            e.status = "uploading".into();
            e.error = None;
        })
        .await?;
        let mut input = tokio::fs::File::open(&entry.path)
            .await
            .map_err(|_| failed())?;
        input
            .seek(std::io::SeekFrom::Start(offset))
            .await
            .map_err(|_| failed())?;
        let mut buffer = vec![0; 8 * 1024 * 1024];
        while offset < entry.bytes {
            self.services.check_revision(revision)?;
            if self.services.catalog_scope().await? != entry.scope {
                return Err(failed());
            }
            let remaining = (entry.bytes - offset).min(buffer.len() as u64) as usize;
            input
                .read_exact(&mut buffer[..remaining])
                .await
                .map_err(|_| failed())?;
            let reply = transport
                .upload_chunk(&id, offset, buffer[..remaining].to_vec())
                .await?;
            let next = reply["offset"]
                .as_u64()
                .filter(|n| *n == offset + remaining as u64)
                .ok_or_else(failed)?;
            offset = next;
            self.update(&entry.id, |e| e.offset = offset).await?;
        }
        self.services.check_revision(revision)?;
        self.update(&entry.id, |entry| entry.status = "verifying-server".into())
            .await?;
        let deadline = tokio::time::Instant::now() + std::time::Duration::from_secs(1800);
        loop {
            self.services.check_revision(revision)?;
            let reply = transport.upload_complete(&id).await?;
            if reply["complete"] == true {
                break;
            }
            if reply["complete"] != false || tokio::time::Instant::now() >= deadline {
                return Err(failed());
            }
            tokio::time::sleep(std::time::Duration::from_secs(1)).await;
        }
        self.services.check_revision(revision)?;
        self.update(&entry.id, |e| {
            e.status = "completed".into();
            e.offset = e.bytes;
        })
        .await
    }
}
async fn checksum(path: &std::path::Path) -> Result<String, Error> {
    let mut input = tokio::fs::File::open(path).await.map_err(|_| failed())?;
    let mut buffer = vec![0; 1024 * 1024];
    let mut hash = Sha256::new();
    loop {
        let n = input.read(&mut buffer).await.map_err(|_| failed())?;
        if n == 0 {
            break;
        }
        hash.update(&buffer[..n]);
    }
    Ok(hex::encode(hash.finalize()))
}
fn failed() -> Error {
    Error::new(
        "upload",
        "تعذّر رفع الملف. تحقق من الاتصال والمساحة ثم أعد المحاولة؛ يبقى الملف الأصلي على جهازك.",
    )
}
