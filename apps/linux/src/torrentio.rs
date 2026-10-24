//! Native Torrentio discovery. Private provider URLs/configuration never enter JavaScript.
use crate::bridge::Error;
use regex::Regex;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::{collections::BTreeSet, sync::OnceLock, time::Duration};

const BODY_LIMIT: usize = 2 * 1024 * 1024;

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Search {
    pub imdb_id: String,
    pub kind: Kind,
    pub season: Option<u32>,
    pub episode: Option<u32>,
}

#[derive(Clone, Copy, Debug, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Kind {
    Movie,
    Series,
}

impl Search {
    fn identifier(&self) -> Result<String, Error> {
        let digits = self.imdb_id.strip_prefix("tt").ok_or_else(mapping_error)?;
        if !(7..=12).contains(&digits.len()) || !digits.bytes().all(|byte| byte.is_ascii_digit()) {
            return Err(mapping_error());
        }
        match self.kind {
            Kind::Movie if self.season.is_none() && self.episode.is_none() => {
                Ok(self.imdb_id.clone())
            }
            Kind::Series => {
                let (Some(season), Some(episode)) = (self.season, self.episode) else {
                    return Err(mapping_error());
                };
                if season > 10000 || episode == 0 || episode > 100000 {
                    return Err(mapping_error());
                }
                Ok(format!("{}:{season}:{episode}", self.imdb_id))
            }
            _ => Err(mapping_error()),
        }
    }
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Candidate {
    pub id: String,
    pub provider: &'static str,
    pub label: String,
    pub release: String,
    pub resolution: Option<u16>,
    pub codec: Option<String>,
    pub hdr: bool,
    pub size_bytes: Option<u64>,
    pub seeders: Option<u32>,
    pub reported_languages: Vec<String>,
    pub available: bool,
    #[serde(skip_serializing)]
    pub info_hash: Option<String>,
    #[serde(skip_serializing)]
    pub file_index: Option<u32>,
    #[serde(skip_serializing)]
    pub trackers: Vec<String>,
}

impl Candidate {
    pub fn public_value(&self) -> Result<Value, Error> {
        let mut value = serde_json::to_value(self).map_err(|_| malformed())?;
        value["available"] = Value::Bool(self.info_hash.is_some());
        value["fileSelectionKnown"] = Value::Bool(self.file_index.is_some());
        value["trackerCount"] = Value::from(self.trackers.len());
        Ok(value)
    }
}

#[derive(Deserialize)]
struct Envelope {
    streams: Vec<Value>,
}

pub async fn search(input: Search) -> Result<Vec<Candidate>, Error> {
    let base = setting("NAHHASIO_TORRENTIO_URL", "NAHHASIO_STREAM_ADDON_URL")
        .unwrap_or_else(|| "https://torrentio.strem.fun".into());
    let config = setting("NAHHASIO_TORRENTIO_CONFIG", "NAHHASIO_STREAM_ADDON_CONFIG");
    search_addon(input, &base, config.as_deref(), "Torrentio").await
}

pub async fn search_addon(
    input: Search,
    base: &str,
    config: Option<&str>,
    provider: &'static str,
) -> Result<Vec<Candidate>, Error> {
    let identifier = input.identifier()?;
    let mut url = url::Url::parse(base).map_err(|_| configuration_error())?;
    if url.scheme() != "https" && !(url.scheme() == "http" && url.host_str() == Some("127.0.0.1")) {
        return Err(configuration_error());
    }
    if !url.username().is_empty()
        || url.password().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
    {
        return Err(configuration_error());
    }
    let kind = match input.kind {
        Kind::Movie => "movie",
        Kind::Series => "series",
    };
    {
        let mut segments = url.path_segments_mut().map_err(|_| configuration_error())?;
        segments.pop_if_empty();
        if let Some(config) = config {
            segments.push(config);
        }
        segments.extend(["stream", kind, &format!("{identifier}.json")]);
    }
    // Provider redirects may contain private configuration; don't follow or log them.
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(8))
        .redirect(reqwest::redirect::Policy::none())
        .user_agent("Nahhasio/0.1")
        .build()
        .map_err(|_| unavailable())?;
    let mut response = client
        .get(url)
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|error| {
            if error.is_timeout() {
                Error::new("source_timeout", "انتهت مهلة الاتصال بـ Torrentio.")
            } else {
                unavailable()
            }
        })?;
    if !response.status().is_success() {
        return Err(unavailable());
    }
    if response
        .content_length()
        .is_some_and(|length| length > BODY_LIMIT as u64)
    {
        return Err(malformed());
    }
    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|_| unavailable())? {
        if bytes.len().saturating_add(chunk.len()) > BODY_LIMIT {
            return Err(malformed());
        }
        bytes.extend_from_slice(&chunk);
    }
    if provider == "Torrentio" {
        parse(&bytes)
    } else {
        parse_provider(&bytes, provider)
    }
}

