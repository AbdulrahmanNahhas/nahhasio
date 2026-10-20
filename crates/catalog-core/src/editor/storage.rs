use super::*;
use base64::{Engine, engine::general_purpose::STANDARD};
use std::{
    fs::OpenOptions,
    io::{Read, Write},
    os::unix::fs::{MetadataExt, OpenOptionsExt},
    path::{Component, Path, PathBuf},
};
use unicode_normalization::UnicodeNormalization;

pub(super) fn uploads() -> PathBuf {
    std::env::var_os("NAHHASIO_MEDIA_ROOT")
        .or_else(|| std::env::var_os("ARCADIA_MEDIA_ROOT"))
        .map(PathBuf::from)
        .unwrap_or_else(|| Path::new(env!("CARGO_MANIFEST_DIR")).join("../../data/media/uploads"))
}
pub(super) async fn path(stored: &str) -> Result<PathBuf> {
    let relative = stored
        .strip_prefix("/media/")
        .ok_or_else(|| invalid("Invalid artwork path"))?;
    if Path::new(relative)
        .components()
        .any(|c| !matches!(c, Component::Normal(_)))
    {
        return Err(invalid("Invalid artwork path"));
    }
    let upload = uploads();
    let public = std::env::var_os("NAHHASIO_PUBLIC_MEDIA_ROOT")
        .or_else(|| std::env::var_os("ARCADIA_PUBLIC_MEDIA_ROOT"))
        .map(PathBuf::from)
        .unwrap_or_else(|| upload.parent().unwrap_or(&upload).to_path_buf());
    let (root, suffix) = relative
        .strip_prefix("uploads/")
        .map_or((public, relative), |suffix| (upload, suffix));
    let root = tokio::fs::canonicalize(root).await?;
    let file = tokio::fs::canonicalize(root.join(suffix)).await?;
    if !file.starts_with(&root) {
        return Err(invalid("Artwork escapes the configured storage directory"));
    }
    Ok(file)
}
pub(super) async fn health(asset: &Value) -> &'static str {
    match path(text(asset, "path")).await {
        Ok(path) => match tokio::fs::metadata(&path).await {
            Ok(info) if !info.is_file() => "unreadable",
            Ok(info) if Some(info.len()) != asset["byteSize"].as_u64() => "size-mismatch",
            Ok(_) => {
                if tokio::fs::File::open(path).await.is_err() {
                    "unreadable"
                } else if asset["health"] == "deletion-error" {
                    "deletion-error"
                } else {
                    "healthy"
                }
            }
            Err(_) => "unreadable",
        },
        Err(crate::Error::Io(error)) if error.kind() == std::io::ErrorKind::NotFound => "missing",
        Err(_) => "unreadable",
    }
}
fn dimensions(bytes: &[u8], mime: &str) -> Result<(u32, u32)> {
    fn be(b: &[u8], i: usize) -> u32 {
        u32::from_be_bytes(b[i..i + 4].try_into().expect("bounded slice"))
    }
    fn le16(b: &[u8], i: usize) -> u32 {
        u16::from_le_bytes(b[i..i + 2].try_into().expect("bounded slice")) as u32
    }
    let dimensions = match mime {
        "image/png" if bytes.len() >= 24 && bytes.starts_with(b"\x89PNG\r\n\x1a\n") => {
            (be(bytes, 16), be(bytes, 20))
        }
        "image/gif"
            if bytes.len() >= 10
                && (bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a")) =>
        {
            (le16(bytes, 6), le16(bytes, 8))
        }
        "image/webp"
            if bytes.len() >= 30 && bytes.starts_with(b"RIFF") && &bytes[8..12] == b"WEBP" =>
        {
            match &bytes[12..16] {
                b"VP8X" => (
                    1 + u32::from_le_bytes([bytes[24], bytes[25], bytes[26], 0]),
                    1 + u32::from_le_bytes([bytes[27], bytes[28], bytes[29], 0]),
                ),
                b"VP8L" if bytes[20] == 0x2f => {
                    let bits = u32::from_le_bytes(bytes[21..25].try_into().expect("bounded slice"));
                    ((bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1)
                }
                b"VP8 " => {
                    let frame = bytes[20..]
                        .windows(3)
                        .position(|w| w == [0x9d, 0x01, 0x2a])
                        .map(|i| i + 20)
                        .ok_or_else(|| invalid("Invalid WebP frame"))?;
                    if frame + 7 > bytes.len() {
                        return Err(invalid("Invalid WebP frame"));
                    }
                    (
                        le16(bytes, frame + 3) & 0x3fff,
                        le16(bytes, frame + 5) & 0x3fff,
                    )
                }
                _ => return Err(invalid("Invalid WebP image")),
            }
        }
        "image/jpeg" if bytes.starts_with(&[0xff, 0xd8]) => {
            let mut offset = 2;
            let mut found = None;
            while offset + 8 < bytes.len() {
                while offset < bytes.len() && bytes[offset] != 0xff {
                    offset += 1;
                }
                while offset < bytes.len() && bytes[offset] == 0xff {
                    offset += 1;
                }
                let Some(&marker) = bytes.get(offset) else {
                    break;
                };
                offset += 1;
                if matches!(marker, 0xd0..=0xd9) {
                    continue;
                }
                if offset + 2 > bytes.len() {
                    break;
                }
                let length = ((bytes[offset] as usize) << 8) | bytes[offset + 1] as usize;
                if length < 2 || offset + length > bytes.len() {
                    break;
                }
                if matches!(marker,0xc0..=0xc3|0xc5..=0xc7|0xc9..=0xcb|0xcd..=0xcf) && length >= 7 {
                    found = Some((
                        ((bytes[offset + 5] as u32) << 8) | bytes[offset + 6] as u32,
                        ((bytes[offset + 3] as u32) << 8) | bytes[offset + 4] as u32,
                    ));
                    break;
                }
                offset += length;
            }
            found.ok_or_else(|| invalid("Invalid JPEG image"))?
        }
        _ => return Err(invalid("File signature does not match its image type")),
    };
    if dimensions.0 == 0
        || dimensions.1 == 0
        || dimensions.0 > 32768
        || dimensions.1 > 32768
        || u64::from(dimensions.0) * u64::from(dimensions.1) > 100_000_000
    {
        return Err(invalid("Artwork dimensions exceed supported bounds"));
    }
    Ok(dimensions)
}
pub(super) fn slug(value: &str, ascii: bool, limit: usize) -> String {
    let mut output = String::new();
    let mut separator = false;
    for c in value.nfkc().flat_map(char::to_lowercase) {
        if c.is_alphanumeric() && (!ascii || c.is_ascii_alphanumeric()) {
            if separator && !output.is_empty() {
                output.push('-');
            }
            output.push(c);
            separator = false;
        } else {
            separator = true;
        }
        if output.chars().count() >= limit {
            break;
        }
    }
    output.trim_matches('-').to_owned()
}
fn extension(mime: &str) -> Result<&'static str> {
    match mime {
        "image/jpeg" => Ok("jpg"),
        "image/png" => Ok("png"),
        "image/webp" => Ok("webp"),
        "image/gif" => Ok("gif"),
        _ => Err(invalid("Unsupported artwork type")),
    }
}
pub(super) async fn execute(
    c: &mut PgConnection,
    operation: &str,
    input: &Value,
    actor: &str,
) -> Result<Value> {
    let (bytes, mime) = if operation == "upload" {
        let (header, data) = text(input, "dataUrl")
            .split_once(',')
            .ok_or_else(|| invalid("Invalid image data URL"))?;
        let mime = header
            .strip_prefix("data:")
            .and_then(|h| h.strip_suffix(";base64"))
            .ok_or_else(|| invalid("Invalid image data URL"))?;
        extension(mime)?;
        (
            STANDARD
                .decode(data)
                .map_err(|_| invalid("Invalid image encoding"))?,
            mime.to_owned(),
        )
    } else {
        super::providers::download(text(input, "url")).await?
    };
    if bytes.is_empty() || bytes.len() > 10 * 1024 * 1024 {
        return Err(invalid("Artwork exceeds 10 MiB"));
    }
    let (width, height) = dimensions(&bytes, &mime)?;
    if operation == "preview" {
        return Ok(json!({"dataUrl":format!("data:{mime};base64,{}",STANDARD.encode(bytes))}));
    }
    let hash = hex::encode(Sha256::digest(&bytes));
    let folder = if input["role"] == "profile" {
        "profiles".into()
    } else {
        format!("{}s", text(input, "role"))
    };
    let owner = slug(text(input, "ownerName"), true, 80);
    let owner = if owner.is_empty() { "image" } else { &owner };
    let file_name = format!(
        "{owner}-{}-{}.{}",
        text(input, "role"),
        &hash[..10],
        extension(&mime)?
    );
    let root = uploads();
    tokio::fs::create_dir_all(&root).await?;
    let root = tokio::fs::canonicalize(root).await?;
    tokio::fs::create_dir_all(root.join(&folder)).await?;
    let directory = tokio::fs::canonicalize(root.join(&folder)).await?;
    if !directory.starts_with(&root) {
        return Err(invalid("Invalid artwork destination"));
    }
    let destination = directory.join(&file_name);
    let expected_hash = hash.clone();
    let stored_bytes = bytes.clone();
    tokio::task::spawn_blocking(move || -> Result<()> {
        // Exclusive creation never follows or overwrites an existing link. The database is
        // registered only after fsync; a failed transaction leaves recoverable orphan bytes.
        match OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&destination)
        {
            Ok(mut file) => {
                if let Err(error) = file.write_all(&stored_bytes).and_then(|()| file.sync_all()) {
                    drop(file);
                    let _ = std::fs::remove_file(&destination);
                    return Err(error.into());
                }
            }
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {
                let file = OpenOptions::new()
                    .read(true)
                    .custom_flags(libc::O_NOFOLLOW)
                    .open(&destination)?;
                let info = file.metadata()?;
                if !info.is_file() || info.len() != stored_bytes.len() as u64 {
                    return Err(invalid("Artwork destination is occupied"));
                }
                let mut existing = Vec::new();
                file.take(info.len() + 1).read_to_end(&mut existing)?;
                if hex::encode(Sha256::digest(&existing)) != expected_hash {
                    return Err(invalid("Artwork destination has different content"));
                }
            }
            Err(error) => return Err(error.into()),
        }
        Ok(())
    })
    .await
    .map_err(|_| invalid("Artwork storage failed"))??;
    let stored = format!("/media/uploads/{folder}/{file_name}");
    let original = Path::new(input["fileName"].as_str().unwrap_or(&file_name))
        .file_name()
        .and_then(|p| p.to_str())
        .unwrap_or(&file_name);
    let record=one(c,"insert into media_assets(path,sha256,mime_type,byte_size,width,height,original_filename) values($1->>'path',$1->>'hash',$1->>'mime',($1->>'size')::integer,($1->>'width')::integer,($1->>'height')::integer,$1->>'name') on conflict(sha256) do update set sha256=excluded.sha256 returning jsonb_build_object('id',id,'path',path)",json!({"path":stored,"hash":hash,"mime":mime,"size":bytes.len(),"width":width,"height":height,"name":original})).await?;
    exec(c,"insert into audit_logs(actor_account_id,action,target_type,target_id,summary,changes) values(nullif($1->>'actor','')::uuid,'admin.artwork.ingest','media_assets',$1->'record'->>'id','Artwork registration',jsonb_build_object('path',$1->'record'->'path'))",json!({"actor":actor,"record":record})).await?;
    if operation == "ingest" {
        exec(c,"insert into source_evidence(entity_type,entity_id,field_path,source_note,source_url,verification_status,checked_by_account_id,checked_at) values('media_assets',$1->>'id','image','Imported image; assignment remains in the work draft',$1->>'url','verified',nullif($1->>'actor','')::uuid,now())",json!({"id":record["id"],"url":input["url"],"actor":actor})).await?;
    }
    Ok(record)
}
pub(super) async fn hard_link(asset: &Value, new_name: &str) -> Result<()> {
    let source = path(text(asset, "path")).await?;
    let destination = source
        .parent()
        .ok_or_else(|| invalid("Invalid artwork directory"))?
        .join(new_name);
    let asset = asset.clone();
    tokio::task::spawn_blocking(move || -> Result<()> {
        let file = OpenOptions::new()
            .read(true)
            .custom_flags(libc::O_NOFOLLOW)
            .open(&source)?;
        let before = file.metadata()?;
        if !before.is_file()
            || before.len() > 32 * 1024 * 1024
            || Some(before.len()) != asset["byteSize"].as_u64()
        {
            return Err(invalid("Invalid artwork file size"));
        }
        let mut bytes = Vec::new();
        (&file).take(before.len() + 1).read_to_end(&mut bytes)?;
        let after = file.metadata()?;
        if bytes.len() as u64 != before.len()
            || after.modified()? != before.modified()?
            || hex::encode(Sha256::digest(&bytes)) != text(&asset, "sha256")
        {
            return Err(invalid("Artwork content changed"));
        }
        let current = std::fs::symlink_metadata(&source)?;
        if !current.is_file() || current.dev() != before.dev() || current.ino() != before.ino() {
            return Err(invalid("Artwork path changed"));
        }
        if let Err(error) = std::fs::hard_link(&source, &destination)
            && error.kind() != std::io::ErrorKind::AlreadyExists
        {
            return Err(error.into());
        }
        let linked = std::fs::symlink_metadata(destination)?;
        if !linked.is_file() || linked.dev() != before.dev() || linked.ino() != before.ino() {
            return Err(invalid("Artwork destination contains another file"));
        }
        Ok(())
    })
    .await
    .map_err(|_| invalid("Artwork rename failed"))?
}

pub(super) fn detect(bytes: &[u8]) -> Result<&'static str> {
    if bytes.is_empty() || bytes.len() > 10 * 1024 * 1024 {
        return Err(invalid("Artwork exceeds 10 MiB"));
    }
    ["image/jpeg", "image/png", "image/webp", "image/gif"]
        .into_iter()
        .find(|mime| dimensions(bytes, mime).is_ok())
        .ok_or_else(|| invalid("Unsupported image content"))
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn dimensions_reject_truncation_wrong_signatures_and_bombs() {
        for mime in ["image/png", "image/jpeg", "image/gif", "image/webp"] {
            assert!(dimensions(b"bad", mime).is_err());
        }
        let mut png = b"\x89PNG\r\n\x1a\n\0\0\0\rIHDR".to_vec();
        png.extend_from_slice(&1_u32.to_be_bytes());
        png.extend_from_slice(&1_u32.to_be_bytes());
        assert_eq!(dimensions(&png, "image/png").unwrap(), (1, 1));
        png[16..20].copy_from_slice(&u32::MAX.to_be_bytes());
        assert!(dimensions(&png, "image/png").is_err());
    }
}
