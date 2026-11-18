//! Trusted HTTP clients, bounded responses and authorization; no UI dispatch.
use super::{Error, ServerSession, valid_id};
use reqwest::{Client, Method, Response};
use serde_json::Value;
use std::{sync::Arc, time::Duration};
use tokio::sync::{Mutex, Semaphore};
use url::Url;

pub(super) fn network(error: reqwest::Error) -> Error {
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
    #[cfg(any(test, feature = "native-diagnostics"))]
    pub fn new(base: &str) -> Result<Self, Error> {
        Self::with_trust(base, None)
    }
    pub fn with_trust(
        base: &str,
        trust: Option<&crate::server_trust::Trust>,
    ) -> Result<Self, Error> {
        let base = nahhasio_client_core::server_address::parse(base)?;
        if trust.is_some() && base.scheme() != "https" {
            return Err(Error::new(
                "certificate",
                "شهادة الخادم متاحة لاتصالات HTTPS فقط.",
            ));
        }
        let certificate = trust
            .map(crate::server_trust::Trust::certificate)
            .transpose()?;
        let trusted_builder = || {
            let builder = Client::builder()
                .no_proxy()
                .connect_timeout(Duration::from_secs(3))
                .redirect(reqwest::redirect::Policy::none());
            match &certificate {
                Some(certificate) => builder.add_root_certificate(certificate.clone()),
                None => builder,
            }
        };
        let client = trusted_builder()
            .timeout(Duration::from_secs(15))
            .build()
            .map_err(network)?;
        // Long media streams need an idle deadline, not a total response deadline.
        let media_client = trusted_builder()
            .read_timeout(Duration::from_secs(30))
            .build()
            .map_err(network)?;
        Ok(Self {
            session_store: None,
            client,
            media_client,
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
    pub(super) async fn editor_reply(&self, response: Response) -> Result<Value, Error> {
        let status = response.status().as_u16();
        if !matches!(status, 400 | 409) {
            return self.json_limit(response, 32 * 1024 * 1024).await;
        }
        // This fixed admin endpoint returns sanitized editorial errors, never SQL details.
        let bytes = collect_body(response, 16 * 1024, || {
            Error::new("server", "Editor error response exceeds the limit")
        })
        .await?;
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
            || info.server_id.as_ref().is_some_and(|id| !valid_id(id))
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
    pub(super) fn url(&self, path: &str) -> Url {
        self.base.join(path).expect("fixed API route")
    }
    pub(super) async fn body(&self, response: Response, max: usize) -> Result<Vec<u8>, Error> {
        if response.status() == reqwest::StatusCode::UNAUTHORIZED {
            self.invalidate_session().await?;
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
            return Err(body_too_large());
        }
        bounded_body(response, max).await
    }
    pub(super) async fn json(&self, response: Response) -> Result<Value, Error> {
        self.json_limit(response, 2 * 1024 * 1024).await
    }
    pub(super) async fn json_limit(&self, response: Response, max: usize) -> Result<Value, Error> {
        let body = self.body(response, max).await?;
        serde_json::from_slice(&body)
            .map_err(|_| Error::new("response", "The server sent an invalid response"))
    }
    pub(super) async fn authorized(
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
}
fn body_too_large() -> Error {
    Error::new("too_large", "Server response exceeds the desktop limit")
}

pub(super) async fn bounded_body(response: Response, max: usize) -> Result<Vec<u8>, Error> {
    collect_body(response, max, body_too_large).await
}

async fn collect_body(
    mut response: Response,
    max: usize,
    too_large: impl FnOnce() -> Error,
) -> Result<Vec<u8>, Error> {
    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(network)? {
        if chunk.len() > max - bytes.len() {
            return Err(too_large());
        }
        bytes.extend_from_slice(&chunk);
    }
    Ok(bytes)
}
