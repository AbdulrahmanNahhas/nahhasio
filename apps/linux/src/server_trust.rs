//! Explicit home-CA trust, scoped to one server transport. Never changes system trust.
use crate::bridge::Error;
use base64::{Engine as _, engine::general_purpose::STANDARD};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

#[derive(Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct Trust {
    pub certificate: String,
    pub fingerprint: String,
}
fn invalid() -> Error {
    Error::new(
        "certificate",
        "تحقق من شهادة جذر الخادم وبصمة SHA-256 المنقولة من جهاز الخادم مباشرة.",
    )
}
impl Trust {
    pub fn certificate(&self) -> Result<reqwest::Certificate, Error> {
        if self.certificate.len() > 8192 || self.fingerprint.len() > 128 {
            return Err(invalid());
        }
        // Accept exactly one public certificate; reject bundles, keys and trailing material.
        let body = self
            .certificate
            .trim()
            .strip_prefix("-----BEGIN CERTIFICATE-----")
            .and_then(|s| s.strip_suffix("-----END CERTIFICATE-----"))
            .ok_or_else(invalid)?;
        let encoded: String = body.chars().filter(|c| !c.is_ascii_whitespace()).collect();
        let der = STANDARD.decode(encoded).map_err(|_| invalid())?;
        let fingerprint: String = self
            .fingerprint
            .chars()
            .filter(|c| !c.is_ascii_whitespace() && *c != ':')
            .collect();
        if fingerprint.len() != 64
            || !fingerprint.eq_ignore_ascii_case(&hex::encode(Sha256::digest(&der)))
        {
            return Err(invalid());
        }
        reqwest::Certificate::from_der(&der).map_err(|_| invalid())
    }
    pub fn normalized(mut self) -> Result<Self, Error> {
        self.certificate()?;
        self.fingerprint = self
            .fingerprint
            .chars()
            .filter(|c| !c.is_ascii_whitespace() && *c != ':')
            .collect::<String>()
            .to_ascii_lowercase();
        Ok(self)
    }
}
