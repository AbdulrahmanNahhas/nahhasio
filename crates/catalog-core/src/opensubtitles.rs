//! Server-side OpenSubtitles transport for the configured shared account.
use reqwest::{Client, Method, Response, StatusCode, Url};
use serde::Deserialize;
use serde_json::{Value, json};
use std::time::{Duration, Instant};
use tokio::sync::{Mutex, OnceCell};

const MAX_FILE_ID: u64 = 9_007_199_254_740_991;
const API: &str = "https://api.opensubtitles.com/api/v1/";
pub const LIMIT: usize = 2 * 1024 * 1024;

#[derive(Debug)]
pub struct Error {
    pub code: &'static str,
    pub message: String,
}
impl Error {
    fn new(code: &'static str, message: &str) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }
}

#[derive(Default)]
pub struct Service {
    client: OnceCell<Client>,
    credentials: Mutex<Option<(Instant, Credentials)>>,
}

#[derive(Clone)]
struct Credentials {
    key: String,
    token: String,
    base: String,
}

struct Settings {
    key: String,
    username: String,
    password: String,
}

impl Settings {
    fn read() -> Option<Self> {
        let key = std::env::var("OPENSUBTITLES_API_KEY").ok()?;
        let username = std::env::var("OPENSUBTITLES_USERNAME").unwrap_or_default();
        let password = std::env::var("OPENSUBTITLES_PASSWORD").unwrap_or_default();
        let key = key.trim();
        let username = username.trim();
        if key.is_empty()
            || key.len() > 512
            || username.len() > 200
            || password.len() > 1024
            || username.is_empty() != password.is_empty()
        {
            return None;
        }
        Some(Self {
            key: key.into(),
            username: username.into(),
            password,
        })
    }
}

pub fn status() -> Value {
    let settings = Settings::read();
    json!({
        "configured": settings.is_some(),
        "source": if settings.is_some() { "server" } else { "none" },
        "downloads": settings.is_some_and(|settings| !settings.username.is_empty()),
    })
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Search {
    query: String,
    language: String,
    year: Option<u16>,
    season: Option<u16>,
    episode: Option<u16>,
    page: u16,
    imdb_id: Option<String>,
    tmdb_id: Option<u64>,
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
fn download_url(value: &str) -> Result<Url, Error> {
    let url = Url::parse(value).map_err(|_| unavailable())?;
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
                "رُفض اتصال OpenSubtitles. أعد المحاولة أو راجع مدير الخادم.",
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
        status if !status.is_success() => {
            return Err(Error::new(
                "subtitle_response",
                &format!(
                    "أعاد OpenSubtitles الخطأ {}. أعد المحاولة لاحقًا.",
                    status.as_u16()
                ),
            ));
        }
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
    async fn api(
        &self,
        credentials: &Credentials,
        method: Method,
        path: &str,
        query: &[(String, String)],
        body: Option<Value>,
    ) -> Result<Value, Error> {
        let base = api_base(&credentials.base)?;
        let initial = Url::parse(&format!("{base}{path}")).map_err(|_| unavailable())?;
        let mut url = initial.clone();
        if !query.is_empty() {
            url.query_pairs_mut()
                .extend_pairs(query.iter().map(|(key, value)| (key, value)));
        }
        for _ in 0..4 {
            let mut request = self
                .client()
                .await?
                .request(method.clone(), url.clone())
                .header("Api-Key", &credentials.key)
                .header("Accept", "application/json");
            if !credentials.token.is_empty() {
                request = request.bearer_auth(&credentials.token);
            }
            if let Some(body) = &body {
                request = request.json(body);
            }
            let response = request.send().await.map_err(|_| unavailable())?;
            if response.status().is_redirection() && method == Method::GET {
                let next = response
                    .headers()
                    .get(reqwest::header::LOCATION)
                    .and_then(|value| value.to_str().ok())
                    .and_then(|location| url.join(location).ok())
                    .ok_or_else(unavailable)?;
                // The service normalizes search query URLs. Never forward credentials to another host/path.
                if next.scheme() != initial.scheme()
                    || next.host_str() != initial.host_str()
                    || next.port_or_known_default() != initial.port_or_known_default()
                    || next.path() != initial.path()
                    || !next.username().is_empty()
                    || next.password().is_some()
                    || next.fragment().is_some()
                {
                    return Err(Error::new(
                        "subtitle_redirect",
                        "رفضت الخدمة تحويل البحث إلى عنوان غير متوقع.",
                    ));
                }
                url = next;
                continue;
            }
            let bytes = bounded(response).await?;
            return serde_json::from_slice(&bytes).map_err(|_| {
                Error::new(
                    "subtitle_response",
                    "أعاد OpenSubtitles استجابة غير صالحة. أعد المحاولة لاحقًا.",
                )
            });
        }
        Err(Error::new(
            "subtitle_redirect",
            "تعذّر إكمال تحويل البحث لدى OpenSubtitles.",
        ))
    }

    async fn credentials(&self) -> Result<Credentials, Error> {
        let mut cached = self.credentials.lock().await;
        if let Some((created, credentials)) = cached.as_ref()
            && created.elapsed() < Duration::from_secs(1800)
        {
            return Ok(credentials.clone());
        }
        let settings = Settings::read().ok_or_else(|| {
            Error::new(
                "subtitle_disconnected",
                "لم يهيئ مدير الخادم اتصال OpenSubtitles.",
            )
        })?;
        let mut credentials = Credentials {
            key: settings.key,
            token: String::new(),
            base: API.into(),
        };
        if !settings.username.is_empty() {
            let result = self
                .api(
                    &credentials,
                    Method::POST,
                    "login",
                    &[],
                    Some(json!({
                        "username": settings.username, "password": settings.password
                    })),
                )
                .await?;
            credentials.token = result["token"]
                .as_str()
                .filter(|token| !token.is_empty() && token.len() <= 8192)
                .ok_or_else(unavailable)?
                .into();
            credentials.base = api_base(result["base_url"].as_str().unwrap_or(API))?;
        }
        *cached = Some((Instant::now(), credentials.clone()));
        Ok(credentials)
    }

    async fn invalidate_expired(&self, credentials: &Credentials, error: &Error) {
        if error.code == "subtitle_expired" {
            let mut cached = self.credentials.lock().await;
            if cached
                .as_ref()
                .is_some_and(|(_, current)| current.token == credentials.token)
            {
                *cached = None;
            }
        }
    }
    pub async fn search(&self, search: Search) -> Result<Value, Error> {
        if search.query.trim().is_empty()
            || search.query.chars().count() > 200
            || !["ar", "en", "fr", "es"].contains(&search.language.as_str())
            || !(1..=100).contains(&search.page)
            || search.year.is_some_and(|v| !(1880..=2200).contains(&v))
            || search.season.is_some_and(|v| v > 1000)
            || search.episode.is_some_and(|v| v > 10000)
            || search
                .tmdb_id
                .is_some_and(|v| v == 0 || v > i32::MAX as u64)
            || search.imdb_id.as_ref().is_some_and(|id| {
                let digits = id.strip_prefix("tt").unwrap_or(id);
                digits.is_empty()
                    || digits.len() > 12
                    || !digits.bytes().all(|c| c.is_ascii_digit())
            })
        {
            return Err(invalid());
        }
        let credentials = self.credentials().await?;
        let mut params = vec![("languages".into(), search.language)];
        if search.page > 1 {
            params.push(("page".into(), search.page.to_string()));
        }
        if let Some(id) = search.imdb_id {
            params.push((
                if search.season.is_some() {
                    "parent_imdb_id"
                } else {
                    "imdb_id"
                }
                .into(),
                id.trim_start_matches("tt").trim_start_matches('0').into(),
            ));
        } else if let Some(id) = search.tmdb_id {
            params.push((
                if search.season.is_some() {
                    "parent_tmdb_id"
                } else {
                    "tmdb_id"
                }
                .into(),
                id.to_string(),
            ));
        } else {
            params.push(("query".into(), search.query.trim().to_lowercase()));
        }
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
        match self
            .api(&credentials, Method::GET, "subtitles", &params, None)
            .await
        {
            Ok(result) => project_results(&result),
            Err(error) => {
                self.invalidate_expired(&credentials, &error).await;
                Err(error)
            }
        }
    }
    async fn download_bytes(&self, mut url: Url) -> Result<Vec<u8>, Error> {
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

    pub async fn download(&self, file_id: u64) -> Result<(Vec<u8>, Option<u64>), Error> {
        if file_id == 0 || file_id > MAX_FILE_ID {
            return Err(invalid());
        }
        let credentials = self.credentials().await?;
        if credentials.token.is_empty() {
            return Err(Error::new(
                "subtitle_login_required",
                "يتطلب تنزيل الترجمة حساب OpenSubtitles في إعدادات بيئة الخادم.",
            ));
        }
        let result = match self
            .api(
                &credentials,
                Method::POST,
                "download",
                &[],
                Some(json!({"file_id":file_id,"sub_format":"srt"})),
            )
            .await
        {
            Ok(result) => result,
            Err(error) => {
                self.invalidate_expired(&credentials, &error).await;
                return Err(error);
            }
        };
        let url = download_url(result["link"].as_str().ok_or_else(unavailable)?)?;
        let bytes = self.download_bytes(url).await?;
        validate_subtitle(&bytes)?;
        Ok((bytes, result["remaining"].as_u64()))
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
                .filter(|id| *id > 0 && *id <= MAX_FILE_ID)
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
    fn provider_links_and_downloaded_content_stay_bounded() {
        assert!(api_base("api.opensubtitles.com.evil.invalid").is_err());
        assert!(download_url("https://dl.opensubtitles.com:8080/fixture").is_err());
        assert!(download_url("https://dl.opensubtitles.com@127.0.0.1/fixture").is_err());
        assert!(download_url("https://dl.opensubtitles.com/fixture").is_ok());
        assert!(validate_subtitle(b"<html>error</html>").is_err());
        assert!(validate_subtitle(b"1\n00:00:01,000 --> 00:00:02,000\nFixture\n").is_ok());
    }

    #[test]
    fn provider_results_only_expose_safe_display_fields() {
        let results = project_results(&json!({"data":[{"attributes":{
            "release":"Fixture","private":"secret",
            "files":[{"file_id":42,"file_name":"fixture.srt"},{"file_id":MAX_FILE_ID + 1}]
        }}]}))
        .unwrap();
        assert_eq!(results["items"].as_array().unwrap().len(), 1);
        assert_eq!(results["items"][0]["fileId"], 42);
        assert!(!results.to_string().contains("secret"));
    }
}
