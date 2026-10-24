//! Client source resolution and transfers. Catalog authorization stays in Services.
use crate::{
    bridge::{Error, Request, valid_id},
    media_gateway::Gateway,
    media_storage::Roots,
    services::Services,
    torrentio,
};
use media_transfer::{Engine, File, TorrentId};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::{
    collections::BTreeMap,
    sync::Arc,
    time::{Duration, Instant},
};
use tokio::sync::{Mutex, OnceCell};

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Target {
    pub work_id: String,
    pub installment_id: Option<String>,
    pub episode_id: Option<String>,
}
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolvedTarget {
    #[serde(skip_serializing)]
    pub poster_id: Option<String>,
    pub work_id: String,
    pub installment_id: String,
    pub episode_id: Option<String>,
    pub title: String,
    #[serde(skip_serializing)]
    pub work_title: String,
    #[serde(skip_serializing)]
    pub search: torrentio::Search,
}
#[derive(Deserialize)]
#[serde(
    tag = "command",
    content = "payload",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub enum Command {
    #[serde(rename = "media.library")]
    Library {},
    #[serde(rename = "media.forgetDownload")]
    ForgetDownload { id: String },
    #[serde(rename = "media.savedAction")]
    SavedAction {
        id: String,
        file: u32,
        action: SavedAction,
    },
    #[serde(rename = "media.openSaved")]
    OpenSaved { id: String, file: u32 },
    #[serde(rename = "media.revealSaved")]
    RevealSaved { id: String, file: u32 },
    #[serde(rename = "media.search")]
    Search { session_id: String, target: Target },
    #[serde(rename = "media.downloadSearch")]
    DownloadSearch { session_id: String, target: Target },
    #[serde(rename = "media.play")]
    Play {
        session_id: String,
        source_id: String,
        file_index: Option<u32>,
    },
    #[serde(rename = "media.download")]
    Download {
        session_id: String,
        source_id: String,
        file_index: Option<u32>,
    },
    #[serde(rename = "media.keep")]
    Keep { session_id: String },
    #[serde(rename = "media.jobs")]
    Jobs {},
    #[serde(rename = "media.saved")]
    Saved {},
    #[serde(rename = "media.deleteCache")]
    DeleteCache {},
    #[serde(rename = "media.local")]
    Local { session_id: String, target: Target },
    #[serde(rename = "media.pause")]
    Pause { id: String },
    #[serde(rename = "media.resume")]
    Resume { id: String },
}
#[derive(Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SavedAction {
    RemoveRecord,
    DeleteVideo,
    Retry,
}
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct SavedRecord {
    version: u8,
    target: Target,
    title: String,
    work_title: String,
    poster_id: Option<String>,
    #[serde(default)]
    scope: Option<String>,
}
fn saved_record(value: &str) -> Option<SavedRecord> {
    serde_json::from_str::<SavedRecord>(value)
        .ok()
        .filter(|record| record.version == 1)
        .or_else(|| {
            serde_json::from_str::<Target>(value)
                .ok()
                .map(|target| SavedRecord {
                    version: 1,
                    target,
                    title: String::new(),
                    work_title: String::new(),
                    poster_id: None,
                    scope: None,
                })
        })
}
impl Command {
    pub fn parse(request: &Request) -> Result<Self, Error> {
        serde_json::from_value(json!({"command": request.command,"payload":request.payload}))
            .map_err(|_| Error::new("bad_request", "Invalid media request"))
    }
    pub fn session(&self) -> Option<&str> {
        match self {
            Self::Search { session_id, .. }
            | Self::Play { session_id, .. }
            | Self::Local { session_id, .. }
            | Self::Keep { session_id } => Some(session_id),
            _ => None,
        }
    }
}
#[derive(Clone)]
struct Source {
    session: String,
    target: Target,
    resolved: ResolvedTarget,
    candidate: torrentio::Candidate,
    created: Instant,
}
pub struct Media {
    services: Services,
    roots: Roots,
    engine: OnceCell<Engine>,
    sources: Mutex<BTreeMap<(String, String), Source>>,
}
pub enum Ready {
    Local {
        path: std::path::PathBuf,
        target: ResolvedTarget,
    },
    Downloading {
        target: ResolvedTarget,
    },
    Choices {
        files: Vec<File>,
        target: ResolvedTarget,
    },
    Playing {
        gateway: Gateway,
        target: ResolvedTarget,
    },
}
#[derive(Serialize)]
pub struct Sources {
    pub target: ResolvedTarget,
    pub candidates: Vec<Value>,
}
impl Media {
    pub async fn reset_sources(&self) {
        self.sources.lock().await.clear();
    }
    pub fn new(services: Services) -> Result<Arc<Self>, Error> {
        Ok(Arc::new(Self {
            services,
            roots: Roots::discover().map_err(|_| transfer_error())?,
            engine: OnceCell::new(),
            sources: Mutex::new(BTreeMap::new()),
        }))
    }
    async fn engine(&self) -> Result<Engine, Error> {
        self.engine
            .get_or_try_init(|| async {
                let roots = self.roots.clone();
                let engine = tokio::task::spawn_blocking(move || Engine::open_with_private_payloads(&roots.state, &roots.videos, &roots.state.join("payloads")))
                    .await.map_err(|_| transfer_error())?.map_err(|_| transfer_error())?;
                let exporter = engine.clone();
                tokio::spawn(async move {
                    loop {
                        let engine = exporter.clone();
                        if !matches!(tokio::task::spawn_blocking(move || engine.export_completed()).await, Ok(Ok(()))) {
                            eprintln!("Download export pending: check destination permissions, space or filename collisions");
                        }
                        tokio::time::sleep(Duration::from_secs(5)).await;
                    }
                });
                Ok::<_, Error>(engine)
            })
            .await
            .cloned()
    }
    pub async fn saved(&self) -> Result<Value, Error> {
        let engine = self.engine().await?;
        let scope = self.services.catalog_scope().await.ok();
        tokio::task::spawn_blocking(move || {
            let files = engine.saved_files()?;
            Ok::<_, media_transfer::Error>(Value::Array(
                files
                    .into_iter()
                    .filter_map(|file| {
                        let record = saved_record(&file.target)?;
                        if scope.is_none() || record.scope != scope {
                            return None;
                        }
                        let target = record.target;
                        Some(json!({"target":target,"available":file.available}))
                    })
                    .collect(),
            ))
        })
        .await
        .map_err(|_| transfer_error())?
        .map_err(|_| transfer_error())
    }
    pub async fn local(
        &self,
        target: Target,
    ) -> Result<Option<(std::path::PathBuf, ResolvedTarget)>, Error> {
        let work_data = self
            .services
            .execute(Request {
                id: "local-catalog".into(),
                command: "work".into(),
                payload: json!({"id":target.work_id}),
            })
            .await?;
        let resolved = resolve_target_for(&work_data, &target, true)?;
        let scope = self.services.catalog_scope().await?;
        let engine = self.engine().await?;
        let work = resolved.work_id.clone();
        let installment = resolved.installment_id.clone();
        let episode = resolved.episode_id.clone();
        let file = tokio::task::spawn_blocking(move || {
            Ok::<_, media_transfer::Error>(
                engine
                    .saved_files()?
                    .into_iter()
                    .find(|file| {
                        file.available
                            && saved_record(&file.target).is_some_and(|record| {
                                let target = record.target;
                                record.scope.as_deref() == Some(&scope)
                                    && target.work_id == work
                                    && target.installment_id.as_ref() == Some(&installment)
                                    && target.episode_id == episode
                            })
                    })
                    .map(|file| file.path),
            )
        })
        .await
        .map_err(|_| transfer_error())?
        .map_err(|_| transfer_error())?;
        Ok(file.map(|file| (file, resolved)))
    }
    pub async fn delete_cache(&self) -> Result<Value, Error> {
        let engine = self.engine().await?;
        tokio::task::spawn_blocking(move || engine.delete_cache().map(|result| json!(result)))
            .await
            .map_err(|_| transfer_error())?
            .map_err(|_| {
                Error::new(
                    "cache_busy",
                    "تعذّر تنظيف الذاكرة المؤقتة. أوقف التشغيل أو انتظر اكتمال حفظ التنزيل.",
                )
            })
    }
    pub async fn search(&self, session: String, target: Target) -> Result<Sources, Error> {
        if session.is_empty()
            || session.len() > 64
            || !session
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-')
        {
            return Err(Error::new("bad_request", "Invalid source session"));
        }
        let resolved = self.resolve(&target).await?;
        let candidates = torrentio::search(resolved.search.clone()).await?;
        let views = candidates
            .iter()
            .map(torrentio::Candidate::public_value)
            .collect::<Result<Vec<_>, _>>()?;
        let mut sources = self.sources.lock().await;
        sources.retain(|_, source| {
            source.created.elapsed() < Duration::from_secs(900) && source.session != session
        });
        while sources.len() + candidates.len() > 800 {
            let oldest = sources
                .iter()
                .min_by_key(|(_, source)| source.created)
                .map(|(key, _)| key.clone());
            if let Some(key) = oldest {
                sources.remove(&key);
            } else {
                break;
            }
        }
        for candidate in candidates {
            sources.insert(
                (session.clone(), candidate.id.clone()),
                Source {
                    session: session.clone(),
                    target: target.clone(),
                    resolved: resolved.clone(),
                    candidate,
                    created: Instant::now(),
                },
            );
        }
        Ok(Sources {
            target: resolved,
            candidates: views,
        })
    }
    pub async fn prepare(
        &self,
        session: &str,
        source_id: &str,
        explicit_file: Option<u32>,
        download: bool,
    ) -> Result<Ready, Error> {
        let source = self
            .sources
            .lock()
            .await
            .get(&(session.to_owned(), source_id.to_owned()))
            .cloned()
            .filter(|source| {
                source.session == session && source.created.elapsed() < Duration::from_secs(900)
            })
            .ok_or_else(|| Error::new("stale_source", "أعد البحث عن مصادر هذا الفيديو."))?;
        // Re-check catalog access/release/mapping immediately before playback.
        let resolved = self.resolve(&source.target).await?;
        if resolved.work_id != source.resolved.work_id
            || resolved.installment_id != source.resolved.installment_id
            || resolved.episode_id != source.resolved.episode_id
            || resolved.search.imdb_id != source.resolved.search.imdb_id
        {
            return Err(Error::new(
                "stale_source",
                "تغيّرت بيانات العمل. أعد البحث عن المصدر.",
            ));
        }
        let hash =
            source.candidate.info_hash.as_ref().ok_or_else(|| {
                Error::new("unsupported_source", "المصادر المباشرة ليست مربوطة بعد.")
            })?;
        let mut magnet = url::Url::parse("magnet:?").map_err(|_| transfer_error())?;
        {
            let mut query = magnet.query_pairs_mut();
            query.append_pair(
                "xt",
                &if hash.len() == 40 {
                    format!("urn:btih:{hash}")
                } else {
                    format!("urn:btmh:1220{hash}")
                },
            );
            for tracker in source.candidate.trackers.iter().take(16) {
                query.append_pair("tr", tracker);
            }
        }
        let engine = self.engine().await?;
        let importer = engine.clone();
        let id = tokio::task::spawn_blocking(move || importer.import_magnet(magnet.into()))
            .await
            .map_err(|_| transfer_error())?
            .map_err(|_| transfer_error())?;
        let start_engine = engine.clone();
        let start_id = id.clone();
        tokio::task::spawn_blocking(move || start_engine.start(&start_id))
            .await
            .map_err(|_| transfer_error())?
            .map_err(|_| transfer_error())?;
        let deadline = Instant::now() + Duration::from_secs(30);
        let files = loop {
            let reader = engine.clone();
            let reader_id = id.clone();
            let result = tokio::task::spawn_blocking(move || reader.files(&reader_id))
                .await
                .map_err(|_| transfer_error())?;
            match result {
                Ok(files) => break files,
                Err(media_transfer::Error::Native(message))
                    if message == "metadata pending" && Instant::now() < deadline =>
                {
                    tokio::time::sleep(Duration::from_millis(200)).await;
                }
                _ => {
                    pause_unowned(engine, id).await;
                    return Err(Error::new(
                        "metadata_unavailable",
                        "تعذّر جلب معلومات التورنت. اختر مصدرًا آخر.",
                    ));
                }
            }
        };
        let videos: Vec<File> = files
            .into_iter()
            .filter(|file| is_video(&file.path))
            .collect();
        if videos.is_empty() {
            pause_unowned(engine, id).await;
            return Err(Error::new(
                "no_video",
                "لا يحتوي هذا التورنت على ملف فيديو مدعوم. اختر مصدرًا آخر.",
            ));
        }
        let index = explicit_file
            .or(source.candidate.file_index)
            .or_else(|| (videos.len() == 1).then(|| videos[0].index));
        let Some(file) =
            index.and_then(|index| videos.iter().find(|file| file.index == index).cloned())
        else {
            pause_unowned(engine, id).await;
            return Ok(Ready::Choices {
                files: videos,
                target: resolved,
            });
        };
        if download {
            if let Err(error) = self.keep(id.clone(), file.index, resolved.clone()).await {
                pause_unowned(engine, id).await;
                return Err(error);
            }
            let starter = engine.clone();
            tokio::task::spawn_blocking(move || starter.start(&id))
                .await
                .map_err(|_| transfer_error())?
                .map_err(|_| transfer_error())?;
            return Ok(Ready::Downloading { target: resolved });
        }
        // Older exports have no catalog mapping. An explicit matching source/file choice
        // can register them safely without guessing episode identity from filenames.
        let local_engine = engine.clone();
        let local_id = id.clone();
        let local_file = file.index;
        let local_target = Target {
            work_id: resolved.work_id.clone(),
            installment_id: Some(resolved.installment_id.clone()),
            episode_id: resolved.episode_id.clone(),
        };
        let local = tokio::task::spawn_blocking(move || {
            if local_engine.saved_files()?.iter().any(|saved| {
                saved.id == local_id.0 && saved.file == local_file && saved.target.is_empty()
            }) {
                local_engine.set_export_target(
                    &local_id,
                    local_file,
                    serde_json::to_string(&local_target)?,
                )?;
            }
            Ok::<_, media_transfer::Error>(
                local_engine
                    .saved_files()?
                    .into_iter()
                    .find(|saved| {
                        saved.id == local_id.0 && saved.file == local_file && saved.available
                    })
                    .map(|saved| saved.path),
            )
        })
        .await
        .map_err(|_| transfer_error())?
        .map_err(|_| transfer_error())?;
        if let Some(path) = local {
            pause_unowned(engine, id).await;
            return Ok(Ready::Local {
                path,
                target: resolved,
            });
        }
        let lease_engine = engine.clone();
        let lease_id = id.clone();
        let index = file.index;
        let lease = tokio::task::spawn_blocking(move || {
            lease_engine.playback_lease(&lease_id, vec![index])
        })
        .await
        .map_err(|_| transfer_error())?
        .map_err(|_| transfer_error())?;
        let gateway = Gateway::start(engine, id, file, lease)
            .await
            .map_err(|_| transfer_error())?;
        Ok(Ready::Playing {
            gateway,
            target: resolved,
        })
    }
    pub async fn keep(
        &self,
        id: TorrentId,
        file: u32,
        resolved: ResolvedTarget,
    ) -> Result<(), Error> {
        let engine = self.engine().await?;
        let videos = self.roots.videos.clone();
        let scope = Some(self.services.catalog_scope().await?);
        tokio::task::spawn_blocking(move || {
            engine.keep_export(&id, file, &videos, &resolved.work_title)?;
            let target = Target {
                work_id: resolved.work_id,
                installment_id: Some(resolved.installment_id),
                episode_id: resolved.episode_id,
            };
            engine.set_export_target(
                &id,
                file,
                serde_json::to_string(&SavedRecord {
                    version: 1,
                    target,
                    title: resolved.title,
                    work_title: resolved.work_title,
                    poster_id: resolved.poster_id,
                    scope,
                })?,
            )
        })
        .await
        .map_err(|_| transfer_error())?
        .map_err(|_| transfer_error())
    }
    pub async fn jobs(&self) -> Result<Value, Error> {
        let engine = self.engine().await?;
        let scope = self.services.catalog_scope().await.ok();
        tokio::task::spawn_blocking(move || {
            let jobs = engine.jobs()?;
            let saved = engine.saved_files()?;
            let mut result = Vec::new();
            for job in jobs {
                if !job.selected.is_empty() {
                    let status = engine.status(&job.id)?;
                    let files = engine.files(&job.id).unwrap_or_default();
                    let exports: Vec<_> = saved.iter().filter(|file| file.id == job.id.0).map(|file|saved_json(file,scope.as_deref())).collect();
                    if !exports.is_empty() {
                        result.push(json!({"id":job.id.0,"files":files,"selected":job.selected,"status":status,"exports":exports}));
                    }
                }
            }
            Ok::<_, media_transfer::Error>(Value::Array(result))
        }).await.map_err(|_| transfer_error())?.map_err(|_| transfer_error())
    }
    pub async fn set_paused(&self, id: String, paused: bool) -> Result<(), Error> {
        if id.len() > 80
            || !id
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-')
        {
            return Err(transfer_error());
        }
        let engine = self.engine().await?;
        tokio::task::spawn_blocking(move || {
            if paused {
                engine.pause(&TorrentId(id))
            } else {
                engine.resume(&TorrentId(id))
            }
        })
        .await
        .map_err(|_| transfer_error())?
        .map_err(|_| transfer_error())
    }
    pub(crate) async fn resolve(&self, target: &Target) -> Result<ResolvedTarget, Error> {
        let work = self.source_catalog(target).await?;
        resolve_target(&work, target)
    }
    pub(crate) async fn embed_context(
        &self,
        target: &Target,
    ) -> Result<(ResolvedTarget, crate::stream_provider::CatalogTarget), Error> {
        let work = self.source_catalog(target).await?;
        // Resolve catalog membership/release eligibility without requiring Torrentio's IMDb ID.
        let resolved = resolve_target_for(&work, target, true)?;
        let context = crate::stream_provider::CatalogTarget::from_catalog(&work, &resolved);
        Ok((resolved, context))
    }
    async fn source_catalog(&self, target: &Target) -> Result<Value, Error> {
        if !valid_id(&target.work_id)
            || target
                .installment_id
                .as_ref()
                .is_some_and(|id| !valid_id(id))
            || target.episode_id.as_ref().is_some_and(|id| !valid_id(id))
        {
            return Err(Error::new("bad_request", "Invalid playback target"));
        }
        self.services
            .execute(Request {
                id: "source-catalog".into(),
                command: "work".into(),
                payload: json!({"id":target.work_id}),
            })
            .await
    }
    pub async fn library(&self) -> Result<Value, Error> {
        use gtk::gio::prelude::*;
        let engine = self.engine().await?;
        let root = self.roots.videos.clone();
        let scope = self.services.catalog_scope().await.ok();
        tokio::task::spawn_blocking(move||{
            let saved=engine.saved_files()?;
            let used:u64=saved.iter().filter(|file|file.available).map(|file|file.size).sum();
            let filesystem=gtk::gio::File::for_path(&root).query_filesystem_info("filesystem::free",None::<&gtk::gio::Cancellable>).ok();
            let free=filesystem.filter(|info|info.has_attribute("filesystem::free")).map(|info|info.attribute_uint64("filesystem::free"));
            Ok::<_,media_transfer::Error>(json!({"files":saved.iter().filter(|file|file.published).map(|file|saved_json(file,scope.as_deref())).collect::<Vec<_>>(),"root":root,"usedBytes":used,"freeBytes":free}))
        }).await.map_err(|_|transfer_error())?.map_err(|_|transfer_error())
    }
    pub async fn saved_path(
        &self,
        id: String,
        file: u32,
    ) -> Result<(std::path::PathBuf, String), Error> {
        let engine = self.engine().await?;
        tokio::task::spawn_blocking(move || {
            let saved = engine
                .saved_files()?
                .into_iter()
                .find(|entry| entry.id == id && entry.file == file && entry.available)
                .ok_or_else(|| media_transfer::Error::Invalid("saved video unavailable".into()))?;
            let title = saved_record(&saved.target)
                .map(|record| crate::display::episode_title(&record.title))
                .filter(|title| !title.is_empty())
                .unwrap_or_else(|| {
                    saved
                        .path
                        .file_name()
                        .unwrap_or_default()
                        .to_string_lossy()
                        .into_owned()
                });
            Ok::<_, media_transfer::Error>((saved.path, title))
        })
        .await
        .map_err(|_| transfer_error())?
        .map_err(|_| {
            Error::new(
                "missing_file",
                "الفيديو المحفوظ مفقود أو تغيّر. حدّث القائمة أو أعد تنزيله.",
            )
        })
    }
    pub async fn saved_context(&self, id: String, file: u32) -> Option<ResolvedTarget> {
        let scope = self.services.catalog_scope().await.ok()?;
        let engine = self.engine().await.ok()?;
        let record = tokio::task::spawn_blocking(move || {
            engine
                .saved_files()
                .ok()?
                .into_iter()
                .find(|saved| saved.id == id && saved.file == file)
                .and_then(|saved| saved_record(&saved.target))
        })
        .await
        .ok()??;
        if record.scope.as_deref() != Some(&scope) {
            return None;
        }
        let work = self
            .services
            .saved_work(&record.target.work_id)
            .await
            .ok()?;
        resolve_target_for(&work, &record.target, true).ok()
    }
    pub async fn manage_download(
        &self,
        id: String,
        file: Option<u32>,
        action: Option<SavedAction>,
    ) -> Result<(), Error> {
        let engine = self.engine().await?;
        tokio::task::spawn_blocking(move||match (file,action) {
            (None,None)=>engine.forget_download(&TorrentId(id)),
            (Some(file),Some(SavedAction::Retry))=>engine.retry_saved(&TorrentId(id),file),
            (Some(file),Some(action))=>engine.remove_saved(&TorrentId(id),file,matches!(action,SavedAction::DeleteVideo)),
            _=>Err(media_transfer::Error::Invalid("download action".into())),
        }).await.map_err(|_|transfer_error())?.map_err(|_|Error::new("download_action","تعذّر تنفيذ الإجراء. قد يجري حفظ الفيديو، أو تغيّر الملف، أو يحتاج التورنت إلى مصدر جديد. لم تُحذف ملفات خارج التنزيل المسجّل."))
    }
}
fn saved_json(file: &media_transfer::SavedFile, scope: Option<&str>) -> Value {
    let record = saved_record(&file.target);
    let owned = record
        .as_ref()
        .filter(|record| scope.is_some() && record.scope.as_deref() == scope);
    json!({"id":file.id,"file":file.file,"path":file.path,"size":file.size,"available":file.available,"published":file.published,"error":file.error,"target":owned.map(|record|&record.target),"title":record.as_ref().map(|record|crate::display::episode_title(&record.title)),"workTitle":record.as_ref().map(|record|&record.work_title),"posterId":owned.and_then(|record|record.poster_id.as_ref())})
}
async fn pause_unowned(engine: Engine, id: TorrentId) {
    let _ = tokio::task::spawn_blocking(move || engine.pause_if_unowned(&id)).await;
}
pub fn is_video(path: &str) -> bool {
    media_transfer::is_video(path)
}
fn eligible(item: &Value) -> bool {
    if item["status"] == "announced" || item["releaseState"] == "upcoming" {
        return false;
    }
    item["releaseDate"]
        .as_str()
        .and_then(|date| chrono::NaiveDate::parse_from_str(date, "%Y-%m-%d").ok())
        .is_none_or(|date| date <= chrono::Utc::now().date_naive())
}
fn resolve_target(work: &Value, target: &Target) -> Result<ResolvedTarget, Error> {
    resolve_target_for(work, target, false)
}
fn resolve_target_for(work: &Value, target: &Target, local: bool) -> Result<ResolvedTarget, Error> {
    if !local && work["playbackPolicy"].as_str() == Some("files-only") {
        return Err(Error::new(
            "files_only",
            "هذا العمل يُشغّل من الملفات فقط. لا تتوفر له مصادر عبر الإنترنت.",
        ));
    }

    let installments = work["installments"].as_array().ok_or_else(transfer_error)?;
    let installment = match &target.installment_id {
        Some(id) => installments
            .iter()
            .find(|item| item["id"].as_str() == Some(id)),
        None => installments.iter().find(|item| eligible(item)),
    }
    .ok_or_else(|| Error::new("upcoming", "لا يوجد إصدار متاح للتشغيل لهذا العمل."))?;
    if !eligible(installment) {
        return Err(Error::new(
            "upcoming",
            "هذا الإصدار قادم؛ لا يبدأ تشغيله تلقائيًا.",
        ));
    }
    let series = installment["kind"] == "season";
    let title = work["titleAr"]
        .as_str()
        .filter(|title| !title.is_empty())
        .or_else(|| work["canonicalTitle"].as_str())
        .unwrap_or("Video");
    let (episode_id, search, title) = if series {
        let episodes = installment["episodes"]
            .as_array()
            .ok_or_else(transfer_error)?;
        let episode = match &target.episode_id {
            Some(id) => episodes
                .iter()
                .find(|episode| episode["id"].as_str() == Some(id)),
            None => episodes.iter().find(|episode| eligible(episode)),
        }
        .ok_or_else(|| Error::new("upcoming", "اختر حلقة غير قادمة لبدء التشغيل."))?;
        if !eligible(episode) {
            return Err(Error::new("upcoming", "هذه الحلقة قادمة."));
        }
        let number = episode["number"]
            .as_str()
            .and_then(standard_episode_number)
            .or_else(|| local.then_some(0))
            .ok_or_else(|| {
                Error::new(
                    "source_mapping",
                    "رقم الحلقة لا يدعم معرّف Torrentio القياسي.",
                )
            })?;
        // Same rule as the historical Tauri API: ordinal among seasons, excluding films/specials.
        let position = installment["position"]
            .as_i64()
            .ok_or_else(transfer_error)?;
        let season = installments
            .iter()
            .filter(|item| {
                item["kind"] == "season"
                    && item["position"]
                        .as_i64()
                        .is_some_and(|value| value < position)
            })
            .count() as u32
            + 1;
        (
            episode["id"].as_str().map(str::to_owned),
            torrentio::Search {
                imdb_id: if local {
                    String::new()
                } else {
                    imdb(work)?.to_owned()
                },
                kind: torrentio::Kind::Series,
                season: Some(season),
                episode: Some(number),
            },
            format!(
                "{title} · الحلقة {}",
                crate::display::episode_number(episode["number"].as_str().unwrap_or(""))
            ),
        )
    } else {
        let only_film = installments
            .iter()
            .filter(|item| item["kind"] != "season")
            .count()
            == 1;
        let identifier = if local {
            ""
        } else {
            imdb(installment).or_else(|error| if only_film { imdb(work) } else { Err(error) })?
        };
        (
            None,
            torrentio::Search {
                imdb_id: identifier.to_owned(),
                kind: torrentio::Kind::Movie,
                season: None,
                episode: None,
            },
            title.to_owned(),
        )
    };
    Ok(ResolvedTarget {
        poster_id: work["artwork"]
            .as_array()
            .and_then(|images| {
                images
                    .iter()
                    .find(|image| image["role"] == "poster" && image["isPrimary"] == true)
            })
            .and_then(|image| image["id"].as_str())
            .filter(|id| valid_id(id))
            .map(str::to_owned),
        work_id: target.work_id.clone(),
        installment_id: installment["id"]
            .as_str()
            .ok_or_else(transfer_error)?
            .to_owned(),
        episode_id,
        title,
        work_title: work["canonicalTitle"]
            .as_str()
            .filter(|title| !title.trim().is_empty())
            .unwrap_or("Video")
            .to_owned(),
        search,
    })
}
// PostgreSQL numeric episode numbers arrive as decimal strings (for example "3.00").
// Accept only exact positive integers, never round fractional specials to another episode.
fn standard_episode_number(number: &str) -> Option<u32> {
    let (whole, fraction) = number.split_once('.').unwrap_or((number, "0"));
    if whole.is_empty()
        || !whole.bytes().all(|byte| byte.is_ascii_digit())
        || fraction.is_empty()
        || !fraction.bytes().all(|byte| byte == b'0')
    {
        return None;
    }
    whole.parse::<u32>().ok().filter(|number| *number > 0)
}

