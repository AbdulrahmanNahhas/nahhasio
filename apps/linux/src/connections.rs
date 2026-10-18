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
            root,
            operations: Arc::new(AsyncRwLock::new(())),
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
                let mut settings = self.settings.lock().map_err(|_| storage())?;
                let mut next = settings.clone();
                if let Some(existing) = next.servers.iter_mut().find(|server| server.url == url) {
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
                return self.state();
            }
            return Err(Error::new("bad_request", "عملية اتصال غير معروفة."));
        }
        let session = self.snapshot()?;
        if matches!(request.command.as_str(), "login" | "session") {
            session.probe().await?;
        }
        session.execute(request).await
    }
}
