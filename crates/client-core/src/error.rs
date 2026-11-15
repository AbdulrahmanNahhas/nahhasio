use serde::Serialize;

/// A client failure safe to return across a frontend boundary.
#[derive(Clone, Debug, Serialize)]
pub struct Error {
    pub code: String,
    pub message: String,
}

impl Error {
    pub fn new(code: &str, message: &str) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn preserves_the_existing_frontend_error_shape() {
        assert_eq!(
            serde_json::to_value(Error::new("bad_request", "طلب غير صالح")).unwrap(),
            serde_json::json!({"code":"bad_request","message":"طلب غير صالح"})
        );
    }
}
