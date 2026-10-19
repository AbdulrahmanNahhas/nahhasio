//! Validated player commands. The web UI never supplies a path, URL or mpv command.
use crate::bridge::{Error, Request};
use serde::{Deserialize, Serialize};
use serde_json::json;

#[derive(Debug, Deserialize)]
#[serde(
    tag = "command",
    content = "payload",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub enum Command {
    #[serde(rename = "player.status")]
    Status {},
    #[serde(rename = "player.pickVideo")]
    PickVideo {},
    #[serde(rename = "player.preview")]
    Preview { title: String },
    #[serde(rename = "player.viewport")]
    Viewport {
        session_id: String,
        x: f64,
        y: f64,
        width: i32,
        height: i32,
    },
    #[serde(rename = "player.close")]
    Close { session_id: String },
    #[serde(rename = "player.pause")]
    Pause { session_id: String, paused: bool },
    #[serde(rename = "player.seek")]
    Seek {
        session_id: String,
        seconds: f64,
        relative: bool,
    },
    #[serde(rename = "player.volume")]
    Volume { session_id: String, volume: f64 },
    #[serde(rename = "player.mute")]
    Mute { session_id: String, muted: bool },
    #[serde(rename = "player.speed")]
    Speed { session_id: String, speed: f64 },
    #[serde(rename = "player.track")]
    Track {
        session_id: String,
        kind: TrackKind,
        track_id: Option<i32>,
    },
    #[serde(rename = "player.pickSubtitle")]
    PickSubtitle { session_id: String },
    #[serde(rename = "player.delay")]
    Delay {
        session_id: String,
        kind: TrackKind,
        seconds: f64,
    },
    #[serde(rename = "player.subtitleStyle")]
    SubtitleStyle {
        session_id: String,
        size: f64,
        position: f64,
    },
    #[serde(rename = "player.fullscreen")]
    Fullscreen { enabled: bool },
}

