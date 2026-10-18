//! Bounded private device-state documents; credentials never enter WebKit.
use crate::bridge::Error;
use serde::{Serialize, de::DeserializeOwned};
use std::{
    fs::{self, OpenOptions},
    io::{Read, Write},
    os::unix::fs::{OpenOptionsExt, PermissionsExt},
    path::Path,
};
pub fn read<T: DeserializeOwned>(root: &Path, name: &str) -> Result<Option<T>, Error> {
    read_limit(root, name, 32768)
}
pub fn read_limit<T: DeserializeOwned>(
    root: &Path,
    name: &str,
    limit: usize,
) -> Result<Option<T>, Error> {
    let path = root.join(name);
    let metadata = match fs::symlink_metadata(&path) {
        Ok(value) => value,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(_) => return Err(error()),
    };
    if !metadata.is_file()
        || metadata.file_type().is_symlink()
        || metadata.permissions().mode() & 0o077 != 0
        || metadata.len() > limit as u64
    {
        return Err(error());
    }
    let mut bytes = Vec::new();
    fs::File::open(path)
        .map_err(|_| error())?
        .take(limit as u64 + 1)
        .read_to_end(&mut bytes)
        .map_err(|_| error())?;
    if bytes.len() > limit {
        return Err(error());
    }
    serde_json::from_slice(&bytes)
        .map(Some)
        .map_err(|_| error())
}
pub fn write<T: Serialize>(root: &Path, name: &str, value: &T) -> Result<(), Error> {
    write_limit(root, name, value, 32768)
}
pub fn write_limit<T: Serialize>(
    root: &Path,
    name: &str,
    value: &T,
    limit: usize,
) -> Result<(), Error> {
    fs::create_dir_all(root).map_err(|_| error())?;
    if fs::symlink_metadata(root)
        .map_err(|_| error())?
        .file_type()
        .is_symlink()
    {
        return Err(error());
    }
    fs::set_permissions(root, fs::Permissions::from_mode(0o700)).map_err(|_| error())?;
    let mut nonce = [0u8; 16];
    getrandom::fill(&mut nonce).map_err(|_| error())?;
    let temporary = root.join(format!(".state-{}.tmp", hex::encode(nonce)));
    let result = (|| {
        let bytes = serde_json::to_vec(value).map_err(|_| error())?;
        if bytes.len() > limit {
            return Err(error());
        }
        let mut file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .mode(0o600)
            .open(&temporary)
            .map_err(|_| error())?;
        file.write_all(&bytes)
            .and_then(|()| file.sync_all())
            .map_err(|_| error())?;
        fs::rename(&temporary, root.join(name)).map_err(|_| error())?;
        fs::File::open(root)
            .and_then(|folder| folder.sync_all())
            .map_err(|_| error())
    })();
    if result.is_err() {
        let _ = fs::remove_file(temporary);
    }
    result
}
pub fn remove(root: &Path, name: &str) -> Result<(), Error> {
    match fs::remove_file(root.join(name)) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(_) => Err(error()),
    }
}
fn error() -> Error {
    Error::new(
        "device_storage",
        "تعذّر قراءة أو حفظ إعدادات الجهاز. تحقق من صلاحيات مجلد حالة نحّاسيو.",
    )
}
