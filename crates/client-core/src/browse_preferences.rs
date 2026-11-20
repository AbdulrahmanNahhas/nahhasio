//! Validated Browse preference documents; persistence and account scope belong to adapters.
use crate::Error;
use serde::{Deserialize, Serialize};
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
    #[serde(default, skip_serializing_if = "Option::is_none")]
    card_views: Option<CardViews>,
    pub size: String,
    pub minimal: bool,
    pub borderless: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub show_title: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub card_title: Option<String>,
    pub show_score: bool,
    pub show_status: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub show_watch_status: Option<bool>,
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
#[derive(Default, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
struct CardViews {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    poster: Option<CardView>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    banner: Option<CardView>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    logo: Option<CardView>,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct CardView {
    size: String,
    minimal: bool,
    borderless: bool,
    show_score: bool,
    show_status: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    show_title: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    card_title: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    show_watch_status: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    show_metadata: Option<bool>,
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
            "library" => matches!(
                value.as_ref(),
                "all"
                    | "anime"
                    | "arabic-cartoon"
                    | "eastern-animation-movies"
                    | "western-animation-movies"
                    | "live-action-movies"
                    | "western-series"
                    | "arabic-series"
            ),
            "view" => matches!(value.as_ref(), "works" | "installments"),
            "privacy" => matches!(value.as_ref(), "public" | "private" | "all"),
            "sort" => matches!(
                value.as_ref(),
                "year-desc"
                    | "year-asc"
                    | "latest-released-desc"
                    | "score-desc"
                    | "score-asc"
                    | "title"
                    | "title-desc"
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
fn valid_card_view(size: &str, title: Option<&str>) -> bool {
    matches!(size, "compact" | "normal" | "comfortable")
        && title.is_none_or(|value| matches!(value, "arabic" | "english"))
}

fn valid_display(display: &Display) -> bool {
    matches!(
        display.layout.as_str(),
        "poster" | "banner" | "logo" | "table"
    ) && valid_card_view(&display.size, display.card_title.as_deref())
        && display.card_views.as_ref().is_none_or(|views| {
            [&views.poster, &views.banner, &views.logo]
                .into_iter()
                .flatten()
                .all(|view| valid_card_view(&view.size, view.card_title.as_deref()))
        })
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
    pub fn validate(&self) -> Result<(), Error> {
        if self.version != 1
            || !valid_search(&self.search)
            || !valid_display(&self.display)
            || self.presets.len() > 8
            || self.presets.iter().any(|preset| {
                !crate::identifiers::valid_id(&preset.id)
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

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn preserves_documents_and_rejects_invalid_presets() {
        let value = serde_json::json!({"version":1,"search":"group=planet&sort=title","display":{"layout":"poster","size":"normal","minimal":false,"borderless":false,"showScore":true,"showStatus":true},"presets":[]});
        let preferences: Preferences = serde_json::from_value(value.clone()).unwrap();
        preferences.validate().unwrap();
        assert_eq!(serde_json::to_value(preferences).unwrap(), value);
        let mut per_layout = value.clone();
        per_layout["display"]["cardViews"] = serde_json::json!({
            "poster": {
                "size": "comfortable", "minimal": false, "borderless": false,
                "showTitle": true, "cardTitle": "arabic", "showScore": false, "showStatus": true
            }
        });
        let preferences: Preferences = serde_json::from_value(per_layout.clone()).unwrap();
        preferences.validate().unwrap();
        assert_eq!(serde_json::to_value(preferences).unwrap(), per_layout);
        per_layout["display"]["cardViews"]["poster"]["size"] = serde_json::json!("broken");
        assert!(
            serde_json::from_value::<Preferences>(per_layout)
                .unwrap()
                .validate()
                .is_err()
        );

        let preset = serde_json::json!({"id":"00112233-4455-6677-8899-aabbccddeeff","name":"قائمتي","search":"group=year","display":value["display"]});
        let mut with_presets = value.clone();
        with_presets["presets"] = serde_json::json!([preset.clone()]);
        serde_json::from_value::<Preferences>(with_presets.clone())
            .unwrap()
            .validate()
            .unwrap();
        with_presets["presets"] = serde_json::json!([preset.clone(), preset]);
        assert!(
            serde_json::from_value::<Preferences>(with_presets)
                .unwrap()
                .validate()
                .is_err()
        );
        for (key, invalid) in [
            ("version", serde_json::json!(2)),
            ("search", serde_json::json!("token=private")),
        ] {
            let mut invalid_value = value.clone();
            invalid_value[key] = invalid;
            assert!(
                serde_json::from_value::<Preferences>(invalid_value)
                    .unwrap()
                    .validate()
                    .is_err()
            );
        }
    }
    #[test]
    fn only_bounded_browse_state_is_persisted() {
        assert!(valid_search("group=planet&sort=title&filters=%7B%7D"));
        assert!(valid_search(
            "library=arabic-series&view=installments&group=year"
        ));
        assert!(!valid_search("library=arbitrary"));
        assert!(!valid_search("token=private"));
        assert!(!valid_search("group=arbitrary"));
        assert!(!valid_search("filters=broken"));
        assert!(!valid_search(&"x".repeat(9001)));
    }
}
