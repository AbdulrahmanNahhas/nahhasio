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
impl Services {
    pub async fn artwork_bytes(
        &self,
        revision: u64,
        id: &str,
        width: u32,
    ) -> Result<(Vec<u8>, String), Error> {
        self.check_revision(revision)?;
        if !crate::bridge::valid_id(id) || ![320, 640, 1280, 1920].contains(&width) {
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
    pub async fn saved_work(&self, id: &str) -> Result<Value, Error> {
        self.offline.read("work", &json!({"id":id})).await
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
                    }],
                });
        if !matches!(settings.version, 1 | 2)
            || settings.servers.is_empty()
            || settings.servers.len() > 8
        {
            return Err(storage());
        }
        let mut seen = std::collections::BTreeSet::new();
        for server in &settings.servers {
            if address(&server.url)? != server.url
                || server.name.is_empty()
                || server.name.chars().count() > 80
                || !seen.insert(&server.url)
            {
                return Err(storage());
            }
            ServerSession::with_trust(&server.url, server.trust.as_ref())?;
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
            root,
            operations: Arc::new(AsyncRwLock::new(())),
            revision: Arc::new(std::sync::atomic::AtomicU64::new(0)),
            pending: tokio::sync::watch::channel(()).0,
        })
    }
    fn snapshot(&self) -> Result<ServerSession, Error> {
        self.active
            .read()
            .map(|value| value.clone())
            .map_err(|_| storage())
    }
    fn state(&self) -> Result<Value, Error> {
        let settings = self.settings.lock().map_err(|_| storage())?;
        let servers: Vec<Value> = settings.servers.iter().map(|s|
            json!({"url":s.url,"name":s.name,"trustedFingerprint":s.trust.as_ref().map(|t| &t.fingerprint)})
        ).collect();
        Ok(json!({"selected":settings.selected,"servers":servers}))
    }
    pub async fn execute(&self, request: Request) -> Result<Value, Error> {
        if request.command == "client.info" {
            self.catalog_scope().await?;
            let info = self.snapshot()?.probe().await?;
            let roots = Roots::discover().map_err(|_| storage())?;
            return Ok(
                json!({"version":env!("CARGO_PKG_VERSION"),"platform":"linux","serverVersion":info.version,"apiVersion":info.api_version,"videoRoot":roots.videos,"capabilities":{"nativePlayback":true,"offlineLibrary":true,"artworkVariants":info.capabilities.artwork_variants,"rememberedAccounts":info.capabilities.remembered_accounts,"subtitleSearch":false,"debrid":false}}),
            );
        }
        if request.command == "artwork.url" {
            let id = request.payload["id"]
                .as_str()
                .filter(|id| crate::bridge::valid_id(id))
                .ok_or_else(|| Error::new("bad_request", "صورة غير صالحة."))?;
            let width = request.payload["width"].as_u64().unwrap_or(640);
            if ![320, 640, 1280, 1920].contains(&width) {
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
                        if trust.is_some() {
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
            self.advance();
            if request.command == "accounts.forget" {
                self.offline
                    .sign_out(session.address(), request.payload["accountId"].as_str())
                    .await?;
            }
            session.execute(request).await?;
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