fn setting(primary: &str, legacy: &str) -> Option<String> {
    [primary, legacy].into_iter().find_map(|name| {
        let value = std::env::var(name).ok()?;
        let value = value.trim();
        let value = value
            .strip_prefix('"')
            .and_then(|value| value.strip_suffix('"'))
            .or_else(|| {
                value
                    .strip_prefix('\'')
                    .and_then(|value| value.strip_suffix('\''))
            })
            .unwrap_or(value)
            .trim();
        (!value.is_empty()).then(|| value.to_owned())
    })
}

pub fn parse(bytes: &[u8]) -> Result<Vec<Candidate>, Error> {
    parse_provider(bytes, "Torrentio")
}

fn parse_provider(bytes: &[u8], provider: &'static str) -> Result<Vec<Candidate>, Error> {
    if bytes.len() > BODY_LIMIT {
        return Err(malformed());
    }
    let envelope: Envelope = serde_json::from_slice(bytes).map_err(|_| malformed())?;
    let mut candidates = Vec::new();
    let mut seen = BTreeSet::new();
    for stream in envelope.streams.into_iter().take(200) {
        let Some(object) = stream.as_object() else {
            return Err(malformed());
        };
        let label = bounded(object.get("name"), 512).unwrap_or_else(|| provider.into());
        let release = bounded(
            object.get("title").or_else(|| object.get("description")),
            4096,
        )
        .unwrap_or_else(|| label.clone());
        let info_hash = object
            .get("infoHash")
            .and_then(Value::as_str)
            .filter(|hash| {
                [40, 64].contains(&hash.len()) && hash.bytes().all(|byte| byte.is_ascii_hexdigit())
            })
            .map(str::to_ascii_lowercase);
        let file_index = match object.get("fileIdx") {
            None | Some(Value::Null) => None,
            Some(value) => Some(
                value
                    .as_u64()
                    .and_then(|value| u32::try_from(value).ok())
                    .ok_or_else(malformed)?,
            ),
        };
        let direct = object.get("url").and_then(Value::as_str);
        if info_hash.is_none() && direct.is_none() {
            continue;
        }
        // Direct/debrid sources are displayed, but never handed to mpv as an untrusted URL.
        let identity = format!(
            "{provider}:{}:{file_index:?}",
            info_hash.as_deref().or(direct).unwrap_or("")
        );
        let id = hex::encode(Sha256::digest(identity.as_bytes()));
        if !seen.insert(id.clone()) {
            continue;
        }
        let upper = format!("{label} {release}").to_uppercase();
        let resolution = [2160, 1080, 720, 480]
            .into_iter()
            .find(|height| upper.contains(&format!("{height}P")))
            .or_else(|| upper.contains("4K").then_some(2160));
        let codec = [
            ("AV1", "AV1"),
            ("HEVC", "HEVC"),
            ("H265", "HEVC"),
            ("H.265", "HEVC"),
            ("X265", "HEVC"),
            ("H264", "H.264"),
            ("H.264", "H.264"),
            ("X264", "H.264"),
        ]
        .into_iter()
        .find_map(|(hint, codec)| upper.contains(hint).then(|| codec.to_owned()));
        let mut languages = Vec::new();
        for (code, hints) in [
            ("ar", ["🇸🇦", "🇪🇬", "ARABIC", "عربي"]),
            ("en", ["🇺🇸", "🇬🇧", "ENGLISH", "إنجليزي"]),
            ("es", ["🇪🇸", "🇲🇽", "SPANISH", "إسباني"]),
        ] {
            if hints.iter().any(|hint| upper.contains(hint)) {
                languages.push(code.into());
            }
        }
        let trackers = object
            .get("sources")
            .and_then(Value::as_array)
            .into_iter()
            .flatten()
            .take(64)
            .filter_map(Value::as_str)
            .filter_map(|source| source.strip_prefix("tracker:"))
            .filter(|tracker| tracker.len() <= 2048)
            .filter_map(|tracker| {
                let url = url::Url::parse(tracker).ok()?;
                matches!(url.scheme(), "http" | "https" | "udp").then(|| tracker.to_owned())
            })
            .collect();
        let size_bytes = object
            .get("behaviorHints")
            .and_then(|hints| hints.get("videoSize"))
            .and_then(Value::as_u64)
            .or_else(|| size(&release));
        candidates.push(Candidate {
            id,
            provider,
            label,
            release,
            resolution,
            codec,
            hdr: upper.contains("HDR") || upper.contains("DOLBY VISION"),
            size_bytes,
            seeders: seeders(&upper),
            reported_languages: languages,
            available: info_hash.is_some(),
            info_hash,
            file_index,
            trackers,
        });
    }
    // Prefer a reasonable playback size; never silently select a source or pretend unknown seeds are zero.
    candidates.sort_by_key(|candidate| {
        (
            !candidate.available,
            candidate.resolution.is_some_and(|height| height > 1080),
            std::cmp::Reverse(candidate.resolution.unwrap_or(0)),
            std::cmp::Reverse(candidate.seeders.unwrap_or(0)),
        )
    });
    Ok(candidates)
}

