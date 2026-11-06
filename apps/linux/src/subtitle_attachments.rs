//! Device-owned subtitle copies, scoped to the account/server and catalog episode.
use crate::{bridge::Error, media::ResolvedTarget, media_storage::Roots, private_state};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    fs,
    io::{Read, Write},
    os::unix::fs::OpenOptionsExt,
    path::{Path, PathBuf},
};

const LIMIT: usize = 16 * 1024 * 1024;
#[derive(Deserialize, Serialize)]
#[serde(untagged)]
enum Selection {
    Named {
        file: String,
        label: String,
        language: Option<String>,
    },
    Legacy(String),
}
impl Selection {
    fn file(&self) -> &str {
        match self {
            Self::Named { file, .. } | Self::Legacy(file) => file,
        }
    }
}
pub struct Attachment {
    pub path: PathBuf,
    pub label: String,
    pub language: Option<String>,
}
fn error() -> Error {
    Error::new(
        "subtitle_storage",
        "تعذّر حفظ ترجمة الحلقة على الجهاز أو قراءتها.",
    )
}
fn directory(scope: &str, target: &ResolvedTarget) -> Result<PathBuf, Error> {
    let identity = format!(
        "{}:{}:{}",
        target.work_id,
        target.installment_id,
        target.episode_id.as_deref().unwrap_or("movie")
    );
    Ok(Roots::discover()
        .map_err(|_| error())?
        .state
        .join("episode-subtitles-v1")
        .join(hex::encode(Sha256::digest(scope.as_bytes())))
        .join(hex::encode(Sha256::digest(identity.as_bytes()))))
}
pub fn load(scope: &str, target: &ResolvedTarget) -> Result<Option<Attachment>, Error> {
    let root = directory(scope, target)?;
    let Some(selection) = private_state::read::<Selection>(&root, "selection.json")? else {
        return Ok(None);
    };
    if !valid_name(selection.file()) {
        return Err(error());
    }
    let path = root.join(selection.file());
    let (label, language) = match selection {
        Selection::Named {
            label, language, ..
        } => (label, language),
        Selection::Legacy(_) => ("ترجمة محفوظة على الجهاز".into(), None),
    };
    if label.len() > 200
        || language.as_ref().is_some_and(|language| {
            language.len() > 16
                || !language
                    .bytes()
                    .all(|c| c.is_ascii_alphabetic() || c == b'-')
        })
    {
        return Err(error());
    }
    match fs::symlink_metadata(&path) {
        Ok(meta)
            if meta.is_file() && !meta.file_type().is_symlink() && meta.len() <= LIMIT as u64 =>
        {
            Ok(Some(Attachment {
                path,
                label,
                language,
            }))
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        _ => Err(error()),
    }
}
fn valid_name(name: &str) -> bool {
    name.split_once('.').is_some_and(|(hash, ext)| {
        hash.len() == 64
            && hash.bytes().all(|c| c.is_ascii_hexdigit())
            && ["srt", "ass", "ssa", "vtt"].contains(&ext)
    })
}
pub fn retain(
    scope: &str,
    target: &ResolvedTarget,
    source: &Path,
    label: &str,
    language: Option<&str>,
) -> Result<PathBuf, Error> {
    let extension = source
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    if !["srt", "ass", "ssa", "vtt"].contains(&extension.as_str()) {
        return Err(error());
    }
    let mut bytes = Vec::new();
    fs::File::open(source)
        .map_err(|_| error())?
        .take(LIMIT as u64 + 1)
        .read_to_end(&mut bytes)
        .map_err(|_| error())?;
    if bytes.is_empty() || bytes.len() > LIMIT {
        return Err(error());
    }
    let root = directory(scope, target)?;
    let old = private_state::read::<Selection>(&root, "selection.json")?;
    let name = format!("{}.{extension}", hex::encode(Sha256::digest(&bytes)));
    if let Some(old) = &old
        && !valid_name(old.file())
    {
        return Err(error());
    }
    // Establish a private directory without publishing a selection before its bytes are durable.
    private_state::write(&root, "format.json", &1u8)?;
    let destination = root.join(&name);
    let mut nonce = [0u8; 16];
    getrandom::fill(&mut nonce).map_err(|_| error())?;
    let temporary = root.join(format!(".subtitle-{}.tmp", hex::encode(nonce)));
    let write = (|| {
        let mut file = fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .mode(0o600)
            .open(&temporary)
            .map_err(|_| error())?;
        file.write_all(&bytes)
            .and_then(|()| file.sync_all())
            .map_err(|_| error())?;
        fs::rename(&temporary, &destination).map_err(|_| error())?;
        Ok::<_, Error>(())
    })();
    if write.is_err() {
        let _ = fs::remove_file(&temporary);
    }
    write?;
    private_state::write(
        &root,
        "selection.json",
        &Selection::Named {
            file: name.clone(),
            label: label.into(),
            language: language.map(str::to_owned),
        },
    )?;
    if let Some(old) = old
        && old.file() != name
    {
        match fs::remove_file(root.join(old.file())) {
            Ok(()) => {}
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
            Err(_) => return Err(error()),
        }
    }
    Ok(destination)
}
