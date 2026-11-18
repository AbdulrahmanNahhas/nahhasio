//! Native account sessions, credential rotation and remembered-account commands.
use super::transport::{bounded_body, network};
use super::{Error, Request, ServerSession, parse, valid_id};
use reqwest::Method;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::sync::Arc;
use tokio::sync::Mutex;

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
pub(super) struct User {
    pub(super) id: String,
    pub(super) name: String,
    pub(super) email: String,
    pub(super) role: String,
    pub(super) account_id: String,
    pub(super) kind: String,
    pub(super) avatar_key: String,
    pub(super) bio: String,
    pub(super) is_admin: bool,
    pub(super) updated_at: String,
}
#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct LoginResponse {
    pub(super) token: String,
    #[serde(default)]
    pub(super) renewal_token: Option<String>,
    pub(super) user: User,
    pub(super) expires_at: String,
}
impl ServerSession {
    pub fn new_persistent(
        base: &str,
        trust: Option<&crate::server_trust::Trust>,
    ) -> Result<Self, Error> {
        let roots = crate::media_storage::discover()
            .map_err(|_| Error::new("configuration", "تعذّر تحديد مجلد حالة التطبيق."))?;
        Self::new_persistent_at(base, trust, &roots.state)
    }
    pub(crate) fn new_persistent_at(
        base: &str,
        trust: Option<&crate::server_trust::Trust>,
        root: &std::path::Path,
    ) -> Result<Self, Error> {
        let mut service = Self::with_trust(base, trust)?;
        let store = crate::session_store::SessionStore::new(root);
        let legacy = store.load(service.base.as_str())?;
        service
            .legacy_session
            .store(legacy.is_some(), std::sync::atomic::Ordering::SeqCst);
        service.token = Arc::new(Mutex::new(legacy));
        service.session_store = Some(Arc::new(store));
        Ok(service)
    }
    pub(super) async fn register_device(&self) -> Result<(), Error> {
        let Some(store) = &self.session_store else {
            return Ok(());
        };
        let response=self.authorized(Method::POST,"api/v1/me/device").await?.json(&json!({"installationId":store.installation_id()?,"name":"Nahhasio Desktop","platform":"linux"})).send().await.map_err(network)?;
        self.json(response).await?;
        Ok(())
    }
    pub(super) async fn invalidate_session(&self) -> Result<(), Error> {
        *self.token.lock().await = None;
        self.forget_stored_session().await
    }

    pub(super) async fn forget_stored_session(&self) -> Result<(), Error> {
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
    pub(super) async fn save_remembered(&self, login: &LoginResponse) -> Result<(), Error> {
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
    pub(super) async fn restore_remembered(&self) -> Result<(), Error> {
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
    pub(super) async fn renew_if_needed(&self) -> Result<(), Error> {
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
            self.invalidate_session().await?;
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
    pub async fn ensure_authenticated(&self) -> Result<(), Error> {
        self.renew_if_needed().await?;
        if self.token.lock().await.is_none() {
            return Err(Error::new("unauthorized", "سجّل الدخول إلى مكتبتك."));
        }
        Ok(())
    }
    pub(super) async fn execute_session(&self, request: Request) -> Result<Value, Error> {
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
                    self.invalidate_session().await?;
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
            _ => Err(Error::new("bad_request", "Unknown desktop command")),
        }
    }
}
