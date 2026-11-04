//! Explicit device-side OpenSubtitles REST operations; credentials never reach Nahhasio's server.
use crate::{
    bridge::Error,
    credential_store::{Sealed, Vault},
    private_state,
};
use reqwest::{Client, Method, Response, StatusCode};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::{
    path::{Path, PathBuf},
    time::Duration,
};

const API: &str = "https://api.opensubtitles.com/api/v1/";
const LIMIT: usize = 2 * 1024 * 1024;
#[derive(Default)]
pub struct Service {
    vault: Vault,
    client: tokio::sync::OnceCell<Client>,
    #[cfg(test)]
    test_base: Option<String>,
}
#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Credentials {
    key: String,
    token: String,
    base: String,
    username: String,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Login {
    api_key: String,
    username: String,
    password: String,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Search {
    query: String,
    language: String,
    year: Option<u16>,
    season: Option<u16>,
    episode: Option<u16>,
    page: u16,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Apply {
    pub session_id: String,
    pub file_id: u64,
}
fn invalid() -> Error {
    Error::new("bad_request", "طلب ترجمة غير صالح.")
}
fn unavailable() -> Error {
    Error::new(
        "subtitle_service",
        "تعذّر الاتصال بـ OpenSubtitles. تحقق من الشبكة وأعد المحاولة.",
    )
}
fn parse<T: serde::de::DeserializeOwned>(value: Value) -> Result<T, Error> {
    serde_json::from_value(value).map_err(|_| invalid())
}
fn credentials_name(scope: &str) -> String {
    format!("opensubtitles-{scope}.json")
}
fn api_base(value: &str) -> Result<String, Error> {
    let value = value.trim_end_matches('/');
    match value {
        "api.opensubtitles.com"
        | "https://api.opensubtitles.com"
        | "https://api.opensubtitles.com/api/v1" => Ok(API.into()),
        "vip-api.opensubtitles.com"
        | "https://vip-api.opensubtitles.com"
        | "https://vip-api.opensubtitles.com/api/v1" => {
            Ok("https://vip-api.opensubtitles.com/api/v1/".into())
        }
        _ => Err(unavailable()),
    }
}
fn download_url(value: &str) -> Result<url::Url, Error> {
    let url = url::Url::parse(value).map_err(|_| unavailable())?;
    if url.scheme() != "https"
        || url.port_or_known_default() != Some(443)
        || !url.username().is_empty()
        || url.password().is_some()
        || url.fragment().is_some()
        || !matches!(
            url.host_str(),
            Some(
                "dl.opensubtitles.com"
                    | "dl.opensubtitles.org"
                    | "www.opensubtitles.com"
                    | "vip-api.opensubtitles.com"
            )
        )
    {
        return Err(unavailable());
    }
    Ok(url)
}
async fn bounded(mut response: Response) -> Result<Vec<u8>, Error> {
    match response.status() {
        StatusCode::UNAUTHORIZED => {
            return Err(Error::new(
                "subtitle_expired",
                "انتهت جلسة OpenSubtitles أو رُفضت بيانات الدخول. أعد الربط من الإعدادات.",
            ));
        }
        StatusCode::FORBIDDEN => {
            return Err(Error::new(
                "subtitle_permission",
                "رفض OpenSubtitles الطلب. راجع مفتاح API وصلاحيات الحساب.",
            ));
        }
        StatusCode::TOO_MANY_REQUESTS | StatusCode::NOT_ACCEPTABLE => {
            return Err(Error::new(
                "subtitle_quota",
                "بلغت حد طلبات أو تنزيلات OpenSubtitles. انتظر تجدد الحصة.",
            ));
        }
        status if !status.is_success() => return Err(unavailable()),
        _ => {}
    }
    if response
        .content_length()
        .is_some_and(|size| size > LIMIT as u64)
    {
        return Err(unavailable());
    }
    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|_| unavailable())? {
        if bytes.len() + chunk.len() > LIMIT {
            return Err(unavailable());
        }
        bytes.extend_from_slice(&chunk);
    }
    Ok(bytes)
}
impl Service {
    async fn client(&self) -> Result<&Client, Error> {
        self.client
            .get_or_try_init(|| async {
                Client::builder()
                    .user_agent(concat!("Nahhasio v", env!("CARGO_PKG_VERSION")))
                    .redirect(reqwest::redirect::Policy::none())
                    .connect_timeout(Duration::from_secs(5))
                    .timeout(Duration::from_secs(20))
                    .build()
                    .map_err(|_| unavailable())
            })
            .await
    }
    async fn credentials(&self, root: &Path, scope: &str) -> Result<Credentials, Error> {
        let sealed =
            private_state::read::<Sealed>(root, &credentials_name(scope))?.ok_or_else(|| {
                Error::new(
                    "subtitle_disconnected",
                    "اربط حساب OpenSubtitles من إعدادات الترجمة أولًا.",
                )
            })?;
        self.vault
            .open(&format!("opensubtitles:{scope}"), &sealed)
            .await
    }
    async fn api(
        &self,
        credentials: &Credentials,
        method: Method,
        path: &str,
        query: &[(String, String)],
        body: Option<Value>,
    ) -> Result<Value, Error> {
        let base = api_base(&credentials.base)?;
        #[cfg(test)]
        let base = self.test_base.as_deref().unwrap_or(&base);
        let mut request = self
            .client()
            .await?
            .request(method, format!("{base}{path}"))
            .header("Api-Key", &credentials.key)
            .header("Accept", "application/json")
            .query(query);
        if !credentials.token.is_empty() {
            request = request.bearer_auth(&credentials.token);
        }
        if let Some(body) = body {
            request = request.json(&body);
        }
        let bytes = bounded(request.send().await.map_err(|_| unavailable())?).await?;
        serde_json::from_slice(&bytes).map_err(|_| unavailable())
    }
    pub fn forget(root: &Path, scope: &str) -> Result<(), Error> {
        private_state::remove(root, &credentials_name(scope))
    }
    pub async fn execute(
        &self,
        root: &Path,
        scope: &str,
        command: &str,
        payload: Value,
    ) -> Result<Value, Error> {
        match command {
            "opensubtitles.status" => {
                let _: serde_json::Map<String, Value> = parse(payload)?;
                let configured =
                    private_state::read::<Sealed>(root, &credentials_name(scope))?.is_some();
                Ok(json!({"connected":configured,"secureStorage":self.vault.available().await}))
            }
            "opensubtitles.disconnect" => {
                let _: serde_json::Map<String, Value> = parse(payload)?;
                Self::forget(root, scope)?;
                Ok(json!({"ok":true}))
            }
            "opensubtitles.login" => {
                let input: Login = parse(payload)?;
                if input.api_key.trim().is_empty()
                    || input.api_key.len() > 512
                    || input.username.trim().is_empty()
                    || input.username.len() > 200
                    || input.password.is_empty()
                    || input.password.len() > 1024
                {
                    return Err(invalid());
                }
                if !self.vault.available().await {
                    return Err(Error::new(
                        "secure_storage",
                        "مخزن الأسرار الآمن غير متاح. لا يمكن حفظ اتصال OpenSubtitles على هذا الجهاز.",
                    ));
                }
                let mut credentials = Credentials {
                    key: input.api_key.trim().into(),
                    token: String::new(),
                    base: API.into(),
                    username: input.username.trim().into(),
                };
                let result = self
                    .api(
                        &credentials,
                        Method::POST,
                        "login",
                        &[],
                        Some(json!({"username":credentials.username,"password":input.password})),
                    )
                    .await?;
                credentials.token = result["token"]
                    .as_str()
                    .filter(|token| !token.is_empty() && token.len() <= 8192)
                    .ok_or_else(unavailable)?
                    .into();
                credentials.base = api_base(result["base_url"].as_str().unwrap_or(API))?;
                let sealed = self
                    .vault
                    .seal(&format!("opensubtitles:{scope}"), &credentials)
                    .await?;
                private_state::write(root, &credentials_name(scope), &sealed)?;
                Ok(json!({"connected":true,"secureStorage":true}))
            }
            "opensubtitles.test" => {
                let credentials = self.credentials(root, scope).await?;
                let result = self
                    .api(&credentials, Method::GET, "infos/user", &[], None)
                    .await?;
                Ok(
                    json!({"username":credentials.username,"remaining":result["data"]["remaining_downloads"].as_u64(),"limit":result["data"]["allowed_downloads"].as_u64()}),
                )
            }
            "opensubtitles.search" => {
                let search: Search = parse(payload)?;
                if search.query.trim().is_empty()
                    || search.query.chars().count() > 200
                    || !["ar", "en", "fr", "es"].contains(&search.language.as_str())
                    || !(1..=100).contains(&search.page)
                    || search.year.is_some_and(|v| !(1880..=2200).contains(&v))
                    || search.season.is_some_and(|v| v > 1000)
                    || search.episode.is_some_and(|v| v > 10000)
                {
                    return Err(invalid());
                }
                let credentials = self.credentials(root, scope).await?;
                let mut params = vec![
                    ("languages".into(), search.language),
                    ("page".into(), search.page.to_string()),
                    ("query".into(), search.query.trim().into()),
                ];
                for (name, value) in [
                    ("year", search.year),
                    ("season_number", search.season),
                    ("episode_number", search.episode),
                ] {
                    if let Some(value) = value {
                        params.push((name.into(), value.to_string()));
                    }
                }
                params.sort();
                let result = self
                    .api(&credentials, Method::GET, "subtitles", &params, None)
                    .await?;
                project_results(&result)
            }
            _ => Err(invalid()),
        }
    }
    async fn download_bytes(&self, mut url: url::Url) -> Result<Vec<u8>, Error> {
        #[cfg(test)]
        if let Some(base) = &self.test_base {
            url = url::Url::parse(&format!("{base}file")).map_err(|_| unavailable())?;
        }
        // Every redirect is revalidated, and no Api-Key or Authorization header is attached.
        for _ in 0..4 {
            let response = self
                .client()
                .await?
                .get(url.clone())
                .send()
                .await
                .map_err(|_| unavailable())?;
            if response.status().is_redirection() {
                let location = response
                    .headers()
                    .get(reqwest::header::LOCATION)
                    .and_then(|value| value.to_str().ok())
                    .ok_or_else(unavailable)?;
                url = download_url(url.join(location).map_err(|_| unavailable())?.as_str())?;
            } else {
                return bounded(response).await;
            }
        }
        Err(unavailable())
    }
    pub async fn download(
        &self,
        root: &Path,
        scope: &str,
        file_id: u64,
    ) -> Result<(PathBuf, Option<u64>), Error> {
        tokio::time::timeout(Duration::from_secs(30), self.download_inner(root, scope, file_id)).await
            .map_err(|_| Error::new("subtitle_timeout", "انتهت مهلة تنزيل الترجمة. ربما احتُسب الطلب من حصة المزود؛ تحقق من الحصة قبل إعادة المحاولة."))?
    }
    async fn download_inner(
        &self,
        root: &Path,
        scope: &str,
        file_id: u64,
    ) -> Result<(PathBuf, Option<u64>), Error> {
        if file_id == 0 || file_id > i64::MAX as u64 {
            return Err(invalid());
        }
        let credentials = self.credentials(root, scope).await?;
        let result = self
            .api(
                &credentials,
                Method::POST,
                "download",
                &[],
                Some(json!({"file_id":file_id,"sub_format":"srt"})),
            )
            .await?;
        let url = download_url(result["link"].as_str().ok_or_else(unavailable)?)?;
        let bytes = self.download_bytes(url).await?;
        validate_subtitle(&bytes)?;
        let cache = root.join("subtitle-cache-v1").join(scope);
        std::fs::create_dir_all(&cache).map_err(|_| unavailable())?;
        use std::os::unix::fs::{OpenOptionsExt, PermissionsExt};
        std::fs::set_permissions(&cache, std::fs::Permissions::from_mode(0o700))
            .map_err(|_| unavailable())?;
        let mut files = Vec::new();
        for entry in std::fs::read_dir(&cache).map_err(|_| unavailable())? {
            let entry = entry.map_err(|_| unavailable())?;
            if entry.file_type().map_err(|_| unavailable())?.is_file()
                && entry.path().extension().is_some_and(|ext| ext == "srt")
            {
                files.push((
                    entry
                        .metadata()
                        .and_then(|m| m.modified())
                        .map_err(|_| unavailable())?,
                    entry.path(),
                ));
            }
        }
        files.sort_by_key(|file| file.0);
        let remove = files.len().saturating_sub(31);
        for (_, file) in files.into_iter().take(remove) {
            std::fs::remove_file(file).map_err(|_| unavailable())?;
        }
        let mut nonce = [0; 16];
        getrandom::fill(&mut nonce).map_err(|_| unavailable())?;
        let path = cache.join(format!("{}.srt", hex::encode(nonce)));
        use std::io::Write;
        std::fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .mode(0o600)
            .open(&path)
            .and_then(|mut file| file.write_all(&bytes))
            .map_err(|_| unavailable())?;
        Ok((path, result["remaining"].as_u64()))
    }
}
fn validate_subtitle(bytes: &[u8]) -> Result<(), Error> {
    let text = std::str::from_utf8(bytes).map_err(|_| {
        Error::new(
            "subtitle_encoding",
            "الترجمة ليست UTF-8. نزّل نسخة أخرى أو استورد ملفًا محليًا.",
        )
    })?;
    if bytes.is_empty()
        || bytes.contains(&0)
        || !text.contains("-->")
        || text
            .trim_start_matches('\u{feff}')
            .trim_start()
            .starts_with('<')
    {
        return Err(Error::new(
            "subtitle_format",
            "لم يُرجع المزود ملف ترجمة SRT صالحًا.",
        ));
    }
    Ok(())
}
fn project_results(result: &Value) -> Result<Value, Error> {
    let rows = result["data"].as_array().ok_or_else(unavailable)?;
    let mut items = Vec::new();
    let mut seen = std::collections::BTreeSet::new();
    for row in rows.iter().take(50) {
        let a = &row["attributes"];
        for file in a["files"].as_array().into_iter().flatten().take(4) {
            let Some(file_id) = file["file_id"]
                .as_u64()
                .filter(|id| *id > 0 && *id <= i64::MAX as u64)
            else {
                continue;
            };
            if !seen.insert(file_id) {
                continue;
            }
            let text = |value: &Value, max: usize| {
                value
                    .as_str()
                    .unwrap_or("")
                    .chars()
                    .take(max)
                    .collect::<String>()
            };
            items.push(json!({"fileId":file_id,"release":text(&a["release"],300),"fileName":text(&file["file_name"],300),"language":text(&a["language"],20),"downloads":a["download_count"].as_u64().unwrap_or(0),"hearingImpaired":a["hearing_impaired"].as_bool().unwrap_or(false),"machineTranslated":a["machine_translated"].as_bool().unwrap_or(false),"aiTranslated":a["ai_translated"].as_bool().unwrap_or(false)}));
        }
    }
    Ok(
        json!({"items":items,"page":result["page"].as_u64().unwrap_or(1),"totalPages":result["total_pages"].as_u64().unwrap_or(1)}),
    )
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn urls_are_provider_owned_and_content_is_bounded_plain_subtitles() {
        assert!(api_base("vip-api.opensubtitles.com").is_ok());
        for url in [
            "https://evil.invalid",
            "https://api.opensubtitles.com@127.0.0.1",
            "http://api.opensubtitles.com",
        ] {
            assert!(api_base(url).is_err());
        }
        assert!(download_url("https://dl.opensubtitles.com/download/temporary").is_ok());
        for url in [
            "http://dl.opensubtitles.com/file",
            "https://127.0.0.1/file",
            "https://dl.opensubtitles.com.evil.invalid/file",
        ] {
            assert!(download_url(url).is_err());
        }
        assert!(
            validate_subtitle("1\n00:00:01,000 --> 00:00:02,000\nترجمة عربية\n".as_bytes()).is_ok()
        );
        assert!(validate_subtitle(b"<html>Error</html>").is_err());
    }
    #[test]
    fn results_project_only_display_data_and_numeric_file_ids() {
        let value=project_results(&json!({"data":[{"attributes":{"language":"ar","release":"Fixture 1080p","secret":"hidden","files":[{"file_id":42,"file_name":"fixture.srt"}]}}],"page":1,"total_pages":2})).unwrap();
        assert_eq!(value["items"][0]["fileId"], 42);
        assert_eq!(value["totalPages"], 2);
        assert!(!value.to_string().contains("hidden"));
    }
    #[tokio::test]
    async fn explicit_login_search_download_are_encrypted_and_scoped() {
        use axum::{
            Json, Router,
            http::HeaderMap,
            routing::{get, post},
        };
        use std::sync::{
            Arc,
            atomic::{AtomicUsize, Ordering},
        };
        let calls = Arc::new(AtomicUsize::new(0));
        let app=Router::new()
            .route("/login",post(|headers:HeaderMap,Json(body):Json<Value>|async move {
                assert_eq!(headers["api-key"],"synthetic-key");
                assert_eq!(body["username"],"fixture");
                Json(json!({"token":"synthetic-token","base_url":"vip-api.opensubtitles.com"}))
            }))
            .route("/subtitles",get({let calls=calls.clone(); move |headers:HeaderMap|{let calls=calls.clone(); async move {
                assert_eq!(headers["authorization"],"Bearer synthetic-token");calls.fetch_add(1,Ordering::SeqCst);
                Json(json!({"data":[{"attributes":{"release":"Fixture 1080p","language":"ar","files":[{"file_id":42,"file_name":"fixture.srt"}]}}],"page":1,"total_pages":1}))
            }}}))
            .route("/download",post({let calls=calls.clone();move |headers:HeaderMap,Json(body):Json<Value>|{let calls=calls.clone();async move {
                assert_eq!(headers["api-key"],"synthetic-key");assert_eq!(body["file_id"],42);calls.fetch_add(1,Ordering::SeqCst);
                Json(json!({"link":"https://dl.opensubtitles.com/download/fixture","remaining":8}))
            }}}))
            .route("/file",get(|headers:HeaderMap|async move {
                assert!(!headers.contains_key("api-key"));assert!(!headers.contains_key("authorization"));
                "1\n00:00:01,000 --> 00:00:02,000\nترجمة تجريبية\n"
            }));
        let listener = tokio::net::TcpListener::bind(("127.0.0.1", 0))
            .await
            .unwrap();
        let address = listener.local_addr().unwrap();
        let server = tokio::spawn(async move {
            axum::serve(listener, app).await.unwrap();
        });
        let service = Service {
            vault: Vault::fixture([42; 32]),
            client: tokio::sync::OnceCell::new(),
            test_base: Some(format!("http://{address}/")),
        };
        let mut nonce = [0; 16];
        getrandom::fill(&mut nonce).unwrap();
        let root =
            std::env::temp_dir().join(format!("nahhasio-subtitles-test-{}", hex::encode(nonce)));
        service.execute(&root,"account-a","opensubtitles.login",json!({"apiKey":"synthetic-key","username":"fixture","password":"synthetic-password"})).await.unwrap();
        assert_eq!(
            calls.load(Ordering::SeqCst),
            0,
            "login must not search or consume downloads"
        );
        let stored = std::fs::read_to_string(root.join(credentials_name("account-a"))).unwrap();
        assert!(!stored.contains("synthetic"));
        assert!(service.credentials(&root, "account-b").await.is_err());
        let found = service
            .execute(
                &root,
                "account-a",
                "opensubtitles.search",
                json!({"query":"Fixture","language":"ar","page":1}),
            )
            .await
            .unwrap();
        assert_eq!(found["items"][0]["fileId"], 42);
        assert_eq!(calls.load(Ordering::SeqCst), 1);
        let (file, remaining) = service.download(&root, "account-a", 42).await.unwrap();
        assert_eq!(remaining, Some(8));
        assert!(std::fs::read_to_string(file).unwrap().contains("ترجمة"));
        assert_eq!(calls.load(Ordering::SeqCst), 2);
        Service::forget(&root, "account-a").unwrap();
        assert!(service.credentials(&root, "account-a").await.is_err());
        std::fs::remove_dir_all(root).unwrap();
        server.abort();
    }
}
