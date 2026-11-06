//! Preserve existing matching subtitle files; never infer episode or language identity.
use super::{storage, worker::digest};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

type Result<T> = std::result::Result<T, &'static str>;
const LIMIT: u64 = 16 * 1024 * 1024;

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct Sidecar {
    pub relative_path: String,
    pub original_relative_path: String,
    pub byte_size: u64,
    pub sha256: String,
}
impl Sidecar {
    fn validate(&self) -> Result<()> {
        storage::relative(&self.relative_path).map_err(|_| "Unsafe subtitle destination")?;
        storage::relative(&self.original_relative_path).map_err(|_| "Unsafe subtitle source")?;
        if self.byte_size == 0 || self.byte_size > LIMIT || self.sha256.len() != 64 {
            return Err("Invalid subtitle receipt");
        }
        Ok(())
    }
    pub async fn checked(&self, root: &Path) -> Result<PathBuf> {
        self.validate()?;
        let path = storage::existing(root, &self.relative_path)
            .await
            .map_err(|_| "Subtitle is missing or unsafe")?;
        check(&path, self).await?;
        Ok(path)
    }
}
pub(super) fn decode(value: &serde_json::Value) -> Result<Vec<Sidecar>> {
    let files: Vec<Sidecar> = match value.get("sidecars") {
        None => Vec::new(),
        Some(value) => {
            serde_json::from_value(value.clone()).map_err(|_| "Invalid subtitle receipt")?
        }
    };
    if files.len() > 16 {
        return Err("Too many subtitle companions; review files manually");
    }
    for file in &files {
        file.validate()?;
    }
    Ok(files)
}
fn suffix<'a>(video_stem: &str, name: &'a str) -> Option<&'a str> {
    if name.starts_with('.') {
        return None;
    }
    let suffix = name.strip_prefix(video_stem)?;
    if !suffix.starts_with('.') || suffix.len() > 96 {
        return None;
    }
    let extension = name.rsplit('.').next()?.to_ascii_lowercase();
    matches!(
        extension.as_str(),
        "srt" | "ass" | "ssa" | "vtt" | "sub" | "idx"
    )
    .then_some(suffix)
}
pub(super) async fn discover(root: &Path, source: &str, destination: &str) -> Result<Vec<Sidecar>> {
    let source_path = storage::existing(root, source)
        .await
        .map_err(|_| "Unsafe video source")?;
    let parent = source_path.parent().ok_or("Invalid source parent")?;
    let stem = source_path
        .file_stem()
        .and_then(|s| s.to_str())
        .ok_or("Invalid video name")?;
    let target = Path::new(destination).with_extension("");
    let mut entries = tokio::fs::read_dir(parent)
        .await
        .map_err(|_| "Cannot inspect subtitle companions")?;
    let mut files = Vec::new();
    let mut scanned = 0;
    let mut ambiguous = false;
    while let Some(entry) = entries
        .next_entry()
        .await
        .map_err(|_| "Cannot inspect subtitle companions")?
    {
        scanned += 1;
        if scanned > 100_000 {
            return Err("Too many files beside video; review import folder");
        }
        let name = entry.file_name();
        let Some(name) = name.to_str() else { continue };
        if entry.path() != source_path
            && Path::new(name).file_stem().and_then(|s| s.to_str()) == Some(stem)
            && matches!(
                Path::new(name)
                    .extension()
                    .and_then(|s| s.to_str())
                    .map(str::to_ascii_lowercase)
                    .as_deref(),
                Some("mp4" | "mkv" | "avi" | "mov" | "webm" | "m4v")
            )
        {
            ambiguous = true;
        }
        let Some(suffix) = suffix(stem, name) else {
            continue;
        };
        let stat = tokio::fs::symlink_metadata(entry.path())
            .await
            .map_err(|_| "Cannot inspect subtitle")?;
        if stat.len() == 0 {
            continue;
        }
        if !stat.is_file() || stat.len() > LIMIT || files.len() == 16 {
            return Err("Unsafe or oversized subtitle companion; original files preserved");
        }
        let original = Path::new(source)
            .parent()
            .unwrap_or(Path::new(""))
            .join(name);
        let checked = storage::existing(root, original.to_str().ok_or("Invalid subtitle source")?)
            .await
            .map_err(|_| "Unsafe subtitle source")?;
        let sha256 = digest(&checked).await?;
        let after = tokio::fs::metadata(&checked)
            .await
            .map_err(|_| "Cannot inspect subtitle")?;
        if stat.len() != after.len()
            || stat.modified().ok() != after.modified().ok()
            || after
                .modified()
                .ok()
                .and_then(|t| t.elapsed().ok())
                .is_none_or(|age| age.as_secs() < 2)
        {
            return Err("Subtitle is still being copied; retry after it finishes");
        }
        files.push(Sidecar {
            relative_path: format!(
                "{}{suffix}",
                target.to_str().ok_or("Invalid subtitle destination")?
            ),
            original_relative_path: original.to_str().ok_or("Invalid subtitle source")?.into(),
            byte_size: stat.len(),
            sha256,
        });
    }
    files.sort_by(|a, b| a.relative_path.cmp(&b.relative_path));
    if ambiguous && !files.is_empty() {
        return Err("Subtitle companions match multiple videos; review source filenames");
    }
    Ok(files)
}
async fn check(path: &Path, file: &Sidecar) -> Result<()> {
    let stat = tokio::fs::symlink_metadata(path)
        .await
        .map_err(|_| "Subtitle is missing")?;
    if !stat.is_file() || stat.len() != file.byte_size || digest(path).await? != file.sha256 {
        return Err("Subtitle bytes changed; originals preserved");
    }
    Ok(())
}
pub(super) async fn publish(files: &[Sidecar], source: &Path, library: &Path) -> Result<()> {
    for file in files {
        file.validate()?;
        if tokio::fs::try_exists(library.join(&file.relative_path))
            .await
            .map_err(|_| "Cannot inspect subtitle destination")?
        {
            file.checked(library).await?;
            continue;
        }
        let original = storage::existing(source, &file.original_relative_path)
            .await
            .map_err(|_| "Subtitle source unavailable")?;
        check(&original, file).await?;
        let target = library.join(&file.relative_path);
        let parent = Path::new(&file.relative_path)
            .parent()
            .ok_or("Invalid subtitle destination")?;
        storage::directory(
            library,
            parent.to_str().ok_or("Invalid subtitle destination")?,
        )
        .await
        .map_err(|_| "Unsafe subtitle directory")?;
        let stage = target.with_extension(format!(
            "{}.partial",
            target
                .extension()
                .and_then(|e| e.to_str())
                .ok_or("Invalid subtitle extension")?
        ));
        super::worker::resume_copy(&original, &stage, &file.sha256).await?;
        tokio::fs::hard_link(&stage, &target)
            .await
            .map_err(|_| "Subtitle destination conflict; bytes preserved")?;
        tokio::fs::remove_file(stage)
            .await
            .map_err(|_| "Subtitle staging cleanup needs review")?;
        file.checked(library).await?;
    }
    Ok(())
}
pub(super) async fn cleanup(files: &[Sidecar], source: &Path, library: &Path) -> Result<()> {
    for file in files {
        file.checked(library).await?;
        if tokio::fs::try_exists(source.join(&file.original_relative_path))
            .await
            .map_err(|_| "Cannot inspect subtitle source")?
        {
            let original = storage::existing(source, &file.original_relative_path)
                .await
                .map_err(|_| "Unsafe subtitle cleanup")?;
            check(&original, file).await?;
            tokio::fs::remove_file(original)
                .await
                .map_err(|_| "Subtitle source cleanup needs review")?;
        }
    }
    Ok(())
}
pub(super) async fn retire(
    files: &[Sidecar],
    library: &Path,
    trash: &Path,
    id: &str,
    action: &str,
    missing: &[usize],
) -> Result<()> {
    if missing.iter().any(|index| *index >= files.len()) {
        return Err("Invalid missing subtitle receipt");
    }
    for (index, file) in files.iter().enumerate() {
        file.validate()?;
        let name = format!("{id}.subtitle-{index}");
        let (from, to) = if action == "restore" {
            (trash.join(&name), library.join(&file.relative_path))
        } else {
            (library.join(&file.relative_path), trash.join(&name))
        };
        if action == "purge" {
            if let Some(checked) = storage::optional_existing(trash, &name)
                .await
                .map_err(|_| "Cannot inspect retired subtitle safely")?
            {
                check(&checked, file).await?;
                tokio::fs::remove_file(checked)
                    .await
                    .map_err(|_| "Cannot purge subtitle")?;
            }
            continue;
        }
        // Both endpoints must be contained even when recovering an interrupted move.
        let (source_root, source_rel, target_root, target_rel) = if action == "restore" {
            (trash, name.as_str(), library, file.relative_path.as_str())
        } else {
            (library, file.relative_path.as_str(), trash, name.as_str())
        };
        if missing.contains(&index) {
            let source = storage::optional_existing(source_root, source_rel)
                .await
                .map_err(|_| "Unsafe missing subtitle source")?;
            let target = storage::optional_existing(target_root, target_rel)
                .await
                .map_err(|_| "Unsafe missing subtitle destination")?;
            if source.is_none() && target.is_none() {
                continue;
            }
            // A previously missing companion may have been recovered manually. Verify it.
        }
        if tokio::fs::try_exists(&to)
            .await
            .map_err(|_| "Cannot inspect subtitle destination")?
        {
            let checked = storage::existing(target_root, target_rel)
                .await
                .map_err(|_| "Unsafe subtitle destination")?;
            check(&checked, file).await?;
        } else {
            let checked = storage::existing(source_root, source_rel)
                .await
                .map_err(|_| "Subtitle source missing")?;
            check(&checked, file).await?;
            if let Some(parent) = Path::new(target_rel)
                .parent()
                .filter(|parent| !parent.as_os_str().is_empty())
            {
                storage::directory(
                    target_root,
                    parent.to_str().ok_or("Invalid subtitle destination")?,
                )
                .await
                .map_err(|_| "Unsafe subtitle destination parent")?;
            }
            tokio::fs::hard_link(checked, &to)
                .await
                .map_err(|_| "Subtitle move conflict; originals preserved")?;
        }
        if tokio::fs::try_exists(&from)
            .await
            .map_err(|_| "Cannot inspect subtitle source")?
        {
            let checked = storage::existing(source_root, source_rel)
                .await
                .map_err(|_| "Unsafe subtitle source")?;
            check(&checked, file).await?;
            tokio::fs::remove_file(checked)
                .await
                .map_err(|_| "Subtitle move cleanup needs review")?;
        }
    }
    Ok(())
}

