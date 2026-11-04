//! Versioned device preferences scoped to the authenticated server/account; never catalog data.
use crate::{bridge::Error, private_state};
use serde::{Deserialize, Serialize};
use std::path::Path;

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
            || !self.subtitle_size.is_finite()
            || !(10.0..=120.0).contains(&self.subtitle_size)
            || !self.subtitle_position.is_finite()
            || !(0.0..=100.0).contains(&self.subtitle_position)
        {
            return Err(Error::new("bad_request", "تفضيلات المشغّل غير صالحة."));
        }
        Ok(())
    }
    pub fn native(&self) -> native_player::PlaybackDefaults {
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
        native_player::PlaybackDefaults {
            audio_languages: languages(&self.audio_language),
            subtitle_languages: languages(&self.subtitle_language),
            subtitles_enabled: self.subtitles_enabled,
            subtitle_size: self.subtitle_size,
            subtitle_position: self.subtitle_position,
        }
    }
}
pub fn load(root: &Path, scope: &str) -> Result<Preferences, Error> {
    let value = private_state::read::<Preferences>(root, &format!("playback-{scope}.json"))?
        .unwrap_or_default();
    value.validate()?;
    Ok(value)
}
pub fn save(
    root: &Path,
    scope: &str,
    payload: serde_json::Value,
) -> Result<serde_json::Value, Error> {
    let value: Preferences = serde_json::from_value(payload)
        .map_err(|_| Error::new("bad_request", "تفضيلات المشغّل غير صالحة."))?;
    value.validate()?;
    private_state::write(root, &format!("playback-{scope}.json"), &value)?;
    serde_json::to_value(value).map_err(|_| Error::new("device_storage", "تعذّر حفظ التفضيلات."))
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn preferences_are_validated_persisted_and_account_scoped() {
        let mut nonce = [0; 16];
        getrandom::fill(&mut nonce).unwrap();
        let root = std::env::temp_dir().join(format!("nahhasio-playback-{}", hex::encode(nonce)));
        let mut value = Preferences {
            audio_language: "ja".into(),
            subtitles_enabled: false,
            ..Preferences::default()
        };
        save(&root, "account-a", serde_json::to_value(&value).unwrap()).unwrap();
        assert_eq!(load(&root, "account-a").unwrap().audio_language, "ja");
        assert_eq!(load(&root, "account-b").unwrap().audio_language, "auto");
        assert!(!load(&root, "account-a").unwrap().native().subtitles_enabled);
        value.subtitle_size = f64::INFINITY;
        assert!(value.validate().is_err());
        std::fs::remove_dir_all(root).unwrap();
    }
}