impl Command {
    pub fn parse(request: &Request) -> Result<Self, Error> {
        let command: Self = serde_json::from_value(json!({
            "command": request.command,
            "payload": request.payload,
        }))
        .map_err(|_| invalid())?;
        if let Some(id) = command.session_id()
            && (id.is_empty()
                || id.len() > 64
                || !id
                    .bytes()
                    .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-'))
        {
            return Err(invalid());
        }
        let valid = match &command {
            Self::Viewport {
                x,
                y,
                width,
                height,
                ..
            } => {
                within(*x, -32768.0, 32768.0)
                    && within(*y, -32768.0, 32768.0)
                    && (1..=16384).contains(width)
                    && (1..=16384).contains(height)
            }
            Self::Preview { title } => !title.trim().is_empty() && title.chars().count() <= 1024,
            Self::Seek {
                seconds, relative, ..
            } => within(
                *seconds,
                if *relative { -2_592_000.0 } else { 0.0 },
                2_592_000.0,
            ),
            Self::Volume { volume, .. } => within(*volume, 0.0, 100.0),
            Self::Speed { speed, .. } => within(*speed, 0.25, 4.0),
            Self::Track { track_id, .. } => track_id.is_none_or(|id| id > 0),
            Self::Delay { seconds, .. } => within(*seconds, -600.0, 600.0),
            Self::SubtitleStyle { size, position, .. } => {
                within(*size, 10.0, 120.0) && within(*position, 0.0, 100.0)
            }
            _ => true,
        };
        if !valid {
            return Err(invalid());
        }
        Ok(command)
    }

    pub fn session_id(&self) -> Option<&str> {
        match self {
            Self::Status {}
            | Self::PickVideo {}
            | Self::Preview { .. }
            | Self::Fullscreen { .. } => None,
            Self::Viewport { session_id, .. }
            | Self::Close { session_id }
            | Self::Pause { session_id, .. }
            | Self::Seek { session_id, .. }
            | Self::Volume { session_id, .. }
            | Self::Mute { session_id, .. }
            | Self::Speed { session_id, .. }
            | Self::Track { session_id, .. }
            | Self::PickSubtitle { session_id }
            | Self::Delay { session_id, .. }
            | Self::SubtitleStyle { session_id, .. } => Some(session_id),
        }
    }
}

fn within(value: f64, min: f64, max: f64) -> bool {
    value.is_finite() && (min..=max).contains(&value)
}

fn invalid() -> Error {
    Error::new("bad_request", "Invalid player request")
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum TrackKind {
    Audio,
    Subtitle,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Track {
    pub id: i32,
    pub kind: TrackKind,
    pub title: Option<String>,
    pub language: Option<String>,
    pub codec: Option<String>,
    pub selected: bool,
    pub external: bool,
}

#[derive(Clone, Copy, Debug, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum SourceKind {
    Local,
    Torrent,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    pub active: bool,
    pub session_id: Option<String>,
    pub work_id: Option<String>,
    pub installment_id: Option<String>,
    pub episode_id: Option<String>,
    pub title: String,
    pub source_kind: Option<SourceKind>,
    pub paused: bool,
    pub position: f64,
    pub duration: f64,
    pub seekable: bool,
    pub volume: f64,
    pub muted: bool,
    pub speed: f64,
    pub buffering: bool,
    pub ended: bool,
    pub fullscreen: bool,
    pub audio_delay: f64,
    pub subtitle_delay: f64,
    pub subtitle_size: f64,
    pub subtitle_position: f64,
    pub tracks: Vec<Track>,
    pub hwdec: Option<String>,
    pub video_codec: Option<String>,
    pub error: Option<String>,
}

impl Default for Snapshot {
    fn default() -> Self {
        Self {
            active: false,
            session_id: None,
            work_id: None,
            installment_id: None,
            episode_id: None,
            title: String::new(),
            source_kind: None,
            paused: true,
            position: 0.0,
            duration: 0.0,
            seekable: false,
            volume: 100.0,
            muted: false,
            speed: 1.0,
            buffering: false,
            ended: false,
            fullscreen: false,
            audio_delay: 0.0,
            subtitle_delay: 0.0,
            subtitle_size: 55.0,
            subtitle_position: 100.0,
            tracks: Vec::new(),
            hwdec: None,
            video_codec: None,
            error: None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::Value;

    fn parse(command: &str, payload: Value) -> Result<Command, Error> {
        Command::parse(&Request {
            id: "test".into(),
            command: command.into(),
            payload,
        })
    }

    #[test]
    fn viewport_is_bounded_and_session_scoped() {
        assert!(
            parse(
                "player.viewport",
                json!({"sessionId":"media-1","x":10,"y":-80,"width":800,"height":450})
            )
            .is_ok()
        );
        for payload in [
            json!({"x":0,"y":0,"width":800,"height":450}),
            json!({"sessionId":"media-1","x":0,"y":0,"width":0,"height":450}),
            json!({"sessionId":"media-1","x":0,"y":0,"width":20000,"height":450}),
            json!({"sessionId":"media-1","x":0,"y":-40000,"width":800,"height":450}),
        ] {
            assert!(parse("player.viewport", payload).is_err());
        }
    }
    #[test]
    fn no_paths_urls_or_generic_commands_cross_the_player_bridge() {
        assert!(parse("player.status", json!({})).is_ok());
        assert!(parse("player.pickVideo", json!({"path": "/etc/passwd"})).is_err());
        assert!(parse("player.status", json!({"url": "http://localhost/"})).is_err());
        assert!(parse("player.command", json!({"command": "run"})).is_err());
        assert!(
            parse(
                "player.pause",
                json!({"sessionId":"media-1","paused":true,"extra":true})
            )
            .is_err()
        );
    }

    #[test]
    fn validates_transport_numeric_ranges() {
        for (command, key, low, high) in [
            ("player.volume", "volume", 0.0, 100.0),
            ("player.speed", "speed", 0.25, 4.0),
        ] {
            for value in [low, high] {
                assert!(parse(command, json!({"sessionId":"media-1",key:value})).is_ok());
            }
            for value in [low - 0.01, high + 0.01] {
                assert!(parse(command, json!({"sessionId":"media-1",key:value})).is_err());
            }
        }
        assert!(
            parse(
                "player.seek",
                json!({"sessionId":"media-1","seconds":-10,"relative":true})
            )
            .is_ok()
        );
        assert!(
            parse(
                "player.seek",
                json!({"sessionId":"media-1","seconds":-10,"relative":false})
            )
            .is_err()
        );
        assert!(
            parse(
                "player.delay",
                json!({"sessionId":"media-1","kind":"subtitle","seconds":601})
            )
            .is_err()
        );
    }

    #[test]
    fn validates_track_style_and_session_arguments() {
        assert!(
            parse(
                "player.track",
                json!({"sessionId":"media-1","kind":"subtitle","trackId":null})
            )
            .is_ok()
        );
        assert!(
            parse(
                "player.track",
                json!({"sessionId":"media-1","kind":"audio","trackId":-1})
            )
            .is_err()
        );
        assert!(
            parse(
                "player.track",
                json!({"sessionId":"media-1","kind":"video","trackId":1})
            )
            .is_err()
        );
        assert!(
            parse(
                "player.subtitleStyle",
                json!({"sessionId":"media-1","size":55,"position":80})
            )
            .is_ok()
        );
        assert!(
            parse(
                "player.subtitleStyle",
                json!({"sessionId":"media-1","size":5,"position":80})
            )
            .is_err()
        );
        assert!(parse("player.close", json!({"sessionId":""})).is_err());
        assert!(parse("player.close", json!({"sessionId":"../old-session"})).is_err());
        assert!(parse("player.close", json!({"sessionId":"x".repeat(65)})).is_err());
    }

    #[test]
    fn snapshot_matches_the_ui_contract_without_private_paths() {
        let snapshot = serde_json::to_value(Snapshot::default()).unwrap();
        assert_eq!(snapshot["sessionId"], Value::Null);
        assert_eq!(snapshot["sourceKind"], Value::Null);
        assert_eq!(snapshot["subtitleSize"].as_f64(), Some(55.0));
        assert_eq!(snapshot["tracks"], json!([]));
        assert!(snapshot.get("path").is_none());
        assert!(snapshot.get("session_id").is_none());
    }
}
