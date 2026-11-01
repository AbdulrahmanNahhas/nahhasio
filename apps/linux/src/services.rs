//! Network work runs on Tokio workers. The session token never enters the UI.
use crate::bridge::{Error, Request, valid_id};
pub use crate::connections::Services;
use base64::{Engine as _, engine::general_purpose::STANDARD};
use reqwest::{Client, Method, Response};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::{sync::Arc, time::Duration};
use tokio::sync::{Mutex, Semaphore};
use url::Url;

#[derive(Clone)]
pub(crate) struct ServerSession {
    session_store: Option<Arc<crate::session_store::SessionStore>>,
    client: Client,
    base: Url,
    token: Arc<Mutex<Option<String>>>,
    pub permits: Arc<Semaphore>,
    network_permits: Arc<Semaphore>,
    artwork_permits: Arc<Semaphore>,
    vault: Arc<crate::credential_store::Vault>,
    identity: Arc<Mutex<Option<User>>>,
    renewal: Arc<Mutex<Option<LoginResponse>>>,
    renewal_guard: Arc<Mutex<()>>,
    legacy_session: Arc<std::sync::atomic::AtomicBool>,
}
#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Login {
    #[serde(skip_serializing_if = "Option::is_none")]
    email: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    account_id: Option<String>,
    password: String,
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    remember: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    installation_id: Option<String>,
}
#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct User {
    id: String,
    name: String,
    email: String,
    role: String,
    account_id: String,
    kind: String,
    avatar_key: String,
    bio: String,
    is_admin: bool,
    updated_at: String,
}
#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct LoginResponse {
    token: String,
    #[serde(default)]
    renewal_token: Option<String>,
    user: User,
    expires_at: String,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct CommentCommand {
    id: String,
    data: CommentData,
}
#[derive(serde::Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct CommentData {
    action: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    comment_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    parent_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    body: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    contains_spoilers: Option<bool>,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Resource {
    id: String,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct FavoriteCommand {
    work_id: String,
    is_favorite: bool,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct WatchedCommand {
    work_id: String,
    installment_id: Option<String>,
    episode_id: Option<String>,
    is_played: bool,
}
impl WatchedCommand {
    fn validate(&self) -> Result<(), Error> {
        if !valid_id(&self.work_id)
            || self
                .installment_id
                .as_deref()
                .is_some_and(|id| !valid_id(id))
            || self.episode_id.as_deref().is_some_and(|id| !valid_id(id))
            || (self.episode_id.is_some() && self.installment_id.is_none())
        {
            return Err(Error::new("bad_request", "Invalid watched target"));
        }
        Ok(())
    }
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct ActivityCommand {
    id: String,
    page: u32,
}
#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct AdminWorksQuery {
    #[serde(skip_serializing_if = "Option::is_none")]
    page: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    page_size: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    q: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    format: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    structure: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    workflow: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    visibility: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    gap: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    sort: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    language: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    status: Option<String>,
}
#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Browse {
    #[serde(skip_serializing_if = "Option::is_none")]
    page: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    page_size: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    q: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    sort: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    format: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    audience: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    genre: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    status: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    year_from: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    year_to: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    include_private: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    planet: Option<String>,
}
#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct CatalogQuery {
    #[serde(skip_serializing_if = "Option::is_none")]
    page: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    page_size: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    q: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    sort: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    group: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    view: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    privacy: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    filters: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    year_from: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    year_to: Option<u32>,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct TrailersQuery {
    #[serde(skip_serializing_if = "Option::is_none")]
    page: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    page_size: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    q: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    format: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    sort: Option<String>,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct EpisodesQuery {
    #[serde(skip_serializing_if = "Option::is_none")]
    kind: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    visibility: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    include_movies: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    page: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    page_size: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    watch_state: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    include_private: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    q: Option<String>,
}

#[derive(Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ReleasesQuery {
    #[serde(skip_serializing_if = "Option::is_none")]
    year: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    month: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    season: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    day: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    kind: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    scope: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    page: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    page_size: Option<u32>,
}
impl ReleasesQuery {
    fn validate(&self) -> Result<(), Error> {
        let scope = self.scope.as_deref().unwrap_or("year");
        if self.year.is_some_and(|n| !(1..=9999).contains(&n))
            || self.month.is_some_and(|n| !(1..=12).contains(&n))
            || self.season.is_some_and(|n| !(1..=4).contains(&n))
            || (self.season.is_some()
                && (scope != "year" || self.month.is_some() || self.day.is_some()))
            || self.day.is_some_and(|n| !(1..=31).contains(&n))
            || (self.day.is_some() && (scope != "year" || self.month.is_none()))
            || self.page.is_some_and(|n| !(1..=100_000).contains(&n))
            || self.page_size.is_some_and(|n| !(1..=100).contains(&n))
            || !matches!(
                self.kind.as_deref().unwrap_or("all"),
                "all" | "installments" | "episodes"
            )
            || !matches!(scope, "year" | "upcoming" | "undated")
            || (scope != "year" && (self.year.is_some() || self.month.is_some()))
        {
            return Err(Error::new("bad_request", "Invalid releases query"));
        }
        Ok(())
    }
}

fn sanitize_release_posters(value: &mut Value) {
    if let Some(items) = value.get_mut("items").and_then(Value::as_array_mut) {
        for item in items {
            if let Some(poster) = item.get_mut("poster") {
                let id = poster
                    .get("id")
                    .and_then(Value::as_str)
                    .filter(|id| valid_id(id))
                    .map(str::to_owned);
                let mime = poster.get("mimeType").and_then(Value::as_str);
                if let Some(id) = id
                    && matches!(
                        mime,
                        Some(
                            "image/jpeg" | "image/png" | "image/webp" | "image/avif" | "image/gif"
                        )
                    )
                    && let Some(fields) = poster.as_object_mut()
                {
                    // Artwork requests resolve registered UUIDs, never server-supplied external URLs or paths.
                    fields.retain(|key, _| {
                        matches!(
                            key.as_str(),
                            "id" | "url"
                                | "mimeType"
                                | "width"
                                | "height"
                                | "byteSize"
                                | "sha256"
                                | "originalFilename"
                                | "focalX"
                                | "focalY"
                        )
                    });
                    fields.insert("url".into(), Value::String(format!("/api/v1/artwork/{id}")));
                } else {
                    *poster = Value::Null;
                }
            }
        }
    }
}

fn parse<T: serde::de::DeserializeOwned>(value: Value) -> Result<T, Error> {
    serde_json::from_value(value).map_err(|_| Error::new("bad_request", "Invalid command fields"))
}
fn network(error: reqwest::Error) -> Error {
    use std::error::Error as _;
    let mut source = error.source();
    while let Some(cause) = source {
        if cause.to_string().to_lowercase().contains("certificate") {
            return Error::new(
                "certificate",
                "شهادة الخادم غير موثوقة أو غير صالحة. تحقق من العنوان والشهادة أو راجع مدير المكتبة؛ لن يُتجاوز التحقق الأمني.",
            );
        }
        source = cause.source();
    }
    if error.is_timeout() {
        Error::new(
            "timeout",
            "لم يستجب الخادم في الوقت المحدد. تحقق من العنوان والشبكة ثم أعد المحاولة.",
        )
    } else {
        Error::new(
            "network",
            "تعذّر الوصول إلى الخادم. تأكد من تشغيله واتصالك بالشبكة.",
        )
    }
}
impl ServerSession {
    pub fn new_persistent(
        base: &str,
        trust: Option<&crate::server_trust::Trust>,
    ) -> Result<Self, Error> {
        let mut service = Self::with_trust(base, trust)?;
        let roots = crate::media_storage::Roots::discover()
            .map_err(|_| Error::new("configuration", "تعذّر تحديد مجلد حالة التطبيق."))?;
        let store = crate::session_store::SessionStore::new(&roots.state);
        let legacy = store.load(service.base.as_str())?;
        service
            .legacy_session
            .store(legacy.is_some(), std::sync::atomic::Ordering::SeqCst);
        service.token = Arc::new(Mutex::new(legacy));
        service.session_store = Some(Arc::new(store));
        Ok(service)
    }
    async fn register_device(&self) -> Result<(), Error> {
        let Some(store) = &self.session_store else {
            return Ok(());
        };
        let response=self.authorized(Method::POST,"api/v1/me/device").await?.json(&json!({"installationId":store.installation_id()?,"name":"Nahhasio Desktop","platform":"linux"})).send().await.map_err(network)?;
        self.json(response).await?;
        Ok(())
    }
    async fn forget_stored_session(&self) -> Result<(), Error> {
        if let Some(store) = &self.session_store {
            store.clear(self.base.as_str())?;
            if let Some(user) = self.identity.lock().await.as_ref() {
                let mut accounts = crate::credential_store::read(store.root(), self.address())?;
                if let Some(account) = accounts
                    .accounts
                    .iter_mut()
                    .find(|a| a.id == user.account_id)
                {
                    account.credentials = None;
                    account.signed_out = true;
                }
                accounts.selected = None;
                crate::credential_store::write(store.root(), self.address(), &accounts)?;
            }
        }
        *self.renewal.lock().await = None;
        Ok(())
    }
    async fn save_remembered(&self, login: &LoginResponse) -> Result<(), Error> {
        let Some(store) = &self.session_store else {
            return Ok(());
        };
        let scope = format!("{}:{}", self.address(), login.user.account_id);
        let credentials = self.vault.seal(&scope, login).await?;
        let mut accounts = crate::credential_store::read(store.root(), self.address())?;
        let account = crate::credential_store::Account {
            id: login.user.account_id.clone(),
            name: login.user.name.clone(),
            avatar_key: login.user.avatar_key.clone(),
            credentials: Some(credentials),
            signed_out: false,
        };
        accounts.accounts.retain(|a| a.id != account.id);
        if accounts.accounts.len() >= 32 {
            return Err(Error::new(
                "account_limit",
                "يمكن تذكّر ٣٢ حسابًا على هذا الجهاز.",
            ));
        }
        accounts.selected = Some(account.id.clone());
        accounts.accounts.push(account);
        crate::credential_store::write(store.root(), self.address(), &accounts)?;
        store.clear(self.address())?;
        self.legacy_session
            .store(false, std::sync::atomic::Ordering::SeqCst);
        Ok(())
    }
    async fn restore_remembered(&self) -> Result<(), Error> {
        if self.token.lock().await.is_some() {
            return Ok(());
        }
        let Some(store) = &self.session_store else {
            return Ok(());
        };
        let accounts = crate::credential_store::read(store.root(), self.address())?;
        let Some(account) = accounts
            .accounts
            .iter()
            .find(|a| Some(&a.id) == accounts.selected.as_ref() && !a.signed_out)
        else {
            return Ok(());
        };
        let Some(credentials) = &account.credentials else {
            return Ok(());
        };
        let login: LoginResponse = self
            .vault
            .open(&format!("{}:{}", self.address(), account.id), credentials)
            .await?;
        *self.token.lock().await = Some(login.token.clone());
        *self.identity.lock().await = Some(login.user.clone());
        *self.renewal.lock().await = Some(login);
        Ok(())
    }
    async fn renew_if_needed(&self) -> Result<(), Error> {
        let _guard = self.renewal_guard.lock().await;
        let Some(current) = self.renewal.lock().await.clone() else {
            return Ok(());
        };
        let due = chrono::DateTime::parse_from_rfc3339(&current.expires_at)
            .ok()
            .is_none_or(|d| d <= chrono::Utc::now() + chrono::Duration::days(1));
        if !due {
            return Ok(());
        }
        let Some(renewal) = &current.renewal_token else {
            return Ok(());
        };
        let store = self
            .session_store
            .as_ref()
            .ok_or_else(|| Error::new("secure_storage", "مخزن الحساب غير متاح."))?;
        let response = self
            .client
            .post(self.url("api/v1/auth/renew"))
            .json(&json!({"renewalToken":renewal,"accessToken":current.token,"installationId":store.installation_id()?}))
            .send()
            .await
            .map_err(network)?;
        if response.status() == reqwest::StatusCode::UNAUTHORIZED {
            *self.token.lock().await = None;
            self.forget_stored_session().await?;
            return Err(Error::new(
                "unauthorized",
                "انتهت صلاحية الحساب المحفوظ. سجّل الدخول مجددًا.",
            ));
        }
        let login: LoginResponse = serde_json::from_slice(&self.body(response, 16384).await?)
            .map_err(|_| Error::new("response", "استجابة تجديد غير صالحة."))?;
        if login.user.account_id != current.user.account_id {
            return Err(Error::new("response", "تغيّرت هوية الحساب."));
        }
        // Persist the rotated token before exposing the new session to other operations.
        self.save_remembered(&login).await?;
        *self.token.lock().await = Some(login.token.clone());
        *self.identity.lock().await = Some(login.user.clone());
        *self.renewal.lock().await = Some(login);
        Ok(())
    }
    pub fn new(base: &str) -> Result<Self, Error> {
        Self::with_trust(base, None)
    }
    pub fn with_trust(
        base: &str,
        trust: Option<&crate::server_trust::Trust>,
    ) -> Result<Self, Error> {
        let base =
            Url::parse(base).map_err(|_| Error::new("configuration", "Invalid server address"))?;
        if base.username() != ""
            || base.password().is_some()
            || base.query().is_some()
            || base.fragment().is_some()
            || base.path() != "/"
            || !(base.scheme() == "https"
                || (base.scheme() == "http"
                    && matches!(
                        base.host_str(),
                        Some("127.0.0.1" | "localhost" | "::1" | "[::1]")
                    )))
        {
            return Err(Error::new(
                "configuration",
                "Server must use HTTPS or a loopback HTTP address",
            ));
        }
        let mut builder = Client::builder()
            .no_proxy()
            .timeout(Duration::from_secs(15))
            .connect_timeout(Duration::from_secs(3))
            .redirect(reqwest::redirect::Policy::none());
        if let Some(trust) = trust {
            if base.scheme() != "https" {
                return Err(Error::new(
                    "certificate",
                    "شهادة الخادم متاحة لاتصالات HTTPS فقط.",
                ));
            }
            builder = builder.add_root_certificate(trust.certificate()?);
        }
        let client = builder.build().map_err(network)?;
        Ok(Self {
            session_store: None,
            client,
            base,
            token: Arc::new(Mutex::new(None)),
            permits: Arc::new(Semaphore::new(64)),
            network_permits: Arc::new(Semaphore::new(6)),
            artwork_permits: Arc::new(Semaphore::new(4)),
            vault: Arc::new(crate::credential_store::Vault::default()),
            identity: Arc::new(Mutex::new(None)),
            renewal: Arc::new(Mutex::new(None)),
            renewal_guard: Arc::new(Mutex::new(())),
            legacy_session: Arc::new(std::sync::atomic::AtomicBool::new(false)),
        })
    }
    async fn editor_reply(&self, mut response: Response) -> Result<Value, Error> {
        let status = response.status().as_u16();
        if !matches!(status, 400 | 409) {
            return self.json_limit(response, 32 * 1024 * 1024).await;
        }
        // This fixed admin endpoint returns sanitized editorial errors, never SQL details.
        let mut bytes = Vec::new();
        while let Some(chunk) = response.chunk().await.map_err(network)? {
            if bytes.len() + chunk.len() > 16 * 1024 {
                return Err(Error::new(
                    "server",
                    "Editor error response exceeds the limit",
                ));
            }
            bytes.extend_from_slice(&chunk);
        }
        let value: Value = serde_json::from_slice(&bytes).unwrap_or(Value::Null);
        let message = value
            .get("message")
            .and_then(Value::as_str)
            .filter(|message| !message.trim().is_empty() && message.len() <= 4096)
            .unwrap_or("تعذّر تنفيذ عملية المحرر؛ راجع البيانات ثم أعد المحاولة.");
        Err(Error::new(
            if status == 409 {
                "conflict"
            } else {
                "bad_request"
            },
            message,
        ))
    }
    pub(crate) fn address(&self) -> &str {
        self.base.as_str()
    }
    pub(crate) async fn probe(&self) -> Result<crate::connections::ServerInfo, Error> {
        let response = self
            .client
            .get(self.url("api/v1/server/info"))
            .timeout(Duration::from_secs(5))
            .send()
            .await
            .map_err(network)?;
        if !response.status().is_success() {
            return Err(Error::new(
                "incompatible",
                "هذا العنوان لا يوفّر اتصال نحّاسيو المتوافق. تحقق من العنوان أو حدّث الخادم.",
            ));
        }
        let info: crate::connections::ServerInfo =
            serde_json::from_slice(&bounded_body(response, 16384).await?).map_err(|_| {
                Error::new("incompatible", "استجابة الخادم غير متوافقة مع هذا التطبيق.")
            })?;
        if info.product != "nahhasio"
            || info.api_version != 1
            || info.name.is_empty()
            || info.name.chars().count() > 100
            || info.version.len() > 64
        {
            return Err(Error::new(
                "incompatible",
                "إصدار الخادم غير متوافق. حدّث التطبيق أو الخادم قبل تسجيل الدخول.",
            ));
        }
        let response = self
            .client
            .get(self.url("api/health/ready"))
            .timeout(Duration::from_secs(5))
            .send()
            .await
            .map_err(network)?;
        if !response.status().is_success() {
            return Err(Error::new(
                "not_ready",
                "وصلنا إلى الخادم، لكن المكتبة غير جاهزة بعد. انتظر قليلًا أو راجع حالة الخادم.",
            ));
        }
        Ok(info)
    }
    fn url(&self, path: &str) -> Url {
        self.base.join(path).expect("fixed API route")
    }
    async fn body(&self, mut response: Response, max: usize) -> Result<Vec<u8>, Error> {
        if response.status() == reqwest::StatusCode::UNAUTHORIZED {
            *self.token.lock().await = None;
            self.forget_stored_session().await?;
            return Err(Error::new(
                "unauthorized",
                "Your session has expired. Sign in again.",
            ));
        }
        if !response.status().is_success() {
            return Err(Error::new(
                match response.status().as_u16() {
                    400 | 422 => "bad_request",
                    403 => "forbidden",
                    404 => "not_found",
                    409 => "conflict",
                    _ => "server",
                },
                match response.status().as_u16() {
                    400 | 422 => "The request or watched target is invalid.",
                    403 => "Your account cannot perform this operation.",
                    404 => "The work or selected target is no longer available.",
                    409 => "تغيّرت البيانات. أعد تحميل الصفحة قبل الحفظ.",
                    429 => "Too many attempts. Try again shortly.",
                    _ => "The server could not complete this request.",
                },
            ));
        }
        if response.content_length().is_some_and(|n| n > max as u64) {
            return Err(Error::new(
                "too_large",
                "Server response exceeds the desktop limit",
            ));
        }
        let mut bytes = Vec::new();
        while let Some(chunk) = response.chunk().await.map_err(network)? {
            if bytes.len() + chunk.len() > max {
                return Err(Error::new(
                    "too_large",
                    "Server response exceeds the desktop limit",
                ));
            }
            bytes.extend_from_slice(&chunk);
        }
        Ok(bytes)
    }
    async fn json(&self, response: Response) -> Result<Value, Error> {
        self.json_limit(response, 2 * 1024 * 1024).await
    }
    async fn json_limit(&self, response: Response, max: usize) -> Result<Value, Error> {
        let body = self.body(response, max).await?;
        serde_json::from_slice(&body)
            .map_err(|_| Error::new("response", "The server sent an invalid response"))
    }
    async fn authorized(
        &self,
        method: Method,
        path: &str,
    ) -> Result<reqwest::RequestBuilder, Error> {
        self.renew_if_needed().await?;
        let token = self
            .token
            .lock()
            .await
            .clone()
            .ok_or_else(|| Error::new("unauthorized", "Sign in to browse your library"))?;
        Ok(self
            .client
            .request(method, self.url(path))
            .bearer_auth(token))
    }
    pub async fn ensure_authenticated(&self) -> Result<(), Error> {
        self.renew_if_needed().await?;
        if self.token.lock().await.is_none() {
            return Err(Error::new("unauthorized", "سجّل الدخول إلى مكتبتك."));
        }
        Ok(())
    }
    pub async fn artwork_bytes(
        &self,
        id: &str,
        width: u32,
        cached: Option<crate::artwork_cache::Cached>,
    ) -> Result<(Vec<u8>, crate::artwork_cache::Metadata, bool, u64, u64), Error> {
        let queued = std::time::Instant::now();
        let _permit = self
            .artwork_permits
            .acquire()
            .await
            .map_err(|_| Error::new("internal", "Artwork stopped"))?;
        let queue = queued.elapsed().as_micros() as u64;
        let start = std::time::Instant::now();
        let mut request = self
            .authorized(Method::GET, &format!("api/v1/artwork/{id}?width={width}"))
            .await?;
        if let Some(cached) = &cached {
            request = request.header(reqwest::header::IF_NONE_MATCH, &cached.metadata.etag);
        }
        let response = request.send().await.map_err(network)?;
        if response.status() == reqwest::StatusCode::NOT_MODIFIED {
            let mut cached =
                cached.ok_or_else(|| Error::new("response", "Invalid artwork revalidation"))?;
            cached.metadata.verified_at = chrono::Utc::now().timestamp().max(0) as u64;
            return Ok((
                cached.bytes,
                cached.metadata,
                true,
                queue,
                start.elapsed().as_micros() as u64,
            ));
        }
        let mime = response
            .headers()
            .get(reqwest::header::CONTENT_TYPE)
            .and_then(|v| v.to_str().ok())
            .unwrap_or("")
            .split(';')
            .next()
            .unwrap_or("")
            .to_owned();
        let etag = response
            .headers()
            .get(reqwest::header::ETAG)
            .and_then(|v| v.to_str().ok())
            .unwrap_or("")
            .to_owned();
        let revision = response
            .headers()
            .get("x-artwork-revision")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("")
            .to_owned();
        let bytes = self.body(response, 10 * 1024 * 1024).await?;
        if ![
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/gif",
            "image/avif",
        ]
        .contains(&mime.as_str())
        {
            return Err(Error::new("response", "Unsupported artwork format"));
        }
        Ok((
            bytes,
            crate::artwork_cache::Metadata {
                etag,
                mime,
                revision,
                verified_at: chrono::Utc::now().timestamp().max(0) as u64,
            },
            false,
            queue,
            start.elapsed().as_micros() as u64,
        ))
    }
    pub async fn execute(&self, request: Request) -> Result<Value, Error> {
        let _permit = self
            .network_permits
            .acquire()
            .await
            .map_err(|_| Error::new("internal", "Desktop requests stopped"))?;
        match request.command.as_str() {
            "loginAccounts" => {
                let Some(store) = &self.session_store else {
                    return Ok(json!([]));
                };
                let accounts = crate::credential_store::read(store.root(), self.address())?;
                Ok(json!(
                    accounts
                        .accounts
                        .iter()
                        .filter(|a| !a.name.is_empty())
                        .map(|a| json!({"id":a.id,"name":a.name,"avatarKey":a.avatar_key}))
                        .collect::<Vec<_>>()
                ))
            }
            "accounts.status" => Ok(json!({"secureStorage":self.vault.available().await})),
            "accounts.switch" | "accounts.forget" => {
                let account = request.payload["accountId"]
                    .as_str()
                    .filter(|id| valid_id(id));
                let Some(store) = &self.session_store else {
                    return Err(Error::new("device_storage", "مخزن الحسابات غير متاح."));
                };
                let mut accounts = crate::credential_store::read(store.root(), self.address())?;
                let active_account = self
                    .identity
                    .lock()
                    .await
                    .as_ref()
                    .map(|u| u.account_id.clone());
                let forgetting_other = request.command == "accounts.forget"
                    && active_account
                        .as_deref()
                        .is_some_and(|id| Some(id) != account);
                if request.command == "accounts.forget" {
                    let id =
                        account.ok_or_else(|| Error::new("bad_request", "اختر حسابًا محفوظًا."))?;
                    let remembered = accounts
                        .accounts
                        .iter()
                        .find(|a| a.id == id)
                        .ok_or_else(|| Error::new("not_found", "الحساب غير محفوظ."))?;
                    let active_token = if active_account.as_deref() == Some(id) {
                        self.token.lock().await.clone()
                    } else {
                        None
                    };
                    let revoke = if let Some(token) = active_token {
                        Some(token)
                    } else if let Some(credentials) = &remembered.credentials {
                        let login: LoginResponse = self
                            .vault
                            .open(&format!("{}:{id}", self.address()), credentials)
                            .await?;
                        Some(login.token)
                    } else {
                        None
                    };
                    if let Some(token) = revoke {
                        let response = self
                            .client
                            .post(self.url("api/v1/auth/logout"))
                            .bearer_auth(token)
                            .send()
                            .await
                            .map_err(network)?;
                        if !response.status().is_success()
                            && response.status() != reqwest::StatusCode::UNAUTHORIZED
                        {
                            return Err(Error::new(
                                "server",
                                "تعذّر إلغاء جلسة الحساب؛ أعد المحاولة.",
                            ));
                        }
                    }
                    // The offline store owns the signed-out marker; forgotten tiles must free a slot.
                    accounts.accounts.retain(|account| account.id != id);
                }
                if forgetting_other {
                    crate::credential_store::write(store.root(), self.address(), &accounts)?;
                    return Ok(Value::Null);
                }
                accounts.selected = if request.command == "accounts.switch" {
                    account.map(str::to_owned)
                } else {
                    None
                };
                crate::credential_store::write(store.root(), self.address(), &accounts)?;
                store.clear(self.address())?;
                *self.token.lock().await = None;
                *self.identity.lock().await = None;
                *self.renewal.lock().await = None;
                Ok(Value::Null)
            }
            "login" => {
                self.legacy_session
                    .store(false, std::sync::atomic::Ordering::SeqCst);
                let mut input: Login = parse(request.payload)?;
                if input.remember {
                    if !self.vault.available().await {
                        return Err(Error::new(
                            "secure_storage",
                            "مخزن الأسرار غير متاح؛ ألغِ تذكّر الحساب للدخول مؤقتًا.",
                        ));
                    }
                    input.installation_id = self
                        .session_store
                        .as_ref()
                        .map(|s| s.installation_id())
                        .transpose()?;
                }
                let valid_identity = match (&input.email, &input.account_id) {
                    (Some(email), None) => email.len() <= 254 && !email.trim().is_empty(),
                    (None, Some(id)) => valid_id(id),
                    _ => false,
                };
                if !valid_identity || input.password.len() > 512 || input.password.is_empty() {
                    return Err(Error::new("bad_request", "Enter an email and password"));
                }
                // Serialize session changes; neither login data nor token is logged or returned.
                let mut token = self.token.lock().await;
                let response = self
                    .client
                    .post(self.url("api/v1/auth/login"))
                    .json(&input)
                    .send()
                    .await
                    .map_err(network)?;
                if response.status() == reqwest::StatusCode::UNAUTHORIZED {
                    return Err(Error::new("unauthorized", "Email or password is incorrect"));
                }
                if !response.status().is_success() {
                    return Err(Error::new("server", "Sign in failed. Try again shortly."));
                }
                let bytes = bounded_body(response, 16 * 1024).await?;
                let login: LoginResponse = serde_json::from_slice(&bytes)
                    .map_err(|_| Error::new("response", "Invalid login response"))?;
                *token = Some(login.token.clone());
                drop(token);
                *self.renewal.lock().await = None;
                *self.identity.lock().await = Some(login.user.clone());
                self.register_device().await?;
                if input.remember {
                    self.save_remembered(&login).await?;
                    *self.renewal.lock().await = Some(login.clone());
                } else if let Some(store) = &self.session_store {
                    store.clear(self.address())?;
                    let mut accounts = crate::credential_store::read(store.root(), self.address())?;
                    accounts.selected = None;
                    if let Some(a) = accounts
                        .accounts
                        .iter_mut()
                        .find(|a| a.id == login.user.account_id)
                    {
                        a.signed_out = false;
                    }
                    crate::credential_store::write(store.root(), self.address(), &accounts)?;
                }
                Ok(json!({"user":login.user,"expiresAt":login.expires_at}))
            }
            "logout" => {
                let mut token = self.token.lock().await;
                let old = token.take();
                self.forget_stored_session().await?;
                if let Some(old) = old {
                    let response = self
                        .client
                        .post(self.url("api/v1/auth/logout"))
                        .bearer_auth(old)
                        .send()
                        .await
                        .map_err(network)?;
                    if !response.status().is_success()
                        && response.status() != reqwest::StatusCode::UNAUTHORIZED
                    {
                        return Err(Error::new(
                            "server",
                            "Signed out locally; server session could not be revoked",
                        ));
                    }
                }
                Ok(Value::Null)
            }
            "session" => {
                self.restore_remembered().await?;
                if self.token.lock().await.is_none() {
                    return Ok(Value::Null);
                }
                let response = self
                    .authorized(Method::GET, "api/v1/auth/session")
                    .await?
                    .send()
                    .await
                    .map_err(network)?;
                if response.status() == reqwest::StatusCode::UNAUTHORIZED {
                    *self.token.lock().await = None;
                    self.forget_stored_session().await?;
                    return Ok(Value::Null);
                }
                let value = self.json(response).await?;
                let user: User = serde_json::from_value(value["user"].clone())
                    .map_err(|_| Error::new("response", "هوية حساب غير صالحة."))?;
                *self.identity.lock().await = Some(user.clone());
                self.register_device().await?;
                // Upgrade legacy plaintext sessions only after the server validates their owner.
                if self
                    .legacy_session
                    .load(std::sync::atomic::Ordering::SeqCst)
                    && self.vault.available().await
                {
                    let token = self
                        .token
                        .lock()
                        .await
                        .clone()
                        .ok_or_else(|| Error::new("unauthorized", "سجّل الدخول."))?;
                    let login = LoginResponse {
                        token,
                        renewal_token: None,
                        user,
                        expires_at: value["expiresAt"].as_str().unwrap_or("").into(),
                    };
                    self.save_remembered(&login).await?;
                }
                Ok(value)
            }
            "editorCall" => {
                let response = self
                    .authorized(Method::POST, "api/v1/admin/editor")
                    .await?
                    .timeout(Duration::from_secs(60))
                    .json(&request.payload)
                    .send()
                    .await
                    .map_err(network)?;
                self.editor_reply(response).await
            }
            "workDocument" => {
                let input: Resource = parse(request.payload)?;
                if !valid_id(&input.id) {
                    return Err(Error::new("bad_request", "Invalid work identifier"));
                }
                let response = self
                    .authorized(Method::GET, &format!("api/v1/admin/works/{}", input.id))
                    .await?
                    .send()
                    .await
                    .map_err(network)?;
                self.json_limit(response, 16 * 1024 * 1024).await
            }
            "workRead" | "workReview" | "workSave" => {
                let path = match request.command.as_str() {
                    "workRead" => "api/v1/admin/works/read",
                    "workReview" => "api/v1/admin/works/review",
                    _ => "api/v1/admin/works/save",
                };
                // Typed UI contracts and strict server schemas bound documents; destination is fixed.
                let response = self
                    .authorized(Method::POST, path)
                    .await?
                    .json(&request.payload)
                    .send()
                    .await
                    .map_err(network)?;
                self.json_limit(response, 16 * 1024 * 1024).await
            }
            "adminWorks" | "adminWorksSelection" => {
                let input: AdminWorksQuery = parse(request.payload)?;
                if input.page.is_some_and(|v| !(1..=100_000).contains(&v))
                    || input.page_size.is_some_and(|v| !(1..=100).contains(&v))
                    || input.q.as_ref().is_some_and(|v| v.chars().count() > 200)
                    || [
                        &input.format,
                        &input.structure,
                        &input.workflow,
                        &input.visibility,
                        &input.gap,
                        &input.language,
                        &input.status,
                        &input.sort,
                    ]
                    .iter()
                    .any(|v| v.as_ref().is_some_and(|s| s.len() > 32))
                {
                    return Err(Error::new("bad_request", "Invalid administration query"));
                }
                let response = self
                    .authorized(
                        Method::GET,
                        if request.command == "adminWorksSelection" {
                            "api/v1/admin/works/selection"
                        } else {
                            "api/v1/admin/works"
                        },
                    )
                    .await?
                    .query(&input)
                    .send()
                    .await
                    .map_err(network)?;
                self.json_limit(response, 16 * 1024 * 1024).await
            }
            "databaseSchema" | "databaseRows" => {
                #[derive(Deserialize)]
                #[serde(rename_all = "camelCase", deny_unknown_fields)]
                struct Inspection {
                    table: Option<String>,
                    page: Option<u32>,
                    page_size: Option<u32>,
                    q: Option<String>,
                    filter_column: Option<String>,
                    filter_value: Option<String>,
                }
                let input: Inspection = parse(request.payload)?;
                let path = if request.command == "databaseSchema" {
                    "api/v1/admin/database/schema".to_owned()
                } else {
                    let table = input
                        .table
                        .as_deref()
                        .filter(|s| {
                            !s.is_empty()
                                && s.len() <= 63
                                && s.bytes().all(|b| {
                                    b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'_'
                                })
                        })
                        .ok_or_else(|| Error::new("bad_request", "Invalid table"))?;
                    format!("api/v1/admin/database/{table}")
                };
                if input.page.is_some_and(|v| v == 0 || v > 100000)
                    || input.page_size.is_some_and(|v| v == 0 || v > 50)
                    || input.q.as_ref().is_some_and(|q| q.chars().count() > 200)
                    || input
                        .filter_column
                        .as_ref()
                        .is_some_and(|column| column.len() > 63)
                    || input
                        .filter_value
                        .as_ref()
                        .is_some_and(|value| value.chars().count() > 200)
                    || input.filter_column.is_some() != input.filter_value.is_some()
                {
                    return Err(Error::new("bad_request", "Invalid table query"));
                }
                let mut parameters = vec![
                    ("page", input.page.unwrap_or(1).to_string()),
                    ("pageSize", input.page_size.unwrap_or(25).to_string()),
                    ("q", input.q.unwrap_or_default()),
                ];
                if let (Some(column), Some(value)) = (input.filter_column, input.filter_value) {
                    parameters.push(("filterColumn", column));
                    parameters.push(("filterValue", value));
                }
                let response = self
                    .authorized(Method::GET, &path)
                    .await?
                    .query(&parameters)
                    .send()
                    .await
                    .map_err(network)?;
                self.json_limit(response, 16 * 1024 * 1024).await
            }
            "serverOverview"
            | "serverSettings"
            | "renameServer"
            | "updateProviders"
            | "serverOperations"
            | "requestServerOperation" => {
                let (method, path) = match request.command.as_str() {
                    "serverOverview" => (Method::GET, "api/v1/admin/server/overview"),
                    "serverSettings" => (Method::GET, "api/v1/admin/server/settings"),
                    "renameServer" => (Method::PATCH, "api/v1/admin/server/settings"),
                    "serverOperations" => (Method::GET, "api/v1/admin/server/operations"),
                    "requestServerOperation" => (Method::POST, "api/v1/admin/server/operations"),
                    _ => (Method::PUT, "api/v1/admin/server/providers"),
                };
                let write = method != Method::GET;
                let mut outgoing = self.authorized(method, path).await?;
                if write {
                    outgoing = outgoing.json(&request.payload);
                }
                let response = outgoing.send().await.map_err(network)?;
                self.json(response).await
            }
            "profileOverview" | "profileEntries" => {
                #[derive(Deserialize)]
                #[serde(deny_unknown_fields)]
                struct Input {
                    id: String,
                    section: Option<String>,
                    page: Option<i64>,
                }
                let input: Input = parse(request.payload)?;
                if !valid_id(&input.id)
                    || input.section.as_ref().is_some_and(|v| {
                        v.len() > 40 || !v.bytes().all(|b| b.is_ascii_lowercase() || b == b'-')
                    })
                    || input.page.is_some_and(|p| !(1..=100_000).contains(&p))
                {
                    return Err(Error::new("bad_request", "Invalid profile request"));
                }
                let suffix = if request.command == "profileOverview" {
                    "overview"
                } else {
                    "entries"
                };
                let mut request = self
                    .authorized(
                        Method::GET,
                        &format!("api/v1/profiles/{}/{suffix}", input.id),
                    )
                    .await?;
                if let Some(section) = input.section {
                    request = request.query(&[("section", section)]);
                }
                if let Some(page) = input.page {
                    request = request.query(&[("page", page)]);
                }
                let response = request.send().await.map_err(network)?;
                self.json(response).await
            }
            "publicProfile" => {
                let input: Resource = parse(request.payload)?;
                if !valid_id(&input.id) {
                    return Err(Error::new("bad_request", "Invalid profile identifier"));
                }
                let response = self
                    .authorized(Method::GET, &format!("api/v1/profiles/{}", input.id))
                    .await?
                    .send()
                    .await
                    .map_err(network)?;
                self.json(response).await
            }
            "profile" | "adminAccess" => {
                let path = if request.command == "profile" {
                    "api/v1/me"
                } else {
                    "api/v1/admin/access"
                };
                let response = self
                    .authorized(Method::GET, path)
                    .await?
                    .send()
                    .await
                    .map_err(network)?;
                self.json(response).await
            }
            "updateProfile" | "updatePassword" => {
                let (method, path) = if request.command == "updateProfile" {
                    (Method::PATCH, "api/v1/me")
                } else {
                    (Method::POST, "api/v1/me/password")
                };
                // Fixed destinations only. Rust/server validate fields; no role or URL commands.
                if !request.payload.is_object() {
                    return Err(Error::new("bad_request", "Invalid account request"));
                }
                let response = self
                    .authorized(method, path)
                    .await?
                    .json(&request.payload)
                    .send()
                    .await
                    .map_err(network)?;
                let value = self.json(response).await?;
                if request.command == "updatePassword" {
                    self.forget_stored_session().await?;
                } else {
                    let user: User = serde_json::from_value(value.clone())
                        .map_err(|_| Error::new("response", "هوية حساب غير صالحة."))?;
                    *self.identity.lock().await = Some(user.clone());
                    let remembered = self.renewal.lock().await.clone();
                    if let Some(mut login) = remembered {
                        login.user = user;
                        self.save_remembered(&login).await?;
                        *self.renewal.lock().await = Some(login);
                    }
                }
                Ok(value)
            }
            "avatar" => {
                #[derive(Deserialize)]
                #[serde(deny_unknown_fields)]
                struct Avatar {
                    key: String,
                }
                let input: Avatar = parse(request.payload)?;
                if !matches!(
                    input.key.as_str(),
                    "nahhasio-library.svg" | "nahhasio-orbit.svg"
                ) {
                    return Err(Error::new("bad_request", "Invalid avatar"));
                }
                let response = self
                    .authorized(Method::GET, &format!("api/v1/auth/avatars/{}", input.key))
                    .await?
                    .send()
                    .await
                    .map_err(network)?;
                if !response.status().is_success() {
                    return self.json(response).await;
                }
                if response
                    .headers()
                    .get("content-type")
                    .and_then(|v| v.to_str().ok())
                    != Some("image/svg+xml")
                {
                    return Err(Error::new("response", "Invalid avatar response"));
                }
                let bytes = self.body(response, 16384).await?;
                Ok(
                    json!({"dataUrl":format!("data:image/svg+xml;base64,{}",STANDARD.encode(bytes))}),
                )
            }
            "workState" => {
                let input: Resource = parse(request.payload)?;
                if !valid_id(&input.id) {
                    return Err(Error::new("bad_request", "Invalid work identifier"));
                }
                let response = self
                    .authorized(Method::GET, &format!("api/v1/works/{}/state", input.id))
                    .await?
                    .send()
                    .await
                    .map_err(network)?;
                self.json(response).await
            }
            "setFavorite" => {
                let input: FavoriteCommand = parse(request.payload)?;
                if !valid_id(&input.work_id) {
                    return Err(Error::new("bad_request", "Invalid work identifier"));
                }
                let response = self
                    .authorized(
                        Method::PUT,
                        &format!("api/v1/works/{}/favorite", input.work_id),
                    )
                    .await?
                    .json(&json!({"isFavorite":input.is_favorite}))
                    .send()
                    .await
                    .map_err(network)?;
                self.json(response).await
            }
            "setWatched" => {
                let input: WatchedCommand = parse(request.payload)?;
                input.validate()?;
                let response = self.authorized(Method::PATCH, &format!("api/v1/works/{}/watched",input.work_id)).await?
                    .json(&json!({"installmentId":input.installment_id,"episodeId":input.episode_id,"isPlayed":input.is_played}))
                    .send().await.map_err(network)?;
                self.json(response).await
            }
            "syncTracking" => {
                let work = request.payload["workId"]
                    .as_str()
                    .filter(|id| valid_id(id))
                    .ok_or_else(|| Error::new("bad_request", "Invalid tracking target"))?;
                let mut payload = request.payload.clone();
                payload
                    .as_object_mut()
                    .ok_or_else(|| Error::new("bad_request", "Invalid tracking request"))?
                    .remove("workId");
                let response = self
                    .authorized(Method::PATCH, &format!("api/v1/works/{work}/tracking"))
                    .await?
                    .json(&payload)
                    .send()
                    .await
                    .map_err(network)?;
                if response.status() == reqwest::StatusCode::CONFLICT {
                    return Err(Error::new(
                        "conflict",
                        "تغيّرت حالة المشاهدة على الخادم. اختر نسخة الجهاز أو الخادم.",
                    ));
                }
                self.json(response).await
            }
            "workComment" => {
                let input: CommentCommand = parse(request.payload)?;
                if !valid_id(&input.id)
                    || !matches!(input.data.action.as_str(), "create" | "update" | "delete")
                    || input
                        .data
                        .comment_id
                        .as_ref()
                        .is_some_and(|id| !valid_id(id))
                    || input
                        .data
                        .parent_id
                        .as_ref()
                        .is_some_and(|id| !valid_id(id))
                    || input
                        .data
                        .body
                        .as_ref()
                        .is_some_and(|body| body.chars().count() > 1200)
                {
                    return Err(Error::new("bad_request", "Invalid comment"));
                }
                let response = self
                    .authorized(Method::POST, &format!("api/v1/works/{}/comments", input.id))
                    .await?
                    .json(&input.data)
                    .send()
                    .await
                    .map_err(network)?;
                self.json(response).await
            }
            "workActivity" => {
                let input: ActivityCommand = parse(request.payload)?;
                if !valid_id(&input.id) || !(1..=100_000).contains(&input.page) {
                    return Err(Error::new("bad_request", "Invalid discussion query"));
                }
                let response = self
                    .authorized(Method::GET, &format!("api/v1/works/{}/activity", input.id))
                    .await?
                    .query(&[("page", input.page)])
                    .send()
                    .await
                    .map_err(network)?;
                self.json(response).await
            }
            "releases" => {
                let input: ReleasesQuery = parse(request.payload)?;
                input.validate()?;
                let response = self
                    .authorized(Method::GET, "api/v1/releases")
                    .await?
                    .query(&input)
                    .send()
                    .await
                    .map_err(network)?;
                let mut value = self.json(response).await?;
                sanitize_release_posters(&mut value);
                Ok(value)
            }
            "works" => {
                let input: Browse = parse(request.payload)?;
                if input.page_size.is_some_and(|n| n > 100 || n == 0)
                    || input.page.is_some_and(|n| n == 0 || n > 100_000)
                    || input.q.as_ref().is_some_and(|q| q.chars().count() > 200)
                {
                    return Err(Error::new("bad_request", "Invalid catalog pagination"));
                }
                let response = self
                    .authorized(Method::GET, "api/v1/works")
                    .await?
                    .query(&input)
                    .send()
                    .await
                    .map_err(network)?;
                self.json(response).await
            }
            "browse" | "facets" => {
                let input: CatalogQuery = parse(request.payload)?;
                if input.page_size.is_some_and(|n| n == 0 || n > 100)
                    || input.page.is_some_and(|n| n == 0 || n > 100_000)
                    || input.q.as_ref().is_some_and(|v| v.chars().count() > 200)
                    || input.filters.as_ref().is_some_and(|v| v.len() > 8000)
                    || input.group.as_deref().is_some_and(|v| {
                        !matches!(
                            v,
                            "none"
                                | "year"
                                | "format"
                                | "audience"
                                | "status"
                                | "watchState"
                                | "planet"
                                | "genre"
                                | "country"
                                | "studio"
                        )
                    })
                {
                    return Err(Error::new("bad_request", "Invalid catalog query"));
                }
                let path = if request.command == "browse" {
                    "api/v1/catalog/browse"
                } else {
                    "api/v1/catalog/facets"
                };
                let response = self
                    .authorized(Method::GET, path)
                    .await?
                    .query(&input)
                    .send()
                    .await
                    .map_err(network)?;
                self.json(response).await
            }

            "trailers" => {
                let input: TrailersQuery = parse(request.payload)?;
                if input.page.is_some_and(|n| !(1..=100_000).contains(&n))
                    || input.page_size.is_some_and(|n| !(1..=60).contains(&n))
                    || input.q.as_ref().is_some_and(|q| q.chars().count() > 200)
                    || input
                        .format
                        .as_deref()
                        .is_some_and(|v| !matches!(v, "animated" | "live-action"))
                    || input
                        .sort
                        .as_deref()
                        .is_some_and(|v| !matches!(v, "newest" | "title"))
                {
                    return Err(Error::new("bad_request", "Invalid trailer filters"));
                }
                let response = self
                    .authorized(Method::GET, "api/v1/catalog/trailers")
                    .await?
                    .query(&input)
                    .send()
                    .await
                    .map_err(network)?;
                self.json(response).await
            }
            "episodes" => {
                let input: EpisodesQuery = parse(request.payload)?;
                if input.page.is_some_and(|n| !(1..=100_000).contains(&n))
                    || input.page_size.is_some_and(|n| !(1..=100).contains(&n))
                    || input
                        .watch_state
                        .as_deref()
                        .is_some_and(|v| !matches!(v, "all" | "watched" | "unwatched"))
                    || input.q.as_ref().is_some_and(|q| q.chars().count() > 200)
                {
                    return Err(Error::new("bad_request", "Invalid episode pagination"));
                }
                let response = self
                    .authorized(Method::GET, "api/v1/catalog/episodes")
                    .await?
                    .query(&input)
                    .send()
                    .await
                    .map_err(network)?;
                self.json(response).await
            }
            "recommendations" => {
                let resource: Resource = parse(request.payload)?;
                if !valid_id(&resource.id) {
                    return Err(Error::new("bad_request", "Invalid catalog identifier"));
                }
                let response = self
                    .authorized(Method::GET, "api/v1/catalog/recommendations")
                    .await?
                    .query(&[("workId", resource.id)])
                    .send()
                    .await
                    .map_err(network)?;
                self.json(response).await
            }
            "filters" | "home" => {
                let response = self
                    .authorized(
                        Method::GET,
                        if request.command == "home" {
                            "api/v1/catalog/home"
                        } else {
                            "api/v1/catalog/filters"
                        },
                    )
                    .await?
                    .send()
                    .await
                    .map_err(network)?;
                self.json(response).await
            }
            "work" | "artwork" => {
                let resource: Resource = parse(request.payload)?;
                if !valid_id(&resource.id) {
                    return Err(Error::new("bad_request", "Invalid catalog identifier"));
                }
                let is_art = request.command == "artwork";
                let path = format!(
                    "api/v1/{}/{}",
                    if is_art { "artwork" } else { "works" },
                    resource.id
                );
                let response = self
                    .authorized(Method::GET, &path)
                    .await?
                    .send()
                    .await
                    .map_err(network)?;
                if !is_art {
                    return self.json(response).await;
                }
                if response.status() == reqwest::StatusCode::UNAUTHORIZED {
                    *self.token.lock().await = None;
                    self.forget_stored_session().await?;
                    return Err(Error::new(
                        "unauthorized",
                        "Your session has expired. Sign in again.",
                    ));
                }
                if !response.status().is_success() {
                    return Err(Error::new("server", "Artwork is currently unavailable"));
                }
                let mime = response
                    .headers()
                    .get(reqwest::header::CONTENT_TYPE)
                    .and_then(|v| v.to_str().ok())
                    .unwrap_or("")
                    .split(';')
                    .next()
                    .unwrap_or("")
                    .to_owned();
                if !matches!(
                    mime.as_str(),
                    "image/jpeg" | "image/png" | "image/webp" | "image/avif" | "image/gif"
                ) {
                    return Err(Error::new("response", "Unsupported artwork format"));
                }
                let bytes = self.body(response, 10 * 1024 * 1024).await?;
                Ok(json!({"dataUrl":format!("data:{mime};base64,{}",STANDARD.encode(bytes))}))
            }
            "appInfo" => Ok(
                json!({"version":env!("CARGO_PKG_VERSION"),"apiUrl":self.base.as_str(),"platform":"linux","playerAvailable":false}),
            ),
            _ => Err(Error::new("bad_request", "Unknown desktop command")),
        }
    }
}
async fn bounded_body(mut response: Response, max: usize) -> Result<Vec<u8>, Error> {
    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(network)? {
        if bytes.len() + chunk.len() > max {
            return Err(Error::new(
                "too_large",
                "Server response exceeds the desktop limit",
            ));
        }
        bytes.extend_from_slice(&chunk);
    }
    Ok(bytes)
}
#[cfg(test)]
mod tests {
    use super::ServerSession as Services;
    #[tokio::test]
    async fn new_catalog_groups_reach_authorization_instead_of_bad_request() {
        let service = Services::new("http://127.0.0.1:9/").unwrap();
        for group in ["planet", "genre", "country", "studio"] {
            let error = service
                .execute(crate::bridge::Request {
                    id: "group-check".into(),
                    command: "browse".into(),
                    payload: serde_json::json!({"group":group,"page":1,"pageSize":30}),
                })
                .await
                .unwrap_err();
            assert_eq!(
                error.code, "unauthorized",
                "group {group} must reach authorization"
            );
        }
        let error = service
            .execute(crate::bridge::Request {
                id: "group-check".into(),
                command: "browse".into(),
                payload: serde_json::json!({"group":"unsupported"}),
            })
            .await
            .unwrap_err();
        assert_eq!(error.code, "bad_request");
    }

    use super::*;
    #[tokio::test]
    async fn releases_validate_before_network_and_require_session() {
        let service = Services::new("http://127.0.0.1:1").unwrap();
        for payload in [
            json!({"year":0}),
            json!({"year":10000}),
            json!({"month":0}),
            json!({"month":13}),
            json!({"month":1,"day":0}),
            json!({"month":1,"day":32}),
            json!({"month":1,"day":1.5}),
            json!({"day":1}),
            json!({"scope":"upcoming","month":1,"day":1}),
            json!({"scope":"undated","day":1}),
            json!({"page":0}),
            json!({"page":100001}),
            json!({"pageSize":0}),
            json!({"pageSize":101}),
            json!({"kind":"private"}),
            json!({"scope":"available"}),
            json!({"scope":"upcoming","year":2026}),
            json!({"scope":"undated","month":1}),
            json!({"includePrivate":true}),
            json!({"url":"https://example.org"}),
            json!({"year":2026.5}),
        ] {
            let error = service
                .execute(Request {
                    id: "test".into(),
                    command: "releases".into(),
                    payload,
                })
                .await
                .unwrap_err();
            assert_eq!(error.code, "bad_request");
        }
        for payload in [
            json!({}),
            json!({"scope":"upcoming"}),
            json!({"scope":"undated","kind":"episodes"}),
            json!({"year":1,"month":12,"pageSize":100}),
            json!({"month":1,"day":1,"pageSize":1}),
            json!({"scope":"year","month":2,"day":31}),
        ] {
            let error = service
                .execute(Request {
                    id: "test".into(),
                    command: "releases".into(),
                    payload,
                })
                .await
                .unwrap_err();
            assert_eq!(error.code, "unauthorized");
        }
    }

    #[tokio::test]
    async fn releases_transport_is_guarded_get_and_clears_expired_session() {
        use std::io::{Read, Write};
        const ID: &str = "00112233-4455-4677-8899-aabbccddeeff";
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        let server = std::thread::spawn(move || {
            for index in 0..2 {
                let (mut stream, _) = listener.accept().unwrap();
                stream
                    .set_read_timeout(Some(Duration::from_secs(5)))
                    .unwrap();
                let mut incoming = Vec::new();
                loop {
                    let mut chunk = [0; 1024];
                    let count = stream.read(&mut chunk).unwrap();
                    assert!(count > 0 && incoming.len() + count <= 4096);
                    incoming.extend_from_slice(&chunk[..count]);
                    if incoming.windows(4).any(|bytes| bytes == b"\r\n\r\n") {
                        break;
                    }
                }
                let headers = String::from_utf8(incoming).unwrap();
                let line = headers.lines().next().unwrap();
                if index == 0 {
                    assert_eq!(
                        line,
                        "GET /api/v1/releases?year=2026&month=10&day=11&kind=episodes&scope=year&page=2&pageSize=100 HTTP/1.1"
                    );
                } else {
                    assert_eq!(line, "GET /api/v1/releases?scope=upcoming HTTP/1.1");
                }
                assert!(
                    headers
                        .to_ascii_lowercase()
                        .contains("authorization: bearer fixture-only-token")
                );
                assert!(!line.contains("token"));
                let (status, body) = if index == 0 {
                    ("200 OK", json!({"items":[{"poster":{"id":ID,"mimeType":"image/png","url":"https://untrusted.example/image","storagePath":"/private"}}],"total":150,"page":2,"pageSize":100,"years":[2026],"days":[{"date":"2026-10-11","count":150}],"asOf":"2026-10-11"}).to_string())
                } else {
                    ("401 Unauthorized", "{}".into())
                };
                write!(stream,"HTTP/1.1 {status}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",body.len()).unwrap();
            }
        });
        let service = Services::new(&format!("http://{address}/")).unwrap();
        *service.token.lock().await = Some("fixture-only-token".into());
        let result = service.execute(Request {id:"test".into(),command:"releases".into(),payload:json!({"year":2026,"month":10,"day":11,"kind":"episodes","scope":"year","page":2,"pageSize":100})}).await.unwrap();
        assert_eq!(
            result["items"][0]["poster"]["url"],
            format!("/api/v1/artwork/{ID}")
        );
        assert!(result["items"][0]["poster"].get("storagePath").is_none());
        assert!(result.get("token").is_none());
        assert_eq!(result["days"], json!([{"date":"2026-10-11","count":150}]));
        let error = service
            .execute(Request {
                id: "test".into(),
                command: "releases".into(),
                payload: json!({"scope":"upcoming"}),
            })
            .await
            .unwrap_err();
        assert_eq!(error.code, "unauthorized");
        assert!(service.token.lock().await.is_none());
        server.join().unwrap();
    }

    #[test]
    fn releases_posters_use_only_registered_artwork_routes() {
        const ID: &str = "00112233-4455-4677-8899-aabbccddeeff";
        let mut page = json!({"items":[
            {"poster":{"id":ID,"url":"file:///private/image","mimeType":"image/png","storagePath":"/private/image","width":300}},
            {"poster":{"id":"../private","url":"https://example.org","mimeType":"image/png"}},
            {"poster":{"id":ID,"mimeType":"image/svg+xml"}},
            {"poster":null}
        ]});
        sanitize_release_posters(&mut page);
        assert_eq!(
            page["items"][0]["poster"]["url"],
            format!("/api/v1/artwork/{ID}")
        );
        assert_eq!(page["items"][0]["poster"]["width"], 300);
        assert!(page["items"][0]["poster"].get("storagePath").is_none());
        for index in 1..4 {
            assert!(page["items"][index]["poster"].is_null());
        }
    }

    #[test]
    fn server_addresses_reject_plaintext_remote_and_credentials() {
        assert!(Services::new("http://127.0.0.1:23103").is_ok());
        assert!(Services::new("http://192.168.1.2:23103").is_err());
        assert!(Services::new("https://user:secret@example.org").is_err());
        assert!(Services::new("https://example.org/path").is_err());
    }
    #[tokio::test]
    async fn viewer_commands_validate_targets_before_network_and_require_session() {
        const ID: &str = "00112233-4455-4677-8899-aabbccddeeff";
        let service = Services::new("http://127.0.0.1:1").unwrap();
        for (command, payload, code) in [
            ("workState", json!({"id":ID}), "unauthorized"),
            (
                "setFavorite",
                json!({"workId":ID,"isFavorite":false}),
                "unauthorized",
            ),
            (
                "setWatched",
                json!({"workId":ID,"isPlayed":true}),
                "unauthorized",
            ),
            ("workActivity", json!({"id":ID,"page":1}), "unauthorized"),
            (
                "setWatched",
                json!({"workId":ID,"episodeId":ID,"isPlayed":true}),
                "bad_request",
            ),
            (
                "setWatched",
                json!({"workId":ID,"installmentId":"../secret","isPlayed":true}),
                "bad_request",
            ),
            (
                "setWatched",
                json!({"workId":ID,"accountId":ID,"isPlayed":true}),
                "bad_request",
            ),
            (
                "setFavorite",
                json!({"workId":ID,"isFavorite":false,"notes":"overwrite"}),
                "bad_request",
            ),
            ("workActivity", json!({"id":ID,"page":0}), "bad_request"),
            (
                "workActivity",
                json!({"id":ID,"page":100_001}),
                "bad_request",
            ),
        ] {
            let error = service
                .execute(Request {
                    id: "test".into(),
                    command: command.into(),
                    payload,
                })
                .await
                .unwrap_err();
            assert_eq!(error.code, code);
        }
    }

    #[tokio::test]
    async fn viewer_transport_uses_allowlisted_routes_and_keeps_bearer_native() {
        use std::io::{Read, Write};
        const ID: &str = "00112233-4455-4677-8899-aabbccddeeff";
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        let state = json!({"workId":ID,"isFavorite":true,"units":[],"installments":[],"summary":{"catalogUnits":0,"releasedUnits":0,"watchedReleasedUnits":0,"isFullyWatched":false,"watchState":"unwatched"}});
        let fixture_state = state.clone();
        let server = std::thread::spawn(move || {
            for (index, (method, suffix, expected_body)) in [
                ("GET", "state", None),
                ("PUT", "favorite", Some(json!({"isFavorite":true}))),
                (
                    "PATCH",
                    "watched",
                    Some(json!({"installmentId":null,"episodeId":null,"isPlayed":true})),
                ),
                (
                    "PATCH",
                    "watched",
                    Some(json!({"installmentId":ID,"episodeId":ID,"isPlayed":false})),
                ),
                ("GET", "activity?page=2", None),
                ("GET", "state", None),
            ]
            .into_iter()
            .enumerate()
            {
                let (mut stream, _) = listener.accept().unwrap();
                stream
                    .set_read_timeout(Some(Duration::from_secs(5)))
                    .unwrap();
                let mut incoming = Vec::new();
                let (end, length) = loop {
                    let mut chunk = [0; 1024];
                    let count = stream.read(&mut chunk).unwrap();
                    assert!(count > 0 && incoming.len() + count <= 4096);
                    incoming.extend_from_slice(&chunk[..count]);
                    if let Some(end) = incoming.windows(4).position(|bytes| bytes == b"\r\n\r\n") {
                        let headers = String::from_utf8_lossy(&incoming[..end]);
                        let length = headers
                            .lines()
                            .find_map(|line| {
                                line.to_ascii_lowercase()
                                    .strip_prefix("content-length:")
                                    .and_then(|s| s.trim().parse::<usize>().ok())
                            })
                            .unwrap_or(0);
                        if incoming.len() >= end + 4 + length {
                            break (end, length);
                        }
                    }
                };
                let headers = String::from_utf8_lossy(&incoming[..end]);
                assert!(
                    headers.starts_with(&format!("{method} /api/v1/works/{ID}/{suffix} HTTP/1.1"))
                );
                assert!(
                    headers
                        .to_ascii_lowercase()
                        .contains("authorization: bearer fixture-only-token")
                );
                if let Some(expected) = expected_body {
                    assert_eq!(
                        serde_json::from_slice::<Value>(&incoming[end + 4..end + 4 + length])
                            .unwrap(),
                        expected
                    );
                } else {
                    assert_eq!(length, 0);
                }
                let status = if index == 5 {
                    "404 Not Found"
                } else {
                    "200 OK"
                };
                let response = if index == 4 {
                    json!({"workId":ID,"items":[],"total":0,"page":2,"pageSize":20})
                } else {
                    fixture_state.clone()
                }
                .to_string();
                write!(stream,"HTTP/1.1 {status}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{response}",response.len()).unwrap();
            }
        });
        let service = Services::new(&format!("http://{address}/")).unwrap();
        *service.token.lock().await = Some("fixture-only-token".into());
        for (command, payload) in [
            ("workState", json!({"id":ID})),
            ("setFavorite", json!({"workId":ID,"isFavorite":true})),
            ("setWatched", json!({"workId":ID,"isPlayed":true})),
            (
                "setWatched",
                json!({"workId":ID,"installmentId":ID,"episodeId":ID,"isPlayed":false}),
            ),
            ("workActivity", json!({"id":ID,"page":2})),
        ] {
            let response = service
                .execute(Request {
                    id: "test".into(),
                    command: command.into(),
                    payload,
                })
                .await
                .unwrap();
            assert_eq!(response["workId"], ID);
            assert!(response.get("token").is_none());
            if command != "workActivity" {
                assert_eq!(response, state);
            }
        }
        let error = service
            .execute(Request {
                id: "test".into(),
                command: "workState".into(),
                payload: json!({"id":ID}),
            })
            .await
            .unwrap_err();
        assert_eq!(error.code, "not_found");
        assert!(service.token.lock().await.is_some());
        server.join().unwrap();
    }

    #[tokio::test]
    async fn login_keeps_credentials_native_and_expired_session_clears_them() {
        use std::io::{Read, Write};
        let listener = std::net::TcpListener::bind("127.0.0.1:0").expect("local test listener");
        let address = listener.local_addr().expect("local address");
        let server = std::thread::spawn(move || {
            for (status, body) in [
                (
                    "200 OK",
                    r#"{"token":"fixture-only-token","user":{"id":"owner","name":"Test","email":"test@example.invalid","role":"owner","accountId":"00000000-0000-4000-8000-000000000001","kind":"admin","avatarKey":"nahhasio-library.svg","bio":"","isAdmin":true,"updatedAt":"2026-10-12T00:00:00.000000Z"},"expiresAt":"2030-01-01T00:00:00Z"}"#,
                ),
                ("401 Unauthorized", r#"{"message":"expired"}"#),
            ] {
                let (mut stream, _) = listener.accept().expect("request");
                stream
                    .set_read_timeout(Some(Duration::from_secs(5)))
                    .expect("timeout");
                let mut incoming = Vec::new();
                loop {
                    let mut chunk = [0; 1024];
                    let count = stream.read(&mut chunk).expect("bounded request");
                    assert!(count > 0 && incoming.len() + count <= 4096);
                    incoming.extend_from_slice(&chunk[..count]);
                    if let Some(end) = incoming.windows(4).position(|bytes| bytes == b"\r\n\r\n") {
                        let headers = String::from_utf8_lossy(&incoming[..end]);
                        let length = headers
                            .lines()
                            .find_map(|line| {
                                line.to_ascii_lowercase()
                                    .strip_prefix("content-length:")
                                    .and_then(|value| value.trim().parse::<usize>().ok())
                            })
                            .unwrap_or(0);
                        if incoming.len() >= end + 4 + length {
                            break;
                        }
                    }
                }
                write!(stream, "HTTP/1.1 {status}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}", body.len()).expect("response");
            }
        });
        let service = Services::new(&format!("http://{address}/")).expect("service");
        let login = service
            .execute(Request {
                id: "login".into(),
                command: "login".into(),
                payload: json!({"email":"test@example.invalid","password":"fixture-only"}),
            })
            .await
            .expect("login should succeed");
        assert!(login.get("token").is_none());
        assert!(login.get("password").is_none());
        assert_eq!(login["user"]["id"], "owner");
        assert!(service.token.lock().await.is_some());
        let session = service
            .execute(Request {
                id: "session".into(),
                command: "session".into(),
                payload: json!({}),
            })
            .await
            .expect("expired session is signed out");
        assert!(session.is_null());
        assert!(service.token.lock().await.is_none());
        server.join().expect("mock server completed");
    }
    #[tokio::test]
    async fn encrypted_accounts_restore_independently_and_temporary_login_stays_temporary() {
        use axum::{
            Json, Router,
            http::HeaderMap,
            routing::{get, post},
        };
        fn user(n: u8) -> Value {
            json!({"id":format!("fixture-{n}"),"name":format!("Account {n}"),"email":format!("fixture{n}@example.invalid"),"role":"member","accountId":format!("96000000-0000-4000-8000-{n:012}"),"kind":"family","avatarKey":"anon-1.png","bio":"","isAdmin":false,"updatedAt":"2026-10-31T00:00:00Z"})
        }
        let api=Router::new()
            .route("/api/v1/auth/login",post(|Json(body):Json<Value>| async move {
                let n=if body["email"]=="fixture1@example.invalid" {1}else if body["email"]=="fixture2@example.invalid" {2}else{3};
                Json(json!({"user":user(n),"token":format!("fixture-token-{n}"),"renewalToken":format!("fixture-renewal-{n}"),"expiresAt":"2099-01-01T00:00:00Z"}))
            }))
            .route("/api/v1/auth/session",get(|headers:HeaderMap| async move {
                let n=if headers["authorization"]=="Bearer fixture-token-1" {1}else if headers["authorization"]=="Bearer fixture-token-2" {2}else{3};
                Json(json!({"user":user(n),"expiresAt":"2099-01-01T00:00:00Z"}))
            }))
            .route("/api/v1/me/device",post(||async{Json(json!({"deviceId":"96000000-0000-4000-8000-000000000004"}))}))
            .route("/api/v1/auth/logout",post(||async{axum::http::StatusCode::NO_CONTENT}));
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let url = format!("http://{}/", listener.local_addr().unwrap());
        let server = tokio::spawn(async move { axum::serve(listener, api).await.unwrap() });
        let root =
            std::env::temp_dir().join(format!("nahhasio-account-vault-{}", std::process::id()));
        let store = Arc::new(crate::session_store::SessionStore::new(&root));
        let mut service = ServerSession::new(&url).unwrap();
        service.session_store = Some(store.clone());
        service.vault = Arc::new(crate::credential_store::Vault::fixture([7; 32]));
        for n in [1, 2] {
            let result=service.execute(Request {id:"test".into(),command:"login".into(),payload:json!({"email":format!("fixture{n}@example.invalid"),"password":"fixture-password","remember":true})}).await.unwrap();
            assert_eq!(result["user"]["accountId"], user(n)["accountId"]);
            assert!(result.get("token").is_none());
        }
        let accounts = crate::credential_store::read(&root, &url).unwrap();
        assert_eq!(accounts.accounts.len(), 2);
        let stored =
            std::fs::read_to_string(root.join(crate::credential_store::name(&url))).unwrap();
        assert!(!stored.contains("fixture-token"));
        assert!(!stored.contains("fixture-password"));
        let mut restored = ServerSession::new(&url).unwrap();
        restored.session_store = Some(store.clone());
        restored.vault = service.vault.clone();
        let request = |command: &str, payload| Request {
            id: "test".into(),
            command: command.into(),
            payload,
        };
        assert_eq!(
            restored
                .execute(request("session", json!({})))
                .await
                .unwrap()["user"]["accountId"],
            user(2)["accountId"]
        );
        restored
            .execute(request(
                "accounts.switch",
                json!({"accountId":user(1)["accountId"]}),
            ))
            .await
            .unwrap();
        assert_eq!(
            restored
                .execute(request("session", json!({})))
                .await
                .unwrap()["user"]["accountId"],
            user(1)["accountId"]
        );
        restored
            .execute(request("logout", json!({})))
            .await
            .unwrap();
        let accounts = crate::credential_store::read(&root, &url).unwrap();
        assert!(
            accounts
                .accounts
                .iter()
                .find(|a| a.id == user(1)["accountId"])
                .unwrap()
                .credentials
                .is_none()
        );
        assert!(
            accounts
                .accounts
                .iter()
                .find(|a| a.id == user(2)["accountId"])
                .unwrap()
                .credentials
                .is_some()
        );
        restored.execute(request("login",json!({"email":"fixture3@example.invalid","password":"fixture-password","remember":false}))).await.unwrap();
        restored
            .execute(request("session", json!({})))
            .await
            .unwrap();
        assert!(restored.renewal.lock().await.is_none());
        let accounts = crate::credential_store::read(&root, &url).unwrap();
        assert!(accounts.selected.is_none());
        assert_eq!(accounts.accounts.len(), 2);
        restored
            .execute(request(
                "accounts.forget",
                json!({"accountId":user(2)["accountId"]}),
            ))
            .await
            .unwrap();
        assert_eq!(
            restored
                .execute(request("session", json!({})))
                .await
                .unwrap()["user"]["accountId"],
            user(3)["accountId"]
        );
        assert_eq!(
            crate::credential_store::read(&root, &url)
                .unwrap()
                .accounts
                .len(),
            1
        );
        server.abort();
        std::fs::remove_dir_all(root).unwrap();
    }
}
