//! Durable export intent; copies run on the caller's blocking executor, not the owner queue.
use super::*;
use std::io::Write;

impl Owner {
    pub(super) fn job_root(&self, id: &str) -> Result<PathBuf> {
        let root: String =
            self.db
                .query_row("SELECT payload_root FROM jobs WHERE id=?1", [id], |row| {
                    row.get(0)
                })?;
        let root = PathBuf::from(root);
        if root != self.root && root != self.payload_root {
            return Err(Error::Invalid("unrecognized payload root".into()));
        }
        reject_symlinks(&root)?;
        Ok(root)
    }
}

/// A single safe directory name, preserving readable Unicode work titles.
pub fn work_directory(title: &str) -> String {
    let name: String = title
        .chars()
        .map(|c| {
            if c.is_control() || matches!(c, '/' | '\\' | ':') {
                '_'
            } else {
                c
            }
        })
        .take(120)
        .collect();
    let name = name.trim().trim_matches('.').trim();
    if name.is_empty() {
        "Video".into()
    } else {
        name.into()
    }
}

impl Engine {
    pub fn keep_export(&self, id: &TorrentId, file: u32, videos: &Path, title: &str) -> Result<()> {
        create_private_root(videos)?;
        let folder = videos.join(work_directory(title));
        create_private_root(&folder)?;
        let folder = folder.canonicalize()?;
        let entry = self
            .files(id)?
            .into_iter()
            .find(|entry| entry.index == file)
            .ok_or_else(|| Error::Invalid("file".into()))?;
        let filename = Path::new(&entry.path)
            .file_name()
            .ok_or_else(|| Error::Invalid("filename".into()))?;
        let destination = folder.join(filename);
        reject_symlinks(&destination)?;
        let owned_id = id.0.clone();
        let destination = destination
            .to_str()
            .ok_or_else(|| Error::Invalid("destination encoding".into()))?
            .to_owned();
        self.call(move |owner| {
            let previous: Option<String> = owner
                .db
                .query_row(
                    "SELECT destination FROM exports WHERE id=?1 AND file=?2",
                    params![owned_id, file],
                    |row| row.get(0),
                )
                .optional()?;
            if let Some(previous) = previous {
                if previous != destination {
                    return Err(Error::Invalid("export destination changed".into()));
                }
                if !Path::new(&destination).exists() {
                    owner.db.execute(
                        "UPDATE exports SET done=0 WHERE id=?1 AND file=?2",
                        params![owned_id, file],
                    )?;
                }
            } else {
                if Path::new(&destination).exists() {
                    return Err(Error::Invalid(
                        "download filename already exists; nothing was overwritten".into(),
                    ));
                }
                owner.db.execute(
                    "INSERT INTO exports(id,file,destination) VALUES(?1,?2,?3)",
                    params![owned_id, file, destination],
                )?;
            }
            Ok(())
        })?;
        self.keep_file(id, file)
    }

    /// Publish only whole verified files. Never overwrite a destination, including on restart.
    pub fn export_completed(&self) -> Result<()> {
        let _guard = self.0.exports.try_lock().map_err(|_| Error::Busy)?;
        let plans = self.call(|owner| {
            let mut stmt = owner
                .db
                .prepare("SELECT id,file,destination FROM exports WHERE done=0")?;
            let plans = stmt
                .query_map([], |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, u32>(1)?,
                        row.get::<_, String>(2)?,
                    ))
                })?
                .collect::<std::result::Result<Vec<_>, _>>()?;
            Ok(plans)
        })?;
        let mut failure = None;
        for (id, file, destination) in plans {
            let result = self.export_one(id.clone(), file, PathBuf::from(destination));
            let message = result.as_ref().err().map(ToString::to_string);
            self.call(move |owner| {
                if let Some(message) = message {
                    owner.export_errors.insert((id, file), message);
                } else {
                    owner.export_errors.remove(&(id, file));
                }
                Ok(())
            })?;
            if let Err(error) = result {
                failure = Some(error);
            }
        }
        failure.map_or(Ok(()), Err)
    }
    fn export_one(&self, id: String, file: u32, destination: PathBuf) -> Result<()> {
        let reader_id = id.clone();
        let source = self.call(move |owner| {
            if !owner.selection(&reader_id)?.contains(&file)
                || !owner.native.file_complete(&reader_id, file)?
            {
                return Ok(None);
            }
            let entry = owner
                .files(&reader_id)?
                .into_iter()
                .find(|entry| entry.index == file)
                .ok_or_else(|| Error::Invalid("file".into()))?;
            Ok(Some((
                owner
                    .job_root(&reader_id)?
                    .join(&reader_id)
                    .join(entry.path),
                entry.size,
            )))
        })?;
        let Some((source, size)) = source else {
            return Ok(());
        };
        reject_symlinks(&source)?;
        reject_hardlinks(&source)?;
        reject_symlinks(&destination)?;
        let parent = destination
            .parent()
            .ok_or_else(|| Error::Invalid("destination".into()))?;
        create_private_root(parent)?;
        let temp = parent.join(format!(".nahhasio-{id}-{file}.partial"));
        // A leftover private partial is ours, but refuse symlinks/hardlinks before retrying.
        reject_symlinks(&temp)?;
        reject_hardlinks(&temp)?;
        if temp.exists() {
            std::fs::remove_file(&temp)?;
        }
        let mut output = std::fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temp)?;
        let result = (|| {
            let torrent = TorrentId(id.clone());
            let cancel = Cancellation::default();
            let mut offset = 0;
            while offset < size {
                let length = (size - offset).min(MAX_RANGE as u64) as usize;
                let bytes = self.read_range(
                    &torrent,
                    file,
                    offset,
                    length,
                    Duration::from_secs(10),
                    &cancel,
                )?;
                output.write_all(&bytes)?;
                offset += bytes.len() as u64;
            }
            output.flush()?;
            output.sync_all()?;
            // Atomic no-clobber publication on the same filesystem; no link to torrent storage.
            std::fs::hard_link(&temp, &destination)?;
            std::fs::File::open(parent)?.sync_all()?;
            self.call(move |owner| {
                owner.db.execute(
                    "UPDATE exports SET done=1,size=?3 WHERE id=?1 AND file=?2",
                    params![
                        id,
                        file,
                        i64::try_from(size).map_err(|_| Error::Invalid("file size".into()))?
                    ],
                )?;
                Ok(())
            })
        })();
        let _ = std::fs::remove_file(temp);
        result
    }
}

