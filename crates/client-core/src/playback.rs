//! Playback preferences and adapter configuration without player or UI dependencies.
use crate::Error;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug)]
pub struct PlaybackDefaults {
    pub audio_languages: String,
    pub subtitle_languages: String,
    pub subtitles_enabled: bool,
    pub subtitle_size: f64,
    pub subtitle_position: f64,
}

impl Default for PlaybackDefaults {
    fn default() -> Self {
        Self {
            audio_languages: String::new(),
            subtitle_languages: "ar,ara,en,eng".into(),
            subtitles_enabled: true,
            subtitle_size: 55.0,
            subtitle_position: 100.0,
        }
    }
}

impl PlaybackDefaults {
    pub fn is_valid(&self) -> bool {
        self.audio_languages.len() <= 100
            && self.subtitle_languages.len() <= 100
            && self
                .audio_languages
                .bytes()
                .chain(self.subtitle_languages.bytes())
                .all(|byte| byte.is_ascii_lowercase() || byte == b',')
            && valid_subtitle_style(self.subtitle_size, self.subtitle_position)
    }
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
    pub audio_language: String,
    pub subtitle_language: String,
    pub subtitles_enabled: bool,
    pub subtitle_size: f64,
    pub subtitle_position: f64,
}

impl Default for Preferences {
    fn default() -> Self {
        Self {
            version: 1,
            audio_language: "auto".into(),
            subtitle_language: "ar".into(),
            subtitles_enabled: true,
            subtitle_size: 55.0,
            subtitle_position: 100.0,
        }
    }
}

impl Preferences {
    pub fn validate(&self) -> Result<(), Error> {
        if self.version != 1
            || !["auto", "ar", "en", "ja", "ko", "fr", "es"].contains(&self.audio_language.as_str())
            || !["auto", "ar", "en", "fr", "es"].contains(&self.subtitle_language.as_str())
            || !valid_subtitle_style(self.subtitle_size, self.subtitle_position)
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
            audio_languages: languages(&self.audio_language),
            subtitle_languages: languages(&self.subtitle_language),
            subtitles_enabled: self.subtitles_enabled,
            subtitle_size: self.subtitle_size,
            subtitle_position: self.subtitle_position,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn preferences_keep_the_existing_serialized_format() {
        let value = serde_json::json!({
            "version":1,"audioLanguage":"auto","subtitleLanguage":"ar",
            "subtitlesEnabled":true,"subtitleSize":55.0,"subtitlePosition":100.0
        });
        let preferences: Preferences = serde_json::from_value(value.clone()).unwrap();
        preferences.validate().unwrap();
        assert_eq!(serde_json::to_value(preferences).unwrap(), value);
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
                subtitles_enabled: false,
                ..Preferences::default()
            };
            preferences.validate().unwrap();
            let defaults = preferences.playback_defaults();
            assert_eq!(defaults.audio_languages, expected);
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
                subtitle_language: "ja".into(),
                ..Preferences::default()
            }
            .validate()
            .is_err()
        );
    }
}
