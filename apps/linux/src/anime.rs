//! Client-owned anipy helper protocol and expiring opaque selections. No UI-supplied stream URLs.
use crate::{bridge::Error, direct_gateway::StreamSource, media::Target};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::{
    process::Stdio,
    sync::atomic::{AtomicU64, Ordering},
    time::{Duration, Instant},
};
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    sync::Mutex,
};

#[derive(Clone, Copy, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Provider {
    Anidbapp,
    Animehub,
}
impl Provider {
    fn name(self) -> &'static str {
        match self {
            Self::Anidbapp => "anidbapp",
            Self::Animehub => "animehub",
        }
    }
}
#[derive(Deserialize)]
#[serde(
    tag = "command",
    content = "payload",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub enum Command {
    #[serde(rename = "anime.search")]
    Search {
        session_id: String,
        target: Target,
        provider: Provider,
        query: String,
    },
    #[serde(rename = "anime.resolve")]
    Resolve {
        session_id: String,
        target: Target,
        candidate_id: String,
    },
    #[serde(rename = "anime.play")]
    Play {
        session_id: String,
        target: Target,
        stream_id: String,
    },
}
impl Command {
    pub fn parse(request: &crate::bridge::Request) -> Result<Self, Error> {
        serde_json::from_value(json!({"command":request.command,"payload":request.payload}))
            .map_err(|_| Error::new("bad_request", "Invalid anime request"))
    }
    pub fn session(&self) -> &str {
        match self {
            Self::Search { session_id, .. }
            | Self::Resolve { session_id, .. }
            | Self::Play { session_id, .. } => session_id,
        }
    }
    pub fn target(&self) -> &Target {
        match self {
            Self::Search { target, .. }
            | Self::Resolve { target, .. }
            | Self::Play { target, .. } => target,
        }
    }
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Found {
    identifier: String,
    name: String,
    dub_listed: bool,
}
#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Subtitle {
    pub url: String,
    pub language: String,
    pub label: String,
}
#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Stream {
    url: String,
    resolution: u32,
    referrer: Option<String>,
    #[serde(default)]
    subtitles: Vec<Subtitle>,
    hls: bool,
}
#[derive(Deserialize)]
struct Reply {
    ok: bool,
    #[serde(default)]
    results: Vec<Found>,
    #[serde(default)]
    streams: Vec<Stream>,
    error: Option<String>,
}
struct Candidate {
    id: String,
    provider: Provider,
    found: Found,
}
struct Choice {
    id: String,
    stream: Stream,
}
struct Selection {
    session: String,
    target: Target,
    created: Instant,
    candidates: Vec<Candidate>,
    streams: Vec<Choice>,
}
#[derive(Default)]
pub struct Resolver {
    selection: Mutex<Option<Selection>>,
    generation: AtomicU64,
}
impl Resolver {
    pub fn cancel(&self) {
        self.generation.fetch_add(1, Ordering::AcqRel);
    }
    pub fn ticket(&self) -> u64 {
        self.generation.load(Ordering::Acquire)
    }
    pub fn require_ticket(&self, ticket: u64) -> Result<(), Error> {
        if self.ticket() == ticket {
            Ok(())
        } else {
            Err(expired())
        }
    }
    pub async fn search(
        &self,
        session: String,
        target: Target,
        provider: Provider,
        query: String,
    ) -> Result<Value, Error> {
        if query.trim().is_empty() || query.len() > 640 || query.chars().count() > 160 {
            return Err(Error::new("bad_request", "اكتب اسم الأنمي للبحث."));
        }
        self.cancel();
        let ticket = self.ticket();
        let reply =
            helper(json!({"action":"search","provider":provider.name(),"query":query.trim()}))
                .await?;
        self.require_ticket(ticket)?;
        let mut candidates = Vec::new();
        let mut result = Vec::new();
        for found in reply.results.into_iter().take(20) {
            if found.name.len() > 1000 || found.identifier.len() > 1024 {
                continue;
            }
            let id = token()?;
            result.push(json!({"id":id,"name":found.name,"dubListed":found.dub_listed}));
            candidates.push(Candidate {
                id,
                provider,
                found,
            });
        }
        *self.selection.lock().await = Some(Selection {
            session,
            target,
            created: Instant::now(),
            candidates,
            streams: Vec::new(),
        });
        Ok(json!({"candidates":result}))
    }
    pub async fn resolve(
        &self,
        session: &str,
        target: &Target,
        id: &str,
        episode: f64,
        film: bool,
    ) -> Result<Value, Error> {
        let (provider, identifier) = {
            let lock = self.selection.lock().await;
            let selection = valid(lock.as_ref(), session, target)?;
            let candidate = selection
                .candidates
                .iter()
                .find(|candidate| candidate.id == id)
                .ok_or_else(expired)?;
            (candidate.provider, candidate.found.identifier.clone())
        };
        let ticket = self.ticket();
        let reply=helper(json!({"action":"resolve","provider":provider.name(),"identifier":identifier,"episode":episode,"film":film})).await?;
        self.require_ticket(ticket)?;
        let mut choices = Vec::new();
        let mut result = Vec::new();
        for stream in reply.streams.into_iter().take(16) {
            if stream.url.len() > 8192
                || stream.referrer.as_ref().is_some_and(|r| r.len() > 8192)
                || stream.subtitles.len() > 20
            {
                continue;
            }
            let id = token()?;
            let arabic = stream
                .subtitles
                .iter()
                .any(|s| matches!(s.language.to_lowercase().as_str(), "ar" | "ara" | "arabic"));
            result.push(json!({"id":id,"resolution":stream.resolution.min(4320),"hasArabic":arabic,"subtitleCount":stream.subtitles.len()}));
            choices.push(Choice { id, stream });
        }
        if choices.is_empty() {
            return Err(Error::new(
                "no_dub",
                "لم نجد فيديو مدبلجًا لهذه الحلقة أو الفيلم لدى هذا المصدر. جرّب مصدرًا آخر.",
            ));
        }
        let mut lock = self.selection.lock().await;
        valid(lock.as_ref(), session, target)?;
        lock.as_mut().ok_or_else(expired)?.streams = choices;
        Ok(json!({"streams":result}))
    }
    pub async fn stream(
        &self,
        session: &str,
        target: &Target,
        id: &str,
    ) -> Result<(StreamSource, Vec<Subtitle>), Error> {
        let lock = self.selection.lock().await;
        let selection = valid(lock.as_ref(), session, target)?;
        let stream = &selection
            .streams
            .iter()
            .find(|choice| choice.id == id)
            .ok_or_else(expired)?
            .stream;
        Ok((
            StreamSource {
                url: stream.url.clone(),
                referrer: stream.referrer.clone(),
                hls: stream.hls,
            },
            stream.subtitles.clone(),
        ))
    }
}
fn valid<'a>(
    selection: Option<&'a Selection>,
    session: &str,
    target: &Target,
) -> Result<&'a Selection, Error> {
    selection
        .filter(|s| {
            s.session == session
                && s.target.work_id == target.work_id
                && s.target.installment_id == target.installment_id
                && s.target.episode_id == target.episode_id
                && s.created.elapsed() < Duration::from_secs(600)
        })
        .ok_or_else(expired)
}
fn expired() -> Error {
    Error::new(
        "cancelled",
        "انتهى اختيار المصدر. أعد البحث ثم اختر النسخة.",
    )
}
fn token() -> Result<String, Error> {
    let mut bytes = [0; 24];
    getrandom::fill(&mut bytes).map_err(|_| expired())?;
    Ok(hex::encode(bytes))
}
async fn helper(input: Value) -> Result<Reply, Error> {
    let path = std::env::var_os("NAHHASIO_ANIPY_HELPER").ok_or_else(|| {
        Error::new(
            "anime_setup",
            "مساعد الأنمي غير متاح. أعد تشغيل التطبيق من بيئة التطوير المحدّثة.",
        )
    })?;
    let mut child = tokio::process::Command::new(path)
        .env_clear()
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .kill_on_drop(true)
        .spawn()
        .map_err(|_| Error::new("anime_setup", "تعذّر تشغيل مساعد الأنمي."))?;
    let task = async {
        let mut stdin = child.stdin.take().ok_or_else(expired)?;
        stdin
            .write_all(format!("{input}\n").as_bytes())
            .await
            .map_err(|_| expired())?;
        drop(stdin);
        let mut output = Vec::new();
        child
            .stdout
            .take()
            .ok_or_else(expired)?
            .take(512 * 1024 + 1)
            .read_to_end(&mut output)
            .await
            .map_err(|_| expired())?;
        if output.len() > 512 * 1024 {
            return Err(expired());
        }
        let _ = child.wait().await.map_err(|_| expired())?;
        let reply: Reply = serde_json::from_slice(&output)
            .map_err(|_| Error::new("anime_source", "استجابة مصدر الأنمي غير صالحة."))?;
        if !reply.ok {
            let dub = reply.error.as_deref() == Some("LangTypeNotAvailableError");
            return Err(Error::new(
                if dub { "no_dub" } else { "anime_source" },
                if dub {
                    "الدبلجة الإنجليزية غير متاحة لدى هذا المصدر."
                } else {
                    "تعذّر الوصول إلى مصدر الأنمي. جرّب المصدر الآخر أو أعد المحاولة."
                },
            ));
        }
        Ok(reply)
    };
    tokio::time::timeout(Duration::from_secs(55), task)
        .await
        .map_err(|_| Error::new("anime_timeout", "استغرق المصدر وقتًا طويلًا. جرّب المصدر الآخر."))?
}

