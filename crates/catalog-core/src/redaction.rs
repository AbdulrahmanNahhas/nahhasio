//! Shared protection for operator output and authenticated schema/table inspection.
use serde_json::{Value, json};

pub fn protected(table: &str, column: &str) -> bool {
    match table {
        "auth_users" => ![
            "id",
            "name",
            "email",
            "email_verified",
            "username",
            "display_username",
            "role",
            "banned",
            "ban_expires",
            "created_at",
            "updated_at",
        ]
        .contains(&column),
        "auth_accounts" => {
            !["id", "user_id", "provider_id", "created_at", "updated_at"].contains(&column)
        }
        "auth_sessions" => ![
            "id",
            "user_id",
            "device_id",
            "expires_at",
            "created_at",
            "updated_at",
        ]
        .contains(&column),
        "auth_verifications" => !["id", "expires_at", "created_at", "updated_at"].contains(&column),
        _ => secret_key(column),
    }
}

pub fn secret_key(key: &str) -> bool {
    let key = key
        .chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .collect::<String>()
        .to_ascii_lowercase();
    [
        "password",
        "secret",
        "token",
        "credential",
        "sessionkey",
        "apikey",
        "privatekey",
    ]
    .iter()
    .any(|part| key.contains(part))
}

pub fn scrub(value: &mut Value, depth: usize) {
    if depth > 24 {
        *value = json!("[value too deeply nested]");
        return;
    }
    match value {
        Value::Object(map) => {
            for (key, value) in map.iter_mut() {
                if secret_key(key) {
                    *value = json!("[protected]");
                } else {
                    scrub(value, depth + 1);
                }
            }
        }
        Value::Array(items) => {
            for item in items {
                scrub(item, depth + 1);
            }
        }
        Value::String(text) if text.contains("://") || text.starts_with("magnet:") => {
            if let Some(index) = text.find('?') {
                text.truncate(index);
                text.push_str("?[protected parameters]");
            }
            if text.contains('@') || text.starts_with("postgres") {
                *text = "[protected connection]".into();
            }
        }
        _ => {}
    }
}

pub fn record(table: &str, mut value: Value) -> Value {
    if let Some(object) = value.as_object_mut() {
        for (name, value) in object.iter_mut() {
            if protected(table, name) {
                *value = json!("[protected]");
            }
        }
    }
    scrub(&mut value, 0);
    value
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn secrets_are_masked_in_nested_json_and_provider_urls() {
        let row = json!({"name":"fixture","api_key":"private","metadata":{"apiKey":"private","nested":[{"session_key":"private"}]},"source":"https://example.test/image?token=private"});
        let safe = record("entities", row);
        assert!(!safe.to_string().contains("private"));
        assert_eq!(safe["name"], "fixture");
        assert_eq!(
            record("auth_verifications", json!({"value":"private"}))["value"],
            "[protected]"
        );
    }
}
