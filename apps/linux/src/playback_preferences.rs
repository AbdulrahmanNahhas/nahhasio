//! Private, account-scoped persistence for the shared playback preference model.
use crate::{bridge::Error, private_state};
use nahhasio_client_core::playback::Preferences;
use std::path::Path;

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
    use nahhasio_client_core::playback::SubtitleColor;
    #[test]
    fn preferences_are_validated_persisted_and_account_scoped() {
        let mut nonce = [0; 16];
        getrandom::fill(&mut nonce).unwrap();
        let root = std::env::temp_dir().join(format!("nahhasio-playback-{}", hex::encode(nonce)));
        let mut value = Preferences {
            audio_language: "ja".into(),
            subtitle_language: "en".into(),
            subtitles_enabled: false,
            subtitle_size: 42.0,
            subtitle_position: 90.0,
            subtitle_delay: -0.25,
            subtitle_color: SubtitleColor::Yellow,
            subtitle_background: true,
            subtitle_bold: true,
            ..Preferences::default()
        };
        save(&root, "account-a", serde_json::to_value(&value).unwrap()).unwrap();
        assert_eq!(load(&root, "account-a").unwrap().audio_language, "ja");
        assert_eq!(load(&root, "account-b").unwrap().audio_language, "auto");
        let defaults = load(&root, "account-a").unwrap().playback_defaults();
        assert!(!defaults.subtitles_enabled);
        assert_eq!(defaults.subtitle_languages, "en,eng");
        assert_eq!(defaults.subtitle_size, 42.0);
        assert_eq!(defaults.subtitle_position, 90.0);
        assert_eq!(defaults.subtitle_delay, -0.25);
        assert_eq!(defaults.subtitle_color, SubtitleColor::Yellow);
        assert!(defaults.subtitle_background && defaults.subtitle_bold);
        value.subtitle_size = f64::INFINITY;
        assert!(value.validate().is_err());
        std::fs::remove_dir_all(root).unwrap();
    }
}