#[derive(Clone)]
pub struct SavedFile {
    pub id: String,
    pub file: u32,
    pub target: String,
    pub path: PathBuf,
    pub size: u64,
    pub available: bool,
    pub published: bool,
    pub error: Option<String>,
}
#[derive(Serialize)]
pub struct CacheResult {
    pub removed: usize,
    pub skipped: usize,
}
impl Owner {
    fn saved_files(&self) -> Result<Vec<SavedFile>> {
        let mut stmt = self
            .db
            .prepare("SELECT id,file,target,destination,size,done FROM exports")?;
        let files = stmt
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, u32>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, i64>(4)?,
                    row.get::<_, bool>(5)?,
                ))
            })?
            .collect::<std::result::Result<Vec<_>, _>>()?;
        Ok(files
            .into_iter()
            .map(|(id, file, target, path, size, done)| {
                let path = PathBuf::from(path);
                let size = u64::try_from(size).unwrap_or(0);
                let available = done
                    && path.starts_with(&self.root)
                    && reject_symlinks(&path).is_ok()
                    && reject_hardlinks(&path).is_ok()
                    && std::fs::metadata(&path)
                        .is_ok_and(|meta| meta.is_file() && meta.len() == size);
                let error = self.export_errors.get(&(id.clone(), file)).cloned();
                SavedFile {
                    published: done,
                    error,
                    id,
                    file,
                    target,
                    path,
                    size,
                    available,
                }
            })
            .collect())
    }
}
impl Engine {
    /// Remove durable queue interest, keeping published videos and playback leases.
    pub fn forget_download(&self, id: &TorrentId) -> Result<()> {
        let _guard = self.0.exports.try_lock().map_err(|_| Error::Busy)?;
        let id = id.0.clone();
        self.call(move |owner| {
            let tx = owner.db.transaction()?;
            let changed = tx.execute("UPDATE jobs SET selected='[]' WHERE id=?1", [&id])?;
            if changed == 0 {
                return Err(Error::Invalid("download not found".into()));
            }
            tx.execute("DELETE FROM exports WHERE id=?1 AND done=0", [&id])?;
            tx.commit()?;
            if !owner.recovery.contains_key(&id) {
                owner.apply_selection(&id)?;
            }
            Ok(())
        })
    }
    /// Forget only registered exported files; physical deletion refuses replaced paths.
    pub fn remove_saved(&self, id: &TorrentId, file: u32, delete_video: bool) -> Result<()> {
        let _guard = self.0.exports.try_lock().map_err(|_| Error::Busy)?;
        let id = id.0.clone();
        self.call(move |owner| {
            let saved = owner
                .saved_files()?
                .into_iter()
                .find(|entry| entry.id == id && entry.file == file && entry.published)
                .ok_or_else(|| Error::Invalid("saved file not found".into()))?;
            let selected: Option<String> = owner
                .db
                .query_row("SELECT selected FROM jobs WHERE id=?1", [&id], |row| {
                    row.get(0)
                })
                .optional()?;
            let has_job = selected.is_some();
            let mut selected: Vec<u32> = serde_json::from_str(selected.as_deref().unwrap_or("[]"))?;
            if delete_video && saved.path.exists() {
                if !saved.available {
                    return Err(Error::Invalid(
                        "saved file changed; physical deletion refused".into(),
                    ));
                }
                reject_symlinks(&saved.path)?;
                reject_hardlinks(&saved.path)?;
                std::fs::remove_file(&saved.path)?;
            }
            selected.retain(|value| *value != file);
            let tx = owner.db.transaction()?;
            tx.execute(
                "DELETE FROM exports WHERE id=?1 AND file=?2",
                params![id, file],
            )?;
            tx.execute(
                "UPDATE jobs SET selected=?2 WHERE id=?1",
                params![id, serde_json::to_string(&selected)?],
            )?;
            tx.commit()?;
            if has_job && !owner.recovery.contains_key(&id) {
                owner.apply_selection(&id)?;
            }
            Ok(())
        })
    }
    pub fn retry_saved(&self, id: &TorrentId, file: u32) -> Result<()> {
        let _guard = self.0.exports.try_lock().map_err(|_| Error::Busy)?;
        let owned_id = id.0.clone();
        self.call(move |owner| {
            if matches!(
                owner.recovery.get(&owned_id),
                Some(TransferState::Blocked | TransferState::Failed)
            ) {
                return Err(Error::Invalid("choose another source".into()));
            }
            owner.validate_selection(&owned_id, &[file])?;
            let saved = owner
                .saved_files()?
                .into_iter()
                .find(|entry| entry.id == owned_id && entry.file == file)
                .ok_or_else(|| Error::Invalid("saved file not found".into()))?;
            if saved.available {
                return Ok(());
            }
            if saved.path.exists() {
                return Err(Error::Invalid(
                    "destination changed; nothing was overwritten".into(),
                ));
            }
            owner.db.execute(
                "UPDATE exports SET done=0 WHERE id=?1 AND file=?2",
                params![owned_id, file],
            )?;
            Ok(())
        })?;
        self.keep_file(id, file)?;
        self.resume(id)
    }
    pub fn saved_files(&self) -> Result<Vec<SavedFile>> {
        self.call(|owner| owner.saved_files())
    }
    pub fn set_export_target(&self, id: &TorrentId, file: u32, target: String) -> Result<()> {
        let entry = self
            .files(id)?
            .into_iter()
            .find(|entry| entry.index == file)
            .ok_or_else(|| Error::Invalid("file".into()))?;
        let id = id.0.clone();
        self.call(move |owner| {
            owner.db.execute(
                "UPDATE exports SET target=?3,size=?4 WHERE id=?1 AND file=?2",
                params![
                    id,
                    file,
                    target,
                    i64::try_from(entry.size).map_err(|_| Error::Invalid("file size".into()))?
                ],
            )?;
            Ok(())
        })
    }
    /// Only private, inactive jobs with no unfinished durable interest are eligible.
    /// Published Videos files and their local-playback records are never removed.
    pub fn delete_cache(&self) -> Result<CacheResult> {
        if self.0.readers.load(Ordering::Acquire) != 0 {
            return Err(Error::Invalid("playback/export reader is active".into()));
        }
        self.call(|owner| {
            let saved = owner.saved_files()?;
            let mut result = CacheResult {
                removed: 0,
                skipped: 0,
            };
            for job in owner.jobs()? {
                let id = &job.id.0;
                let root = owner.job_root(id)?;
                if root == owner.root
                    || owner.leases.values().any(|(leased, _)| leased == id)
                    || saved
                        .iter()
                        .any(|saved| saved.id == *id && !saved.available)
                    || !job.selected.iter().all(|file| {
                        saved
                            .iter()
                            .any(|saved| saved.id == *id && saved.file == *file && saved.available)
                    })
                {
                    result.skipped += 1;
                    continue;
                }
                validate_path(id)?;
                let path = root.join(id);
                if path.exists() {
                    validate_cache_tree(&path)?;
                }
                owner.native.pin_mut().remove(id)?;
                if path.exists() {
                    std::fs::remove_dir_all(&path)?;
                }
                owner.db.execute("DELETE FROM jobs WHERE id=?1", [id])?;
                owner.errors.remove(id);
                owner.recovery.remove(id);
                result.removed += 1;
            }
            Ok(result)
        })
    }
}
fn validate_cache_tree(path: &Path) -> Result<()> {
    reject_symlinks(path)?;
    let meta = std::fs::symlink_metadata(path)?;
    if meta.is_dir() {
        for entry in std::fs::read_dir(path)? {
            validate_cache_tree(&entry?.path())?;
        }
    } else if meta.is_file() {
        reject_hardlinks(path)?;
    } else {
        return Err(Error::Invalid("unexpected cache entry".into()));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::work_directory;
    #[test]
    fn readable_bounded_folder_names() {
        assert_eq!(
            work_directory("Frieren Beyond Journey's End"),
            "Frieren Beyond Journey's End"
        );
        assert_eq!(work_directory("../a/b\\c:"), "_a_b_c_");
        assert_eq!(work_directory(".."), "Video");
        assert_eq!(work_directory(" أوشي نو كو "), "أوشي نو كو");
    }
}