fn imdb(item: &Value) -> Result<&str, Error> {
    item["externalIds"]["imdbId"]
        .as_str()
        .filter(|id| !id.is_empty())
        .ok_or_else(|| {
            Error::new(
                "no_identifier",
                "هذا الإصدار لا يحمل معرّف IMDb صالحًا للتشغيل.",
            )
        })
}
fn transfer_error() -> Error {
    Error::new(
        "transfer",
        "تعذّر تجهيز نقل الفيديو. تحقق من المصدر والتخزين ثم أعد المحاولة.",
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    fn target() -> Target {
        Target {
            work_id: "00000000-0000-4000-8000-000000000001".into(),
            installment_id: None,
            episode_id: None,
        }
    }
    #[test]
    fn films_require_unambiguous_imdb_and_reject_upcoming() {
        let mut work = json!({"canonicalTitle":"Fixture","externalIds":{"imdbId":"tt1234567"},
            "installments":[{"id":"film","kind":"movie","status":"completed","externalIds":{"imdbId":null}}]});
        assert_eq!(
            resolve_target(&work, &target()).unwrap().search.imdb_id,
            "tt1234567"
        );
        work["installments"][0]["status"] = json!("announced");
        assert!(resolve_target(&work, &target()).is_err());
        work["installments"][0]["status"] = json!("completed");
        work["installments"]
            .as_array_mut()
            .unwrap()
            .push(json!({"id":"second","kind":"movie","status":"completed"}));
        assert!(resolve_target(&work, &target()).is_err());
    }
    #[test]
    fn series_mapping_excludes_films_and_cannot_play_another_parts_episode() {
        let work = json!({"canonicalTitle":"Fixture","externalIds":{"imdbId":"tt1234567"},"installments":[
            {"id":"film","kind":"movie","position":0,"status":"completed"},
            {"id":"season-one","kind":"season","position":2,"status":"completed","episodes":[]},
            {"id":"special","kind":"special","position":3,"status":"completed"},
            {"id":"season-two","kind":"season","position":4,"status":"airing","episodes":[
                {"id":"released","number":"3.00","releaseState":"released"},{"id":"future","number":"4","releaseState":"upcoming"}]}
        ]});
        let mut selected = target();
        selected.installment_id = Some("season-two".into());
        selected.episode_id = Some("released".into());
        let resolved = resolve_target(&work, &selected).unwrap();
        assert_eq!(resolved.search.season, Some(2));
        assert_eq!(resolved.search.episode, Some(3));
        selected.episode_id = Some("future".into());
        assert!(resolve_target(&work, &selected).is_err());
        selected.installment_id = Some("season-one".into());
        selected.episode_id = Some("released".into());
        assert!(resolve_target(&work, &selected).is_err());
    }
    #[test]
    fn standard_episode_numbers_preserve_exact_decimal_identity() {
        for number in ["3", "3.0", "3.00", "003.000"] {
            assert_eq!(standard_episode_number(number), Some(3), "{number}");
        }
        assert_eq!(standard_episode_number("4294967295.00"), Some(u32::MAX));
        for number in [
            "",
            "0",
            "0.00",
            "3.50",
            "12.50",
            "-3",
            "+3",
            "3.",
            ".0",
            "3.0.0",
            "3e0",
            "3.00 ",
            "4294967296.00",
            "NaN",
        ] {
            assert_eq!(standard_episode_number(number), None, "{number}");
        }
    }
    #[test]
    fn fractional_episodes_are_not_silently_mapped_to_standard_sources() {
        let work = json!({"canonicalTitle":"Fixture","externalIds":{"imdbId":"tt1234567"},"installments":[
            {"id":"season","kind":"season","position":0,"status":"completed","episodes":[
                {"id":"special","number":"12.50","releaseState":"released"}]}
        ]});
        assert!(resolve_target(&work, &target()).is_err());
    }
    #[test]
    fn embed_mapping_does_not_require_imdb_or_reuse_first_season_anime_ids() {
        use crate::stream_provider::{Audio, CatalogTarget, Provider};
        let work = json!({"canonicalTitle":"Fixture","externalIds":{"tmdbId":94605,"malId":52991},"installments":[
            {"id":"one","kind":"season","position":0,"status":"completed","episodes":[{"id":"ep-one","number":"1.00"}]},
            {"id":"two","kind":"season","position":1,"status":"completed","episodes":[{"id":"ep-two","number":"1.00"}]}
        ]});
        let mut selected = target();
        let resolved = resolve_target_for(&work, &selected, true).unwrap();
        let context = CatalogTarget::from_catalog(&work, &resolved);
        assert!(Provider::Vidnest.embed_url(&context, Audio::Dub).is_err());
        assert!(
            Provider::Vidhawk
                .embed_url(&context, Audio::Dub)
                .unwrap()
                .contains("/mal/52991/1/dub")
        );
        assert!(
            Provider::Vidfast
                .embed_url(&context, Audio::Original)
                .unwrap()
                .contains("/tv/94605/1/1")
        );
        selected.installment_id = Some("two".into());
        let resolved = resolve_target_for(&work, &selected, true).unwrap();
        let context = CatalogTarget::from_catalog(&work, &resolved);
        assert!(Provider::Vidhawk.embed_url(&context, Audio::Dub).is_err());
    }
    #[test]
    fn non_video_payloads_are_never_player_candidates() {
        assert!(is_video("season/episode.MKV"));
        for name in [
            "run.exe",
            "setup.sh",
            "movie.mkv.exe",
            "playlist.m3u8",
            "index.html",
            "archive.zip",
        ] {
            assert!(!is_video(name));
        }
    }
}
