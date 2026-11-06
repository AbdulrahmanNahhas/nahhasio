//! Saved server addresses and immutable per-server transports. Switching is gated by the shell.
use crate::{
    bridge::{Error, Request},
    media_storage::Roots,
    private_state,
    services::ServerSession,
    session_store::SessionStore,
};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::{
    path::PathBuf,
    sync::{Arc, Mutex, RwLock},
};
use tokio::sync::{RwLock as AsyncRwLock, Semaphore};

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerInfo {
    #[serde(default)]
    pub server_id: Option<String>,
    pub product: String,
    pub name: String,
    pub version: String,
    pub api_version: u32,
    #[serde(default)]
    pub capabilities: Capabilities,
}
#[derive(Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Capabilities {
    #[serde(default)]
    pub artwork_variants: bool,
    #[serde(default)]
    pub remembered_accounts: bool,
}
#[derive(Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
struct SavedServer {
    url: String,
    name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    trust: Option<crate::server_trust::Trust>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    server_id: Option<String>,
}
#[derive(Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
struct Settings {
    version: u32,
    selected: String,
    servers: Vec<SavedServer>,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Address {
    url: String,
    #[serde(default)]
    name: String,
    #[serde(default)]
    trust: Option<crate::server_trust::Trust>,
}
#[derive(Clone)]
pub struct Services {
    active: Arc<RwLock<ServerSession>>,
    settings: Arc<Mutex<Settings>>,
    root: PathBuf,
    offline: crate::offline::Store,
    revision: Arc<std::sync::atomic::AtomicU64>,
    artwork_cache: Arc<crate::artwork_cache::Cache>,
    subtitles: Arc<crate::opensubtitles::Service>,
    pending: tokio::sync::watch::Sender<()>,
    pub permits: Arc<Semaphore>,
    pub operations: Arc<AsyncRwLock<()>>,
}
fn storage() -> Error {
    Error::new("device_storage", "تعذّر قراءة إعدادات الخوادم أو حفظها.")
}
fn address(input: &str) -> Result<String, Error> {
    let input = input.trim();
    if input.len() > 2048 || input.is_empty() {
        return Err(Error::new("server_address", "أدخل عنوان الخادم."));
    }
    let url = if input.contains("://") {
        input.to_owned()
    } else {
        format!("https://{input}")
    };
    ServerSession::new(&url)
        .map(|server| server.address().to_owned())
        .map_err(|_| {
            Error::new(
                "server_address",
                "استخدم عنوان HTTPS دون اسم مستخدم أو مسار إضافي. HTTP متاح للجهاز المحلي فقط.",
            )
        })
}
fn identity_error() -> Error {
    Error::new(
        "server_identity",
        "هذا العنوان لا يطابق هوية المكتبة المحفوظة. بقي الاتصال السابق دون تغيير.",
    )
}
fn verify_identity(expected: &str, info: &ServerInfo) -> Result<(), Error> {
    if !crate::bridge::valid_id(expected) || info.server_id.as_deref() != Some(expected) {
        return Err(identity_error());
    }
    Ok(())
}
impl Services {
    pub async fn artwork_bytes(
        &self,
        revision: u64,
        id: &str,
        width: u32,
    ) -> Result<(Vec<u8>, String), Error> {
        self.check_revision(revision)?;
        if !crate::bridge::valid_id(id) || ![0, 320, 640, 1280, 1920].contains(&width) {
            return Err(Error::new("bad_request", "صورة غير صالحة."));
        }
        if self.offline.is_offline().await {
            use base64::Engine;
            let value = self.offline.read("artwork", &json!({"id":id})).await?;
            let data = value["dataUrl"]
                .as_str()
                .ok_or_else(|| Error::new("not_found", "الصورة غير محفوظة."))?;
            let (mime, body) = data
                .strip_prefix("data:")
                .and_then(|s| s.split_once(";base64,"))
                .ok_or_else(|| Error::new("response", "صورة غير صالحة."))?;
            let bytes = base64::engine::general_purpose::STANDARD
                .decode(body)
                .map_err(|_| Error::new("response", "صورة غير صالحة."))?;
            return Ok((bytes, mime.into()));
        }
        let session = self.snapshot()?;
        let scope = self.catalog_scope().await?;
        let key = crate::artwork_cache::Cache::key(&scope, id, width);
        let _flight = self.artwork_cache.flight(&key).await;
        let cached = self.artwork_cache.read(&key).await?;
        if let Some(cached) = cached.as_ref().filter(|c| {
            let now = chrono::Utc::now().timestamp().max(0) as u64;
            c.metadata.verified_at <= now && now - c.metadata.verified_at < 30
        }) {
            session.ensure_authenticated().await?;
            self.check_revision(revision)?;
            self.artwork_cache.touch(&key, &cached.metadata).await?;
            let mut metrics = self.artwork_cache.metrics.lock().await;
            metrics.requests += 1;
            metrics.cache_hits += 1;
            return Ok((cached.bytes.clone(), cached.metadata.mime.clone()));
        }
        let (bytes, metadata, hit, queue, response) =
            session.artwork_bytes(id, width, cached).await?;
        self.check_revision(revision)?;
        if hit {
            self.artwork_cache.touch(&key, &metadata).await?;
        } else {
            self.artwork_cache
                .save(&key, metadata.clone(), &bytes)
                .await?;
        }
        let mut metrics = self.artwork_cache.metrics.lock().await;
        metrics.requests += 1;
        metrics.queue_micros += queue;
        metrics.response_micros += response;
        if hit {
            metrics.cache_hits += 1;
        } else {
            metrics.network_bytes += bytes.len() as u64;
        }
        Ok((bytes, metadata.mime))
    }
    pub fn revision(&self) -> u64 {
        self.revision.load(std::sync::atomic::Ordering::SeqCst)
    }
    pub fn check_revision(&self, expected: u64) -> Result<(), Error> {
        if self.revision() == expected {
            Ok(())
        } else {
            Err(Error::new(
                "connection_changed",
                "تغيّر الحساب أو الخادم. أعد المحاولة من المكتبة الحالية.",
            ))
        }
    }
    fn advance(&self) {
        self.revision
            .fetch_add(1, std::sync::atomic::Ordering::SeqCst);
        self.pending.send_replace(());
    }
    pub fn cancellation(&self) -> tokio::sync::watch::Receiver<()> {
        self.pending.subscribe()
    }
    pub fn begin_transition(&self, expected: u64) -> Result<u64, Error> {
        self.check_revision(expected)?;
        self.advance();
        Ok(self.revision())
    }
    pub async fn catalog_scope(&self) -> Result<String, Error> {
        self.offline.scope().await
    }
    pub async fn opensubtitle_file(&self, file_id: u64) -> Result<(PathBuf, Option<u64>), Error> {
        let scope = self.catalog_scope().await?;
        self.subtitles.download(&self.root, &scope, file_id).await
    }
    pub async fn playback_defaults(&self) -> Result<native_player::PlaybackDefaults, Error> {
        let scope = self.catalog_scope().await?;
        Ok(crate::playback_preferences::load(&self.root, &scope)?.native())
    }
    pub async fn saved_work(&self, id: &str) -> Result<Value, Error> {
        self.offline.read("work", &json!({"id":id})).await
    }
    pub async fn save_work_required(&self, id: &str) -> Result<(), Error> {
        let revision = self.revision();
        self.offline.save_required(&self.snapshot()?, id).await?;
        self.check_revision(revision)
    }
    pub fn new_persistent(default: &str) -> Result<Self, Error> {
        let root = Roots::discover().map_err(|_| storage())?.state;
        let default = address(default)?;
        let mut settings =
            private_state::read_limit::<Settings>(&root, "connections.json", 96 * 1024)?
                .unwrap_or_else(|| Settings {
                    version: 1,
                    selected: default.clone(),
                    servers: vec![SavedServer {
                        url: default.clone(),
                        name: "هذا الجهاز".into(),
                        trust: None,
                        server_id: None,
                    }],
                });
        if !matches!(settings.version, 1..=3)
            || settings.servers.is_empty()
            || settings.servers.len() > 8
        {
            return Err(storage());
        }
        let mut seen = std::collections::BTreeSet::new();
        for server in &mut settings.servers {
            if address(&server.url)? != server.url
                || server.name.is_empty()
                || server.name.chars().count() > 80
                || !seen.insert(server.url.clone())
                || server
                    .server_id
                    .as_ref()
                    .is_some_and(|id| !crate::bridge::valid_id(id))
            {
                return Err(storage());
            }
            ServerSession::with_trust(&server.url, server.trust.as_ref())?;
            if server.server_id.is_none() {
                server.server_id =
                    crate::offline::Store::new(root.clone()).known_identity(&server.url)?;
            }
        }
        if !settings
            .servers
            .iter()
            .any(|server| server.url == settings.selected)
        {
            return Err(storage());
        }
        if std::env::var_os("NAHHASIO_SERVER_URL").is_some() {
            settings.selected = default.clone();
            if !settings.servers.iter().any(|server| server.url == default) {
                if settings.servers.len() == 8 {
                    return Err(Error::new(
                        "server_limit",
                        "احذف اتصالًا محفوظًا قبل إضافة خادم آخر؛ الحد ثمانية خوادم.",
                    ));
                }
                settings.servers.push(SavedServer {
                    url: default,
                    name: "خادم مخصص".into(),
                    trust: None,
                    server_id: None,
                });
            }
        }
        let selected = settings
            .servers
            .iter()
            .find(|s| s.url == settings.selected)
            .ok_or_else(storage)?;
        let active = ServerSession::new_persistent(&settings.selected, selected.trust.as_ref())?;
        Ok(Self {
            permits: active.permits.clone(),
            active: Arc::new(RwLock::new(active)),
            settings: Arc::new(Mutex::new(settings)),
            offline: crate::offline::Store::new(root.clone()),
            artwork_cache: Arc::new(crate::artwork_cache::Cache::new(&root)),
            subtitles: Arc::new(crate::opensubtitles::Service::default()),
            root,
            operations: Arc::new(AsyncRwLock::new(())),
            revision: Arc::new(std::sync::atomic::AtomicU64::new(0)),
            pending: tokio::sync::watch::channel(()).0,
        })
    }
    pub(crate) fn snapshot(&self) -> Result<ServerSession, Error> {
        self.active
            .read()
            .map(|value| value.clone())
            .map_err(|_| storage())
    }
    fn remember_identity(&self, url: &str, info: &ServerInfo) -> Result<(), Error> {
        let mut settings = self.settings.lock().map_err(|_| storage())?;
        let mut next = settings.clone();
        let Some(server) = next.servers.iter_mut().find(|s| s.url == url) else {
            return Ok(());
        };
        if let Some(previous) = server.server_id.as_deref() {
            return verify_identity(previous, info);
        }
        let Some(id) = info.server_id.as_deref() else {
            return Ok(());
        };
        if !crate::bridge::valid_id(id) {
            return Err(identity_error());
        }
        server.server_id = Some(id.into());
        next.version = 3;
        private_state::write_limit(&self.root, "connections.json", &next, 96 * 1024)?;
        *settings = next;
        Ok(())
    }
    async fn update_address(&self, request: Request) -> Result<Value, Error> {
        #[derive(Deserialize)]
        #[serde(rename_all = "camelCase", deny_unknown_fields)]
        struct Move {
            previous_url: String,
            url: String,
        }
        let input: Move = serde_json::from_value(request.payload)
            .map_err(|_| Error::new("bad_request", "بيانات العنوان غير صالحة."))?;
        let previous = address(&input.previous_url)?;
        let url = address(&input.url)?;
        let saved = {
            let settings = self.settings.lock().map_err(|_| storage())?;
            if previous == url || settings.servers.iter().any(|s| s.url == url) {
                return Err(Error::new(
                    "conflict",
                    "العنوان محفوظ بالفعل. أدخل عنوانًا جديدًا لهذا الاتصال.",
                ));
            }
            settings
                .servers
                .iter()
                .find(|s| s.url == previous)
                .cloned()
                .ok_or_else(|| Error::new("not_found", "الاتصال السابق غير محفوظ."))?
        };
        if previous.starts_with("https:") && !url.starts_with("https:") {
            return Err(Error::new(
                "certificate",
                "لا يمكن تحويل اتصال HTTPS محفوظ إلى HTTP.",
            ));
        }
        let expected = saved
            .server_id
            .clone()
            .or(self.offline.known_identity(&previous)?);
        let expected = expected.ok_or_else(|| Error::new("server_identity", "لم تُحفظ هوية هذه المكتبة بعد. اختبر عنوانها السابق أو سجّل الدخول إليه مرة واحدة قبل تغيير العنوان."))?;
        // Probe anonymously with the existing authority and normal hostname validation.
        // A matching public UUID is never permission to forward the old origin's credentials.
        let candidate = ServerSession::with_trust(&url, saved.trust.as_ref())?;
        let info = candidate.probe().await?;
        verify_identity(&expected, &info)?;
        if request.command == "servers.addressProbe" {
            return Ok(json!({"url":url,"info":info}));
        }
        self.offline.identify(&previous, &expected).await?;
        self.offline.identify(&url, &expected).await?;
        for account in crate::credential_store::read(&self.root, &previous)?.accounts {
            if account.signed_out {
                self.offline.sign_out(&previous, Some(&account.id)).await?;
            }
        }
        // The replacement owns only credentials previously stored for its own address.
        let replacement = ServerSession::new_persistent_at(&url, saved.trust.as_ref(), &self.root)?;
        let selected;
        {
            let mut settings = self.settings.lock().map_err(|_| storage())?;
            if settings.servers.iter().any(|s| s.url == url) {
                return Err(Error::new(
                    "conflict",
                    "أضيف العنوان أثناء الفحص. أعد المحاولة.",
                ));
            }
            let mut next = settings.clone();
            let server = next
                .servers
                .iter_mut()
                .find(|s| s.url == previous)
                .ok_or_else(|| Error::new("conflict", "تغيّر الاتصال أثناء الفحص. أعد المحاولة."))?;
            server.url = url.clone();
            server.server_id = Some(expected);
            next.version = 3;
            selected = next.selected == previous;
            if selected {
                next.selected = url;
            }
            let mut active = self.active.write().map_err(|_| storage())?;
            private_state::write_limit(&self.root, "connections.json", &next, 96 * 1024)?;
            if selected {
                *active = replacement;
            }
            *settings = next;
        }
        if selected {
            self.offline.reset().await;
            self.advance();
        }
        self.state()
    }
    fn state(&self) -> Result<Value, Error> {
        let settings = self.settings.lock().map_err(|_| storage())?;
        let servers: Vec<Value> = settings.servers.iter().map(|s|
            json!({"url":s.url,"name":s.name,"trustedFingerprint":s.trust.as_ref().map(|t| &t.fingerprint),"serverId":s.server_id})
        ).collect();
        Ok(json!({"selected":settings.selected,"servers":servers}))
    }
    pub async fn execute(&self, request: Request) -> Result<Value, Error> {
        if request.command == "client.info" {
            self.catalog_scope().await?;
            let info = self.snapshot()?.probe().await?;
            let roots = Roots::discover().map_err(|_| storage())?;
            return Ok(
                json!({"version":env!("CARGO_PKG_VERSION"),"platform":"linux","serverVersion":info.version,"apiVersion":info.api_version,"videoRoot":roots.videos,"capabilities":{"nativePlayback":true,"offlineLibrary":true,"artworkVariants":info.capabilities.artwork_variants,"rememberedAccounts":info.capabilities.remembered_accounts,"subtitleSearch":true,"debrid":false}}),
            );
        }
        if request.command == "artwork.url" {
            let id = request.payload["id"]
                .as_str()
                .filter(|id| crate::bridge::valid_id(id))
                .ok_or_else(|| Error::new("bad_request", "صورة غير صالحة."))?;
            let width = request.payload["width"].as_u64().unwrap_or(640);
            if ![0, 320, 640, 1280, 1920].contains(&width) {
                return Err(Error::new("bad_request", "حجم صورة غير صالح."));
            }
            self.catalog_scope().await?;
            return Ok(
                json!({"url":format!("nahhasio://app/_artwork/{}/{id}/{width}",self.revision())}),
            );
        }
        if request.command.starts_with("artworkCache.") {
            self.catalog_scope().await?;
            return match request.command.as_str() {
                "artworkCache.status" => self.artwork_cache.status().await,
                "artworkCache.clear" => {
                    self.artwork_cache.clear().await?;
                    self.artwork_cache.status().await
                }
                _ => Err(Error::new("bad_request", "عملية غير صالحة.")),
            };
        }
        if request.command.starts_with("opensubtitles.") {
            let scope = self.catalog_scope().await?;
            return self
                .subtitles
                .execute(&self.root, &scope, &request.command, request.payload)
                .await;
        }
        if request.command.starts_with("playbackPreferences.") {
            let scope = self.catalog_scope().await?;
            return match request.command.as_str() {
                "playbackPreferences.load" => {
                    serde_json::to_value(crate::playback_preferences::load(&self.root, &scope)?)
                        .map_err(|_| storage())
                }
                "playbackPreferences.save" => {
                    crate::playback_preferences::save(&self.root, &scope, request.payload)
                }
                _ => Err(storage()),
            };
        }
        if request.command.starts_with("browsePreferences.") {
            let scope = self.catalog_scope().await?;
            return crate::browse_preferences::execute(
                &self.root,
                &scope,
                &request.command,
                request.payload,
            );
        }
        if request.command.starts_with("offline.") {
            let session = self.snapshot()?;
            let accounts = crate::credential_store::read(&self.root, session.address())?;
            if request.command == "offline.open"
                && accounts.accounts.iter().any(|a| {
                    a.signed_out && request.payload["accountId"].as_str() == Some(a.id.as_str())
                })
            {
                return Err(Error::new(
                    "unauthorized",
                    "سجّل الدخول إلى هذا الحساب مجددًا لفتح مكتبته.",
                ));
            }
            if request.command == "offline.profiles" {
                let mut value = self
                    .offline
                    .execute(session.address(), session.clone(), request)
                    .await?;
                if let Some(profiles) = value.as_array_mut() {
                    profiles.retain(|p| {
                        !accounts
                            .accounts
                            .iter()
                            .any(|a| a.signed_out && p["account"].as_str() == Some(a.id.as_str()))
                    });
                }
                return Ok(value);
            }
            let changes_mode = matches!(request.command.as_str(), "offline.open" | "offline.close");
            let result = self
                .offline
                .execute(session.address(), session.clone(), request)
                .await;
            if changes_mode && result.is_ok() {
                self.advance();
            }
            return result;
        }
        if self.offline.is_offline().await {
            return match request.command.as_str() {
                "work" | "workState" | "artwork" => {
                    self.offline.read(&request.command, &request.payload).await
                }
                "setWatched" => {
                    let work = request.payload["workId"]
                        .as_str()
                        .filter(|id| crate::bridge::valid_id(id))
                        .ok_or_else(|| Error::new("bad_request", "عمل غير صالح."))?;
                    self.offline.change(work, &request.payload, true).await
                }
                "session" => Ok(Value::Null),
                "logout" => {
                    self.offline.reset().await;
                    Ok(Value::Null)
                }
                _ => Err(Error::new(
                    "offline_mode",
                    "هذه الميزة تحتاج الاتصال بالخادم.",
                )),
            };
        }
        if request.command == "servers.list" {
            return self.state();
        }
        if matches!(
            request.command.as_str(),
            "servers.addressProbe" | "servers.addressUpdate"
        ) {
            return self.update_address(request).await;
        }
        if request.command.starts_with("servers.") {
            let input: Address = serde_json::from_value(request.payload)
                .map_err(|_| Error::new("bad_request", "بيانات الاتصال غير صالحة."))?;
            let url = address(&input.url)?;
            let name = input.name.trim();
            if name.chars().count() > 80 {
                return Err(Error::new("bad_request", "اسم الخادم طويل جدًا."));
            }
            let saved = self
                .settings
                .lock()
                .map_err(|_| storage())?
                .servers
                .iter()
                .find(|s| s.url == url)
                .cloned();
            // Changing trust for an existing origin requires removing that connection first.
            // Never silently send an existing session to a newly enrolled authority.
            if saved.is_some() && input.trust.is_some() {
                return Err(Error::new(
                    "conflict",
                    "أزل الاتصال المحفوظ قبل تغيير شهادة الثقة الخاصة به.",
                ));
            }
            let trust = match saved.as_ref() {
                Some(server) => server.trust.clone(),
                None => input.trust.map(|t| t.normalized()).transpose()?,
            };
            if request.command == "servers.probe" {
                let info = ServerSession::with_trust(&url, trust.as_ref())?
                    .probe()
                    .await?;
                self.remember_identity(&url, &info)?;
                return Ok(json!({"url":url,"info":info}));
            }
            if request.command == "servers.remove" {
                let mut settings = self.settings.lock().map_err(|_| storage())?;
                if settings.selected == url {
                    return Err(Error::new(
                        "conflict",
                        "اختر خادمًا آخر قبل إزالة هذا الاتصال.",
                    ));
                }
                let mut next = settings.clone();
                next.servers.retain(|server| server.url != url);
                SessionStore::new(&self.root).clear(&url)?;
                private_state::remove(&self.root, &crate::credential_store::name(&url))?;
                private_state::write_limit(&self.root, "connections.json", &next, 96 * 1024)?;
                *settings = next;
                drop(settings);
                return self.state();
            }
            if request.command == "servers.save" {
                let mut settings = self.settings.lock().map_err(|_| storage())?;
                let mut next = settings.clone();
                let existing = next
                    .servers
                    .iter_mut()
                    .find(|server| server.url == url)
                    .ok_or_else(|| Error::new("bad_request", "اختبر الاتصال بخادم جديد أولًا."))?;
                if name.is_empty() {
                    return Err(Error::new("bad_request", "أدخل اسمًا للاتصال."));
                }
                existing.name = name.into();
                private_state::write_limit(&self.root, "connections.json", &next, 96 * 1024)?;
                *settings = next;
                drop(settings);
                return self.state();
            }
            if request.command == "servers.select" {
                let session = ServerSession::new_persistent(&url, trust.as_ref())?;
                let info = session.probe().await?;
                self.remember_identity(&url, &info)?;
                {
                    let mut settings = self.settings.lock().map_err(|_| storage())?;
                    let mut next = settings.clone();
                    if let Some(existing) = next.servers.iter_mut().find(|server| server.url == url)
                    {
                        if !name.is_empty() {
                            existing.name = name.into();
                        }
                    } else {
                        if next.servers.len() == 8 {
                            return Err(Error::new(
                                "server_limit",
                                "يمكن حفظ ثمانية خوادم. احذف اتصالًا قديمًا أولًا.",
                            ));
                        }
                        if info.server_id.is_some() {
                            next.version = 3;
                        } else if trust.is_some() {
                            next.version = 2;
                        }
                        next.servers.push(SavedServer {
                            url: url.clone(),
                            name: if name.is_empty() {
                                info.name.chars().take(80).collect()
                            } else {
                                name.into()
                            },
                            trust,
                            server_id: info.server_id.clone(),
                        });
                    }
                    next.selected = url;
                    let mut active = self.active.write().map_err(|_| storage())?;
                    private_state::write_limit(&self.root, "connections.json", &next, 96 * 1024)?;
                    *active = session;
                    *settings = next;
                    drop(active);
                    drop(settings);
                }
                self.offline.reset().await;
                self.advance();
                return self.state();
            }
            return Err(Error::new("bad_request", "عملية اتصال غير معروفة."));
        }
        let session = self.snapshot()?;
        if matches!(
            request.command.as_str(),
            "accounts.switch" | "accounts.forget"
        ) {
            let restore = request.command == "accounts.forget"
                || (request.command == "accounts.switch"
                    && request.payload["accountId"].is_string());
            let forgotten_scope = if request.command == "accounts.forget" {
                request.payload["accountId"]
                    .as_str()
                    .map(|id| self.offline.account_scope(session.address(), id))
                    .transpose()?
            } else {
                None
            };
            self.advance();
            if request.command == "accounts.forget" {
                self.offline
                    .sign_out(session.address(), request.payload["accountId"].as_str())
                    .await?;
            }
            session.execute(request).await?;
            if let Some(scope) = forgotten_scope {
                crate::opensubtitles::Service::forget(&self.root, &scope)?;
            }
            self.offline.reset().await;
            if restore {
                let info = session.probe().await?;
                if let Some(id) = info.server_id {
                    self.offline.identify(session.address(), &id).await?;
                }
                let value = session
                    .execute(Request {
                        id: "resume".into(),
                        command: "session".into(),
                        payload: json!({}),
                    })
                    .await?;
                if !value.is_null() {
                    self.offline.remember(session.address(), &value).await?;
                }
                return Ok(value);
            }
            return Ok(Value::Null);
        }
        if request.command == "setWatched"
            && let Some(work) = request.payload["workId"].as_str()
            && self.offline.tracks(work).await
        {
            return self.offline.change(work, &request.payload, true).await;
        }
        if matches!(request.command.as_str(), "login" | "session") {
            let info = session.probe().await?;
            self.remember_identity(session.address(), &info)?;
            if request.command == "login"
                && request.payload["remember"] == true
                && !info.capabilities.remembered_accounts
            {
                return Err(Error::new(
                    "incompatible",
                    "حدّث الخادم لتفعيل تذكّر الحساب، أو ادخل مؤقتًا دون تذكّره.",
                ));
            }
            if let Some(id) = info.server_id {
                self.offline.identify(session.address(), &id).await?;
            }
        }
        let identity = matches!(request.command.as_str(), "login" | "session");
        let login = request.command == "login";
        let logout = request.command == "logout";
        let state_work = if request.command == "workState" {
            request.payload["id"].as_str().map(str::to_owned)
        } else if request.command == "setFavorite" {
            request.payload["workId"].as_str().map(str::to_owned)
        } else {
            None
        };
        let mut cancellation = self.cancellation();
        let mut result = tokio::select! {
            result=session.execute(request)=>result,
            _=cancellation.changed()=>Err(Error::new("connection_changed","تغيّر الحساب أو الخادم.")),
        };
        if let Some(work) = state_work
            && self.offline.tracks(&work).await
            && let Ok(state) = result
        {
            result = self.offline.merge_state(&work, state).await;
        }
        if logout {
            self.offline.sign_out(session.address(), None).await?;
            self.offline.reset().await;
            self.advance();
        }
        if identity {
            if let Ok(value) = &result {
                if !value.is_null() {
                    if login {
                        self.advance();
                    }
                    self.offline.remember(session.address(), value).await?;
                } else {
                    self.offline.reset().await;
                }
            } else if result.as_ref().is_err_and(|e| e.code == "unauthorized") {
                self.offline.reset().await;
            }
        }
        result
    }
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;
    use axum::{Router, http::HeaderMap, routing::get};
    const ID: &str = "97900000-0000-4000-8000-000000000001";
    fn fixture(url: &str, identity: Option<&str>) -> Services {
        let mut nonce = [0u8; 16];
        getrandom::fill(&mut nonce).unwrap();
        let root =
            std::env::temp_dir().join(format!("nahhasio-address-test-{}", hex::encode(nonce)));
        let active = ServerSession::new(url).unwrap();
        let settings = Settings {
            version: 3,
            selected: url.into(),
            servers: vec![SavedServer {
                url: url.into(),
                name: "Saved household".into(),
                trust: None,
                server_id: identity.map(str::to_owned),
            }],
        };
        private_state::write_limit(&root, "connections.json", &settings, 96 * 1024).unwrap();
        Services {
            permits: active.permits.clone(),
            active: Arc::new(RwLock::new(active)),
            settings: Arc::new(Mutex::new(settings)),
            offline: crate::offline::Store::new(root.clone()),
            artwork_cache: Arc::new(crate::artwork_cache::Cache::new(&root)),
            subtitles: Arc::new(crate::opensubtitles::Service::default()),
            root,
            operations: Arc::new(AsyncRwLock::new(())),
            revision: Arc::new(std::sync::atomic::AtomicU64::new(0)),
            pending: tokio::sync::watch::channel(()).0,
        }
    }
    pub(crate) fn media_fixture(url: &str) -> (Services, PathBuf) {
        let service = fixture(url, None);
        let root = service.root.clone();
        (service, root)
    }
    async fn candidate(id: Option<&str>) -> (String, tokio::task::JoinHandle<()>) {
        let info = json!({"serverId":id,"product":"nahhasio","name":"Household","version":"0.1.2","apiVersion":1});
        let router = Router::new()
            .route(
                "/api/v1/server/info",
                get(move |headers: HeaderMap| {
                    let info = info.clone();
                    async move {
                        assert!(!headers.contains_key("authorization"));
                        assert!(!headers.contains_key("cookie"));
                        axum::Json(info)
                    }
                }),
            )
            .route(
                "/api/health/ready",
                get(|headers: HeaderMap| async move {
                    assert!(!headers.contains_key("authorization"));
                    "ready"
                }),
            );
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = format!("http://{}/", listener.local_addr().unwrap());
        let task = tokio::spawn(async move {
            axum::serve(listener, router).await.unwrap();
        });
        (address, task)
    }
    fn request(command: &str, old: &str, new: &str) -> Request {
        Request {
            id: "address-test".into(),
            command: command.into(),
            payload: json!({"previousUrl":old,"url":new}),
        }
    }
    #[tokio::test]
    async fn verified_move_preserves_storage_and_never_copies_origin_credentials() {
        let old = "http://127.0.0.1:23199/";
        let service = fixture(old, None);
        service.offline.identify(old, ID).await.unwrap();
        private_state::write(
            &service.root,
            "session.json",
            &json!({"server":old,"token":"fixture-session","expires_at":"2099-01-01T00:00:00Z"}),
        )
        .unwrap();
        let (new, task) = candidate(Some(ID)).await;
        let original = std::fs::read(service.root.join("connections.json")).unwrap();
        service
            .update_address(request("servers.addressProbe", old, &new))
            .await
            .unwrap();
        assert_eq!(
            std::fs::read(service.root.join("connections.json")).unwrap(),
            original
        );
        let state = service
            .update_address(request("servers.addressUpdate", old, &new))
            .await
            .unwrap();
        assert_eq!(state["selected"], new);
        assert_eq!(state["servers"].as_array().unwrap().len(), 1);
        assert_eq!(state["servers"][0]["name"], "Saved household");
        assert_eq!(state["servers"][0]["serverId"], ID);
        assert_eq!(service.snapshot().unwrap().address(), new);
        let aliases: Vec<(String, String, String)> =
            private_state::read(&service.root, "server-identities.json")
                .unwrap()
                .unwrap();
        assert!(
            aliases
                .iter()
                .any(|(url, id, canonical)| url == &new && id == ID && canonical == old)
        );
        let sessions = SessionStore::new(&service.root);
        assert_eq!(
            sessions.load(old).unwrap().as_deref(),
            Some("fixture-session")
        );
        assert!(sessions.load(&new).unwrap().is_none());
        assert!(
            crate::credential_store::read(&service.root, &new)
                .unwrap()
                .accounts
                .is_empty()
        );
        let local_session = json!({"user":{"accountId":ID,"name":"Offline account"}});
        service
            .offline
            .remember(&new, &local_session)
            .await
            .unwrap();
        service.offline.sign_out(&new, Some(ID)).await.unwrap();
        let profiles = service
            .offline
            .execute(
                &new,
                service.snapshot().unwrap(),
                Request {
                    id: "profiles".into(),
                    command: "offline.profiles".into(),
                    payload: json!({}),
                },
            )
            .await
            .unwrap();
        assert!(profiles.as_array().unwrap().is_empty());
        let restored: Settings =
            private_state::read_limit(&service.root, "connections.json", 96 * 1024)
                .unwrap()
                .unwrap();
        assert_eq!(restored.selected, new);
        assert_eq!(restored.servers[0].server_id.as_deref(), Some(ID));
        task.abort();
        std::fs::remove_dir_all(service.root).unwrap();
    }
    #[tokio::test]
    async fn mismatched_or_missing_identity_leaves_saved_connection_unchanged() {
        for identity in [Some("97900000-0000-4000-8000-000000000002"), None] {
            let old = "http://127.0.0.1:23199/";
            let service = fixture(old, Some(ID));
            let (new, task) = candidate(identity).await;
            let original = std::fs::read(service.root.join("connections.json")).unwrap();
            let error = service
                .update_address(request("servers.addressUpdate", old, &new))
                .await
                .unwrap_err();
            assert_eq!(error.code, "server_identity");
            assert_eq!(
                std::fs::read(service.root.join("connections.json")).unwrap(),
                original
            );
            assert_eq!(service.snapshot().unwrap().address(), old);
            assert!(service.offline.known_identity(&new).unwrap().is_none());
            task.abort();
            std::fs::remove_dir_all(service.root).unwrap();
        }
    }
    #[tokio::test]
    async fn downgrade_duplicate_and_unidentified_moves_are_rejected() {
        let service = fixture("https://library.home/", Some(ID));
        let error = service
            .update_address(request(
                "servers.addressProbe",
                "https://library.home/",
                "http://127.0.0.1:23199/",
            ))
            .await
            .unwrap_err();
        assert_eq!(error.code, "certificate");
        let error = service
            .update_address(request(
                "servers.addressProbe",
                "https://library.home/",
                "https://library.home/",
            ))
            .await
            .unwrap_err();
        assert_eq!(error.code, "conflict");
        std::fs::remove_dir_all(service.root).unwrap();
        let service = fixture("http://127.0.0.1:23199/", None);
        let error = service
            .update_address(request(
                "servers.addressProbe",
                "http://127.0.0.1:23199/",
                "http://127.0.0.1:23198/",
            ))
            .await
            .unwrap_err();
        assert_eq!(error.code, "server_identity");
        std::fs::remove_dir_all(service.root).unwrap();
    }
    #[test]
    fn old_settings_remain_readable_and_known_id_cannot_disappear() {
        let settings:Settings=serde_json::from_value(json!({"version":1,"selected":"http://127.0.0.1:23103/","servers":[{"url":"http://127.0.0.1:23103/","name":"Legacy"}]})).unwrap();
        assert!(settings.servers[0].server_id.is_none());
        let service = fixture("http://127.0.0.1:23199/", Some(ID));
        let info: ServerInfo = serde_json::from_value(
            json!({"product":"nahhasio","name":"Legacy","version":"0.1","apiVersion":1}),
        )
        .unwrap();
        assert_eq!(
            service
                .remember_identity("http://127.0.0.1:23199/", &info)
                .unwrap_err()
                .code,
            "server_identity"
        );
        std::fs::remove_dir_all(service.root).unwrap();
    }
}
