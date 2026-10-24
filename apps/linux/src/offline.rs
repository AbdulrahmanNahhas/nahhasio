//! Device-owned snapshots. A saved catalog is data, never an authentication grant.
use crate::{
    bridge::{Error, Request, valid_id},
    private_state,
    services::ServerSession,
};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use std::{collections::BTreeSet, path::PathBuf, sync::Arc};
use tokio::sync::Mutex;

const DOCUMENT_LIMIT: usize = 16 * 1024 * 1024;
#[derive(Clone, Deserialize, Serialize)]
struct Profile {
    account: String,
    name: String,
}
#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct Entry {
    id: String,
    title: String,
    poster_id: Option<String>,
    saved_at: String,
    images: usize,
    #[serde(default = "saved_default")]
    saved: bool,
    #[serde(default)]
    pending: usize,
    #[serde(default)]
    conflict: bool,
}
#[derive(Clone, Deserialize, Serialize)]
struct Pack {
    version: u32,
    work: Value,
    state: Value,
    pending: Vec<Change>,
    #[serde(default)]
    conflict: bool,
}
#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct Change {
    installment_id: String,
    episode_id: Option<String>,
    expected_updated_at: Value,
    #[serde(default)]
    expected_revision: Option<i64>,
    is_played: Option<bool>,
    position_seconds: Option<u64>,
    duration_seconds: Option<u64>,
}
#[derive(Clone)]
struct Owner {
    server: String,
    account: String,
    name: String,
    offline: bool,
}
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct Job {
    work_id: String,
    account: String,
    server: String,
    completed: usize,
    total: usize,
    running: bool,
    error: Option<String>,
}
#[derive(Clone)]
pub struct Store {
    root: PathBuf,
    owner: Arc<Mutex<Option<Owner>>>,
    serial: Arc<Mutex<()>>,
    job: Arc<Mutex<Option<Job>>>,
}
fn bad() -> Error {
    Error::new(
        "offline_data",
        "تعذّر قراءة بيانات المكتبة المحفوظة. أعد حفظ العمل بعد الاتصال.",
    )
}
fn saved_default() -> bool {
    true
}
fn hash(value: &str) -> String {
    hex::encode(Sha256::digest(value.as_bytes()))
}
fn now() -> String {
    chrono::Utc::now().to_rfc3339()
}
fn array(value: &Value) -> Result<&Vec<Value>, Error> {
    value.as_array().ok_or_else(bad)
}
fn id(value: &Value, key: &str) -> Result<String, Error> {
    value[key]
        .as_str()
        .filter(|id| valid_id(id))
        .map(str::to_owned)
        .ok_or_else(bad)
}
impl Store {
    pub fn new(root: PathBuf) -> Self {
        Self {
            root,
            owner: Arc::new(Mutex::new(None)),
            serial: Arc::new(Mutex::new(())),
            job: Arc::new(Mutex::new(None)),
        }
    }
    fn server_root(&self, server: &str) -> PathBuf {
        self.root.join("saved").join(hash(server))
    }
    fn canonical_server(&self, server: &str) -> Result<String, Error> {
        let aliases: Vec<(String, String, String)> =
            private_state::read(&self.root, "server-identities.json")?.unwrap_or_default();
        if aliases.len() > 256 {
            return Err(bad());
        }
        Ok(aliases
            .into_iter()
            .find(|(url, _, _)| url == server)
            .map(|(_, _, canonical)| canonical)
            .unwrap_or_else(|| server.into()))
    }
    /// Keep the original storage namespace so previously downloaded videos and preferences remain valid.
    /// New addresses of the same verified instance share it; credentials remain address-scoped.
    pub async fn identify(&self, server: &str, instance: &str) -> Result<(), Error> {
        if !valid_id(instance) {
            return Err(bad());
        }
        let _guard = self.serial.lock().await;
        let mut aliases: Vec<(String, String, String)> =
            private_state::read(&self.root, "server-identities.json")?.unwrap_or_default();
        if let Some((_, previous, _)) = aliases.iter().find(|(url, _, _)| url == server) {
            if previous != instance {
                return Err(Error::new(
                    "server_identity",
                    "تغيّرت هوية الخادم في هذا العنوان. بيانات المكتبة السابقة محفوظة؛ راجع إعداد الاتصال.",
                ));
            }
            return Ok(());
        }
        if aliases.len() >= 256 {
            return Err(bad());
        }
        let canonical = aliases
            .iter()
            .find(|(_, id, _)| id == instance)
            .map(|(_, _, canonical)| canonical.clone())
            .unwrap_or_else(|| server.into());
        if canonical != server && self.server_root(server).exists() {
            return Err(Error::new(
                "server_identity",
                "لهذا العنوان بيانات محلية مستقلة. احتفظ بها وراجع الاتصال قبل دمج المكتبتين.",
            ));
        }
        aliases.push((server.into(), instance.into(), canonical));
        private_state::write(&self.root, "server-identities.json", &aliases)
    }
    fn directory(&self, owner: &Owner) -> PathBuf {
        self.server_root(&owner.server).join(hash(&owner.account))
    }
    async fn owner(&self) -> Result<Owner, Error> {
        self.owner
            .lock()
            .await
            .clone()
            .ok_or_else(|| Error::new("offline_owner", "سجّل الدخول أو اختر مكتبة جهاز محفوظة أولًا."))
    }
    pub async fn reset(&self) {
        *self.owner.lock().await = None;
    }
    pub async fn scope(&self) -> Result<String, Error> {
        let owner = self.owner().await?;
        Ok(format!("{}-{}", hash(&owner.server), hash(&owner.account)))
    }
    pub async fn tracks(&self, work: &str) -> bool {
        let Ok(owner) = self.owner().await else {
            return false;
        };
        self.entries(&owner)
            .is_ok_and(|entries| entries.iter().any(|entry| entry.id == work))
    }
    pub async fn merge_state(&self, work: &str, state: Value) -> Result<Value, Error> {
        let owner = self.owner().await?;
        let _guard = self.serial.lock().await;
        let mut pack = self.pack(&owner, work)?;
        pack.state = state;
        apply_pending(&mut pack)?;
        self.put(&owner, work, &pack)?;
        Ok(pack.state)
    }
    pub async fn is_offline(&self) -> bool {
        self.owner.lock().await.as_ref().is_some_and(|o| o.offline)
    }
    pub async fn remember(&self, server: &str, session: &Value) -> Result<(), Error> {
        let canonical = self.canonical_server(server)?;
        let server = canonical.as_str();
        let user = &session["user"];
        let account = id(user, "accountId")?;
        let name = user["name"]
            .as_str()
            .filter(|name| name.chars().count() <= 200)
            .ok_or_else(bad)?
            .to_owned();
        let _guard = self.serial.lock().await;
        let dir = self.server_root(server);
        let mut profiles: Vec<Profile> =
            private_state::read(&dir, "profiles.json")?.unwrap_or_default();
        if let Some(profile) = profiles.iter_mut().find(|p| p.account == account) {
            profile.name = name.clone();
        } else {
            if profiles.len() >= 32 {
                return Err(bad());
            }
            profiles.push(Profile {
                account: account.clone(),
                name: name.clone(),
            });
        }
        private_state::write(&dir, "profiles.json", &profiles)?;
        let owner = Owner {
            server: server.into(),
            account,
            name,
            offline: false,
        };
        if !self.owner.lock().await.as_ref().is_some_and(|previous| {
            previous.server == owner.server && previous.account == owner.account
        }) {
            self.reconcile(&owner)?;
        }
        *self.owner.lock().await = Some(owner);
        Ok(())
    }
    fn entries(&self, owner: &Owner) -> Result<Vec<Entry>, Error> {
        let entries: Vec<Entry> =
            private_state::read_limit(&self.directory(owner), "index.json", 256 * 1024)?
                .unwrap_or_default();
        if entries.len() > 1000 || entries.iter().any(|entry| !valid_id(&entry.id)) {
            return Err(bad());
        }
        Ok(entries)
    }
    fn reconcile(&self, owner: &Owner) -> Result<(), Error> {
        let mut entries = self.entries(owner)?;
        let mut changed = false;
        for entry in &mut entries {
            if let Ok(pack) = self.pack(owner, &entry.id)
                && (entry.pending != pack.pending.len() || entry.conflict != pack.conflict)
            {
                entry.pending = pack.pending.len();
                entry.conflict = pack.conflict;
                changed = true;
            }
        }
        if changed {
            private_state::write_limit(&self.directory(owner), "index.json", &entries, 256 * 1024)?;
        }
        Ok(())
    }
    fn pack(&self, owner: &Owner, work: &str) -> Result<Pack, Error> {
        if !valid_id(work) {
            return Err(bad());
        }
        let pack: Pack = private_state::read_limit(
            &self.directory(owner),
            &format!("{work}.json"),
            DOCUMENT_LIMIT,
        )?
        .ok_or_else(|| Error::new("not_saved", "هذا العمل غير محفوظ على هذا الجهاز."))?;
        if pack.version != 1
            || pack.work["id"] != work
            || pack.state["workId"] != work
            || pack.pending.len() > 10000
        {
            return Err(bad());
        }
        Ok(pack)
    }
    fn put(&self, owner: &Owner, work: &str, pack: &Pack) -> Result<(), Error> {
        private_state::write_limit(
            &self.directory(owner),
            &format!("{work}.json"),
            pack,
            DOCUMENT_LIMIT,
        )?;
        let mut entries = self.entries(owner)?;
        if let Some(entry) = entries.iter_mut().find(|entry| entry.id == work) {
            entry.pending = pack.pending.len();
            entry.conflict = pack.conflict;
            private_state::write_limit(&self.directory(owner), "index.json", &entries, 256 * 1024)?;
        }
        Ok(())
    }
    pub async fn execute(
        &self,
        server: &str,
        transport: ServerSession,
        request: Request,
    ) -> Result<Value, Error> {
        let canonical = self.canonical_server(server)?;
        let server = canonical.as_str();
        match request.command.as_str() {
            "offline.profiles" => {
                let profiles: Vec<Profile> =
                    private_state::read(&self.server_root(server), "profiles.json")?
                        .unwrap_or_default();
                Ok(json!(profiles))
            }
            "offline.open" => {
                let account = id(&request.payload, "accountId")?;
                let profiles: Vec<Profile> =
                    private_state::read(&self.server_root(server), "profiles.json")?
                        .unwrap_or_default();
                let profile = profiles
                    .into_iter()
                    .find(|p| p.account == account)
                    .ok_or_else(bad)?;
                let owner = Owner {
                    server: server.into(),
                    account,
                    name: profile.name,
                    offline: true,
                };
                self.reconcile(&owner)?;
                *self.owner.lock().await = Some(owner);
                self.status().await
            }
            "offline.close" => {
                self.reset().await;
                Ok(Value::Null)
            }
            "offline.status" => self.status().await,
            "offline.list" => {
                let owner = self.owner().await?;
                Ok(json!(
                    self.entries(&owner)?
                        .into_iter()
                        .filter(|entry| entry.saved)
                        .collect::<Vec<_>>()
                ))
            }
            "offline.save" => {
                let owner = self.owner().await?;
                if owner.offline {
                    return Err(Error::new(
                        "offline_mode",
                        "اتصل بالخادم لتحديث بيانات العمل.",
                    ));
                }
                let work = id(&request.payload, "id")?;
                let mut job = self.job.lock().await;
                if job.as_ref().is_some_and(|job| job.running) {
                    return Err(Error::new("busy", "انتظر اكتمال حفظ العمل الحالي."));
                }
                *job = Some(Job {
                    work_id: work.clone(),
                    account: owner.account.clone(),
                    server: owner.server.clone(),
                    completed: 0,
                    total: 0,
                    running: true,
                    error: None,
                });
                let store = self.clone();
                tokio::spawn(async move {
                    let result = store.save(&owner, &transport, &work).await;
                    let mut job = store.job.lock().await;
                    if let Some(job) = job.as_mut() {
                        job.running = false;
                        job.error = result.err().map(|e| e.message);
                    }
                });
                Ok(Value::Null)
            }
            "offline.remove" => {
                let owner = self.owner().await?;
                let work = id(&request.payload, "id")?;
                let _guard = self.serial.lock().await;
                let job = self.job.lock().await;
                if job.as_ref().is_some_and(|job| job.running) {
                    return Err(Error::new("busy", "انتظر اكتمال حفظ الصور قبل الإزالة."));
                }
                let pack = self.pack(&owner, &work)?;
                if !pack.pending.is_empty() {
                    return Err(Error::new(
                        "pending_sync",
                        "زامن تغييرات المشاهدة أو احسم تعارضاتها قبل إزالة العمل.",
                    ));
                }
                let mut entries = self.entries(&owner)?;
                entries.retain(|entry| entry.id != work);
                private_state::write_limit(
                    &self.directory(&owner),
                    "index.json",
                    &entries,
                    256 * 1024,
                )?;
                private_state::remove(&self.directory(&owner), &format!("{work}.json"))?;
                self.cleanup_images(&owner, &entries)?;
                Ok(Value::Null)
            }
            "offline.sync" => self.sync(&transport).await,
            "offline.review" => {
                let owner = self.owner().await?;
                if owner.offline {
                    return Err(Error::new("offline_mode", "اتصل بالخادم لمراجعة التعارض."));
                }
                let work = id(&request.payload, "id")?;
                let fresh = call(&transport, "workState", json!({"id":work})).await?;
                let pack = self.pack(&owner, &work)?;
                let changes:Vec<_>=pack.pending.iter().map(|change|{
                    let device=find_unit(&pack.state,change)?;let server=find_unit(&fresh,change)?;
                    let installment=array(&pack.work["installments"])?.iter().find(|item|item["id"]==change.installment_id).ok_or_else(bad)?;
                    let episode=change.episode_id.as_ref().and_then(|id|installment["episodes"].as_array()?.iter().find(|item|item["id"]==*id));
                    let label=episode.map_or_else(||installment["title"].as_str().unwrap_or("إصدار").to_owned(),|item|format!("{} · الحلقة {}",installment["title"].as_str().unwrap_or("جزء"),crate::display::episode_number(item["number"].as_str().unwrap_or(""))));
                    Ok::<Value,Error>(json!({"key":format!("{}:{}",change.installment_id,change.episode_id.as_deref().unwrap_or("film")),"label":label,"devicePlayed":device["isPlayed"],"serverPlayed":server["isPlayed"],"devicePosition":device["positionSeconds"],"serverPosition":server["positionSeconds"]}))
                }).collect::<Result<_,_>>()?;
                Ok(json!({"revision":hash(&fresh.to_string()),"changes":changes}))
            }
            "offline.resolve" => {
                let owner = self.owner().await?;
                if owner.offline {
                    return Err(Error::new(
                        "offline_mode",
                        "اتصل بالخادم لحسم تعارض المشاهدة.",
                    ));
                }
                let work = id(&request.payload, "id")?;
                let choice = request.payload["choice"].as_str().ok_or_else(bad)?;
                if !matches!(choice, "device" | "server") {
                    return Err(bad());
                }
                let fresh = call(&transport, "workState", json!({"id":work})).await?;
                if request.payload["revision"].as_str() != Some(hash(&fresh.to_string()).as_str()) {
                    return Err(Error::new(
                        "conflict",
                        "تغيّرت الحالة مجددًا. أغلق المراجعة وافتحها لتحديث المقارنة.",
                    ));
                }
                let _guard = self.serial.lock().await;
                let mut pack = self.pack(&owner, &work)?;
                pack.conflict = false;
                if choice == "server" {
                    pack.pending.clear();
                    pack.state = fresh;
                } else {
                    for change in &mut pack.pending {
                        let unit = find_unit(&fresh, change)?;
                        change.expected_updated_at = unit["updatedAt"].clone();
                        change.expected_revision = unit["revision"].as_i64();
                    }
                }
                self.put(&owner, &work, &pack)?;
                Ok(Value::Null)
            }
            "offline.progress" => {
                let work = id(&request.payload, "workId")?;
                if request.payload["scope"].as_str() != Some(self.scope().await?.as_str()) {
                    return Err(Error::new("offline_owner", "تغيّر حساب المشاهدة."));
                }
                self.track(&work, &transport).await?;
                self.change(&work, &request.payload, false).await
            }
            "offline.position" => {
                let owner = self.owner().await?;
                let work = id(&request.payload, "workId")?;
                if !owner.offline {
                    self.track(&work, &transport).await?;
                }
                let pack = self.pack(&owner, &work)?;
                let installment = id(&request.payload, "installmentId")?;
                let episode = request
                    .payload
                    .get("episodeId")
                    .cloned()
                    .unwrap_or(Value::Null);
                let unit = array(&pack.state["units"])?
                    .iter()
                    .find(|unit| {
                        unit["installmentId"] == installment && unit["episodeId"] == episode
                    })
                    .ok_or_else(bad)?;
                Ok(json!({"position":unit["positionSeconds"]}))
            }
            _ => Err(bad()),
        }
    }
    async fn status(&self) -> Result<Value, Error> {
        let owner = self.owner.lock().await.clone();
        let Some(owner) = owner else {
            return Ok(
                json!({"active":false,"name":null,"pending":0,"job":null,"offline":false,"scope":null,"conflicts":[]}),
            );
        };
        let entries = self.entries(&owner)?;
        let pending: usize = entries.iter().map(|entry| entry.pending).sum();
        let job = self
            .job
            .lock()
            .await
            .clone()
            .filter(|job| job.account == owner.account && job.server == owner.server);
        Ok(
            json!({"active":true,"offline":owner.offline,"name":owner.name,"pending":pending,"job":job,"conflicts":entries.iter().filter(|entry|entry.conflict).map(|entry|json!({"id":entry.id,"title":entry.title})).collect::<Vec<_>>(),"scope":format!("{}-{}",hash(&owner.server),hash(&owner.account))}),
        )
    }
    async fn save(
        &self,
        owner: &Owner,
        transport: &ServerSession,
        work: &str,
    ) -> Result<(), Error> {
        let data = call(transport, "work", json!({"id":work})).await?;
        if data["id"] != work {
            return Err(bad());
        }
        let state = call(transport, "workState", json!({"id":work})).await?;
        let mut ids = BTreeSet::new();
        image_ids(&data, &mut ids);
        if ids.len() > 2000 {
            return Err(Error::new(
                "offline_limit",
                "عدد صور العمل أكبر من حد الحفظ الحالي.",
            ));
        }
        if let Some(job) = self.job.lock().await.as_mut() {
            job.total = ids.len();
        }
        let images = self.directory(owner).join("images");
        let mut tasks = tokio::task::JoinSet::new();
        let mut images_iter = ids.iter();
        let mut total_bytes = 0usize;
        loop {
            while tasks.len() < 6 {
                let Some(asset) = images_iter.next() else {
                    break;
                };
                let asset = asset.clone();
                let transport = transport.clone();
                let images = images.clone();
                tasks.spawn(async move {
                    let value = call(&transport, "artwork", json!({"id":asset})).await?;
                    let length = value["dataUrl"].as_str().ok_or_else(bad)?.len();
                    private_state::write_limit(
                        &images,
                        &format!("{asset}.json"),
                        &value,
                        DOCUMENT_LIMIT,
                    )?;
                    Ok::<usize, Error>(length)
                });
            }
            let Some(result) = tasks.join_next().await else {
                break;
            };
            total_bytes += result.map_err(|_| bad())??;
            if total_bytes > 512 * 1024 * 1024 {
                tasks.abort_all();
                return Err(Error::new(
                    "offline_limit",
                    "تجاوزت صور العمل حد الحفظ البالغ 512 ميغابايت.",
                ));
            }
            if let Some(job) = self.job.lock().await.as_mut() {
                job.completed += 1;
            }
        }
        let _guard = self.serial.lock().await;
        let mut entries = self.entries(owner)?;
        if entries.len() >= 1000 && !entries.iter().any(|e| e.id == work) {
            return Err(Error::new(
                "offline_limit",
                "وصلت المكتبة إلى حد ألف عمل محفوظ.",
            ));
        }
        let previous = self.pack(owner, work).ok();
        let conflict = previous.as_ref().is_some_and(|pack| pack.conflict);
        let mut pack = Pack {
            version: 1,
            work: data,
            state,
            pending: previous.map(|p| p.pending).unwrap_or_default(),
            conflict,
        };
        apply_pending(&mut pack)?;
        let entry = Entry {
            id: work.into(),
            title: pack.work["titleAr"]
                .as_str()
                .filter(|s| !s.is_empty())
                .or_else(|| pack.work["canonicalTitle"].as_str())
                .unwrap_or("عمل")
                .into(),
            poster_id: pack.work["poster"]["id"].as_str().map(str::to_owned),
            saved_at: now(),
            images: ids.len(),
            saved: true,
            pending: pack.pending.len(),
            conflict: pack.conflict,
        };
        self.put(owner, work, &pack)?;
        entries.retain(|entry| entry.id != work);
        entries.insert(0, entry);
        private_state::write_limit(&self.directory(owner), "index.json", &entries, 256 * 1024)
    }
    fn cleanup_images(&self, owner: &Owner, entries: &[Entry]) -> Result<(), Error> {
        let mut used = BTreeSet::new();
        for entry in entries {
            image_ids(&self.pack(owner, &entry.id)?.work, &mut used);
        }
        let dir = self.directory(owner).join("images");
        let files = match std::fs::read_dir(&dir) {
            Ok(files) => files,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(()),
            Err(_) => return Err(bad()),
        };
        for file in files {
            let file = file.map_err(|_| bad())?;
            let name = file.file_name();
            let name = name.to_string_lossy();
            if let Some(id) = name.strip_suffix(".json")
                && valid_id(id)
                && !used.contains(id)
            {
                private_state::remove(&dir, &name)?;
            }
        }
        Ok(())
    }
    pub async fn read(&self, command: &str, payload: &Value) -> Result<Value, Error> {
        let owner = self.owner().await?;
        let resource = id(payload, "id")?;
        if command == "artwork" {
            // Only UUID filenames inside this device's server/account namespace are read.
            return private_state::read_limit(
                &self.directory(&owner).join("images"),
                &format!("{resource}.json"),
                DOCUMENT_LIMIT,
            )?
            .ok_or_else(bad);
        }
        let pack = self.pack(&owner, &resource)?;
        match command {
            "work" => Ok(pack.work),
            "workState" => Ok(pack.state),
            _ => Err(bad()),
        }
    }
    /// Tracking is durable even when metadata/artwork was not explicitly saved for browsing.
    async fn track(&self, work: &str, transport: &ServerSession) -> Result<(), Error> {
        let owner = self.owner().await?;
        if self.entries(&owner)?.iter().any(|entry| entry.id == work) {
            return Ok(());
        }
        if owner.offline {
            return Err(Error::new(
                "not_saved",
                "بيانات هذا العمل غير متاحة دون اتصال.",
            ));
        }
        let data = call(transport, "work", json!({"id":work})).await?;
        let state = call(transport, "workState", json!({"id":work})).await?;
        let _guard = self.serial.lock().await;
        let mut entries = self.entries(&owner)?;
        if entries.iter().any(|entry| entry.id == work) {
            return Ok(());
        }
        if entries.len() >= 1000 {
            return Err(Error::new(
                "device_storage",
                "وصل سجل الجهاز إلى الحد الحالي؛ زامن المكتبة ونظّف التخزين.",
            ));
        }
        let entry = Entry {
            id: work.into(),
            title: data["titleAr"]
                .as_str()
                .filter(|s| !s.is_empty())
                .or_else(|| data["canonicalTitle"].as_str())
                .unwrap_or("عمل")
                .into(),
            poster_id: None,
            saved_at: now(),
            images: 0,
            saved: false,
            pending: 0,
            conflict: false,
        };
        let pack = Pack {
            version: 1,
            work: data,
            state,
            pending: vec![],
            conflict: false,
        };
        self.put(&owner, work, &pack)?;
        entries.push(entry);
        private_state::write_limit(&self.directory(&owner), "index.json", &entries, 256 * 1024)
    }
    pub async fn change(&self, work: &str, input: &Value, watched: bool) -> Result<Value, Error> {
        let owner = self.owner().await?;
        if !watched
            && input["scope"].as_str()
                != Some(format!("{}-{}", hash(&owner.server), hash(&owner.account)).as_str())
        {
            return Err(Error::new(
                "offline_owner",
                "تغيّرت المكتبة؛ لم يُنقل تقدم المشاهدة إلى حساب آخر.",
            ));
        }
        let _guard = self.serial.lock().await;
        let mut pack = self.pack(&owner, work)?;
        let installment = input.get("installmentId").and_then(Value::as_str);
        let episode = input.get("episodeId").and_then(Value::as_str);
        if installment.is_some_and(|id| !valid_id(id))
            || episode.is_some_and(|id| !valid_id(id))
            || (episode.is_some() && installment.is_none())
        {
            return Err(bad());
        }
        let position = if watched {
            None
        } else {
            Some(
                input["positionSeconds"]
                    .as_u64()
                    .filter(|n| *n <= 31_536_000)
                    .ok_or_else(bad)?,
            )
        };
        let duration = if watched {
            None
        } else {
            Some(
                input["durationSeconds"]
                    .as_u64()
                    .filter(|n| *n <= 31_536_000)
                    .ok_or_else(bad)?,
            )
        };
        let played = if watched {
            Some(input["isPlayed"].as_bool().ok_or_else(bad)?)
        } else {
            None
        };
        if !watched && installment.is_none() {
            return Err(bad());
        }
        let units = array(&pack.state["units"])?;
        let selected: Vec<_> = units
            .iter()
            .filter(|u| {
                installment.is_none_or(|i| u["installmentId"] == i)
                    && episode.is_none_or(|e| u["episodeId"] == e)
            })
            .cloned()
            .collect();
        if selected.is_empty() || (!watched && selected.len() != 1) {
            return Err(bad());
        }
        for unit in selected {
            let installment = id(&unit, "installmentId")?;
            let episode = unit["episodeId"].as_str().map(str::to_owned);
            if let Some(change) = pack
                .pending
                .iter_mut()
                .find(|c| c.installment_id == installment && c.episode_id == episode)
            {
                if watched {
                    change.is_played = played;
                } else {
                    change.position_seconds = position;
                    change.duration_seconds = duration;
                }
            } else {
                pack.pending.push(Change {
                    installment_id: installment,
                    episode_id: episode,
                    expected_updated_at: unit["updatedAt"].clone(),
                    expected_revision: unit["revision"].as_i64(),
                    is_played: played,
                    position_seconds: position,
                    duration_seconds: duration,
                });
            }
        }
        if pack.pending.len() > 10000 {
            return Err(bad());
        }
        apply_pending(&mut pack)?;
        self.put(&owner, work, &pack)?;
        Ok(pack.state)
    }
    async fn sync(&self, transport: &ServerSession) -> Result<Value, Error> {
        let owner = self.owner().await?;
        if owner.offline {
            return Err(Error::new(
                "offline_mode",
                "سجّل الدخول إلى حساب هذه المكتبة لمزامنة التغييرات.",
            ));
        }
        let _guard = self.serial.lock().await;
        let mut conflicts = Vec::new();
        let mut synced = 0;
        for entry in self.entries(&owner)? {
            let mut pack = self.pack(&owner, &entry.id)?;
            while let Some(change) = pack.pending.first().cloned() {
                if synced >= 5 {
                    break;
                }
                let mut input = serde_json::to_value(&change).map_err(|_| bad())?;
                input["workId"] = json!(entry.id);
                match call(transport, "syncTracking", input).await {
                    Ok(state) => {
                        pack.conflict = false;
                        pack.state = state;
                        pack.pending.remove(0);
                        apply_pending(&mut pack)?;
                        self.put(&owner, &entry.id, &pack)?;
                        synced += 1;
                    }
                    Err(error) if error.code == "conflict" => {
                        pack.conflict = true;
                        self.put(&owner, &entry.id, &pack)?;
                        conflicts.push(entry.id.clone());
                        break;
                    }
                    Err(error) => return Err(error),
                }
            }
        }
        Ok(json!({"synced":synced,"conflicts":conflicts}))
    }
}
async fn call(transport: &ServerSession, command: &str, payload: Value) -> Result<Value, Error> {
    transport
        .execute(Request {
            id: "saved-library".into(),
            command: command.into(),
            payload,
        })
        .await
}
fn image_ids(value: &Value, ids: &mut BTreeSet<String>) {
    match value {
        Value::Object(object) => {
            if object.contains_key("mimeType")
                && object.contains_key("width")
                && let Some(id) = object
                    .get("id")
                    .and_then(Value::as_str)
                    .filter(|id| valid_id(id))
            {
                ids.insert(id.into());
            }
            for value in object.values() {
                image_ids(value, ids);
            }
        }
        Value::Array(values) => {
            for value in values {
                image_ids(value, ids);
            }
        }
        _ => {}
    }
}
fn find_unit<'a>(state: &'a Value, change: &Change) -> Result<&'a Value, Error> {
    array(&state["units"])?
        .iter()
        .find(|unit| {
            unit["installmentId"] == change.installment_id
                && unit["episodeId"] == json!(change.episode_id)
        })
        .ok_or_else(bad)
}
fn apply_pending(pack: &mut Pack) -> Result<(), Error> {
    for change in &pack.pending {
        let units = pack.state["units"].as_array_mut().ok_or_else(bad)?;
        let unit = units
            .iter_mut()
            .find(|unit| {
                unit["installmentId"] == change.installment_id
                    && unit["episodeId"] == json!(change.episode_id)
            })
            .ok_or_else(bad)?;
        if let Some(played) = change.is_played {
            unit["isPlayed"] = json!(played);
            unit["playedManually"] = json!(true);
            unit["playedAt"] = if played { json!(now()) } else { Value::Null };
        }
        if let Some(position) = change.position_seconds {
            unit["positionSeconds"] = json!(position);
            unit["durationSeconds"] = json!(change.duration_seconds);
            if unit["playedManually"] != true
                && change.duration_seconds.is_some_and(|duration| {
                    duration > 0 && position.saturating_mul(10) >= duration.saturating_mul(9)
                })
            {
                unit["isPlayed"] = json!(true);
                if unit["playedAt"].is_null() {
                    unit["playedAt"] = json!(now());
                }
            }
        }
    }
    let units = array(&pack.state["units"])?;
    pack.state["summary"] = summary(units);
    let summaries: Vec<_> = array(&pack.state["installments"])?
        .iter()
        .map(|item| {
            let units: Vec<_> = pack.state["units"]
                .as_array()
                .into_iter()
                .flatten()
                .filter(|unit| unit["installmentId"] == item["installmentId"])
                .cloned()
                .collect();
            json!({"installmentId":item["installmentId"],"summary":summary(&units)})
        })
        .collect();
    pack.state["installments"] = json!(summaries);
    Ok(())
}
fn summary(units: &[Value]) -> Value {
    let released = units.iter().filter(|u| u["isReleased"] == true).count();
    let played = units
        .iter()
        .filter(|u| u["isReleased"] == true && u["isPlayed"] == true)
        .count();
    let full = released > 0 && played == released;
    json!({"catalogUnits":units.len(),"releasedUnits":released,"watchedReleasedUnits":units.iter().filter(|u|u["isReleased"]==true && u["isPlayed"]==true).count(),"isFullyWatched":full,"watchState":if full{"watched"}else if units.iter().any(|u|u["isPlayed"]==true || u["positionSeconds"].as_u64().unwrap_or(0)>0){"in-progress"}else{"unwatched"}})
}
