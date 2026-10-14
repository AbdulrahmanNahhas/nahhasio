//! Client-owned, thread-confined transfer engine. Blocking methods belong on a
//! caller's blocking executor, never GTK. All transfers restore paused and recheck.
#[allow(unsafe_code)]
mod bridge;
mod exports;
use bridge::ffi;
pub use exports::SavedFile;
use rusqlite::{Connection, OptionalExtension, params};
use serde::{Deserialize, Serialize};
use std::{
    collections::{BTreeMap, BTreeSet},
    path::{Component, Path, PathBuf},
    sync::{
        Arc,
        atomic::{AtomicBool, AtomicUsize, Ordering},
        mpsc,
    },
    thread,
    time::{Duration, Instant},
};
const MAX_META: usize = 8 * 1024 * 1024;
const MAX_RANGE: usize = 256 * 1024;
#[cfg(feature = "test-fixtures")]
pub fn fixture_metainfo(root: &Path, version: u8) -> Result<Vec<u8>> {
    Ok(ffi::fixture(
        root.to_str()
            .ok_or_else(|| Error::Invalid("fixture root encoding".into()))?,
        version,
    )?)
}
type Work = Box<dyn FnOnce(&mut Owner) + Send>;
pub type Result<T> = std::result::Result<T, Error>;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum NetworkPolicy {
    Public,
    LoopbackOnly,
}
#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("transfer: {0}")]
    Native(String),
    #[error(transparent)]
    Io(#[from] std::io::Error),
    #[error(transparent)]
    Store(#[from] rusqlite::Error),
    #[error(transparent)]
    Json(#[from] serde_json::Error),
    #[error("invalid or unsafe input: {0}")]
    Invalid(String),
    #[error("owner queue is full or closed")]
    Busy,
    #[error("range wait cancelled")]
    Cancelled,
    #[error("verified range not available before deadline")]
    Timeout,
}
impl From<cxx::Exception> for Error {
    fn from(value: cxx::Exception) -> Self {
        Self::Native(value.to_string())
    }
}
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct TorrentId(pub String);
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct File {
    pub index: u32,
    pub path: String,
    pub size: u64,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Job {
    pub id: TorrentId,
    pub selected: Vec<u32>,
    pub recovery_error: Option<String>,
    pub recovery_state: Option<TransferState>,
}
#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TransferState {
    MetadataPending,
    Checking,
    Paused,
    Downloading,
    Complete,
    Missing,
    Blocked,
    Failed,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Status {
    pub verified: u64,
    pub total: u64,
    pub complete: bool,
    pub paused: bool,
    pub error: Option<String>,
    pub state: TransferState,
    pub download_rate: u64,
    pub peers: u32,
}
#[derive(Clone, Default)]
pub struct Cancellation {
    flag: Arc<AtomicBool>,
    parent: Option<Arc<AtomicBool>>,
}
impl Cancellation {
    pub fn cancel(&self) {
        self.flag.store(true, Ordering::Release);
    }
    pub fn is_cancelled(&self) -> bool {
        self.flag.load(Ordering::Acquire)
            || self
                .parent
                .as_ref()
                .is_some_and(|flag| flag.load(Ordering::Acquire))
    }
    pub fn child_of(parent: &Self) -> Self {
        Self {
            flag: Arc::new(AtomicBool::new(false)),
            parent: Some(parent.flag.clone()),
        }
    }
}
/// Clones share one engine, SQLite owner and bounded command queue.
#[derive(Clone)]
pub struct Engine(Arc<Inner>);
struct Inner {
    exports: std::sync::Mutex<()>,
    tx: mpsc::SyncSender<Work>,
    join: std::sync::Mutex<Option<thread::JoinHandle<()>>>,
    readers: AtomicUsize,
}
impl Drop for Inner {
    fn drop(&mut self) {
        let _ = self.tx.send(Box::new(|owner| owner.stop = true));
        if let Ok(join) = self.join.get_mut()
            && let Some(join) = join.take()
        {
            let _ = join.join();
        }
    }
}
struct Owner {
    native: cxx::UniquePtr<ffi::Session>,
    db: Connection,
    root: PathBuf,
    payload_root: PathBuf,
    _lock: std::fs::File,
    leases: BTreeMap<u64, (String, Vec<u32>)>,
    next_lease: u64,
    errors: BTreeMap<String, String>,
    recovery: BTreeMap<String, TransferState>,
    export_errors: BTreeMap<(String, u32), String>,
    stop: bool,
}
impl Engine {
    pub fn open(state_root: impl AsRef<Path>, media_root: impl AsRef<Path>) -> Result<Self> {
        Self::open_with_network(state_root, media_root, NetworkPolicy::Public)
    }
    pub fn open_with_network(
        state_root: impl AsRef<Path>,
        media_root: impl AsRef<Path>,
        policy: NetworkPolicy,
    ) -> Result<Self> {
        Self::open_roots(state_root.as_ref(), media_root.as_ref(), None, policy)
    }
    /// Preserve existing payload locations, but place new jobs in private storage.
    pub fn open_with_private_payloads(
        state_root: &Path,
        legacy_root: &Path,
        payload_root: &Path,
    ) -> Result<Self> {
        Self::open_roots(
            state_root,
            legacy_root,
            Some(payload_root.to_path_buf()),
            NetworkPolicy::Public,
        )
    }
    fn open_roots(
        state_root: &Path,
        media_root: &Path,
        payload_root: Option<PathBuf>,
        policy: NetworkPolicy,
    ) -> Result<Self> {
        let state_root = state_root.to_path_buf();
        let media_root = media_root.to_path_buf();
        let (tx, rx) = mpsc::sync_channel::<Work>(32);
        let (ready_tx, ready_rx) = mpsc::sync_channel(1);
        let join = thread::Builder::new()
            .name("media-transfer".into())
            .spawn(move || {
                let mut owner = match Owner::open(state_root, media_root, payload_root, policy) {
                    Ok(owner) => {
                        let _ = ready_tx.send(Ok(()));
                        owner
                    }
                    Err(error) => {
                        let _ = ready_tx.send(Err(error));
                        return;
                    }
                };
                while let Ok(work) = rx.recv() {
                    work(&mut owner);
                    if owner.stop {
                        break;
                    }
                }
            })?;
        ready_rx.recv().map_err(|_| Error::Busy)??;
        Ok(Self(Arc::new(Inner {
            exports: std::sync::Mutex::new(()),
            tx,
            join: std::sync::Mutex::new(Some(join)),
            readers: AtomicUsize::new(0),
        })))
    }
    fn call<T: Send + 'static>(
        &self,
        work: impl FnOnce(&mut Owner) -> Result<T> + Send + 'static,
    ) -> Result<T> {
        let (tx, rx) = mpsc::sync_channel(1);
        self.0
            .tx
            .try_send(Box::new(move |owner| {
                let _ = tx.send(work(owner));
            }))
            .map_err(|_| Error::Busy)?;
        rx.recv().map_err(|_| Error::Busy)?
    }
    pub fn import_torrent(&self, data: Vec<u8>) -> Result<TorrentId> {
        if data.is_empty() || data.len() > MAX_META {
            return Err(Error::Invalid("metainfo size".into()));
        }
        self.call(move |owner| owner.import(data, String::new()))
    }
    pub fn import_magnet(&self, magnet: String) -> Result<TorrentId> {
        if magnet.len() > 8192 || !magnet.starts_with("magnet:?") {
            return Err(Error::Invalid("magnet".into()));
        }
        self.call(move |owner| owner.import(Vec::new(), magnet))
    }
    pub fn files(&self, id: &TorrentId) -> Result<Vec<File>> {
        let id = id.0.clone();
        self.call(move |owner| owner.files(&id))
    }
    pub fn jobs(&self) -> Result<Vec<Job>> {
        self.call(|owner| owner.jobs())
    }
    /// Replace durable interest before activity. Empty selection never deletes data.
    pub fn select_download(&self, id: &TorrentId, files: Vec<u32>) -> Result<()> {
        let owned_id = id.0.clone();
        self.call(move |owner| {
            let id = owned_id;
            let files: Vec<u32> = files
                .into_iter()
                .collect::<BTreeSet<_>>()
                .into_iter()
                .collect();
            owner.validate_selection(&id, &files)?;
            owner.db.execute(
                "UPDATE jobs SET selected=?2 WHERE id=?1",
                params![id, serde_json::to_string(&files)?],
            )?;
            owner.apply_selection(&id)?;
            Ok(())
        })?;
        self.checkpoint_job(id)
    }
    /// Playback and durable jobs use the same handle's union selection.
    pub fn playback_lease(&self, id: &TorrentId, files: Vec<u32>) -> Result<PlaybackLease> {
        let id = id.0.clone();
        let token = self.call(move |owner| {
            owner.validate_selection(&id, &files)?;
            let token = owner.next_lease;
            owner.next_lease += 1;
            owner.leases.insert(token, (id.clone(), files));
            owner.apply_selection(&id)?;
            Ok(token)
        })?;
        Ok(PlaybackLease {
            engine: self.clone(),
            token,
        })
    }
    pub fn start(&self, id: &TorrentId) -> Result<()> {
        let id = id.0.clone();
        self.call(move |owner| {
            if matches!(
                owner.recovery.get(&id),
                Some(TransferState::Blocked | TransferState::Failed)
            ) {
                return Err(Error::Invalid("recovery required".into()));
            }
            owner.recovery.remove(&id);
            owner.native.pin_mut().start(&id)?;
            Ok(())
        })
    }
    pub fn resume(&self, id: &TorrentId) -> Result<()> {
        self.start(id)
    }
    pub fn pause(&self, id: &TorrentId) -> Result<()> {
        let id = id.0.clone();
        self.call(move |owner| {
            owner.native.pin_mut().pause(&id)?;
            Ok(())
        })
    }
    pub fn pause_if_unowned(&self, id: &TorrentId) -> Result<()> {
        let id = id.0.clone();
        self.call(move |owner| {
            if owner.selection(&id)?.is_empty() {
                owner.native.pin_mut().pause(&id)?;
            }
            Ok(())
        })
    }
    pub fn status(&self, id: &TorrentId) -> Result<Status> {
        let id = id.0.clone();
        self.call(move |owner| {
            if let Some(error) = owner.errors.get(&id) {
                return Ok(Status {
                    download_rate: 0,
                    peers: 0,
                    verified: 0,
                    total: 0,
                    complete: false,
                    paused: true,
                    error: Some(error.clone()),
                    state: owner
                        .recovery
                        .get(&id)
                        .copied()
                        .unwrap_or(TransferState::Failed),
                });
            }
            let s = owner.native.status(&id)?;
            let state = owner
                .recovery
                .get(&id)
                .copied()
                .unwrap_or(if !s.error.is_empty() {
                    TransferState::Failed
                } else if !s.metadata {
                    TransferState::MetadataPending
                } else if s.checking {
                    TransferState::Checking
                } else if s.complete {
                    TransferState::Complete
                } else if s.paused {
                    TransferState::Paused
                } else {
                    TransferState::Downloading
                });
            Ok(Status {
                download_rate: s.download_rate,
                peers: s.peers,
                verified: s.verified,
                total: s.total,
                complete: s.complete,
                paused: s.paused,
                error: (!s.error.is_empty()).then_some(s.error),
                state,
            })
        })
    }
    pub fn checkpoint(&self) -> Result<()> {
        for job in self.jobs()? {
            if job.recovery_error.is_none() {
                self.checkpoint_job(&job.id)?;
            }
        }
        Ok(())
    }
    pub fn checkpoint_job(&self, id: &TorrentId) -> Result<()> {
        let deadline = Instant::now() + Duration::from_secs(5);
        loop {
            let id = id.0.clone();
            if self.call(move |owner| owner.checkpoint_one(&id))? {
                return Ok(());
            }
            if Instant::now() >= deadline {
                return Err(Error::Native("resume save deadline exceeded".into()));
            }
            thread::sleep(Duration::from_millis(25));
        }
    }
    pub fn remove_download(&self, id: &TorrentId) -> Result<()> {
        self.select_download(id, Vec::new())
    }
    /// Add a file to durable interest without dropping other kept episodes.
    pub fn keep_file(&self, id: &TorrentId, file: u32) -> Result<()> {
        let owned_id = id.0.clone();
        self.call(move |owner| {
            let json: String = owner.db.query_row(
                "SELECT selected FROM jobs WHERE id=?1",
                [&owned_id],
                |row| row.get(0),
            )?;
            let mut files: BTreeSet<u32> = serde_json::from_str::<Vec<u32>>(&json)?
                .into_iter()
                .collect();
            files.insert(file);
            let files: Vec<u32> = files.into_iter().collect();
            owner.validate_selection(&owned_id, &files)?;
            owner.db.execute(
                "UPDATE jobs SET selected=?2 WHERE id=?1",
                params![owned_id, serde_json::to_string(&files)?],
            )?;
            owner.apply_selection(&owned_id)?;
            Ok(())
        })?;
        self.checkpoint_job(id)
    }
    /// Verified engine-backed bytes only. Every wait yields the owner queue.
    pub fn read_range(
        &self,
        id: &TorrentId,
        file: u32,
        offset: u64,
        length: usize,
        timeout: Duration,
        cancel: &Cancellation,
    ) -> Result<Vec<u8>> {
        if length > MAX_RANGE || timeout > Duration::from_secs(120) {
            return Err(Error::Invalid("range/wait limit".into()));
        }
        let files = self.files(id)?;
        let entry = files
            .iter()
            .find(|f| f.index == file)
            .ok_or_else(|| Error::Invalid("file".into()))?;
        validate_range(entry.size, offset, length)?;
        if cancel.is_cancelled() {
            return Err(Error::Cancelled);
        }
        self.0
            .readers
            .fetch_update(Ordering::AcqRel, Ordering::Acquire, |count| {
                (count < 8).then_some(count + 1)
            })
            .map_err(|_| Error::Busy)?;
        let mut guard = ReadGuard {
            engine: self.clone(),
            token: None,
        };
        let owned_id = id.0.clone();
        guard.token = Some(self.call(move |owner| {
            if !owner.selection(&owned_id)?.contains(&file) {
                return Err(Error::Invalid("file has no interest".into()));
            }
            Ok(owner
                .native
                .pin_mut()
                .begin_read(&owned_id, file, offset, length as u32)?)
        })?);
        let deadline = Instant::now() + timeout;
        let mut result = Vec::with_capacity(length);
        while result.len() < length {
            if cancel.is_cancelled() {
                return Err(Error::Cancelled);
            }
            if Instant::now() >= deadline {
                return Err(Error::Timeout);
            }
            let id = id.0.clone();
            let position = offset + result.len() as u64;
            let bytes = self.call(move |owner| {
                if !owner.selection(&id)?.contains(&file) {
                    return Err(Error::Invalid("file has no interest".into()));
                }
                Ok(owner.native.pin_mut().piece(&id, file, position)?)
            })?;
            if bytes.is_empty() {
                thread::sleep(Duration::from_millis(25));
                continue;
            }
            result.extend_from_slice(&bytes[..bytes.len().min(length - result.len())]);
        }
        if cancel.is_cancelled() {
            return Err(Error::Cancelled);
        }
        Ok(result)
    }
    pub fn connect_loopback_peer(&self, id: &TorrentId, port: u16) -> Result<()> {
        let id = id.0.clone();
        self.call(move |owner| {
            owner.native.pin_mut().connect_peer(&id, port)?;
            Ok(())
        })
    }
    pub fn listen_port(&self) -> Result<u16> {
        self.call(|owner| Ok(owner.native.listen_port()?))
    }
}
pub struct PlaybackLease {
    engine: Engine,
    token: u64,
}
struct ReadGuard {
    engine: Engine,
    token: Option<u64>,
}
impl Drop for ReadGuard {
    fn drop(&mut self) {
        if let Some(token) = self.token {
            let _ = self.engine.0.tx.send(Box::new(move |owner| {
                let _ = owner.native.pin_mut().end_read(token);
            }));
        }
        self.engine.0.readers.fetch_sub(1, Ordering::AcqRel);
    }
}
impl Drop for PlaybackLease {
    fn drop(&mut self) {
        let token = self.token;
        let _ = self.engine.0.tx.send(Box::new(move |owner| {
            if let Some((id, _)) = owner.leases.remove(&token) {
                let _ = owner.apply_selection(&id);
            }
        }));
    }
}
fn validate_range(size: u64, offset: u64, length: usize) -> Result<()> {
    if offset
        .checked_add(length as u64)
        .is_none_or(|end| end > size)
    {
        return Err(Error::Invalid("range exceeds file".into()));
    }
    Ok(())
}
fn validate_path(path: &str) -> Result<()> {
    if path.is_empty()
        || path.len() > 4096
        || path.contains('\\')
        || path.contains(':')
        || path.contains('\0')
        || Path::new(path)
            .components()
            .any(|c| !matches!(c, Component::Normal(_)))
        || path
            .split('/')
            .any(|c| c.is_empty() || c == "." || c == "..")
    {
        return Err(Error::Invalid("unsafe torrent path".into()));
    }
    Ok(())
}
fn reject_symlinks(root: &Path) -> Result<()> {
    let mut current = PathBuf::new();
    for component in root.components() {
        current.push(component);
        if let Ok(meta) = std::fs::symlink_metadata(&current)
            && meta.file_type().is_symlink()
        {
            return Err(Error::Invalid("symlink in managed root".into()));
        }
    }
    Ok(())
}
fn create_private_root(root: &Path) -> Result<()> {
    reject_symlinks(root)?;
    let mut builder = std::fs::DirBuilder::new();
    builder.recursive(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::{DirBuilderExt, PermissionsExt};
        builder.mode(0o700);
        if let Ok(meta) = std::fs::metadata(root)
            && meta.permissions().mode() & 0o022 != 0
        {
            return Err(Error::Invalid(
                "managed root is writable by other users".into(),
            ));
        }
    }
    builder.create(root)?;
    Ok(())
}
fn reject_hardlinks(path: &Path) -> Result<()> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::MetadataExt;
        if let Ok(meta) = std::fs::metadata(path)
            && meta.is_file()
            && meta.nlink() != 1
        {
            return Err(Error::Invalid("hard-linked payload".into()));
        }
    }
    Ok(())
}
impl Owner {
    fn open(
        state_root: PathBuf,
        root: PathBuf,
        payload_root: Option<PathBuf>,
        policy: NetworkPolicy,
    ) -> Result<Self> {
        for directory in [&state_root, &root] {
            create_private_root(directory)?;
        }
        let root = root.canonicalize()?;
        reject_symlinks(&state_root.join("owner.lock"))?;
        let lock = std::fs::OpenOptions::new()
            .create(true)
            .truncate(false)
            .read(true)
            .write(true)
            .open(state_root.join("owner.lock"))?;
        lock.try_lock()
            .map_err(|error| Error::Invalid(format!("store already owned: {error}")))?;
        for name in ["jobs.sqlite3", "jobs.sqlite3-wal", "jobs.sqlite3-shm"] {
            reject_symlinks(&state_root.join(name))?;
        }
        let db = Connection::open(state_root.join("jobs.sqlite3"))?;
        db.busy_timeout(Duration::from_secs(2))?;
        db.execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;")?;
        let version: i64 = db.query_row("PRAGMA user_version", [], |row| row.get(0))?;
        if version > 4 {
            return Err(Error::Invalid("unsupported job store version".into()));
        }
        if version == 0 {
            db.execute_batch("BEGIN IMMEDIATE; CREATE TABLE jobs(id TEXT PRIMARY KEY,v1 TEXT,v2 TEXT,meta BLOB NOT NULL,magnet TEXT NOT NULL,selected TEXT NOT NULL,resume BLOB NOT NULL); PRAGMA user_version=1; COMMIT;")?;
        }
        if version <= 1 {
            let tx = db.unchecked_transaction()?;
            tx.execute("CREATE TABLE roots(media TEXT NOT NULL)", [])?;
            tx.execute("CREATE UNIQUE INDEX jobs_v1 ON jobs(v1) WHERE v1<>''", [])?;
            tx.execute("CREATE UNIQUE INDEX jobs_v2 ON jobs(v2) WHERE v2<>''", [])?;
            tx.execute(
                "INSERT INTO roots VALUES(?1)",
                [root
                    .to_str()
                    .ok_or_else(|| Error::Invalid("root encoding".into()))?],
            )?;
            tx.pragma_update(None, "user_version", 2)?;
            tx.commit()?;
        }
        let stored_root: String = db.query_row("SELECT media FROM roots", [], |row| row.get(0))?;
        if Path::new(&stored_root) != root {
            return Err(Error::Invalid(
                "media root changed; existing layout must not be moved".into(),
            ));
        }
        if version < 3 {
            let tx = db.unchecked_transaction()?;
            tx.execute(
                "ALTER TABLE jobs ADD COLUMN payload_root TEXT NOT NULL DEFAULT ''",
                [],
            )?;
            tx.execute("UPDATE jobs SET payload_root=?1", [&stored_root])?;
            tx.execute_batch("CREATE TABLE exports(id TEXT NOT NULL,file INTEGER NOT NULL,destination TEXT NOT NULL,done INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(id,file)); PRAGMA user_version=3;")?;
            tx.commit()?;
        }
        if version < 4 {
            db.execute_batch("BEGIN IMMEDIATE; ALTER TABLE exports ADD COLUMN target TEXT NOT NULL DEFAULT ''; ALTER TABLE exports ADD COLUMN size INTEGER NOT NULL DEFAULT 0; PRAGMA user_version=4; COMMIT;")?;
        }
        let payload_root = payload_root.unwrap_or_else(|| root.clone());
        create_private_root(&payload_root)?;
        let payload_root = payload_root.canonicalize()?;
        let mut owner = Self {
            native: ffi::session(policy == NetworkPolicy::Public)?,
            db,
            root,
            payload_root,
            _lock: lock,
            leases: BTreeMap::new(),
            next_lease: 1,
            errors: BTreeMap::new(),
            recovery: BTreeMap::new(),
            export_errors: BTreeMap::new(),
            stop: false,
        };
        let entries = {
            let mut stmt = owner.db.prepare("SELECT id,meta,magnet,resume FROM jobs")?;
            stmt.query_map([], |r| {
                Ok((
                    r.get::<_, String>(0)?,
                    r.get::<_, Vec<u8>>(1)?,
                    r.get::<_, String>(2)?,
                    r.get::<_, Vec<u8>>(3)?,
                ))
            })?
            .collect::<std::result::Result<Vec<_>, _>>()?
        };
        for (id, meta, magnet, resume) in entries {
            let missing = !owner.job_root(&id)?.join(&id).exists();
            if let Err(error) = owner.add(&id, &meta, &magnet, &resume).and_then(|()| {
                let selected = owner.selection(&id)?;
                if !selected.is_empty() {
                    owner.validate_selection(&id, &selected)?;
                    owner.apply_selection(&id)?;
                }
                Ok(())
            }) {
                let state = match error {
                    Error::Invalid(_) | Error::Io(_) => TransferState::Blocked,
                    _ => TransferState::Failed,
                };
                owner.recovery.insert(id.clone(), state);
                owner.errors.insert(id, error.to_string());
            } else if missing {
                owner.recovery.insert(id, TransferState::Missing);
            }
        }
        Ok(owner)
    }
    fn add(&mut self, id: &str, meta: &[u8], magnet: &str, resume: &[u8]) -> Result<()> {
        validate_path(id)?;
        let identity = ffi::inspect(meta, magnet)?;
        if id != format!("v1-{}", identity.v1) && id != format!("v2-{}", identity.v2) {
            return Err(Error::Invalid("stored identity mismatch".into()));
        }
        let path = self.job_root(id)?.join(id);
        reject_symlinks(&path)?;
        if resume.len() > 32 * 1024 * 1024 {
            return Err(Error::Invalid("resume data limit".into()));
        }
        for file in ffi::describe(meta, magnet, resume)? {
            validate_path(&file.path)?;
            reject_symlinks(&path.join(&file.path))?;
            reject_hardlinks(&path.join(&file.path))?;
        }
        create_private_root(&path)?;
        self.native.pin_mut().add(
            id,
            meta,
            magnet,
            path.to_str()
                .ok_or_else(|| Error::Invalid("root encoding".into()))?,
            resume,
        )?;
        Ok(())
    }
    fn import(&mut self, meta: Vec<u8>, magnet: String) -> Result<TorrentId> {
        let identity = ffi::inspect(&meta, &magnet)?;
        let existing: Option<String> = self
            .db
            .query_row(
                "SELECT id FROM jobs WHERE (v1<>'' AND v1=?1) OR (v2<>'' AND v2=?2)",
                params![identity.v1, identity.v2],
                |row| row.get(0),
            )
            .optional()?;
        if let Some(id) = existing {
            if !meta.is_empty() {
                self.db.execute(
                    "UPDATE jobs SET meta=?2,v1=?3,v2=?4,magnet='' WHERE id=?1",
                    params![id, meta, identity.v1, identity.v2],
                )?;
                self.native.pin_mut().upgrade(&id, &meta)?;
            }
            return Ok(TorrentId(id));
        }
        if self.jobs()?.len() >= 64 {
            return Err(Error::Invalid("job limit (64)".into()));
        }
        let id = if identity.v2.is_empty() {
            format!("v1-{}", identity.v1)
        } else {
            format!("v2-{}", identity.v2)
        };
        self.db.execute(
            "INSERT INTO jobs(id,v1,v2,meta,magnet,selected,resume,payload_root) VALUES(?1,?2,?3,?4,?5,'[]',x'',?6)",
            params![id, identity.v1, identity.v2, meta, magnet, self.payload_root.to_str().ok_or_else(|| Error::Invalid("root encoding".into()))?],
        )?;
        if let Err(error) = self.add(&id, &meta, &magnet, &[]) {
            self.recovery.insert(id.clone(), TransferState::Failed);
            self.errors.insert(id.clone(), error.to_string());
            return Err(error);
        }
        Ok(TorrentId(id))
    }
    fn files(&self, id: &str) -> Result<Vec<File>> {
        let native = self.native.files(id)?;
        let root = self.job_root(id)?;
        let mut files = Vec::new();
        for f in native {
            validate_path(&f.path)?;
            reject_symlinks(&root.join(id).join(&f.path))?;
            reject_hardlinks(&root.join(id).join(&f.path))?;
            if !f.pad {
                files.push(File {
                    index: f.index,
                    path: f.path,
                    size: f.size,
                });
            }
        }
        Ok(files)
    }
    fn validate_selection(&self, id: &str, selected: &[u32]) -> Result<()> {
        let files = self.files(id)?;
        if selected.len() > files.len()
            || selected
                .iter()
                .any(|i| !files.iter().any(|f| f.index == *i))
        {
            return Err(Error::Invalid("selection".into()));
        }
        Ok(())
    }
    fn selection(&self, id: &str) -> Result<Vec<u32>> {
        let json: String =
            self.db
                .query_row("SELECT selected FROM jobs WHERE id=?1", [id], |r| r.get(0))?;
        let mut selected: BTreeSet<u32> = serde_json::from_str::<Vec<u32>>(&json)?
            .into_iter()
            .collect();
        for (lease_id, files) in self.leases.values() {
            if lease_id == id {
                selected.extend(files);
            }
        }
        Ok(selected.into_iter().collect())
    }
    fn apply_selection(&mut self, id: &str) -> Result<()> {
        let selected = self.selection(id)?;
        if selected.is_empty() {
            self.native.pin_mut().pause(id)?;
        }
        self.native.pin_mut().select(id, &selected)?;
        Ok(())
    }
    fn jobs(&self) -> Result<Vec<Job>> {
        let mut stmt = self
            .db
            .prepare("SELECT id,selected FROM jobs ORDER BY id")?;
        let values = stmt
            .query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))?
            .collect::<std::result::Result<Vec<_>, _>>()?;
        values
            .into_iter()
            .map(|(id, json)| {
                Ok(Job {
                    selected: serde_json::from_str(&json)?,
                    recovery_error: self.errors.get(&id).cloned(),
                    recovery_state: self.recovery.get(&id).copied(),
                    id: TorrentId(id),
                })
            })
            .collect()
    }
    fn checkpoint_one(&mut self, id: &str) -> Result<bool> {
        let resume = self.native.pin_mut().save(id)?;
        if resume.is_empty() {
            return Ok(false);
        }
        if resume.len() > 32 * 1024 * 1024 {
            return Err(Error::Invalid("resume data limit".into()));
        }
        let identity = ffi::resume_identity(&resume)?;
        self.db.execute(
            "UPDATE jobs SET resume=?2,v1=?3,v2=?4 WHERE id=?1",
            params![id, resume, identity.v1, identity.v2],
        )?;
        Ok(true)
    }
}

#[cfg(test)]
mod tests;
