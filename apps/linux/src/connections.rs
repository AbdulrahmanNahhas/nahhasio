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
    pub product: String,
    pub name: String,
    pub version: String,
    pub api_version: u32,
}
#[derive(Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
struct SavedServer {
    url: String,
    name: String,
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
}
#[derive(Clone)]
pub struct Services {
    active: Arc<RwLock<ServerSession>>,
    settings: Arc<Mutex<Settings>>,
    root: PathBuf,
    offline: crate::offline::Store,
    revision: Arc<std::sync::atomic::AtomicU64>,
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
        let mut settings = private_state::read::<Settings>(&root, "connections.json")?
            .unwrap_or_else(|| Settings {
                version: 1,
                selected: default.clone(),
                servers: vec![SavedServer {
                    url: default.clone(),
                    name: "هذا الجهاز".into(),
                }],
            });
        if settings.version != 1 || settings.servers.is_empty() || settings.servers.len() > 8 {
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
                });
            }
        }
        let active = ServerSession::new_persistent(&settings.selected)?;
        Ok(Self {
            permits: active.permits.clone(),
            active: Arc::new(RwLock::new(active)),
            settings: Arc::new(Mutex::new(settings)),
            offline: crate::offline::Store::new(root.clone()),
            root,
            operations: Arc::new(AsyncRwLock::new(())),
            revision: Arc::new(std::sync::atomic::AtomicU64::new(0)),
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
        Ok(json!({"selected":settings.selected,"servers":settings.servers}))
    }
    pub async fn execute(&self, request: Request) -> Result<Value, Error> {
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
            if request.command == "servers.probe" {
                let info = ServerSession::new(&url)?.probe().await?;
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
                private_state::write(&self.root, "connections.json", &next)?;
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
                private_state::write(&self.root, "connections.json", &next)?;
                *settings = next;
                drop(settings);
                return self.state();
            }
            if request.command == "servers.select" {
                let session = ServerSession::new_persistent(&url)?;
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
                        next.servers.push(SavedServer {
                            url: url.clone(),
                            name: if name.is_empty() {
                                info.name.clone()
                            } else {
                                name.into()
                            },
                        });
                    }
                    next.selected = url;
                    let mut active = self.active.write().map_err(|_| storage())?;
                    private_state::write(&self.root, "connections.json", &next)?;
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
        if request.command == "setWatched"
            && let Some(work) = request.payload["workId"].as_str()
            && self.offline.tracks(work).await
        {
            return self.offline.change(work, &request.payload, true).await;
        }
        if matches!(request.command.as_str(), "login" | "session") {
            session.probe().await?;
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
        let mut result = session.execute(request).await;
        if let Some(work) = state_work
            && self.offline.tracks(&work).await
            && let Ok(state) = result
        {
            result = self.offline.merge_state(&work, state).await;
        }
        if logout {
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
