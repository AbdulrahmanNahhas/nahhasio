//! Durable file imports. Per-file publication is journaled before database registration.
use super::{Item, storage};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use sqlx::{PgPool, Row, types::Json as SqlJson};
use std::os::unix::fs::MetadataExt;
use std::{path::Path, time::Duration};
use tokio::{
    io::{AsyncReadExt, AsyncSeekExt},
    process::Command,
};
type WorkerResult<T> = std::result::Result<T, &'static str>;
const LEASE: &str = "nahhasio-media-worker";
static PROBE: tokio::sync::Semaphore = tokio::sync::Semaphore::const_new(1);
static IMPORTS: tokio::sync::Mutex<
    std::collections::BTreeMap<String, std::sync::Weak<tokio::sync::Mutex<()>>>,
> = tokio::sync::Mutex::const_new(std::collections::BTreeMap::new());

pub async fn run(pool: PgPool) -> std::result::Result<(), Box<dyn std::error::Error>> {
    let mut owner = pool.acquire().await?.detach();
    let acquired: bool = sqlx::query_scalar("select pg_try_advisory_lock(23103,1101)")
        .fetch_one(&mut owner)
        .await?;
    if !acquired {
        return Err("Another media worker owns this database".into());
    }
    let mut active = tokio::task::JoinSet::new();
    let mut terminate = tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())?;
    loop {
        sqlx::query("select 1").execute(&mut owner).await?;
        while active.len() < 2 {
            match claim(&pool).await? {
                Some((id, payload, actor)) => {
                    let pool = pool.clone();
                    active.spawn(async move {
                        let result = process(&pool, &id, payload, &actor).await;
                        finish(&pool, &id, result).await;
                    });
                }
                None => break,
            }
        }
        tokio::select! {
            signal=tokio::signal::ctrl_c()=>{signal?;active.shutdown().await;return Ok(());},
            _=terminate.recv()=>{active.shutdown().await;return Ok(());},
            result=active.join_next(),if !active.is_empty()=>{if result.is_some_and(|r|r.is_err()){tracing::error!("media task interrupted; lease recovery will resume it");}},
            ()=tokio::time::sleep(Duration::from_secs(2))=>{},
        }
    }
}
async fn claim(pool: &PgPool) -> std::result::Result<Option<(String, Value, String)>, sqlx::Error> {
    let mut tx = pool.begin().await?;
    sqlx::query("set transaction read write")
        .execute(&mut *tx)
        .await?;
    sqlx::query("update background_jobs set status=case when cancel_requested_at is not null then 'cancelled'::background_job_status else 'failed'::background_job_status end,error=case when cancel_requested_at is not null then null else 'Worker retry limit reached; review and retry explicitly' end,lease_owner=null,lease_expires_at=null,finished_at=now(),updated_at=now() where type in ('media.import','media.youtube.preview','media.file','media.upload.verify') and status='running' and lease_expires_at<now() and (cancel_requested_at is not null or attempts>=max_attempts)").execute(&mut *tx).await?;
    let row=sqlx::query("select id::text,payload || jsonb_build_object('jobType',type,'jobId',id::text) payload,created_by_account_id::text actor from background_jobs where type in ('media.import','media.youtube.preview','media.file','media.upload.verify') and cancel_requested_at is null and attempts<max_attempts and run_after<=now() and (status='queued' or (status='running' and lease_expires_at<now())) order by created_at,id for update skip locked limit 1").fetch_optional(&mut *tx).await?;
    let Some(row) = row else { return Ok(None) };
    let id: String = row.get("id");
    let actor: Option<String> = row.get("actor");
    sqlx::query("update background_jobs set status='running',attempts=attempts+1,started_at=coalesce(started_at,now()),lease_owner=$2,lease_expires_at=now()+interval '2 minutes',heartbeat_at=now(),updated_at=now() where id=$1::uuid").bind(&id).bind(LEASE).execute(&mut *tx).await?;
    tx.commit().await?;
    Ok(Some((
        id,
        row.get::<SqlJson<Value>, _>("payload").0,
        actor.unwrap_or_default(),
    )))
}
async fn process(pool: &PgPool, id: &str, payload: Value, actor: &str) -> WorkerResult<()> {
    let stop = tokio::sync::watch::channel(false);
    let beat_pool = pool.clone();
    let beat_id = id.to_string();
    let mut receiver = stop.1.clone();
    let heartbeat = tokio::spawn(async move {
        loop {
            tokio::select! {
                _=receiver.changed()=>break,
                ()=tokio::time::sleep(Duration::from_secs(20))=>{
                    let mut tx=match write_transaction(&beat_pool).await {Ok(tx)=>tx,Err(_)=>break};
                    if sqlx::query("update background_jobs set heartbeat_at=now(),lease_expires_at=now()+interval '2 minutes' where id=$1::uuid and status='running' and lease_owner=$2").bind(&beat_id).bind(LEASE).execute(&mut *tx).await.is_err(){break;}
                    if tx.commit().await.is_err(){break;}
                }
            }
        }
    });
    let action = async {
        if payload["jobType"] == "media.youtube.preview" {
            match super::youtube::extract(payload["url"].as_str().unwrap_or("")).await {
                Ok(preview) => save_result(pool, id, preview).await,
                Err(error) => Err(error),
            }
        } else if payload["jobType"] == "media.upload.verify" {
            super::uploads::finalize(
                pool,
                payload["uploadId"]
                    .as_str()
                    .ok_or("Invalid upload identity")?
                    .to_owned(),
                actor,
            )
            .await
            .map(|_| ())
            .map_err(|error| error.1)
        } else if payload["jobType"] == "media.file" {
            super::trash::execute(pool, &payload, actor).await
        } else {
            process_items(pool, id, payload, actor).await
        }
    };
    tokio::pin!(action);
    let result = loop {
        tokio::select! {
            result=&mut action=>break result,
            ()=tokio::time::sleep(Duration::from_secs(2))=>{
                let canceled=sqlx::query_scalar::<_,bool>("select cancel_requested_at is not null from background_jobs where id=$1::uuid").bind(id).fetch_one(pool).await;
                match canceled {Ok(true)=>break Err("Cancelled"),Ok(false)=>{},Err(_)=>break Err("Job database unavailable")}
            }
        }
    };
    let _ = stop.0.send(true);
    let _ = heartbeat.await;
    result
}
async fn process_items(pool: &PgPool, id: &str, payload: Value, actor: &str) -> WorkerResult<()> {
    let work = payload["workId"].as_str().ok_or("Invalid import work")?;
    let items: Vec<Item> =
        serde_json::from_value(payload["items"].clone()).map_err(|_| "Invalid import items")?;
    let incoming =
        storage::root("NAHHASIO_IMPORT_ROOT").map_err(|_| "Import root is not configured")?;
    let library =
        storage::root("NAHHASIO_LIBRARY_ROOT").map_err(|_| "Library root is not configured")?;
    let journals = storage::root("NAHHASIO_MEDIA_OPERATIONS_ROOT")
        .map_err(|_| "Media operations root is not configured")?;
    let mut results = Vec::new();
    let mut failed = false;
    for (index, item) in items.iter().enumerate() {
        let canceled: bool = sqlx::query_scalar(
            "select cancel_requested_at is not null from background_jobs where id=$1::uuid",
        )
        .bind(id)
        .fetch_one(pool)
        .await
        .map_err(|_| "Job database unavailable")?;
        if canceled {
            return Err("Cancelled");
        }
        let mut tx = write_transaction(pool)
            .await
            .map_err(|_| "Cannot update import phase")?;
        sqlx::query("update background_jobs set result=coalesce(result,'{}'::jsonb)||jsonb_build_object('phase',$2::text,'currentFile',$3::text),updated_at=now() where id=$1::uuid")
            .bind(id).bind(if item.youtube_id.is_some(){"downloading"}else{"inspecting"}).bind(Path::new(&item.relative_path).file_name().and_then(|n|n.to_str()).unwrap_or("video")).execute(&mut *tx).await.map_err(|_| "Cannot update import phase")?;
        tx.commit()
            .await
            .map_err(|_| "Cannot commit import phase")?;
        let result = import_file(
            &ImportContext {
                pool,
                incoming: &incoming,
                library: &library,
                journals: &journals,
                job: id,
                work,
                actor,
            },
            index,
            item,
        )
        .await;
        failed |= result.is_err();
        results.push(json!({"fileId":file_id(id,index),"name":Path::new(&item.relative_path).file_name().and_then(|n|n.to_str()),"status":if result.is_ok(){"completed"}else{"failed"},"error":result.err()}));
        let mut tx = write_transaction(pool)
            .await
            .map_err(|_| "Cannot start job progress transaction")?;
        sqlx::query("update background_jobs set progress=$2,result=jsonb_build_object('phase','importing','processed',$3::integer,'total',$4::integer,'items',$5::jsonb),updated_at=now() where id=$1::uuid").bind(id).bind(((index+1)*100/items.len()) as i32).bind((index+1) as i32).bind(items.len() as i32).bind(SqlJson(&results)).execute(&mut *tx).await.map_err(|_|"Could not save import progress")?;
        tx.commit()
            .await
            .map_err(|_| "Could not commit import progress")?;
    }
    if failed {
        Err("Some files failed; inspect per-file results and retry unfinished items")
    } else {
        Ok(())
    }
}
pub(super) async fn digest(path: &Path) -> WorkerResult<String> {
    let mut input = tokio::fs::File::open(path)
        .await
        .map_err(|_| "Cannot read media file")?;
    let mut hash = Sha256::new();
    let mut buffer = vec![0; 1024 * 1024];
    loop {
        let size = input
            .read(&mut buffer)
            .await
            .map_err(|_| "Cannot read media file")?;
        if size == 0 {
            break;
        }
        hash.update(&buffer[..size]);
    }
    Ok(hex::encode(hash.finalize()))
}
fn file_id(job: &str, index: usize) -> String {
    let h = hex::encode(Sha256::digest(format!("{job}:{index}").as_bytes()));
    format!(
        "{}-{}-4{}-a{}-{}",
        &h[..8],
        &h[8..12],
        &h[13..16],
        &h[17..20],
        &h[20..32]
    )
}
#[derive(Clone, Copy)]
struct ImportContext<'a> {
    pool: &'a PgPool,
    incoming: &'a Path,
    library: &'a Path,
    journals: &'a Path,
    job: &'a str,
    work: &'a str,
    actor: &'a str,
}
async fn import_file(context: &ImportContext<'_>, index: usize, item: &Item) -> WorkerResult<()> {
    let ImportContext {
        pool,
        incoming,
        library,
        journals,
        job,
        work,
        actor,
    } = *context;
    // The database singleton limits worker ownership; this serializes same-work retries
    // without keeping a database transaction open during long downloads.
    let lock = {
        let mut locks = IMPORTS.lock().await;
        locks.retain(|_, lock| lock.strong_count() > 0);
        let lock = locks
            .get(work)
            .and_then(std::sync::Weak::upgrade)
            .unwrap_or_else(|| std::sync::Arc::new(tokio::sync::Mutex::new(())));
        locks.insert(work.into(), std::sync::Arc::downgrade(&lock));
        lock
    };
    let _reservation = lock.lock().await;
    let id = file_id(job, index);
    let already =
        sqlx::query("select relative_path,sha256,availability,probe_metadata from media_files where id=$1::uuid")
            .bind(&id)
            .fetch_optional(pool)
            .await
            .map_err(|_| "Media database unavailable")?;
    if let Some(row) = already {
        if row.get::<String, _>("availability") != "present" {
            return Err("Imported file is no longer available; review its current registration");
        }
        let source_root = item
            .source_root
            .path()
            .map_err(|_| "Source root unavailable")?;
        if !item.copy && item.youtube_id.is_none() {
            super::sidecars::cleanup(
                &super::sidecars::decode(&row.get::<SqlJson<Value>, _>("probe_metadata").0)?,
                &source_root,
                library,
            )
            .await?;
            cleanup_source(
                &source_root,
                &item.relative_path,
                library,
                &row.get::<String, _>("relative_path"),
                &row.get::<String, _>("sha256"),
            )
            .await?;
        }
        return Ok(());
    }
    if let Some(youtube_id) = &item.youtube_id {
        let existing=sqlx::query("select f.episode_id::text episode_id,coalesce(f.installment_id,e.installment_id)::text installment_id,f.availability,f.probe_metadata ? 'trash' trashed from media_files f left join episodes e on e.id=f.episode_id join installments i on i.id=coalesce(f.installment_id,e.installment_id) where i.title_id=$1::uuid and not f.probe_metadata ? 'purgedAt' and f.probe_metadata->>'youtubeVideoId'=$2")
            .bind(work).bind(youtube_id).fetch_all(pool).await.map_err(|_| "Cannot inspect YouTube provenance")?;
        if !existing.is_empty() {
            if existing.iter().any(|row| {
                row.get::<Option<String>, _>("episode_id") == item.episode_id
                    && row.get::<String, _>("installment_id") == item.installment_id
                    && row.get::<String, _>("availability") == "present"
                    && !row.get::<bool, _>("trashed")
            }) {
                return Ok(());
            }
            return Err(
                "YouTube source already registered; restore, verify or reassign its existing file",
            );
        }
    }
    let selected_root = item
        .source_root
        .path()
        .map_err(|_| "Source root unavailable")?;
    item.source_root
        .validate(&item.relative_path)
        .map_err(|_| "Unsafe source selection")?;
    if item.youtube_id.is_none() {
        let registered: bool=sqlx::query_scalar("select exists(select 1 from media_files f join library_roots r on r.id=f.library_root_id where r.path=$1 and f.relative_path=$2 and not f.probe_metadata ? 'purgedAt')").bind(selected_root.to_str().ok_or("Invalid source root")?).bind(&item.relative_path).fetch_one(pool).await.map_err(|_| "Cannot inspect registered source")?;
        if registered {
            return Err("Source is already registered; manage its existing file instead");
        }
        let previous=sqlx::query("select f.episode_id::text episode_id,coalesce(f.installment_id,e.installment_id)::text installment_id,f.availability,f.probe_metadata ? 'trash' trashed from media_files f left join episodes e on e.id=f.episode_id join installments i on i.id=coalesce(f.installment_id,e.installment_id) where i.title_id=$1::uuid and not f.probe_metadata ? 'purgedAt' and f.probe_metadata->>'originalRelativePath'=$2 and f.probe_metadata->>'sourceRoot'=$3")
            .bind(work).bind(&item.relative_path).bind(match item.source_root {storage::SourceRoot::Incoming=>"incoming",storage::SourceRoot::Library=>"library"}).fetch_all(pool).await.map_err(|_| "Cannot inspect import provenance")?;
        if !previous.is_empty() {
            return Err(
                "Source was already imported; inspect its existing file before importing again",
            );
        }
    }
    let youtube_id = item.youtube_id.clone();
    let downloaded;
    let item = if let Some(video_id) = &item.youtube_id {
        if !super::youtube::video_id(video_id) {
            return Err("Invalid YouTube identity");
        }
        let relative = format!("youtube/{job}/{video_id}.mkv");
        let directory = storage::directory(incoming, &format!("youtube/{job}"))
            .await
            .map_err(|_| "Unsafe YouTube staging")?;
        let destination = incoming.join(&relative);
        let receipt = directory.join(format!("{video_id}.complete.json"));
        if tokio::fs::try_exists(&destination)
            .await
            .map_err(|_| "Cannot inspect YouTube staging")?
        {
            let valid = match tokio::fs::symlink_metadata(&receipt).await {
                Ok(stat) if stat.is_file() && stat.len() < 32768 => {
                    let data: Value = serde_json::from_slice(
                        &tokio::fs::read(&receipt)
                            .await
                            .map_err(|_| "Cannot read download receipt")?,
                    )
                    .map_err(|_| "Invalid download receipt")?;
                    data["videoId"] == *video_id
                        && data["sha256"].as_str()
                            == Some(
                                digest(
                                    &storage::existing(incoming, &relative)
                                        .await
                                        .map_err(|_| "Unsafe completed download")?,
                                )
                                .await?
                                .as_str(),
                            )
                }
                _ => false,
            };
            if !valid {
                // A remux output without its completion receipt may be truncated. Preserve
                // it separately; only a newly completed tool invocation can publish video.
                let mut nonce = [0; 16];
                getrandom::fill(&mut nonce).map_err(|_| "Cannot journal interrupted download")?;
                let preserved = directory.join(format!(
                    ".interrupted-{video_id}-{}.mkv",
                    hex::encode(nonce)
                ));
                let source = storage::existing(incoming, &relative)
                    .await
                    .map_err(|_| "Unsafe interrupted download")?;
                tokio::fs::hard_link(&source, preserved)
                    .await
                    .map_err(|_| "Cannot preserve interrupted download")?;
                tokio::fs::remove_file(source)
                    .await
                    .map_err(|_| "Cannot release interrupted download staging")?;
            }
        }
        if !tokio::fs::try_exists(&destination)
            .await
            .map_err(|_| "Cannot inspect YouTube staging")?
        {
            let format = match item.quality.as_deref() {
                Some("720") => "bv*[height<=720]+ba/b[height<=720]",
                Some("best") => "bv*+ba/b",
                _ => "bv*[height<=1080]+ba/b[height<=1080]",
            };
            let output = directory.join(format!("{video_id}.%(ext)s"));
            let url = format!("https://www.youtube.com/watch?v={video_id}");
            command_with_storage(
                "yt-dlp",
                &[
                    "--ignore-config",
                    "--no-playlist",
                    "--no-progress",
                    "--no-warnings",
                    "--no-cache-dir",
                    "--continue",
                    "--socket-timeout",
                    "20",
                    "--format",
                    format,
                    "--merge-output-format",
                    "mkv",
                    "--remux-video",
                    "mkv",
                    "--output",
                    output.to_str().ok_or("Invalid YouTube staging")?,
                    "--",
                    &url,
                ],
                7200,
                1024 * 1024,
                Some(library),
            )
            .await?;
            let checked = storage::existing(incoming, &relative)
                .await
                .map_err(|_| "Unsafe completed download")?;
            storage::journal(
                &receipt,
                &json!({"videoId":video_id,"sha256":digest(&checked).await?}),
            )
            .await
            .map_err(|_| "Cannot save download completion receipt")?;
        }
        let stat = tokio::fs::metadata(destination)
            .await
            .map_err(|_| "YouTube download did not produce a video")?;
        downloaded = Item {
            source_root: storage::SourceRoot::Incoming,
            relative_path: relative,
            installment_id: item.installment_id.clone(),
            episode_id: item.episode_id.clone(),
            byte_size: stat.len(),
            modified_seconds: stat
                .modified()
                .ok()
                .and_then(|m| m.duration_since(std::time::UNIX_EPOCH).ok())
                .map_or(0, |m| m.as_secs()),
            copy: false,
            youtube_id: None,
            quality: None,
        };
        &downloaded
    } else {
        item
    };
    let source_root = if youtube_id.is_some() {
        incoming
    } else {
        &selected_root
    };
    let source = storage::existing(source_root, &item.relative_path)
        .await
        .map_err(|_| "Import file missing or unsafe")?;
    let before = tokio::fs::metadata(&source)
        .await
        .map_err(|_| "Cannot inspect source")?;
    let modified = before
        .modified()
        .ok()
        .and_then(|m| m.duration_since(std::time::UNIX_EPOCH).ok())
        .map_or(0, |m| m.as_secs());
    if !before.is_file() || before.len() != item.byte_size || modified != item.modified_seconds {
        return Err("Source changed; inspect and review the import again");
    }
    tokio::time::sleep(Duration::from_secs(2)).await;
    let after = tokio::fs::metadata(&source)
        .await
        .map_err(|_| "Cannot inspect source")?;
    if before.len() != after.len() || before.modified().ok() != after.modified().ok() {
        return Err("Source is still being copied");
    }
    let space = Command::new("df")
        .args(["-Pk"])
        .arg(library)
        .output()
        .await
        .map_err(|_| "Cannot inspect free space")?;
    let free = String::from_utf8_lossy(&space.stdout)
        .lines()
        .last()
        .and_then(|l| l.split_whitespace().nth(3))
        .and_then(|s| s.parse::<u64>().ok())
        .ok_or("Cannot inspect free space")?
        * 1024;
    let library_stat = tokio::fs::metadata(library)
        .await
        .map_err(|_| "Cannot inspect library filesystem")?;
    let reserve = 5 * 1024 * 1024 * 1024
        + if item.copy || before.dev() != library_stat.dev() {
            item.byte_size
        } else {
            0
        };
    if !space.status.success() || free < reserve {
        return Err("Insufficient free space; 5 GiB reserve required");
    }
    let probe_slot = PROBE
        .acquire()
        .await
        .map_err(|_| "Probe worker unavailable")?;
    let output=command("ffprobe",&["-v","error","-show_entries","format=duration:stream=index,codec_type,codec_name,width,height:stream_tags=language,title:stream_disposition=default,forced","-of","json",source.to_str().ok_or("Invalid media path")?],60,2*1024*1024).await?;
    drop(probe_slot);
    let mut probe: Value = serde_json::from_slice(&output).map_err(|_| "Invalid probe result")?;
    if !probe["streams"]
        .as_array()
        .is_some_and(|streams| streams.iter().any(|s| s["codec_type"] == "video"))
    {
        return Err("File contains no video stream");
    }
    if let Some(format) = probe["format"].as_object_mut() {
        format.remove("filename");
    }
    let checksum = digest(&source).await?;
    let extension = source
        .extension()
        .and_then(|s| s.to_str())
        .ok_or("Invalid file extension")?
        .to_ascii_lowercase();
    let names:(String,String,Option<String>)=sqlx::query_as("select t.canonical_title,i.title,e.number::text from titles t join installments i on i.title_id=t.id left join episodes e on e.id=$3::uuid and e.installment_id=i.id where t.id=$1::uuid and i.id=$2::uuid")
        .bind(work).bind(&item.installment_id).bind(&item.episode_id).fetch_one(pool).await.map_err(|_| "Cannot resolve import destination identities")?;
    let category = if item.episode_id.is_some() {
        "series"
    } else {
        "movies"
    };
    let category_path = storage::directory(library, category)
        .await
        .map_err(|_| "Unsafe library category")?;
    let work_folder = storage::readable_folder(&category_path, &names.0, work)
        .await
        .map_err(|_| "Ambiguous or unsafe work directory")?;
    let work_path = storage::directory(library, &format!("{category}/{work_folder}"))
        .await
        .map_err(|_| "Unsafe work directory")?;
    let rel = if let Some(episode) = &item.episode_id {
        let part_folder = storage::readable_folder(&work_path, &names.1, &item.installment_id)
            .await
            .map_err(|_| "Ambiguous installment directory")?;
        let number = names
            .2
            .as_deref()
            .ok_or("Episode identity changed; review import again")?;
        let number = number.replace('.', "-");
        format!("series/{work_folder}/{part_folder}/E{number:0>3}--{episode}--{id}.{extension}")
    } else {
        format!(
            "movies/{work_folder}/{}--{id}.{extension}",
            item.installment_id
        )
    };
    tokio::fs::create_dir_all(journals)
        .await
        .map_err(|_| "Cannot prepare import journal")?;
    let journal = journals.join(format!("{id}.json"));
    let (rel, companions) = match tokio::fs::symlink_metadata(&journal).await {
        Ok(stat) => {
            if !stat.is_file() || stat.len() > 32768 {
                return Err("Invalid import journal; review recovery");
            }
            let record: Value = serde_json::from_slice(
                &tokio::fs::read(&journal)
                    .await
                    .map_err(|_| "Cannot read import journal")?,
            )
            .map_err(|_| "Invalid import journal")?;
            if record["jobId"] != job || record["fileId"] != id || record["sha256"] != checksum {
                return Err("Source differs from its import journal; recovery needs review");
            }
            let relative = record["destination"]
                .as_str()
                .ok_or("Invalid journal destination")?;
            storage::SourceRoot::Library
                .validate(relative)
                .map_err(|_| "Unsafe journal destination")?;
            (relative.to_owned(), super::sidecars::decode(&record)?)
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            let companions = if youtube_id.is_none() {
                super::sidecars::discover(source_root, &item.relative_path, &rel).await?
            } else {
                Vec::new()
            };
            (rel, companions)
        }
        Err(_) => return Err("Cannot inspect import journal"),
    };
    let destination = library.join(&rel);
    let parent = destination.parent().ok_or("Invalid destination")?;
    storage::directory(
        library,
        parent
            .strip_prefix(library)
            .map_err(|_| "Invalid destination")?
            .to_str()
            .ok_or("Invalid destination")?,
    )
    .await
    .map_err(|_| "Unsafe destination")?;
    let record = json!({"jobId":job,"fileId":id,"sourceRoot":item.source_root,"source":item.relative_path,"destination":rel,"sha256":checksum,"copy":item.copy,"sidecars":companions});
    storage::journal(&journal, &record)
        .await
        .map_err(|_| "Cannot save import journal")?;
    if tokio::fs::try_exists(&destination)
        .await
        .map_err(|_| "Cannot inspect destination")?
    {
        if digest(&destination).await? != checksum {
            return Err("Destination conflict; existing bytes were preserved");
        }
    } else {
        let link = if item.copy {
            Err(std::io::Error::from_raw_os_error(18))
        } else {
            tokio::fs::hard_link(&source, &destination).await
        };
        match link {
            Ok(()) => {}
            Err(error) if error.raw_os_error() == Some(18) => {
                let stage = destination.with_extension(format!("{extension}.partial"));
                resume_copy(&source, &stage, &checksum).await?;
                tokio::fs::hard_link(&stage, &destination)
                    .await
                    .map_err(|_| "Destination conflict")?;
                tokio::fs::remove_file(stage)
                    .await
                    .map_err(|_| "Could not remove completed staging link")?;
            }
            Err(_) => return Err("Cannot publish media file without overwriting existing data"),
        }
    }
    super::sidecars::publish(&companions, source_root, library).await?;
    let mut tx = pool
        .begin()
        .await
        .map_err(|_| "Media database unavailable")?;
    sqlx::query("set transaction read write")
        .execute(&mut *tx)
        .await
        .map_err(|_| "Cannot start media registration")?;
    authorize(&mut tx, actor).await?;
    let part: Option<String> = sqlx::query_scalar(
        "select id::text from installments where id=$1::uuid and title_id=$2::uuid for share",
    )
    .bind(&item.installment_id)
    .bind(work)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|_| "Cannot validate import work")?;
    if part.is_none() {
        return Err("Installment changed; review import again");
    }
    if let Some(episode) = &item.episode_id {
        let found: Option<String> = sqlx::query_scalar(
            "select id::text from episodes where id=$1::uuid and installment_id=$2::uuid for share",
        )
        .bind(episode)
        .bind(&item.installment_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|_| "Cannot validate import episode")?;
        if found.is_none() {
            return Err("Episode changed; review import again");
        }
    }
    let root_id:String=sqlx::query_scalar("insert into library_roots(name,path,is_read_only) values('Managed media',$1,false) on conflict(path) do update set is_active=true returning id::text").bind(library.to_str().ok_or("Invalid library path")?).fetch_one(&mut *tx).await.map_err(|_|"Cannot register media root")?;
    let duration = probe["format"]["duration"]
        .as_str()
        .and_then(|s| s.parse::<f64>().ok())
        .filter(|s| s.is_finite() && *s > 0.0)
        .map(|s| s.min(i32::MAX as f64) as i32);
    let metadata = json!({"source":if youtube_id.is_some(){"youtube"}else if item.relative_path.starts_with("uploads/"){"upload"}else{"server-folder"},"sourceRoot":item.source_root,"originalRelativePath":item.relative_path,"youtubeVideoId":youtube_id,"importJobId":job,"probe":probe,"sidecars":companions});
    sqlx::query("insert into media_files(id,installment_id,episode_id,path,library_root_id,relative_path,byte_size,sha256,availability,probe_metadata,duration_seconds,last_verified_at,probe_version) values($1::uuid,$2::uuid,$3::uuid,$4,$5::uuid,$6,$7,$8,'present',$9,$10,now(),'ffprobe-v1')").bind(&id).bind(if item.episode_id.is_none(){Some(&item.installment_id)}else{None}).bind(&item.episode_id).bind(destination.to_str().ok_or("Invalid destination")?).bind(root_id).bind(&rel).bind(item.byte_size as i64).bind(&checksum).bind(SqlJson(&metadata)).bind(duration).execute(&mut *tx).await.map_err(|_|"Cannot register verified video; journal retained")?;
    for stream in probe["streams"].as_array().into_iter().flatten() {
        let kind = stream["codec_type"].as_str().unwrap_or("");
        if !matches!(kind, "audio" | "subtitle") {
            continue;
        }
        sqlx::query("insert into media_tracks(media_file_id,kind,stream_index,language,codec,title,is_default,is_forced) values($1::uuid,$2::track_kind,$3,$4,$5,$6,$7,$8)").bind(&id).bind(kind).bind(stream["index"].as_i64().unwrap_or(0) as i32).bind(stream["tags"]["language"].as_str()).bind(stream["codec_name"].as_str()).bind(stream["tags"]["title"].as_str()).bind(stream["disposition"]["default"]==1).bind(stream["disposition"]["forced"]==1).execute(&mut *tx).await.map_err(|_|"Cannot register media tracks")?;
    }
    for companion in &companions {
        let codec = Path::new(&companion.relative_path)
            .extension()
            .and_then(|extension| extension.to_str())
            .ok_or("Invalid subtitle extension")?
            .to_ascii_lowercase();
        sqlx::query("insert into media_tracks(media_file_id,kind,stream_index,source,relative_path,sha256,codec,title) values($1::uuid,'subtitle',null,'external',$2,$3,$4,$5)")
            .bind(&id).bind(&companion.relative_path).bind(&companion.sha256).bind(codec).bind(Path::new(&companion.original_relative_path).file_name().and_then(|name| name.to_str())).execute(&mut *tx).await.map_err(|_| "Cannot register preserved subtitle track")?;
    }
    sqlx::query("insert into audit_logs(actor_account_id,action,target_type,target_id,summary) values($1::uuid,'media.import.completed','media_files',$2,'Registered verified server video')").bind(actor).bind(&id).execute(&mut *tx).await.map_err(|_|"Cannot record media audit")?;
    tx.commit()
        .await
        .map_err(|_| "Cannot commit media registration")?;
    if !item.copy {
        super::sidecars::cleanup(&companions, source_root, library).await?;
        cleanup_source(source_root, &item.relative_path, library, &rel, &checksum).await?;
    }
    Ok(())
}