fn bounded(value: Option<&Value>, max: usize) -> Option<String> {
    value?
        .as_str()
        .filter(|value| value.chars().count() <= max)
        .map(|value| value.split_whitespace().collect::<Vec<_>>().join(" "))
}
fn size(label: &str) -> Option<u64> {
    static RE: OnceLock<Regex> = OnceLock::new();
    let captures = RE
        .get_or_init(|| Regex::new(r"(?i)(\d+(?:\.\d+)?)\s*(TB|TiB|GB|GiB|MB|MiB)\b").unwrap())
        .captures(label)?;
    let amount: f64 = captures.get(1)?.as_str().parse().ok()?;
    let unit = captures.get(2)?.as_str().to_ascii_lowercase();
    let power = if unit.starts_with('t') {
        4
    } else if unit.starts_with('g') {
        3
    } else {
        2
    };
    let base: f64 = if unit.contains('i') { 1024.0 } else { 1000.0 };
    let bytes = amount * base.powi(power);
    (bytes.is_finite() && bytes > 0.0 && bytes <= 10.0 * 1024.0_f64.powi(4)).then_some(bytes as u64)
}
fn seeders(label: &str) -> Option<u32> {
    static RE: OnceLock<Regex> = OnceLock::new();
    let captures = RE
        .get_or_init(|| Regex::new(r"(?:👤\s*|SEEDERS?\s*[:=]?\s*)(\d+)").unwrap())
        .captures(label)?;
    captures.get(1)?.as_str().parse().ok()
}
fn mapping_error() -> Error {
    Error::new(
        "source_mapping",
        "اختر معرّف IMDb ورقم الموسم والحلقة الصحيحين للبحث.",
    )
}
fn configuration_error() -> Error {
    Error::new(
        "source_config",
        "إعداد Torrentio غير صالح. تحقق من إعداد العميل الخاص.",
    )
}
fn malformed() -> Error {
    Error::new(
        "source_response",
        "أرسل Torrentio استجابة غير صالحة أو أكبر من الحد المسموح.",
    )
}
fn unavailable() -> Error {
    Error::new(
        "source_unavailable",
        "تعذّر الوصول إلى Torrentio. أعد المحاولة لاحقًا.",
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn source_ids_are_strict_and_series_needs_explicit_mapping() {
        let movie = Search {
            imdb_id: "tt1234567".into(),
            kind: Kind::Movie,
            season: None,
            episode: None,
        };
        assert_eq!(movie.identifier().unwrap(), "tt1234567");
        assert!(
            Search {
                kind: Kind::Series,
                ..movie.clone()
            }
            .identifier()
            .is_err()
        );
        assert_eq!(
            Search {
                kind: Kind::Series,
                season: Some(0),
                episode: Some(1),
                ..movie.clone()
            }
            .identifier()
            .unwrap(),
            "tt1234567:0:1"
        );
        assert!(
            Search {
                imdb_id: "../../secret".into(),
                ..movie
            }
            .identifier()
            .is_err()
        );
    }
    #[test]
    fn parses_reported_hints_without_leaking_native_engine_data() {
        let input = serde_json::json!({"streams":[{
            "name":"Torrentio 1080p","title":"Release HEVC 🇸🇦 2.5 GB 👤 42",
            "infoHash":"a".repeat(40),"fileIdx":0,"sources":["tracker:https://tracker.example/announce"]
        }]});
        let candidates = parse(input.to_string().as_bytes()).unwrap();
        assert_eq!(candidates.len(), 1);
        assert_eq!(candidates[0].resolution, Some(1080));
        assert_eq!(candidates[0].seeders, Some(42));
        assert_eq!(candidates[0].reported_languages, vec!["ar"]);
        assert_eq!(candidates[0].size_bytes, Some(2_500_000_000));
        let view = serde_json::to_value(&candidates).unwrap();
        assert!(view[0].get("infoHash").is_none());
        assert!(view[0].get("trackers").is_none());
        assert!(view[0].get("fileIndex").is_none());
    }
    #[test]
    fn empty_direct_and_malformed_responses_are_distinct() {
        assert!(parse(br#"{"streams":[]}"#).unwrap().is_empty());
        assert!(
            !parse(br#"{"streams":[{"url":"https://private.example/token"}]}"#).unwrap()[0]
                .available
        );
        assert!(parse(br#"{"streams":[{"infoHash":"a","fileIdx":-1}]}"#).is_err());
        assert!(parse(br#"{"streams":"not an array"}"#).is_err());
        assert!(parse(&vec![0; BODY_LIMIT + 1]).is_err());
    }
}
