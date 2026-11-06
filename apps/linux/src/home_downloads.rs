//! Device-owned original-file downloads; durable journals never contain server credentials.
use crate::{
    bridge::Error,
    media::{ResolvedTarget, Target},
    media_storage::Roots,
    private_state,
    services::Services,
};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use std::{collections::BTreeSet, path::PathBuf, sync::Arc};
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    sync::{Mutex, Semaphore},
};
use tokio_stream::StreamExt;
const JOURNAL_LIMIT: usize = 4 * 1024 * 1024;
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Entry {
    id: String,
    scope: String,
    target: Target,
    title: String,
    work_title: String,
    poster_id: Option<String>,
    path: PathBuf,
    size: u64,
    sha256: String,
    #[serde(default)]
    subtitles: Vec<crate::home_gateway::Subtitle>,
    offset: u64,
    state: String,
    error: Option<String>,
}
#[derive(Clone)]
pub struct Downloads {
    root: PathBuf,
    videos: PathBuf,
    services: Services,
    serial: Arc<Mutex<()>>,
    active: Arc<Mutex<BTreeSet<String>>>,
    paused: Arc<Mutex<BTreeSet<String>>>,
    slots: Arc<Semaphore>,
    wake: Arc<tokio::sync::Notify>,
}
fn failed() -> Error {
    Error::new(
        "home_download",
        "تعذّر تنزيل الفيديو من مكتبة المنزل. تحقق من الاتصال والملف ثم أعد المحاولة.",
    )
}
impl Downloads {
    pub fn new(services: Services, roots: &Roots) -> Self {
        Self {
            root: roots.state.join("home-downloads"),
            videos: roots.videos.clone(),
            services,
            serial: Arc::new(Mutex::new(())),
            active: Arc::new(Mutex::new(BTreeSet::new())),
            paused: Arc::new(Mutex::new(BTreeSet::new())),
            slots: Arc::new(Semaphore::new(2)),
            wake: Arc::new(tokio::sync::Notify::new()),
        }
    }
    fn load(&self) -> Result<Vec<Entry>, Error> {
        let entries: Vec<Entry> =
            private_state::read_limit(&self.root, "files.json", JOURNAL_LIMIT)?.unwrap_or_default();
        for entry in &entries {
            let relative = entry
                .path
                .strip_prefix(&self.videos)
                .map_err(|_| failed())?;
            if !crate::bridge::valid_id(&entry.id)
                || !entry.path.starts_with(self.scope_directory(&entry.scope))
                || relative
                    .components()
                    .any(|part| !matches!(part, std::path::Component::Normal(_)))
            {
                return Err(failed());
            }
            let mut cursor = self.videos.clone();
            for part in relative.components() {
                cursor.push(part);
                if std::fs::symlink_metadata(&cursor).is_ok_and(|m| m.file_type().is_symlink()) {
                    return Err(failed());
                }
            }
        }
        Ok(entries)
    }
    async fn update(&self, id: &str, scope: &str, f: impl FnOnce(&mut Entry)) -> Result<(), Error> {
        let _guard = self.serial.lock().await;
        let mut entries = self.load()?;
        let entry = entries
            .iter_mut()
            .find(|e| e.id == id && e.scope == scope)
            .ok_or_else(failed)?;
        f(entry);
        private_state::write_limit(&self.root, "files.json", &entries, JOURNAL_LIMIT)
    }
    async fn entry(&self, id: &str) -> Result<Entry, Error> {
        let scope = self.services.catalog_scope().await?;
        self.load()?
            .into_iter()
            .find(|e| e.id == id && e.scope == scope)
            .ok_or_else(failed)
    }
    pub async fn start(
        &self,
        id: String,
        resolved: ResolvedTarget,
        size: u64,
        sha256: String,
        extension: String,
        subtitles: Vec<crate::home_gateway::Subtitle>,
    ) -> Result<Value, Error> {
        let scope = self.services.catalog_scope().await?;
        if subtitles.len() > 16 {
            return Err(failed());
        }
        for subtitle in &subtitles {
            subtitle.extension()?;
        }
        if size == 0
            || sha256.len() != 64
            || !sha256.bytes().all(|c| c.is_ascii_hexdigit())
            || !media_transfer::is_video(&format!("video.{extension}"))
        {
            return Err(failed());
        }
        let directory = self.scope_directory(&scope).join(format!(
            "{}--{}",
            media_transfer::work_directory(&resolved.work_title),
            resolved.work_id
        ));
        let path = directory.join(format!(
            "{}--{id}.{extension}",
            resolved
                .episode_id
                .as_deref()
                .unwrap_or(&resolved.installment_id)
        ));
        let entry = Entry {
            id: id.clone(),
            scope: scope.clone(),
            target: Target {
                work_id: resolved.work_id,
                installment_id: Some(resolved.installment_id),
                episode_id: resolved.episode_id,
            },
            title: resolved.title,
            work_title: resolved.work_title,
            poster_id: resolved.poster_id,
            path,
            size,
            sha256,
            subtitles,
            offset: 0,
            state: "paused".into(),
            error: None,
        };
        {
            let _guard = self.serial.lock().await;
            let mut entries = self.load()?;
            if let Some(previous) = entries.iter().find(|e| e.id == id && e.scope == scope) {
                if previous.sha256 != entry.sha256
                    || previous.size != entry.size
                    || previous.subtitles != entry.subtitles
                {
                    return Err(Error::new(
                        "changed_media",
                        "تغيّر فيديو الخادم؛ احذف سجل التنزيل القديم قبل بدء نسخة جديدة.",
                    ));
                }
            } else {
                entries.push(entry.clone());
                private_state::write_limit(&self.root, "files.json", &entries, JOURNAL_LIMIT)?;
            }
        }
        let entry = self.entry(&id).await?;
        self.paused
            .lock()
            .await
            .remove(&format!("{}:{}", entry.scope, entry.id));
        self.spawn(entry).await;
        Ok(json!({"ok":true}))
    }
    async fn spawn(&self, entry: Entry) {
        let owner = self.clone();
        let key = format!("{}:{}", entry.scope, entry.id);
        if !owner.active.lock().await.insert(key.clone()) {
            return;
        }
        tokio::spawn(async move {
            let Ok(_slot) = owner.slots.acquire().await else {
                owner.active.lock().await.remove(&key);
                return;
            };
            let id = entry.id.clone();
            let scope = entry.scope.clone();
            if let Err(error) = owner.transfer(entry).await {
                let _ = owner
                    .update(&id, &scope, |e| {
                        e.state = "failed".into();
                        e.error = Some(error.message);
                    })
                    .await;
            }
            owner.active.lock().await.remove(&key);
        });
    }
    fn scope_directory(&self, scope: &str) -> PathBuf {
        self.videos.join(format!(
            "home--{}",
            hex::encode(Sha256::digest(scope.as_bytes()))
        ))
    }
    async fn transfer(&self, entry: Entry) -> Result<(), Error> {
        let revision = self.services.revision();
        if self.services.catalog_scope().await? != entry.scope {
            return Err(failed());
        }
        if self
            .paused
            .lock()
            .await
            .contains(&format!("{}:{}", entry.scope, entry.id))
        {
            return Ok(());
        }
        if entry.path.is_file()
            && tokio::fs::metadata(&entry.path)
                .await
                .map_err(|_| failed())?
                .len()
                == entry.size
        {
            verify_video(&entry.path, entry.size, &entry.sha256).await?;
            if !self.transfer_subtitles(&entry, revision).await? {
                return Ok(());
            }
            return self
                .update(&entry.id, &entry.scope, |e| {
                    e.offset = e.size;
                    e.state = "complete".into();
                    e.error = None;
                })
                .await;
        }
        let parent = entry.path.parent().ok_or_else(failed)?;
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|_| failed())?;
        if tokio::fs::symlink_metadata(parent)
            .await
            .map_err(|_| failed())?
            .file_type()
            .is_symlink()
        {
            return Err(failed());
        }
        let partial = entry.path.with_extension("partial");
        if tokio::fs::symlink_metadata(&partial)
            .await
            .is_ok_and(|m| m.file_type().is_symlink())
        {
            return Err(failed());
        }
        let mut file = tokio::fs::OpenOptions::new()
            .create(true)
            .truncate(false)
            .append(true)
            .open(&partial)
            .await
            .map_err(|_| failed())?;
        let mut offset = file.metadata().await.map_err(|_| failed())?.len();
        if offset > entry.size {
            return Err(failed());
        }
        self.update(&entry.id, &entry.scope, |e| {
            e.offset = offset;
            e.state = "downloading".into();
            e.error = None;
        })
        .await?;
        if offset < entry.size {
            let disk = rustix::fs::statvfs(parent).map_err(|_| failed())?;
            if disk.f_bavail.saturating_mul(disk.f_frsize) < entry.size - offset + 256 * 1024 * 1024
            {
                return Err(Error::new(
                    "device_full",
                    "لا توجد مساحة كافية لتنزيل الفيديو؛ حرّر مساحة من مكتبة الجهاز.",
                ));
            }
            let transport = self.services.snapshot()?;
            let range = format!("bytes={offset}-");
            let mut cancellation = self.services.cancellation();
            let response = tokio::select! {
                response=transport.media_response(&entry.id,reqwest::Method::GET,Some(&range))=>response?,
                _=cancellation.changed()=>return Err(Error::new("connection_changed","تغيّر الحساب أو الخادم؛ استأنف التنزيل من حسابه.")),
            };
            if response.status() != reqwest::StatusCode::PARTIAL_CONTENT
                || response
                    .headers()
                    .get(reqwest::header::CONTENT_RANGE)
                    .and_then(|v| v.to_str().ok())
                    != Some(format!("bytes {offset}-{}/{}", entry.size - 1, entry.size).as_str())
            {
                return Err(failed());
            }
            let mut stream = response.bytes_stream();
            let mut checkpoint = std::time::Instant::now();
            loop {
                let notification = self.wake.notified();
                tokio::pin!(notification);
                notification.as_mut().enable();
                self.services.check_revision(revision)?;
                let key = format!("{}:{}", entry.scope, entry.id);
                if self.paused.lock().await.contains(&key) {
                    file.sync_all().await.map_err(|_| failed())?;
                    self.update(&entry.id, &entry.scope, |e| {
                        e.offset = offset;
                        e.state = "paused".into();
                    })
                    .await?;
                    return Ok(());
                }
                let chunk = tokio::select! {
                    _=cancellation.changed()=>return Err(Error::new("connection_changed","تغيّر الحساب أو الخادم؛ استأنف التنزيل من حسابه.")),
                    _=notification=>continue,
                    chunk=stream.next()=>match chunk {Some(chunk)=>chunk,None=>break},
                };
                let chunk = chunk.map_err(|_| failed())?;
                if offset + chunk.len() as u64 > entry.size {
                    return Err(failed());
                }
                file.write_all(&chunk).await.map_err(|_| failed())?;
                offset += chunk.len() as u64;
                if checkpoint.elapsed() >= std::time::Duration::from_secs(1) {
                    let disk = rustix::fs::statvfs(parent).map_err(|_| failed())?;
                    if disk.f_bavail.saturating_mul(disk.f_frsize) < 256 * 1024 * 1024 {
                        return Err(Error::new(
                            "device_full",
                            "أُوقف التنزيل لحماية مساحة الجهاز؛ حرّر مساحة ثم استأنفه.",
                        ));
                    }
                    self.update(&entry.id, &entry.scope, |e| e.offset = offset)
                        .await?;
                    checkpoint = std::time::Instant::now();
                }
            }
        }
        file.sync_all().await.map_err(|_| failed())?;
        drop(file);
        if offset != entry.size {
            return Err(failed());
        }
        verify_video(&partial, entry.size, &entry.sha256).await?;
        self.services.check_revision(revision)?;
        tokio::fs::hard_link(&partial, &entry.path)
            .await
            .map_err(|_| Error::new("file_conflict", "يوجد ملف في الوجهة؛ لم يُستبدل."))?;
        tokio::fs::remove_file(partial)
            .await
            .map_err(|_| failed())?;
        if !self.transfer_subtitles(&entry, revision).await? {
            return Ok(());
        }
        self.update(&entry.id, &entry.scope, |e| {
            e.offset = e.size;
            e.state = "complete".into();
        })
        .await
    }
    async fn transfer_subtitles(&self, entry: &Entry, revision: u64) -> Result<bool, Error> {
        let key = format!("{}:{}", entry.scope, entry.id);
        for (index, subtitle) in entry.subtitles.iter().enumerate() {
            self.services.check_revision(revision)?;
            if self.paused.lock().await.contains(&key) {
                return Ok(false);
            }
            let target = entry.path.with_extension(format!(
                "subtitle-{index}.{}",
                subtitle.extension()?.to_ascii_lowercase()
            ));
            if tokio::fs::try_exists(&target).await.map_err(|_| failed())? {
                if tokio::fs::symlink_metadata(&target)
                    .await
                    .map_err(|_| failed())?
                    .file_type()
                    .is_symlink()
                {
                    return Err(failed());
                }
                verify_video(&target, subtitle.byte_size, &subtitle.sha256).await?;
                continue;
            }
            let transport = self.services.snapshot()?;
            let request = transport.media_subtitle(&entry.id, index, reqwest::Method::GET, None);
            tokio::pin!(request);
            let mut response = loop {
                tokio::select! {
                    result = &mut request => break result?,
                    () = self.wake.notified() => if self.paused.lock().await.contains(&key) { return Ok(false); },
                }
            };
            if response.status() != reqwest::StatusCode::OK {
                return Err(failed());
            }
            let mut bytes = Vec::new();
            loop {
                let chunk = tokio::select! {
                    result = response.chunk() => result.map_err(|_| failed())?,
                    () = self.wake.notified() => { if self.paused.lock().await.contains(&key) { return Ok(false); } continue; },
                };
                let Some(chunk) = chunk else { break };
                if bytes.len() as u64 + chunk.len() as u64 > subtitle.byte_size {
                    return Err(failed());
                }
                bytes.extend_from_slice(&chunk);
            }
            if bytes.len() as u64 != subtitle.byte_size
                || hex::encode(Sha256::digest(&bytes)) != subtitle.sha256
            {
                return Err(failed());
            }
            self.services.check_revision(revision)?;
            let disk = rustix::fs::statvfs(entry.path.parent().ok_or_else(failed)?)
                .map_err(|_| failed())?;
            if disk.f_bavail.saturating_mul(disk.f_frsize) < subtitle.byte_size + 256 * 1024 * 1024
            {
                return Err(failed());
            }
            let stage = target.with_extension("partial");
            if tokio::fs::symlink_metadata(&stage)
                .await
                .is_ok_and(|stat| !stat.is_file())
            {
                return Err(failed());
            }
            let mut output = tokio::fs::OpenOptions::new()
                .write(true)
                .create(true)
                .truncate(true)
                .mode(0o600)
                .open(&stage)
                .await
                .map_err(|_| failed())?;
            output.write_all(&bytes).await.map_err(|_| failed())?;
            output.sync_all().await.map_err(|_| failed())?;
            drop(output);
            tokio::fs::hard_link(&stage, &target)
                .await
                .map_err(|_| failed())?;
            tokio::fs::remove_file(stage).await.map_err(|_| failed())?;
        }
        Ok(true)
    }
    fn json(entry: &Entry) -> Value {
        let available = entry.state == "complete"
            && std::fs::metadata(&entry.path).is_ok_and(|m| m.is_file() && m.len() == entry.size);
        json!({"id":format!("home:{}",entry.id),"file":0,"path":entry.path,"size":entry.size,"available":available,"published":entry.state=="complete","error":entry.error,"target":entry.target,"title":entry.title,"workTitle":entry.work_title,"posterId":entry.poster_id})
    }
    pub async fn library(&self) -> Result<Vec<Value>, Error> {
        let scope = self.services.catalog_scope().await?;
        Ok(self
            .load()?
            .iter()
            .filter(|e| e.scope == scope)
            .map(Self::json)
            .collect())
    }
    pub async fn used_bytes(&self) -> Result<u64, Error> {
        let scope = self.services.catalog_scope().await?;
        let mut bytes = 0u64;
        for entry in self.load()?.iter().filter(|entry| entry.scope == scope) {
            let mut paths = vec![entry.path.clone(), entry.path.with_extension("partial")];
            for (index, subtitle) in entry.subtitles.iter().enumerate() {
                let subtitle_path = entry.path.with_extension(format!(
                    "subtitle-{index}.{}",
                    subtitle.extension()?.to_ascii_lowercase()
                ));
                paths.push(subtitle_path.with_extension("partial"));
                paths.push(subtitle_path);
            }
            for path in paths {
                if let Ok(stat) = tokio::fs::symlink_metadata(path).await
                    && stat.is_file()
                {
                    bytes = bytes.saturating_add(stat.len());
                }
            }
        }
        Ok(bytes)
    }
    pub async fn jobs(&self) -> Result<Vec<Value>, Error> {
        let scope = self.services.catalog_scope().await?;
        let active = self.active.lock().await.clone();
        Ok(self.load()?.iter().filter(|e|e.scope==scope).map(|e|{
            let state=if e.state=="downloading" && !active.contains(&format!("{}:{}",e.scope,e.id)){"paused"}else{e.state.as_str()};
            json!({"id":format!("home:{}",e.id),"selected":[0],"files":[{"index":0,"path":e.title,"size":e.size}],"status":{"verified":e.offset,"total":e.size,"complete":state=="complete","paused":state=="paused","error":e.error,"state":state,"download_rate":0,"peers":0},"exports":[Self::json(e)]})}).collect())
    }
    pub async fn pause(&self, id: &str, paused: bool) -> Result<(), Error> {
        let entry = self.entry(id).await?;
        let key = format!("{}:{}", entry.scope, id);
        if !paused && self.active.lock().await.contains(&key) {
            return Err(Error::new("busy", "انتظر اكتمال إيقاف التنزيل ثم استأنفه."));
        }
        if paused {
            self.paused.lock().await.insert(key);
            self.wake.notify_waiters();
            self.update(id, &entry.scope, |e| e.state = "paused".into())
                .await
        } else {
            self.paused.lock().await.remove(&key);
            self.spawn(entry).await;
            Ok(())
        }
    }
    pub async fn path(&self, id: &str) -> Result<(PathBuf, String), Error> {
        let entry = self.entry(id).await?;
        if !Self::json(&entry)["available"].as_bool().unwrap_or(false) {
            return Err(failed());
        }
        Ok((entry.path, entry.title))
    }
    pub async fn context(&self, id: &str) -> Option<ResolvedTarget> {
        let entry = self.entry(id).await.ok()?;
        Some(ResolvedTarget {
            poster_id: entry.poster_id,
            work_id: entry.target.work_id,
            installment_id: entry.target.installment_id?,
            episode_id: entry.target.episode_id,
            title: entry.title,
            work_title: entry.work_title,
            search: crate::torrentio::Search {
                imdb_id: String::new(),
                kind: crate::torrentio::Kind::Movie,
                season: None,
                episode: None,
            },
        })
    }
    pub async fn remove(&self, id: &str, delete: bool) -> Result<(), Error> {
        let entry = self.entry(id).await?;
        let key = format!("{}:{}", entry.scope, id);
        if self.active.lock().await.contains(&key) {
            return Err(Error::new("busy", "أوقف التنزيل وانتظر قبل حذفه."));
        }
        if delete {
            for (index, subtitle) in entry.subtitles.iter().enumerate() {
                let target = entry.path.with_extension(format!(
                    "subtitle-{index}.{}",
                    subtitle.extension()?.to_ascii_lowercase()
                ));
                for path in [target.with_extension("partial"), target] {
                    match tokio::fs::remove_file(path).await {
                        Ok(()) => {}
                        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
                        Err(_) => return Err(failed()),
                    }
                }
            }
            if entry.path.exists() {
                tokio::fs::remove_file(&entry.path)
                    .await
                    .map_err(|_| failed())?;
            }
            let partial = entry.path.with_extension("partial");
            if partial.exists() {
                tokio::fs::remove_file(partial)
                    .await
                    .map_err(|_| failed())?;
            }
        }
        let _guard = self.serial.lock().await;
        let mut entries = self.load()?;
        entries.retain(|e| e.id != id || e.scope != entry.scope);
        private_state::write_limit(&self.root, "files.json", &entries, JOURNAL_LIMIT)
    }
}

