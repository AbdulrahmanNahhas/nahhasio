//! Private Browse preference persistence; the client core owns document validation.
use crate::{bridge::Error, private_state};
use nahhasio_client_core::browse_preferences::Preferences;
use std::path::Path;

const LIMIT: usize = 128 * 1024;

fn invalid() -> Error {
    Error::new(
        "browse_preferences",
        "تعذّر قراءة أو حفظ تفضيلات التصفح على الجهاز.",
    )
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
}