pub(super) async fn retirement_contents(
    files: &[Sidecar],
    library: &Path,
    trash: &Path,
    id: &str,
) -> Result<(Vec<usize>, u64)> {
    let mut missing = Vec::new();
    let mut bytes = 0;
    for (index, file) in files.iter().enumerate() {
        file.validate()?;
        let source = storage::optional_existing(library, &file.relative_path)
            .await
            .map_err(|_| "Unsafe subtitle source")?;
        let target = storage::optional_existing(trash, &format!("{id}.subtitle-{index}"))
            .await
            .map_err(|_| "Unsafe retired subtitle")?;
        if source.is_none() && target.is_none() {
            missing.push(index);
        } else {
            for path in [source, target].into_iter().flatten() {
                check(&path, file).await?;
            }
            bytes += file.byte_size;
        }
    }
    Ok((missing, bytes))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn matching_requires_exact_video_stem_and_a_subtitle_extension() {
        assert_eq!(
            suffix("Episode 1", "Episode 1.ar.forced.srt"),
            Some(".ar.forced.srt")
        );
        for name in [
            "Episode 10.srt",
            "Episode 1.mp4",
            "._Episode 1.srt",
            "Other.srt",
        ] {
            assert_eq!(suffix("Episode 1", name), None);
        }
    }
}