async fn verify_video(path: &std::path::Path, size: u64, expected: &str) -> Result<(), Error> {
    let mut input = tokio::fs::File::open(path).await.map_err(|_| failed())?;
    if input.metadata().await.map_err(|_| failed())?.len() != size {
        return Err(failed());
    }
    let mut hash = Sha256::new();
    let mut buffer = vec![0; 1024 * 1024];
    loop {
        let n = input.read(&mut buffer).await.map_err(|_| failed())?;
        if n == 0 {
            break;
        }
        hash.update(&buffer[..n]);
    }
    if hex::encode(hash.finalize()) != expected {
        return Err(Error::new(
            "changed_media",
            "فشل التحقق من الفيديو؛ لم يُنشر الملف للتشغيل.",
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{
        Json, Router,
        body::Body,
        http::{HeaderMap, StatusCode},
        routing::{get, post},
    };
    const FILE: &str = "a3000000-0000-4000-8000-000000000001";
    const WORK: &str = "a1000000-0000-4000-8000-000000000001";
    const PART: &str = "a2000000-0000-4000-8000-000000000001";
    const ACCOUNT: &str = "a4000000-0000-4000-8000-000000000001";
    const OTHER: &str = "a4000000-0000-4000-8000-000000000002";
    async fn command(services: &Services, name: &str, payload: Value) -> Result<Value, Error> {
        services
            .execute(crate::bridge::Request {
                id: "media-fixture".into(),
                command: name.into(),
                payload,
            })
            .await
    }
    fn target() -> ResolvedTarget {
        ResolvedTarget {
            work_id: WORK.into(),
            installment_id: PART.into(),
            episode_id: None,
            title: "Fixture".into(),
            work_title: "Fixture work".into(),
            poster_id: None,
            search: crate::torrentio::Search {
                imdb_id: String::new(),
                kind: crate::torrentio::Kind::Movie,
                season: None,
                episode: None,
            },
        }
    }
    async fn wait_for(manager: &Downloads, state: &str) {
        for _ in 0..2000 {
            if manager
                .load()
                .unwrap()
                .last()
                .is_some_and(|e| e.state == state)
                && manager.active.lock().await.is_empty()
            {
                return;
            }
            tokio::time::sleep(std::time::Duration::from_millis(20)).await;
        }
        panic!(
            "transfer did not reach {state}: {:?}",
            manager
                .load()
                .unwrap()
                .iter()
                .map(|e| (&e.state, &e.error))
                .collect::<Vec<_>>()
        );
    }
    #[tokio::test]
    async fn range_restart_account_isolation_offline_access_and_sign_out() {
        let calls = Arc::new(std::sync::atomic::AtomicUsize::new(0));
        let media_calls = calls.clone();
        let missing_image = Arc::new(std::sync::atomic::AtomicBool::new(true));
        let work_image = missing_image.clone();
        let app=Router::new()
            .route("/api/v1/media/{id}/subtitles/{index}",get(|headers:HeaderMap|async move {
                assert_eq!(headers["authorization"],"Bearer fixture-media-token");
                "1\n00:00:00,000 --> 00:00:01,000\nSubtitle fixture\n"
            }))
            .route("/api/health/ready",get(||async {"ready"}))
            .route("/api/v1/server/info",get(||async {Json(json!({"serverId":"a5000000-0000-4000-8000-000000000001","product":"nahhasio","name":"Fixture","version":"0.1.3","apiVersion":1}))}))
            .route("/api/v1/auth/login",post(|Json(input):Json<Value>|async move {Json(json!({"token":"fixture-media-token","expiresAt":"2099-01-01T00:00:00Z","user":{"id":"fixture","accountId":if input["email"]=="other@example.invalid"{OTHER}else{ACCOUNT},"name":"Fixture","email":"fixture@example.invalid","role":"member","kind":"member","avatarKey":"cars-1.png","bio":"","isAdmin":false,"updatedAt":"2026-11-05T00:00:00Z"}}))}))
            .route("/api/v1/auth/logout",post(||async {Json(Value::Null)}))
            .route("/api/v1/works/{id}",get(move ||{let missing=work_image.clone();async move {Json(json!({"id":WORK,"canonicalTitle":"Fixture work","installments":[],"poster":if missing.load(std::sync::atomic::Ordering::SeqCst){json!({"id":"a6000000-0000-4000-8000-000000000001","mimeType":"image/png","width":320})}else{Value::Null}}))}}))
            .route("/api/v1/works/{id}/state",get(||async{Json(json!({"workId":WORK,"installments":[],"units":[]}))}))
            .route("/api/v1/media/{id}/content",get(move |headers:HeaderMap| {let calls=media_calls.clone();async move {
                assert_eq!(headers["authorization"],"Bearer fixture-media-token");
                let call=calls.fetch_add(1,std::sync::atomic::Ordering::SeqCst);
                let offset=if call==1 {5}else{0};
                assert_eq!(headers["range"],format!("bytes={offset}-"));
                let bytes=if call==1 {b"56789".as_slice()}else if call==0 {b"01234".as_slice()}else{b"0123456789".as_slice()};
                let body=if call==2 {
                    // Cross the ordinary API's 15-second deadline with a valid streaming body.
                    Body::from_stream(tokio_stream::iter([0,1]).then(|index|async move {
                        if index==1 {tokio::time::sleep(std::time::Duration::from_secs(16)).await;}
                        Ok::<_,std::io::Error>(axum::body::Bytes::from_static(if index==0 {b"01234"}else{b"56789"}))
                    }))
                } else {Body::from(bytes)};
                (StatusCode::PARTIAL_CONTENT,[("content-range",format!("bytes {offset}-9/10"))],body)
            }}));
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let url = format!("http://{}/", listener.local_addr().unwrap());
        let server = tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
        let (services, root) = crate::connections::tests::media_fixture(&url);
        command(
            &services,
            "login",
            json!({"email":"fixture@example.invalid","password":"fixture-only"}),
        )
        .await
        .unwrap();
        assert!(services.save_work_required(WORK).await.is_err());
        assert!(services.saved_work(WORK).await.is_err());
        missing_image.store(false, std::sync::atomic::Ordering::SeqCst);
        services.save_work_required(WORK).await.unwrap();
        let pack = services.saved_work(WORK).await.unwrap();
        missing_image.store(true, std::sync::atomic::Ordering::SeqCst);
        assert!(services.save_work_required(WORK).await.is_err());
        assert_eq!(services.saved_work(WORK).await.unwrap(), pack);
        let roots = Roots {
            state: root.join("transfers"),
            videos: root.join("videos"),
        };
        let manager = Downloads::new(services.clone(), &roots);
        let checksum = hex::encode(Sha256::digest(b"0123456789"));
        let subtitle_bytes = b"1\n00:00:00,000 --> 00:00:01,000\nSubtitle fixture\n";
        let subtitles = vec![crate::home_gateway::Subtitle {
            relative_path: "fixture.ar.srt".into(),
            byte_size: subtitle_bytes.len() as u64,
            sha256: hex::encode(Sha256::digest(subtitle_bytes)),
        }];
        let gateway = crate::home_gateway::HomeGateway::start_with_subtitles(
            services.snapshot().unwrap(),
            FILE.into(),
            subtitles.clone(),
        )
        .await
        .unwrap();
        let client = reqwest::Client::new();
        assert_eq!(
            client
                .get(&gateway.subtitles()[0].0)
                .send()
                .await
                .unwrap()
                .bytes()
                .await
                .unwrap(),
            subtitle_bytes.as_slice()
        );
        assert_eq!(
            client
                .get(&gateway.subtitles()[0].0)
                .header("Origin", "http://untrusted.invalid")
                .send()
                .await
                .unwrap()
                .status(),
            reqwest::StatusCode::FORBIDDEN
        );

        manager
            .start(
                FILE.into(),
                target(),
                10,
                checksum.clone(),
                "mp4".into(),
                subtitles.clone(),
            )
            .await
            .unwrap();
        wait_for(&manager, "failed").await;
        let first = manager.load().unwrap()[0].clone();
        assert_eq!(
            tokio::fs::read(first.path.with_extension("partial"))
                .await
                .unwrap(),
            b"01234"
        );
        assert!(!first.path.exists());
        let restarted = Downloads::new(services.clone(), &roots);
        let interrupted_subtitle = first.path.with_extension("subtitle-0.partial");
        tokio::fs::write(&interrupted_subtitle, b"interrupted")
            .await
            .unwrap();
        assert_eq!(restarted.used_bytes().await.unwrap(), 5 + 11);

        restarted.pause(FILE, false).await.unwrap();
        wait_for(&restarted, "complete").await;
        assert_eq!(
            restarted.used_bytes().await.unwrap(),
            10 + subtitle_bytes.len() as u64
        );
        assert!(
            !interrupted_subtitle.exists(),
            "subtitle staging is reconciled after restart"
        );
        assert_eq!(tokio::fs::read(&first.path).await.unwrap(), b"0123456789");
        assert_eq!(
            tokio::fs::read(first.path.with_extension("subtitle-0.srt"))
                .await
                .unwrap(),
            subtitle_bytes
        );
        command(
            &services,
            "login",
            json!({"email":"other@example.invalid","password":"fixture-only"}),
        )
        .await
        .unwrap();
        assert!(restarted.library().await.unwrap().is_empty());
        restarted
            .start(
                FILE.into(),
                target(),
                10,
                checksum,
                "mp4".into(),
                subtitles.clone(),
            )
            .await
            .unwrap();
        wait_for(&restarted, "complete").await;
        let entries = restarted.load().unwrap();
        assert_ne!(entries[0].path, entries[1].path);
        restarted.remove(FILE, true).await.unwrap();
        assert!(first.path.exists());
        server.abort();
        let _ = server.await;
        command(&services, "offline.open", json!({"accountId":ACCOUNT}))
            .await
            .unwrap();
        assert_eq!(restarted.path(FILE).await.unwrap().0, first.path);
        assert_eq!(services.saved_work(WORK).await.unwrap(), pack);
        command(&services, "offline.close", json!({}))
            .await
            .unwrap();
        // Marking a profile signed out is independent of retained video bytes.
        let profiles = root
            .join("saved")
            .join(hex::encode(Sha256::digest(url.as_bytes())))
            .join("profiles.json");
        assert!(profiles.exists());
        let mut data: Vec<Value> = private_state::read(profiles.parent().unwrap(), "profiles.json")
            .unwrap()
            .unwrap();
        for profile in &mut data {
            profile["signed_out"] = json!(true);
        }
        private_state::write(profiles.parent().unwrap(), "profiles.json", &data).unwrap();
        assert!(
            command(&services, "offline.open", json!({"accountId":ACCOUNT}))
                .await
                .is_err()
        );
        assert!(first.path.exists());
        std::fs::remove_dir_all(root).unwrap();
    }
}