#[cfg(feature = "native-diagnostics")]
pub async fn diagnostic_source() -> Result<StreamSource, Error> {
    let film = std::env::args().any(|arg| arg == "--anime-smoke-film");
    let (query, title) = if film {
        ("The Imaginary", "Yaneura No Rudger")
    } else {
        ("Frieren", "Frieren: Beyond Journey's End")
    };
    let resolver = Resolver::default();
    let target = Target {
        work_id: "00000000-0000-4000-8000-000000000001".into(),
        installment_id: Some("00000000-0000-4000-8000-000000000002".into()),
        episode_id: Some("00000000-0000-4000-8000-000000000003".into()),
    };
    let matches = resolver
        .search(
            "diagnostic".into(),
            target.clone(),
            Provider::Animehub,
            query.into(),
        )
        .await?;
    let id = matches["candidates"]
        .as_array()
        .and_then(|items| items.iter().find(|item| item["name"] == title))
        .and_then(|item| item["id"].as_str())
        .ok_or_else(|| Error::new("anime_source", "Diagnostic title not found"))?;
    let streams = resolver
        .resolve("diagnostic", &target, id, 1.0, film)
        .await?;
    eprintln!(
        "anime-smoke: title={query} qualities={:?}",
        streams["streams"].as_array().map(|items| items
            .iter()
            .map(|item| item["resolution"].as_u64().unwrap_or(0))
            .collect::<Vec<_>>())
    );
    let id = streams["streams"]
        .as_array()
        .and_then(|items| items.first())
        .and_then(|item| item["id"].as_str())
        .ok_or_else(expired)?;
    resolver
        .stream("diagnostic", &target, id)
        .await
        .map(|(source, _)| source)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn bridge_refuses_external_urls_and_unknown_providers() {
        for payload in [
            json!({"sessionId":"media-1","provider":"external","query":"Frieren","target":{}}),
            json!({"sessionId":"media-1","streamId":"x","url":"https://evil.invalid/video","target":{}}),
        ] {
            let command = if payload.get("provider").is_some() {
                "anime.search"
            } else {
                "anime.play"
            };
            assert!(
                Command::parse(&crate::bridge::Request {
                    id: "test".into(),
                    command: command.into(),
                    payload
                })
                .is_err()
            );
        }
    }
    #[test]
    fn selections_are_bound_to_episode_session_and_age() {
        let target = Target {
            work_id: "work".into(),
            installment_id: Some("season".into()),
            episode_id: Some("one".into()),
        };
        let selection = Selection {
            session: "first".into(),
            target: target.clone(),
            created: Instant::now(),
            candidates: vec![],
            streams: vec![],
        };
        assert!(valid(Some(&selection), "first", &target).is_ok());
        assert!(valid(Some(&selection), "second", &target).is_err());
        let mut next = target;
        next.episode_id = Some("two".into());
        assert!(valid(Some(&selection), "first", &next).is_err());
        let resolver = Resolver::default();
        let ticket = resolver.ticket();
        resolver.cancel();
        assert!(resolver.require_ticket(ticket).is_err());
    }
}