async fn cleanup_source(
    source_root: &Path,
    relative: &str,
    library: &Path,
    destination: &str,
    checksum: &str,
) -> WorkerResult<()> {
    if !tokio::fs::try_exists(source_root.join(relative))
        .await
        .map_err(|_| "Cannot inspect source cleanup")?
    {
        return Ok(());
    }
    let source = storage::existing(source_root, relative)
        .await
        .map_err(|_| "Unsafe source cleanup")?;
    let destination = storage::existing(library, destination)
        .await
        .map_err(|_| "Registered video is missing; source preserved")?;
    if digest(&source).await? != checksum || digest(&destination).await? != checksum {
        return Err("Source or destination changed; original source preserved");
    }
    tokio::fs::remove_file(source)
        .await
        .map_err(|_| "Registered video; original source cleanup needs review")
}

pub(super) async fn resume_copy(source: &Path, stage: &Path, checksum: &str) -> WorkerResult<()> {
    let mut input = tokio::fs::File::open(source)
        .await
        .map_err(|_| "Cannot read source")?;
    let size = input
        .metadata()
        .await
        .map_err(|_| "Cannot inspect source")?
        .len();
    let mut output = match tokio::fs::OpenOptions::new()
        .create_new(true)
        .write(true)
        .open(stage)
        .await
    {
        Ok(file) => file,
        Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {
            let stat = tokio::fs::symlink_metadata(stage)
                .await
                .map_err(|_| "Cannot inspect staging")?;
            if !stat.is_file() || stat.len() > size {
                return Err("Staging conflict; bytes preserved");
            }
            // Verify the retained prefix before appending, including after a changed source.
            let mut prefix = Sha256::new();
            let mut remaining = stat.len();
            let mut buffer = vec![0; 1024 * 1024];
            while remaining > 0 {
                let count = input
                    .read(&mut buffer[..remaining.min(1024 * 1024) as usize])
                    .await
                    .map_err(|_| "Cannot verify copy prefix")?;
                if count == 0 {
                    return Err("Source changed during copy recovery");
                }
                prefix.update(&buffer[..count]);
                remaining -= count as u64;
            }
            if hex::encode(prefix.finalize()) != digest(stage).await? {
                return Err("Staging differs from source; bytes preserved");
            }
            tokio::fs::OpenOptions::new()
                .append(true)
                .open(stage)
                .await
                .map_err(|_| "Cannot resume staged copy")?
        }
        Err(_) => return Err("Cannot create copy staging"),
    };
    let offset = output
        .metadata()
        .await
        .map_err(|_| "Cannot inspect copy offset")?
        .len();
    input
        .seek(std::io::SeekFrom::Start(offset))
        .await
        .map_err(|_| "Cannot resume source")?;
    tokio::io::copy(&mut input, &mut output)
        .await
        .map_err(|_| "Copy interrupted; staging bytes retained")?;
    output
        .sync_all()
        .await
        .map_err(|_| "Could not sync staged video")?;
    if digest(stage).await? != checksum {
        return Err("Copy verification failed; staging bytes retained");
    }
    Ok(())
}
async fn finish(pool: &PgPool, id: &str, result: WorkerResult<()>) {
    let (status, error) = match result {
        Ok(()) => ("completed", None),
        Err("Cancelled") => ("cancelled", None),
        Err(error) => ("failed", Some(error)),
    };
    let Ok(mut tx) = write_transaction(pool).await else {
        tracing::error!("could not start media completion transaction");
        return;
    };
    if sqlx::query("update background_jobs set status=$2::background_job_status,error=$3,finished_at=now(),lease_owner=null,lease_expires_at=null,heartbeat_at=null,updated_at=now() where id=$1::uuid and status='running' and lease_owner=$4").bind(id).bind(status).bind(error).bind(LEASE).execute(&mut *tx).await.is_err(){tracing::error!("could not finish media job; lease recovery required");return;}
    if tx.commit().await.is_err() {
        tracing::error!("could not commit media completion");
    }
}

