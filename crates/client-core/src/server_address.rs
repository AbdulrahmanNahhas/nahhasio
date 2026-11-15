//! Server-origin policy, independent of HTTP transports and certificate storage.
use crate::Error;
use url::Url;

/// Parse an explicit origin. Remote servers require HTTPS; HTTP is loopback-only.
pub fn parse(base: &str) -> Result<Url, Error> {
    let base =
        Url::parse(base).map_err(|_| Error::new("configuration", "Invalid server address"))?;
    if !base.username().is_empty()
        || base.password().is_some()
        || base.query().is_some()
        || base.fragment().is_some()
        || base.path() != "/"
        || !(base.scheme() == "https"
            || (base.scheme() == "http"
                && matches!(
                    base.host_str(),
                    Some("127.0.0.1" | "localhost" | "::1" | "[::1]")
                )))
    {
        return Err(Error::new(
            "configuration",
            "Server must use HTTPS or a loopback HTTP address",
        ));
    }
    Ok(base)
}

/// Normalize server-picker input without constructing clients or making requests.
pub fn normalize(input: &str) -> Result<String, Error> {
    let input = input.trim();
    if input.len() > 2048 || input.is_empty() {
        return Err(Error::new("server_address", "أدخل عنوان الخادم."));
    }
    let url = if input.contains("://") {
        input.to_owned()
    } else {
        format!("https://{input}")
    };
    parse(&url).map(String::from).map_err(|_| {
        Error::new(
            "server_address",
            "استخدم عنوان HTTPS دون اسم مستخدم أو مسار إضافي. HTTP متاح للجهاز المحلي فقط.",
        )
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_origins_without_changing_their_storage_identity() {
        for (input, expected) in [
            (" example.test:8443 ", "https://example.test:8443/"),
            ("https://EXAMPLE.test:443/", "https://example.test/"),
            ("http://127.0.0.1:23103", "http://127.0.0.1:23103/"),
            ("http://localhost:23103/", "http://localhost:23103/"),
            ("http://[::1]:23103", "http://[::1]:23103/"),
        ] {
            assert_eq!(normalize(input).unwrap(), expected);
            assert_eq!(normalize(expected).unwrap(), expected);
        }
    }

    #[test]
    fn rejects_remote_plaintext_credentials_and_nonorigin_urls() {
        for input in [
            "http://example.test",
            "http://192.0.2.1:8443",
            "https://user@example.test",
            "https://user:secret@example.test",
            "https://example.test/api",
            "https://example.test/?token=secret",
            "https://example.test/#section",
            "file:///etc/passwd",
            "ftp://example.test/",
        ] {
            let error = parse(input).unwrap_err();
            assert_eq!(error.code, "configuration");
            assert!(!error.message.contains(input));
            assert_eq!(normalize(input).unwrap_err().code, "server_address");
        }
    }

    #[test]
    fn server_picker_limits_remain_distinct_from_explicit_origin_parsing() {
        assert_eq!(normalize(" ").unwrap_err().code, "server_address");
        assert!(normalize(&"x".repeat(2049)).is_err());
        assert!(parse("not a URL").is_err());
        assert!(parse("example.test").is_err());
    }
}
