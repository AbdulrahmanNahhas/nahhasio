//! Native-only, server-bound session storage. Passwords and tokens never enter the UI.
use crate::bridge::Error;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::{
    fs::{self, OpenOptions},
    io::{Read, Write},
    os::unix::fs::{OpenOptionsExt, PermissionsExt},
    path::{Path, PathBuf},
};

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
    fn file(&self) -> PathBuf {
        self.root.join("session.json")
    }
    fn read(&self) -> Result<Option<Stored>, Error> {
        let path = self.file();
        let metadata = match fs::symlink_metadata(&path) {
            Ok(value) => value,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
            Err(_) => return Err(storage()),
        };
        if !metadata.is_file()
            || metadata.file_type().is_symlink()
            || metadata.permissions().mode() & 0o077 != 0
            || metadata.len() > 16384
        {
            return Err(storage());
        }
        let mut bytes = Vec::new();
        std::fs::File::open(path)
            .map_err(|_| storage())?
            .take(16385)
            .read_to_end(&mut bytes)
            .map_err(|_| storage())?;
        if bytes.len() > 16384 {
            return Err(storage());
        }
        Ok(serde_json::from_slice(&bytes).ok())
    }
    pub fn load(&self, server: &str) -> Result<Option<String>, Error> {
        let Some(value) = self.read()? else {
            return Ok(None);
        };
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
        if token.is_empty() || token.len() > 4096 || expires_at.len() > 100 {
            return Err(storage());
        }
        fs::create_dir_all(&self.root).map_err(|_| storage())?;
        if fs::symlink_metadata(&self.root)
            .map_err(|_| storage())?
            .file_type()
            .is_symlink()
        {
            return Err(storage());
        }
        fs::set_permissions(&self.root, fs::Permissions::from_mode(0o700))
            .map_err(|_| storage())?;
        let mut nonce = [0u8; 16];
        getrandom::fill(&mut nonce).map_err(|_| storage())?;
        let temp = self
            .root
            .join(format!(".session-{}.tmp", hex::encode(nonce)));
        let result = (|| {
            let mut file = OpenOptions::new()
                .write(true)
                .create_new(true)
                .mode(0o600)
                .open(&temp)
                .map_err(|_| storage())?;
            file.write_all(
                &serde_json::to_vec(&Stored {
                    server: server.to_owned(),
                    token: token.to_owned(),
                    expires_at: expires_at.to_owned(),
                })
                .map_err(|_| storage())?,
            )
            .map_err(|_| storage())?;
            file.sync_all().map_err(|_| storage())?;
            fs::rename(&temp, self.file()).map_err(|_| storage())?;
            std::fs::File::open(&self.root)
                .and_then(|folder| folder.sync_all())
                .map_err(|_| storage())
        })();
        if result.is_err() {
            let _ = fs::remove_file(temp);
        }
        result
    }
    pub fn clear(&self, server: &str) -> Result<(), Error> {
        if self.read()?.is_some_and(|stored| stored.server != server) {
            return Ok(());
        }
        match fs::remove_file(self.file()) {
            Ok(()) => Ok(()),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
            Err(_) => Err(storage()),
        }
    }
}
fn storage() -> Error {
    Error::new(
        "session_storage",
        "تعذّر حفظ أو قراءة الجلسة الخاصة. تحقق من صلاحيات مجلد حالة نحّاسيو.",
    )
}
