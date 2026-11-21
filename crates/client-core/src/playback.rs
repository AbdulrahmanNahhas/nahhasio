//! Playback preferences and adapter configuration without player or UI dependencies.
use crate::Error;
use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum SubtitleColor {
    #[default]
    White,
    Yellow,
}

const TRACK_LANGUAGES: [&str; 7] = ["auto", "ar", "en", "ja", "ko", "fr", "es"];

#[derive(Clone, Debug)]
pub struct PlaybackDefaults {
    pub startup_volume: f64,
    pub startup_speed: f64,
    pub audio_languages: String,
    pub subtitle_languages: String,
    pub subtitles_enabled: bool,
    pub subtitle_size: f64,
    pub subtitle_position: f64,
    pub audio_delay: f64,
    pub subtitle_delay: f64,
    pub subtitle_color: SubtitleColor,
    pub subtitle_background: bool,
    pub subtitle_bold: bool,
}

impl Default for PlaybackDefaults {
    fn default() -> Self {
        Self {
            startup_volume: default_volume(),
            startup_speed: default_speed(),
            audio_languages: String::new(),
            subtitle_languages: "ar,ara,en,eng".into(),
            subtitles_enabled: true,
            subtitle_size: 55.0,
            subtitle_position: 100.0,
            audio_delay: 0.0,
            subtitle_delay: 0.0,
            subtitle_color: SubtitleColor::White,
            subtitle_background: false,
            subtitle_bold: false,
        }
    }
}

impl PlaybackDefaults {
    pub fn is_valid(&self) -> bool {
        valid_startup(self.startup_volume, self.startup_speed)
            && self.audio_languages.len() <= 100
            && self.subtitle_languages.len() <= 100
            && self
                .audio_languages
                .bytes()
                .chain(self.subtitle_languages.bytes())
                .all(|byte| byte.is_ascii_lowercase() || byte == b',')
            && valid_subtitle_style(self.subtitle_size, self.subtitle_position)
            && valid_track_delay(self.audio_delay)
            && valid_track_delay(self.subtitle_delay)
    }
}

const fn default_volume() -> f64 {
    100.0
}

const fn default_speed() -> f64 {
    1.0
}

fn valid_startup(volume: f64, speed: f64) -> bool {
    (0.0..=100.0).contains(&volume) && (0.25..=4.0).contains(&speed)
}

pub fn valid_track_delay(seconds: f64) -> bool {
    (-600.0..=600.0).contains(&seconds)
}

pub fn valid_subtitle_style(size: f64, position: f64) -> bool {
    size.is_finite()
        && (10.0..=120.0).contains(&size)
        && position.is_finite()
        && (0.0..=100.0).contains(&position)
}

/// Versioned device preferences; adapters retain their existing account-scoped files.
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Preferences {
    pub version: u8,
    #[serde(default = "default_volume")]
    pub startup_volume: f64,
    #[serde(default = "default_speed")]
    pub startup_speed: f64,
    pub audio_language: String,
    pub subtitle_language: String,
    pub subtitles_enabled: bool,
    pub subtitle_size: f64,
    pub subtitle_position: f64,
    #[serde(default)]
    pub audio_delay: f64,
    #[serde(default)]
    pub subtitle_delay: f64,
    #[serde(default)]
    pub subtitle_color: SubtitleColor,
    #[serde(default)]
    pub subtitle_background: bool,
    #[serde(default)]
    pub subtitle_bold: bool,
}

impl Default for Preferences {
    fn default() -> Self {
        Self {
            version: 1,
            startup_volume: default_volume(),
            startup_speed: default_speed(),
            audio_language: "auto".into(),
            subtitle_language: "ar".into(),
            subtitles_enabled: true,
            subtitle_size: 55.0,
            subtitle_position: 100.0,
            audio_delay: 0.0,
            subtitle_delay: 0.0,
            subtitle_color: SubtitleColor::White,
            subtitle_background: false,
            subtitle_bold: false,
        }
    }
}

impl Preferences {
    pub fn validate(&self) -> Result<(), Error> {
        if self.version != 1
            || !valid_startup(self.startup_volume, self.startup_speed)
            || !TRACK_LANGUAGES.contains(&self.audio_language.as_str())
            || !TRACK_LANGUAGES.contains(&self.subtitle_language.as_str())
            || !valid_subtitle_style(self.subtitle_size, self.subtitle_position)
            || !valid_track_delay(self.audio_delay)
            || !valid_track_delay(self.subtitle_delay)
        {
            return Err(Error::new("bad_request", "تفضيلات المشغّل غير صالحة."));
        }
        Ok(())
    }

