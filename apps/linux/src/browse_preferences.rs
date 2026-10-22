//! Device-local Browse preferences, isolated by the native server/account scope.
use crate::{bridge::Error, private_state};
use serde::{Deserialize, Serialize};
use std::path::Path;

const LIMIT: usize = 128 * 1024;
#[derive(Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Preferences {
    pub version: u8,
    pub search: String,
    pub display: Display,
    pub presets: Vec<Preset>,
}
#[derive(Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Display {
    pub layout: String,
    pub size: String,
    pub minimal: bool,
    pub borderless: bool,
    pub show_score: bool,
    pub show_status: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub show_metadata: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub show_original_title: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub table_columns: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub table_posters: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub table_density: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub table_title: Option<String>,
}
#[derive(Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Preset {
    pub id: String,
    pub name: String,
    pub search: String,
    pub display: Display,
}
fn invalid() -> Error {
    Error::new(
        "browse_preferences",
        "تعذّر قراءة أو حفظ تفضيلات التصفح على الجهاز.",
    )
}
fn valid_search(search: &str) -> bool {
    search.len() <= 9000
        && url::form_urlencoded::parse(search.as_bytes()).all(|(key, value)| match key.as_ref() {
            "view" => matches!(value.as_ref(), "works" | "installments"),
            "privacy" => matches!(value.as_ref(), "public" | "private" | "all"),
            "sort" => matches!(
                value.as_ref(),
                "year-desc"
                    | "year-asc"
                    | "latest-released-desc"
                    | "score-desc"
                    | "title"
                    | "updated-desc"
                    | "added-desc"
            ),
            "group" => matches!(
                value.as_ref(),
                "none"
                    | "year"
                    | "format"
                    | "audience"
                    | "status"
                    | "watchState"
                    | "planet"
                    | "genre"
                    | "country"
                    | "studio"
            ),
            "from" | "to" => value.len() <= 4 && value.bytes().all(|c| c.is_ascii_digit()),
            "filters" => {
                value.len() <= 8000
                    && serde_json::from_str::<serde_json::Map<String, serde_json::Value>>(&value)
                        .is_ok()
            }
            _ => false,
        })
}
fn valid_display(display: &Display) -> bool {
    matches!(
        display.layout.as_str(),
        "poster" | "banner" | "logo" | "table"
    ) && matches!(display.size.as_str(), "compact" | "normal" | "comfortable")
        && display
            .table_density
            .as_deref()
            .is_none_or(|value| matches!(value, "compact" | "normal"))
        && display
            .table_title
            .as_deref()
            .is_none_or(|value| matches!(value, "arabic" | "english" | "both"))
        && display.table_columns.as_ref().is_none_or(|columns| {
            columns.len() <= 7
                && columns.iter().all(|value| {
                    matches!(
                        value.as_str(),
                        "release"
                            | "status"
                            | "score"
                            | "audience"
                            | "age"
                            | "watchState"
                            | "format"
                    )
                })
        })
}
impl Preferences {
    fn validate(&self) -> Result<(), Error> {
        if self.version != 1
            || !valid_search(&self.search)
            || !valid_display(&self.display)
            || self.presets.len() > 8
            || self.presets.iter().any(|preset| {
                !crate::bridge::valid_id(&preset.id)
                    || preset.name.trim().is_empty()
                    || preset.name.chars().count() > 60
                    || !valid_search(&preset.search)
                    || !valid_display(&preset.display)
            })
            || self.presets.iter().enumerate().any(|(index, preset)| {
                self.presets[..index]
                    .iter()
                    .any(|previous| previous.id == preset.id)
            })
        {
            return Err(invalid());
        }
        Ok(())
    }
}
pub fn execute(
    root: &Path,
    scope: &str,
    command: &str,
    payload: serde_json::Value,
) -> Result<serde_json::Value, Error> {
    // Scope is derived by Rust from the selected server and account, never accepted from JS.
    let name = format!("browse-{scope}.json");
    match command {
        "browsePreferences.load" => {
            let value = private_state::read_limit::<Preferences>(root, &name, LIMIT)?;
            if let Some(value) = &value {
                value.validate()?;
            }
            serde_json::to_value(value).map_err(|_| invalid())
        }
        "browsePreferences.save" => {
            let value: Preferences = serde_json::from_value(payload).map_err(|_| invalid())?;
            value.validate()?;
            private_state::write_limit(root, &name, &value, LIMIT)?;
            Ok(serde_json::json!({"ok":true}))
        }
        _ => Err(invalid()),
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn preferences_survive_reopen_and_remain_scoped() {
        let mut nonce = [0_u8; 16];
        getrandom::fill(&mut nonce).unwrap();
        let root =
            std::env::temp_dir().join(format!("nahhasio-browse-test-{}", hex::encode(nonce)));
        let value = serde_json::json!({"version":1,"search":"group=planet&sort=title","display":{"layout":"poster","size":"normal","minimal":false,"borderless":false,"showScore":true,"showStatus":true},"presets":[]});
        assert!(
            execute(
                &root,
                "server-a-account-a",
                "browsePreferences.load",
                serde_json::json!({})
            )
            .unwrap()
            .is_null()
        );
        execute(
            &root,
            "server-a-account-a",
            "browsePreferences.save",
            value.clone(),
        )
        .unwrap();
        assert_eq!(
            execute(
                &root,
                "server-a-account-a",
                "browsePreferences.load",
                serde_json::json!({})
            )
            .unwrap(),
            value
        );
        assert!(
            execute(
                &root,
                "server-b-account-a",
                "browsePreferences.load",
                serde_json::json!({})
            )
            .unwrap()
            .is_null()
        );
        assert!(
            execute(
                &root,
                "server-a-account-b",
                "browsePreferences.load",
                serde_json::json!({})
            )
            .unwrap()
            .is_null()
        );
        let mut invalid = value.clone();
        invalid["version"] = serde_json::json!(2);
        assert!(
            execute(
                &root,
                "server-a-account-a",
                "browsePreferences.save",
                invalid
            )
            .is_err()
        );
        assert_eq!(
            execute(
                &root,
                "server-a-account-a",
                "browsePreferences.load",
                serde_json::json!({})
            )
            .unwrap(),
            value
        );
        std::fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn only_bounded_browse_state_is_persisted() {
        assert!(valid_search("group=planet&sort=title&filters=%7B%7D"));
        assert!(!valid_search("token=private"));
        assert!(!valid_search("group=arbitrary"));
        assert!(!valid_search("filters=broken"));
        assert!(!valid_search(&"x".repeat(9001)));
    }
}
