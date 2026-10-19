//! Server-scoped private sessions; the previous single-session file remains readable.
use crate::{bridge::Error, private_state};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::path::{Path, PathBuf};
#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Stored {
    server: String,
    token: String,
    expires_at: String,
}
pub struct SessionStore {
    root: PathBuf,
}
impl SessionStore {
    pub fn new(root: &Path) -> Self {
        Self {
            root: root.to_path_buf(),
        }
    }
    pub fn installation_id(&self) -> Result<String, Error> {
        let existing: Option<String> = private_state::read(&self.root, "installation.json")?;
        if let Some(id) = existing {
            if crate::bridge::valid_id(&id) {
                return Ok(id);
            }
            return Err(Error::new(
                "device_storage",
                "Invalid installation identity",
            ));
        }
        let mut bytes = [0u8; 16];
        getrandom::fill(&mut bytes)
            .map_err(|_| Error::new("device_storage", "Cannot create installation identity"))?;
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        let hex = hex::encode(bytes);
        let id = format!(
            "{}-{}-{}-{}-{}",
            &hex[..8],
            &hex[8..12],
            &hex[12..16],
            &hex[16..20],
            &hex[20..]
        );
        private_state::write(&self.root, "installation.json", &id)?;
        Ok(id)
    }
    fn name(server: &str) -> String {
        format!(
            "session-{}.json",
            hex::encode(Sha256::digest(server.as_bytes()))
        )
    }
    pub fn load(&self, server: &str) -> Result<Option<String>, Error> {
        let stored: Option<Stored> = private_state::read(&self.root, &Self::name(server))?;
        let stored = match stored {
            Some(value) => Some(value),
            None => private_state::read(&self.root, "session.json")?,
        };
        let Some(value) = stored else { return Ok(None) };
        if value.server != server {
            return Ok(None);
        }
        if value.token.is_empty()
            || value.token.len() > 4096
            || DateTime::parse_from_rfc3339(&value.expires_at)
                .ok()
                .is_none_or(|date| date <= Utc::now())
        {
            self.clear(server)?;
            return Ok(None);
        }
        Ok(Some(value.token))
    }
    pub fn save(&self, server: &str, token: &str, expires_at: &str) -> Result<(), Error> {
        if token.is_empty()
            || token.len() > 4096
            || DateTime::parse_from_rfc3339(expires_at).is_err()
        {
            return Err(Error::new("response", "استجابة جلسة غير صالحة."));
        }
        private_state::write(
            &self.root,
            &Self::name(server),
            &Stored {
                server: server.into(),
                token: token.into(),
                expires_at: expires_at.into(),
            },
        )?;
        self.clear_legacy(server)
    }
    fn clear_legacy(&self, server: &str) -> Result<(), Error> {
        if private_state::read::<Stored>(&self.root, "session.json")?
            .is_some_and(|old| old.server == server)
        {
            private_state::remove(&self.root, "session.json")?;
        }
        Ok(())
    }
    pub fn clear(&self, server: &str) -> Result<(), Error> {
        private_state::remove(&self.root, &Self::name(server))?;
        self.clear_legacy(server)
    }
}