    pub fn playback_defaults(&self) -> PlaybackDefaults {
        fn languages(value: &str) -> String {
            match value {
                "ar" => "ar,ara,en,eng",
                "en" => "en,eng",
                "ja" => "ja,jpn",
                "ko" => "ko,kor",
                "fr" => "fr,fra,fre",
                "es" => "es,spa",
                _ => "",
            }
            .into()
        }
        PlaybackDefaults {
            startup_volume: self.startup_volume,
            startup_speed: self.startup_speed,
            audio_languages: languages(&self.audio_language),
            subtitle_languages: languages(&self.subtitle_language),
            subtitles_enabled: self.subtitles_enabled,
            subtitle_size: self.subtitle_size,
            subtitle_position: self.subtitle_position,
            audio_delay: self.audio_delay,
            subtitle_delay: self.subtitle_delay,
            subtitle_color: self.subtitle_color,
            subtitle_background: self.subtitle_background,
            subtitle_bold: self.subtitle_bold,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn old_preferences_load_with_safe_startup_defaults() {
        let value = serde_json::json!({
            "version":1,"audioLanguage":"auto","subtitleLanguage":"ar",
            "subtitlesEnabled":true,"subtitleSize":55.0,"subtitlePosition":100.0
        });
        let preferences: Preferences = serde_json::from_value(value.clone()).unwrap();
        preferences.validate().unwrap();
        let defaults = preferences.playback_defaults();
        assert_eq!(defaults.startup_volume, 100.0);
        assert_eq!(defaults.startup_speed, 1.0);
        assert_eq!(defaults.subtitle_color, SubtitleColor::White);
        assert_eq!(defaults.audio_delay, 0.0);
        assert_eq!(defaults.subtitle_delay, 0.0);
        assert!(!defaults.subtitle_bold && !defaults.subtitle_background);
        assert!(defaults.is_valid());

        let preferences = Preferences {
            startup_volume: 35.0,
            startup_speed: 1.25,
            audio_delay: -0.15,
            subtitle_delay: 0.5,
            subtitle_color: SubtitleColor::Yellow,
            subtitle_background: true,
            subtitle_bold: true,
            ..preferences
        };
        let stored = serde_json::to_value(preferences).unwrap();
        let loaded: Preferences = serde_json::from_value(stored).unwrap();
        assert_eq!(loaded.playback_defaults().startup_volume, 35.0);
        assert_eq!(loaded.playback_defaults().startup_speed, 1.25);
        let defaults = loaded.playback_defaults();
        assert_eq!(defaults.audio_delay, -0.15);
        assert_eq!(defaults.subtitle_delay, 0.5);
        assert_eq!(defaults.subtitle_color, SubtitleColor::Yellow);
        assert!(defaults.subtitle_bold && defaults.subtitle_background);
        assert!(loaded.validate().is_ok());
        assert!(
            Preferences {
                subtitle_delay: 601.0,
                ..loaded.clone()
            }
            .validate()
            .is_err()
        );
        assert!(
            Preferences {
                startup_volume: 101.0,
                startup_speed: f64::INFINITY,
                ..loaded
            }
            .validate()
            .is_err()
        );
    }

    #[test]
    fn preserves_language_order_and_subtitle_choices() {
        let preferences = Preferences::default();
        assert!(preferences.playback_defaults().audio_languages.is_empty());
        assert_eq!(
            preferences.playback_defaults().subtitle_languages,
            "ar,ara,en,eng"
        );
        for (language, expected) in [
            ("auto", ""),
            ("ar", "ar,ara,en,eng"),
            ("en", "en,eng"),
            ("ja", "ja,jpn"),
            ("ko", "ko,kor"),
            ("fr", "fr,fra,fre"),
            ("es", "es,spa"),
        ] {
            let preferences = Preferences {
                audio_language: language.into(),
                subtitle_language: language.into(),
                subtitles_enabled: false,
                ..Preferences::default()
            };
            preferences.validate().unwrap();
            let defaults = preferences.playback_defaults();
            assert_eq!(defaults.audio_languages, expected);
            assert_eq!(defaults.subtitle_languages, expected);
            assert!(!defaults.subtitles_enabled);
            assert!(defaults.is_valid());
        }
    }

    #[test]
    fn subtitle_style_has_one_finite_bounded_policy() {
        for (size, position) in [(10.0, 0.0), (120.0, 100.0), (55.0, 80.0)] {
            assert!(valid_subtitle_style(size, position));
        }
        for (size, position) in [
            (9.99, 0.0),
            (120.01, 0.0),
            (55.0, -0.01),
            (55.0, 100.01),
            (f64::NAN, 0.0),
            (f64::INFINITY, 0.0),
            (55.0, f64::NEG_INFINITY),
        ] {
            assert!(!valid_subtitle_style(size, position));
            assert!(
                !PlaybackDefaults {
                    subtitle_size: size,
                    subtitle_position: position,
                    ..PlaybackDefaults::default()
                }
                .is_valid()
            );
            assert!(
                Preferences {
                    subtitle_size: size,
                    subtitle_position: position,
                    ..Preferences::default()
                }
                .validate()
                .is_err()
            );
        }
    }

    #[test]
    fn adapters_cannot_receive_unbounded_or_command_like_language_preferences() {
        for language in [
            "AR".into(),
            "ar;run".into(),
            "ar/ara".into(),
            "a".repeat(101),
        ] {
            assert!(
                !PlaybackDefaults {
                    audio_languages: language.clone(),
                    ..PlaybackDefaults::default()
                }
                .is_valid()
            );
            assert!(
                !PlaybackDefaults {
                    subtitle_languages: language,
                    ..PlaybackDefaults::default()
                }
                .is_valid()
            );
        }
        assert!(PlaybackDefaults::default().is_valid());
        assert!(
            Preferences {
                version: 2,
                ..Preferences::default()
            }
            .validate()
            .is_err()
        );
        assert!(
            Preferences {
                subtitle_language: "xx".into(),
                ..Preferences::default()
            }
            .validate()
            .is_err()
        );
    }
}
