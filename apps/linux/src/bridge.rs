//! The desktop bridge accepts catalog operations, never arbitrary URLs or native commands.
pub use nahhasio_client_core::{Error, identifiers::valid_id};
use serde::Deserialize;
use serde_json::{Value, json};

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Request {
    pub id: String,
    pub command: String,
    #[serde(default = "empty_object")]
    pub payload: Value,
}
fn empty_object() -> Value {
    json!({})
}
impl Request {
    pub fn parse(raw: &str) -> Result<Self, Error> {
        if raw.len() > 16 * 1024 * 1024 {
            return Err(Error::new("bad_request", "Request is too large"));
        }
        let request: Self = serde_json::from_str(raw)
            .map_err(|_| Error::new("bad_request", "Invalid bridge request"))?;
        // Only bounded document writes have a larger payload; other commands retain 16 KiB.
        let limit = if request.command == "browsePreferences.save" {
            128 * 1024
        } else {
            16384
        };
        if raw.len() > limit
            && !matches!(
                request.command.as_str(),
                "workReview" | "workSave" | "editorCall"
            )
        {
            return Err(Error::new("bad_request", "Request is too large"));
        }
        if request.id.is_empty()
            || request.id.len() > 64
            || !request
                .id
                .bytes()
                .all(|c| c.is_ascii_alphanumeric() || c == b'-')
            || !request.payload.is_object()
        {
            return Err(Error::new("bad_request", "Invalid bridge request"));
        }
        Ok(request)
    }
}

pub fn reply(id: &str, result: Result<Value, Error>) -> Value {
    match result {
        Ok(result) => json!({"id": id, "ok": true, "result": result}),
        Err(error) => json!({"id": id, "ok": false, "error": error}),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_unbounded_and_ambiguous_messages() {
        assert!(Request::parse(&"x".repeat(16385)).is_err());
        assert!(
            Request::parse(
                r#"{"id":"1","command":"works","payload":[],"url":"file:///etc/passwd"}"#
            )
            .is_err()
        );
        assert!(Request::parse(r#"{"id":"</script>","command":"session"}"#).is_err());
        assert!(Request::parse(r#"{"id":"request-1","command":"session"}"#).is_ok());
    }
    #[test]
    fn resource_identifiers_cannot_escape_routes() {
        assert!(valid_id("00112233-4455-6677-8899-aabbccddeeff"));
        assert!(!valid_id("../../etc/passwd"));
        assert!(!valid_id("00112233-4455-6677-8899-aabbccddeef/"));
    }
}