async fn write_transaction(
    pool: &PgPool,
) -> std::result::Result<sqlx::Transaction<'_, sqlx::Postgres>, sqlx::Error> {
    let mut tx = pool.begin().await?;
    sqlx::query("set transaction read write")
        .execute(&mut *tx)
        .await?;
    Ok(tx)
}

async fn save_result(pool: &PgPool, id: &str, result: Value) -> WorkerResult<()> {
    let mut tx = write_transaction(pool)
        .await
        .map_err(|_| "Cannot save preview")?;
    sqlx::query("update background_jobs set result=$2,progress=100 where id=$1::uuid")
        .bind(id)
        .bind(SqlJson(result))
        .execute(&mut *tx)
        .await
        .map_err(|_| "Cannot save preview")?;
    tx.commit().await.map_err(|_| "Cannot commit preview")?;
    Ok(())
}
pub(super) async fn command(
    program: &str,
    args: &[&str],
    seconds: u64,
    limit: u64,
) -> WorkerResult<Vec<u8>> {
    command_with_storage(program, args, seconds, limit, None).await
}
struct ProcessGroup(rustix::process::Pid);
impl Drop for ProcessGroup {
    fn drop(&mut self) {
        if let Err(error) =
            rustix::process::kill_process_group(self.0, rustix::process::Signal::KILL)
            && error != rustix::io::Errno::SRCH
        {
            tracing::error!("could not stop media tool process group");
        }
    }
}
fn available_bytes(root: &Path) -> WorkerResult<u64> {
    let stat = rustix::fs::statvfs(root).map_err(|_| "Cannot inspect staging capacity")?;
    Ok(stat.f_bavail.saturating_mul(stat.f_frsize))
}
async fn command_with_storage(
    program: &str,
    args: &[&str],
    seconds: u64,
    limit: u64,
    storage: Option<&Path>,
) -> WorkerResult<Vec<u8>> {
    use std::process::Stdio;
    if let Some(root) = storage
        && available_bytes(root)? < 5 * 1024 * 1024 * 1024
    {
        return Err("Insufficient free space; 5 GiB reserve required");
    }
    let mut child = Command::new(program)
        .args(args)
        .env_clear()
        .env("PATH", std::env::var_os("PATH").unwrap_or_default())
        .env("LANG", "C.UTF-8")
        .env("DENO_DIR", "/tmp/nahhasio-deno")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .kill_on_drop(true)
        .process_group(0)
        .spawn()
        .map_err(|_| "Media tool is unavailable")?;
    let group = ProcessGroup(
        rustix::process::Pid::from_raw(child.id().ok_or("Media tool lost its identity")? as i32)
            .filter(|id| id.as_raw_pid() > 1)
            .ok_or("Invalid media tool identity")?,
    );
    let stdout = child
        .stdout
        .take()
        .ok_or("Cannot capture media tool result")?;
    let monitor = async {
        loop {
            tokio::time::sleep(Duration::from_millis(500)).await;
            if let Some(root) = storage
                && available_bytes(root)? < 5 * 1024 * 1024 * 1024 + 64 * 1024 * 1024
            {
                return Err("Download stopped to preserve the 5 GiB free-space reserve");
            }
        }
    };
    let operation = async {
        let mut output = Vec::new();
        stdout
            .take(limit + 1)
            .read_to_end(&mut output)
            .await
            .map_err(|_| "Media tool output failed")?;
        if output.len() as u64 > limit {
            return Err("Media tool output exceeded its limit");
        }
        let status = child.wait().await.map_err(|_| "Media tool interrupted")?;
        if !status.success() {
            return Err("Media tool failed; check source availability and worker tools");
        }
        Ok(output)
    };
    let result = tokio::select! {
        result=tokio::time::timeout(Duration::from_secs(seconds),operation)=>result.map_err(|_| "Media tool timed out")?,
        result=monitor=>result,
    };
    drop(group);
    if result.is_err() {
        let _ = child.kill().await;
    }
    result
}

pub(super) async fn authorize(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    actor: &str,
) -> WorkerResult<()> {
    let user:Option<String>=sqlx::query_scalar("select u.id from auth_users u join accounts a on a.auth_user_id=u.id where a.id=$1::uuid and u.role in ('admin','owner') and (not u.banned or u.ban_expires<=now()) for update of u").bind(actor).fetch_optional(&mut **tx).await.map_err(|_|"Cannot lock import identity")?;
    if user.is_none() {
        return Err("Import owner no longer has administrator access");
    }
    let account:Option<String>=sqlx::query_scalar("select id::text from accounts where id=$1::uuid and status='active' and kind='admin' for update").bind(actor).fetch_optional(&mut **tx).await.map_err(|_|"Cannot lock import account")?;
    if account.is_none() {
        return Err("Import owner no longer has administrator access");
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[tokio::test]
    async fn interrupted_copy_verifies_prefix_and_never_replaces_a_conflict() {
        let root = std::env::temp_dir().join(format!("nahhasio-copy-{}", std::process::id()));
        tokio::fs::create_dir_all(&root).await.unwrap();
        let source = root.join("source");
        let stage = root.join("stage");
        tokio::fs::write(&source, b"0123456789").await.unwrap();
        let checksum = digest(&source).await.unwrap();
        tokio::fs::write(&stage, b"bad").await.unwrap();
        assert!(resume_copy(&source, &stage, &checksum).await.is_err());
        assert_eq!(tokio::fs::read(&stage).await.unwrap(), b"bad");
        tokio::fs::write(&stage, b"0123").await.unwrap();
        resume_copy(&source, &stage, &checksum).await.unwrap();
        assert_eq!(tokio::fs::read(&stage).await.unwrap(), b"0123456789");
        resume_copy(&source, &stage, &checksum).await.unwrap();
        tokio::fs::remove_dir_all(root).await.unwrap();
    }
    #[tokio::test]
    async fn cancellation_stops_descendants_and_tools_do_not_inherit_database_credentials() {
        assert_eq!(
            command("sh", &["-c", "printf %s \"${DATABASE_URL-unset}\""], 5, 100)
                .await
                .unwrap(),
            b"unset"
        );
        let path = std::env::temp_dir().join(format!("nahhasio-child-{}", std::process::id()));
        let child_path = path.clone();
        let task = tokio::spawn(async move {
            command(
                "sh",
                &[
                    "-c",
                    "sleep 30 & echo $! > \"$1\"; wait",
                    "fixture",
                    child_path.to_str().unwrap(),
                ],
                60,
                100,
            )
            .await
        });
        let mut pid = None;
        for _ in 0..100 {
            if let Ok(value) = tokio::fs::read_to_string(&path).await {
                pid = value.trim().parse::<u32>().ok();
                if pid.is_some() {
                    break;
                }
            }
            tokio::time::sleep(Duration::from_millis(10)).await;
        }
        let pid = pid.expect("child fixture did not start");
        task.abort();
        let _ = task.await;
        let mut stopped = false;
        for _ in 0..100 {
            match tokio::fs::read_to_string(format!("/proc/{pid}/stat")).await {
                Err(_) => {
                    stopped = true;
                    break;
                }
                Ok(value) if value.split_whitespace().nth(2) == Some("Z") => {
                    stopped = true;
                    break;
                }
                Ok(_) => {}
            }
            tokio::time::sleep(Duration::from_millis(10)).await;
        }
        assert!(stopped, "media tool descendant survived cancellation");
        tokio::fs::remove_file(path).await.unwrap();
    }
}
