//! Server-owned media inventory and authenticated original-file delivery.
mod sidecars;
mod storage;
mod trash;
mod uploads;
mod worker;
mod youtube;
use crate::auth::User;
use axum::{
    Extension, Json, Router,
    body::Body,
    extract::{Path, Query, Request, State},
    http::{HeaderMap, StatusCode, header},
    middleware,
    response::{IntoResponse, Response},
    routing::{get, post, put},
};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sqlx::{PgPool, Row, types::Json as SqlJson};
use tower::ServiceExt;
use tower_http::services::ServeFile;
pub use worker::run as run_worker;

#[derive(Debug)]
pub(super) struct Error(pub StatusCode, pub &'static str);
impl IntoResponse for Error {
    fn into_response(self) -> Response {
        (self.0, Json(json!({"message":self.1}))).into_response()
    }
}
impl From<sqlx::Error> for Error {
    fn from(_: sqlx::Error) -> Self {
        Self(
            StatusCode::SERVICE_UNAVAILABLE,
            "Media database is unavailable",
        )
    }
}
type Result<T> = std::result::Result<T, Error>;
#[derive(Clone)]
struct MediaState {
    pool: PgPool,
    uploads: std::sync::Arc<tokio::sync::Semaphore>,
}
pub(super) fn routes(pool: PgPool) -> Router {
    let state = MediaState {
        pool: pool.clone(),
        uploads: std::sync::Arc::new(tokio::sync::Semaphore::new(2)),
    };
    let viewer = Router::new()
        .route("/api/v1/works/{id}/media", get(files))
        .route("/api/v1/media/{id}/content", get(content))
        .route("/api/v1/media/{id}/subtitles/{index}", get(subtitle))
        .route_layer(middleware::from_fn_with_state(
            pool.clone(),
            crate::auth::require_viewer,
        ));
    let admin = Router::new()
        .route("/api/v1/admin/media", get(inventory))
        .route("/api/v1/admin/media/coverage", get(coverage))
        .route("/api/v1/admin/media/units", get(units))
        .route("/api/v1/admin/media/{id}", post(trash::enqueue))
        .route("/api/v1/admin/media/incoming", get(incoming))
        .route("/api/v1/admin/media/jobs", get(jobs).post(enqueue))
        .route("/api/v1/admin/media/youtube", post(youtube::preview))
        .route("/api/v1/admin/media/uploads", post(uploads::start))
        .route(
            "/api/v1/admin/media/uploads/{id}",
            put(uploads::chunk).layer(axum::extract::DefaultBodyLimit::max(8 * 1024 * 1024)),
        )
        .route(
            "/api/v1/admin/media/uploads/{id}/complete",
            post(uploads::complete),
        )
        .route("/api/v1/admin/media/jobs/{id}", post(control))
        .route_layer(middleware::from_fn_with_state(
            pool,
            crate::auth::require_admin,
        ));
    viewer
        .merge(admin)
        .layer(middleware::from_fn(no_store))
        .with_state(state)
}
async fn no_store(request: Request, next: middleware::Next) -> Response {
    let mut response = next.run(request).await;
    response
        .headers_mut()
        .insert(header::CACHE_CONTROL, "private, no-store".parse().unwrap());
    response
}
#[derive(Default, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct List {
    page: Option<i64>,
    page_size: Option<i64>,
    q: Option<String>,
    work_id: Option<String>,
    installment_id: Option<String>,
    episode_ids: Option<String>,
    #[serde(default)]
    source_root: storage::SourceRoot,
    media_state: Option<String>,
    media_source: Option<String>,
}
impl List {
    fn pagination(&self) -> Result<(i64, i64)> {
        let (page, size) = (self.page.unwrap_or(1), self.page_size.unwrap_or(30));
        if !(1..=100000).contains(&page)
            || !(1..=100).contains(&size)
            || self.q.as_ref().is_some_and(|q| q.len() > 600)
            || !matches!(
                self.media_state.as_deref(),
                None | Some("all" | "present" | "needs-review" | "trash" | "missing")
            )
            || !matches!(
                self.media_source.as_deref(),
                None | Some("all" | "server-folder" | "youtube" | "upload")
            )
        {
            return Err(storage::invalid());
        }
        if let Some(id) = &self.work_id {
            storage::uuid(id)?;
        }
        if let Some(id) = &self.installment_id {
            storage::uuid(id)?;
        }
        if let Some(ids) = &self.episode_ids {
            if ids.split(',').count() > 10 || self.installment_id.is_none() {
                return Err(storage::invalid());
            }
            if ids != "none" {
                for id in ids.split(',') {
                    storage::uuid(id)?;
                }
            }
        }
        Ok((page, size))
    }
}
const FILE_FROM: &str = "from media_files f left join episodes e on e.id=f.episode_id join installments i on i.id=coalesce(f.installment_id,e.installment_id) join titles t on t.id=i.title_id";
const FILE_JSON: &str = "jsonb_build_object('id',f.id,'workId',t.id,'workTitle',coalesce(t.title_ar,t.canonical_title),'installmentId',i.id,'installmentTitle',i.title,'episodeId',e.id,'episodeTitle',e.title,'episodeNumber',e.number::text,'relativePath',f.relative_path,'byteSize',f.byte_size,'sha256',f.sha256,'durationSeconds',f.duration_seconds,'availability',f.availability,'probeMetadata',f.probe_metadata,'isTrashed',f.probe_metadata ? 'trash','trashExpiresAt',f.probe_metadata->'trash'->>'expiresAt','lastVerifiedAt',f.last_verified_at,'revision',f.updated_at::text)";
const SIDECAR_BYTES: &str = "coalesce((select sum(case when jsonb_typeof(s->'byteSize')='number' then greatest(0,least(16777216,(s->>'byteSize')::numeric)) else 0 end) from jsonb_array_elements(case when jsonb_typeof(probe_metadata->'sidecars')='array' then probe_metadata->'sidecars' else '[]'::jsonb end) s),0)";
async fn inventory(
    State(state): State<MediaState>,
    Query(input): Query<List>,
) -> Result<Json<Value>> {
    let (page, size) = input.pagination()?;
    let condition = "not f.probe_metadata ? 'purgedAt' and ($1::text is null or strpos(lower(t.canonical_title||' '||coalesce(t.title_ar,'')||' '||coalesce(e.title,'')),lower($1))>0) and ($2::uuid is null or t.id=$2::uuid) and ($3='all' or f.probe_metadata->>'source'=$3) and ($4='all' or ($4='trash' and f.probe_metadata ? 'trash') or ($4='present' and f.availability='present' and not f.probe_metadata ? 'trash') or ($4 in ('missing','needs-review') and f.availability!='present' and not f.probe_metadata ? 'trash')) and ($8::uuid is null or i.id=$8::uuid) and ($9::text is null or ($9='none' and e.id is null) or e.id::text=any(string_to_array($9,',')))";
    let sql = format!(
        "select jsonb_build_object('items',coalesce((select jsonb_agg(item) from (select {FILE_JSON} item {FILE_FROM} where {condition} order by t.sort_title,i.position,e.position,f.id limit $5 offset $6) page),'[]'::jsonb),'total',(select count(*) {FILE_FROM} where {condition}),'page',$7::bigint,'pageSize',$5::bigint,'trashBytes',(select coalesce(sum(case when jsonb_typeof(probe_metadata->'trash'->'byteSize')='number' then greatest(0,(probe_metadata->'trash'->>'byteSize')::numeric) else coalesce(byte_size,0)+{SIDECAR_BYTES} end),0) from media_files where probe_metadata ? 'trash'),'trashFiles',(select count(*) from media_files where probe_metadata ? 'trash'))"
    );
    let result = sqlx::query_scalar::<_, SqlJson<Value>>(sqlx::AssertSqlSafe(sql))
        .bind(input.q)
        .bind(input.work_id)
        .bind(input.media_source.as_deref().unwrap_or("all"))
        .bind(input.media_state.as_deref().unwrap_or("all"))
        .bind(size)
        .bind((page - 1) * size)
        .bind(page)
        .bind(input.installment_id)
        .bind(input.episode_ids)
        .fetch_one(&state.pool)
        .await?
        .0;
    Ok(Json(result))
}
async fn units(State(state): State<MediaState>, Query(input): Query<List>) -> Result<Json<Value>> {
    input.pagination()?;
    let work = input.work_id.ok_or_else(storage::invalid)?;
    let part = input.installment_id.ok_or_else(storage::invalid)?;
    let episodes = input.episode_ids.ok_or_else(storage::invalid)?;
    // Summaries are bounded to the editor's visible episode page, including units with no files.
    let sql = "with units as (select i.id installment_id,e.id episode_id from installments i left join episodes e on e.installment_id=i.id where i.title_id=$1::uuid and i.id=$2::uuid and (($3='none' and e.id is null and i.kind!='season') or e.id::text=any(string_to_array($3,',')))) select coalesce(jsonb_agg(jsonb_build_object('episodeId',u.episode_id,'totalFiles',c.total,'availableFiles',c.available,'missingFiles',c.missing,'reviewFiles',c.review,'trashedFiles',c.trash,'activeImports',(select count(*) from background_jobs j where j.type='media.import' and j.status in ('queued','running') and j.payload->>'workId'=$1 and exists(select 1 from jsonb_array_elements(j.payload->'items') with ordinality item(value,position) where item.value->>'installmentId'=u.installment_id::text and (item.value->>'episodeId') is not distinct from u.episode_id::text and (j.result->'items'->((item.position-1)::int)->>'status') is distinct from 'completed')))),'[]'::jsonb) from units u cross join lateral (select count(*) total,count(*) filter(where f.availability='present' and not f.probe_metadata ? 'trash') available,count(*) filter(where f.availability='missing' and not f.probe_metadata ? 'trash') missing,count(*) filter(where f.availability in ('unknown','unreadable') and not f.probe_metadata ? 'trash') review,count(*) filter(where f.probe_metadata ? 'trash') trash from media_files f where not f.probe_metadata ? 'purgedAt' and ((u.episode_id is not null and f.episode_id=u.episode_id) or (u.episode_id is null and f.installment_id=u.installment_id and f.episode_id is null))) c";
    Ok(Json(
        sqlx::query_scalar::<_, SqlJson<Value>>(sql)
            .bind(work)
            .bind(part)
            .bind(episodes)
            .fetch_one(&state.pool)
            .await?
            .0,
    ))
}
async fn coverage(
    State(state): State<MediaState>,
    Query(input): Query<List>,
) -> Result<Json<Value>> {
    let (page, size) = input.pagination()?;
    let sql = "with units as (select i.title_id,i.id installment_id,e.id episode_id from installments i left join episodes e on e.installment_id=i.id where (i.kind!='season' or e.id is not null) and (exists(select 1 from titles t where t.id=i.title_id and t.playback_policy='files-only') or exists(select 1 from media_files managed left join episodes owned on owned.id=managed.episode_id where coalesce(managed.installment_id,owned.installment_id)=i.id and not managed.probe_metadata ? 'purgedAt'))), counts as (select u.title_id,count(*) expected,count(*) filter(where exists(select 1 from media_files f where ((u.episode_id is not null and f.episode_id=u.episode_id) or (u.episode_id is null and f.installment_id=u.installment_id and f.episode_id is null)) and f.availability='present' and not f.probe_metadata ? 'trash')) available from units u group by u.title_id), works as (select t.id,coalesce(t.title_ar,t.canonical_title) title,t.sort_title,coalesce(c.expected,0) expected,coalesce(c.available,0) available,(select count(*) from media_files f left join episodes e on e.id=f.episode_id join installments i on i.id=coalesce(f.installment_id,e.installment_id) where i.title_id=t.id and not f.probe_metadata ? 'purgedAt') files from titles t left join counts c on c.title_id=t.id where ($1::text is null or strpos(lower(t.canonical_title||' '||coalesce(t.title_ar,'')),lower($1))>0) and ($2::uuid is null or t.id=$2::uuid)), filtered as (select * from works where (files>0 or exists(select 1 from titles t where t.id=works.id and t.playback_policy='files-only')) and ($3!='missing' or expected>available)) select jsonb_build_object('items',coalesce((select jsonb_agg(item) from (select jsonb_build_object('workId',id,'workTitle',title,'expectedUnits',expected,'availableUnits',available,'missingUnits',expected-available,'fileCount',files) item from filtered order by sort_title,id limit $4 offset $5) page),'[]'::jsonb),'total',(select count(*) from filtered),'page',$6::bigint,'pageSize',$4::bigint)";
    let result = sqlx::query_scalar::<_, SqlJson<Value>>(sql)
        .bind(input.q)
        .bind(input.work_id)
        .bind(input.media_state.as_deref().unwrap_or("all"))
        .bind(size)
        .bind((page - 1) * size)
        .bind(page)
        .fetch_one(&state.pool)
        .await?
        .0;
    Ok(Json(result))
}
async fn files(
    State(state): State<MediaState>,
    Path(id): Path<String>,
    Extension(user): Extension<User>,
) -> Result<Json<Value>> {
    storage::uuid(&id)?;
    let sql = format!(
        "select coalesce(jsonb_agg({FILE_JSON} order by i.position,e.position,f.id),'[]'::jsonb) {FILE_FROM} where not f.probe_metadata ? 'purgedAt' and t.id=$1::uuid and ($2 or (not t.is_private and t.workflow_status in ('draft','published')))"
    );
    Ok(Json(
        sqlx::query_scalar::<_, SqlJson<Value>>(sqlx::AssertSqlSafe(sql))
            .bind(id)
            .bind(user.is_admin)
            .fetch_one(&state.pool)
            .await?
            .0,
    ))
}
async fn content(
    State(state): State<MediaState>,
    Path(id): Path<String>,
    Extension(user): Extension<User>,
    request: Request,
) -> Result<Response> {
    storage::uuid(&id)?;
    let root = storage::root("NAHHASIO_LIBRARY_ROOT")?;
    let sql = format!(
        "select f.relative_path,f.byte_size {FILE_FROM} where f.id=$1::uuid and f.availability='present' and f.relative_path is not null and exists(select 1 from library_roots lr where lr.id=f.library_root_id and lr.path=$3 and lr.is_active) and ($2 or (not t.is_private and t.workflow_status in ('draft','published')))"
    );
    let row = sqlx::query(sqlx::AssertSqlSafe(sql))
        .bind(id)
        .bind(user.is_admin)
        .bind(root.to_str().ok_or_else(storage::invalid)?)
        .fetch_optional(&state.pool)
        .await?
        .ok_or(Error(StatusCode::NOT_FOUND, "Media is unavailable"))?;
    let path = storage::existing(&root, row.get::<String, _>("relative_path").as_str()).await?;
    let metadata = tokio::fs::metadata(&path)
        .await
        .map_err(|_| storage::unavailable())?;
    if !metadata.is_file()
        || metadata.len() == 0
        || row
            .get::<Option<i64>, _>("byte_size")
            .is_some_and(|s| s < 0 || s as u64 != metadata.len())
    {
        return Err(Error(
            StatusCode::CONFLICT,
            "Media changed; administrator verification is required",
        ));
    }
    let response = ServeFile::new(path)
        .oneshot(request.map(|_| Body::empty()))
        .await
        .map_err(|_| storage::unavailable())?;
    Ok(response.map(Body::new))
}
async fn subtitle(
    State(state): State<MediaState>,
    Path((id, index)): Path<(String, usize)>,
    Extension(user): Extension<User>,
    request: Request,
) -> Result<Response> {
    storage::uuid(&id)?;
    let root = storage::root("NAHHASIO_LIBRARY_ROOT")?;
    let sql = format!(
        "select f.probe_metadata {FILE_FROM} where f.id=$1::uuid and f.availability='present' and not f.probe_metadata ? 'trash' and exists(select 1 from library_roots lr where lr.id=f.library_root_id and lr.path=$3 and lr.is_active) and ($2 or (not t.is_private and t.workflow_status in ('draft','published')))"
    );
    let metadata = sqlx::query_scalar::<_, SqlJson<Value>>(sqlx::AssertSqlSafe(sql))
        .bind(id)
        .bind(user.is_admin)
        .bind(root.to_str().ok_or_else(storage::invalid)?)
        .fetch_optional(&state.pool)
        .await?
        .ok_or(Error(StatusCode::NOT_FOUND, "Subtitle is unavailable"))?
        .0;
    let files = sidecars::decode(&metadata).map_err(|_| storage::invalid())?;
    let file = files
        .get(index)
        .ok_or(Error(StatusCode::NOT_FOUND, "Subtitle is unavailable"))?;
    let path = file.checked(&root).await.map_err(|_| {
        Error(
            StatusCode::CONFLICT,
            "Subtitle changed; administrator verification is required",
        )
    })?;
    let response = ServeFile::new(path)
        .oneshot(request.map(|_| Body::empty()))
        .await
        .map_err(|_| storage::unavailable())?;
    Ok(response.map(Body::new))
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Incoming {
    relative_path: String,
    byte_size: u64,
    modified_seconds: u64,
}
async fn incoming(
    State(state): State<MediaState>,
    Query(input): Query<List>,
) -> Result<Json<Value>> {
    let (page, size) = input.pagination()?;
    let root = input.source_root.path()?;
    let input_folder = input.q.as_deref().unwrap_or("");
    if !input_folder.is_empty() {
        input.source_root.validate(input_folder)?;
    }
    let folder = input.q.as_deref().unwrap_or("");
    let path = if folder.is_empty() {
        root.clone()
    } else {
        storage::existing(&root, folder).await?
    };
    let mut entries = tokio::fs::read_dir(path)
        .await
        .map_err(|_| storage::unavailable())?;
    let registered: Vec<String> = sqlx::query_scalar("select relative_path from media_files f join library_roots r on r.id=f.library_root_id where r.path=$1 and not f.probe_metadata ? 'purgedAt' and relative_path is not null")
        .bind(root.to_str().ok_or_else(storage::invalid)?).fetch_all(&state.pool).await?;
    let registered: std::collections::HashSet<_> = registered.into_iter().collect();
    let mut candidates = Vec::new();
    let mut scanned = 0;
    while let Some(entry) = entries
        .next_entry()
        .await
        .map_err(|_| storage::unavailable())?
    {
        scanned += 1;
        if scanned > 100_000 {
            return Err(Error(
                StatusCode::CONFLICT,
                "Directory is too large; split it into subfolders",
            ));
        }
        let kind = entry
            .file_type()
            .await
            .map_err(|_| storage::unavailable())?;
        let rel = entry
            .path()
            .strip_prefix(&root)
            .map_err(|_| storage::invalid())?
            .to_string_lossy()
            .into_owned();
        if input.source_root.validate(&rel).is_err() {
            continue;
        }
        if kind.is_dir() {
            candidates.push((rel, None));
        } else if kind.is_file() && storage::video(&rel) {
            if registered.contains(&rel) {
                continue;
            }
            let stat = entry.metadata().await.map_err(|_| storage::unavailable())?;
            if stat.len() > 0 {
                candidates.push((
                    rel.clone(),
                    Some(Incoming {
                        relative_path: rel,
                        byte_size: stat.len(),
                        modified_seconds: stat
                            .modified()
                            .ok()
                            .and_then(|m| m.duration_since(std::time::UNIX_EPOCH).ok())
                            .map_or(0, |m| m.as_secs()),
                    }),
                ));
            }
        }
    }
    candidates.sort_by(|a, b| a.0.cmp(&b.0));
    let total = candidates.len();
    let mut files = Vec::new();
    let mut folders = Vec::new();
    for (rel, file) in candidates
        .into_iter()
        .skip(((page - 1) * size) as usize)
        .take(size as usize)
    {
        if let Some(file) = file {
            files.push(file);
        } else {
            folders.push(rel);
        }
    }
    Ok(Json(
        json!({"files":files,"folders":folders,"truncated":page*size<(total as i64),"total":total,"page":page,"pageSize":size}),
    ))
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct Item {
    #[serde(default)]
    pub source_root: storage::SourceRoot,
    pub relative_path: String,
    pub installment_id: String,
    pub episode_id: Option<String>,
    pub byte_size: u64,
    pub modified_seconds: u64,
    #[serde(default)]
    pub copy: bool,
    #[serde(default)]
    pub youtube_id: Option<String>,
    #[serde(default)]
    pub quality: Option<String>,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Enqueue {
    work_id: String,
    items: Vec<Item>,
    idempotency_key: String,
}
async fn enqueue(
    State(state): State<MediaState>,
    headers: HeaderMap,
    Json(input): Json<Enqueue>,
) -> Result<Json<Value>> {
    storage::uuid(&input.work_id)?;
    if input.items.is_empty()
        || input.items.len() > 500
        || input.idempotency_key.len() > 100
        || input.idempotency_key.is_empty()
    {
        return Err(storage::invalid());
    }
    let mut tx = state.pool.begin().await?;
    sqlx::query("set transaction read write")
        .execute(&mut *tx)
        .await?;
    let actor = crate::auth::lock_admin_session(&mut tx, &headers)
        .await
        .map_err(|_| Error(StatusCode::FORBIDDEN, "Administrator session expired"))?;
    let payload = json!({"workId":input.work_id,"items":input.items});
    // Serialize reservations for one work, including requests from different administrators.
    sqlx::query("select pg_advisory_xact_lock(23104,hashtext($1))")
        .bind(&input.work_id)
        .execute(&mut *tx)
        .await?;
    if let Some(existing) = sqlx::query("select id::text,payload from background_jobs where created_by_account_id=$1::uuid and type='media.import' and idempotency_key=$2")
        .bind(&actor).bind(&input.idempotency_key).fetch_optional(&mut *tx).await? {
        if existing.get::<SqlJson<Value>,_>("payload").0 != payload {
            return Err(Error(StatusCode::CONFLICT,"Request key belongs to a different import"));
        }
        return Ok(Json(json!({"id":existing.get::<String,_>("id")})));
    }
    let mut paths = std::collections::BTreeSet::new();
    let mut targets = std::collections::BTreeSet::new();
    for item in &input.items {
        item.source_root.validate(&item.relative_path)?;
        storage::uuid(&item.installment_id)?;
        if let Some(id) = &item.youtube_id {
            if item.source_root != storage::SourceRoot::Incoming
                || !youtube::video_id(id)
                || !matches!(item.quality.as_deref(), Some("720" | "1080" | "best"))
            {
                return Err(storage::invalid());
            }
        } else if !storage::video(&item.relative_path) || item.byte_size == 0 {
            return Err(storage::invalid());
        }
        if !paths.insert((format!("{:?}", item.source_root), &item.relative_path))
            || !targets.insert((&item.installment_id, &item.episode_id))
        {
            return Err(storage::invalid());
        }
        if let Some(id) = &item.episode_id {
            storage::uuid(id)?;
        }
    }
    for item in &input.items {
        let valid:bool=sqlx::query_scalar("select exists(select 1 from installments i where i.id=$1::uuid and i.title_id=$2::uuid and (($3::uuid is null and i.kind!='season') or exists(select 1 from episodes e where e.id=$3::uuid and e.installment_id=i.id)))").bind(&item.installment_id).bind(&input.work_id).bind(&item.episode_id).fetch_one(&mut *tx).await?;
        if !valid {
            return Err(storage::invalid());
        }
        if item.youtube_id.is_none() {
            let root = item.source_root.path()?;
            let registered:bool=sqlx::query_scalar("select exists(select 1 from media_files f join library_roots r on r.id=f.library_root_id where r.path=$1 and f.relative_path=$2 and not f.probe_metadata ? 'purgedAt')")
                .bind(root.to_str().ok_or_else(storage::invalid)?).bind(&item.relative_path).fetch_one(&mut *tx).await?;
            if registered {
                return Err(Error(
                    StatusCode::CONFLICT,
                    "Source is already registered; manage its existing file instead",
                ));
            }
        }
        let reserved:bool=sqlx::query_scalar("select exists(select 1 from background_jobs j cross join lateral jsonb_array_elements(j.payload->'items') item where j.type='media.import' and j.status in ('queued','running') and j.payload->>'workId'=$1 and ((item->>'installmentId'=$2 and item->'episodeId'=$3::jsonb) or (item->>'youtubeId'=$4 and $4 is not null) or (item->>'relativePath'=$5 and coalesce(item->>'sourceRoot','incoming')=$6)))")
            .bind(&input.work_id).bind(&item.installment_id).bind(SqlJson(&item.episode_id)).bind(&item.youtube_id).bind(&item.relative_path).bind(match item.source_root {storage::SourceRoot::Incoming=>"incoming",storage::SourceRoot::Library=>"library"}).fetch_one(&mut *tx).await?;
        if reserved {
            return Err(Error(
                StatusCode::CONFLICT,
                "An active import already includes this source or episode; inspect its job",
            ));
        }
    }
    let id:String=sqlx::query_scalar("insert into background_jobs(created_by_account_id,type,payload,idempotency_key) values($1::uuid,'media.import',$2,$3) on conflict do nothing returning id::text").bind(&actor).bind(SqlJson(&payload)).bind(&input.idempotency_key).fetch_optional(&mut *tx).await?.ok_or(Error(StatusCode::CONFLICT,"Import already queued; reload jobs"))?;
    sqlx::query("insert into audit_logs(actor_account_id,action,target_type,target_id,summary) values($1::uuid,'media.import.queued','background_jobs',$2,'Reviewed server media import')").bind(actor).bind(&id).execute(&mut *tx).await?;
    tx.commit().await?;
    Ok(Json(json!({"id":id})))
}
async fn jobs(State(state): State<MediaState>, Query(input): Query<List>) -> Result<Json<Value>> {
    let (page, size) = input.pagination()?;
    let value=sqlx::query_scalar::<_,SqlJson<Value>>("select coalesce(jsonb_agg(item),'[]'::jsonb) from (select jsonb_build_object('id',id,'type',type,'status',status,'progress',progress,'result',result,'error',error,'label',coalesce((select coalesce(t.title_ar,t.canonical_title) from titles t where t.id::text=payload->>'workId'),payload->>'name',case type when 'media.youtube.preview' then 'معاينة YouTube' when 'media.upload.verify' then 'التحقق من فيديو مرفوع' when 'media.file' then 'إجراء على ملف' else 'وسائط' end),'createdAt',created_at,'cancelRequested',cancel_requested_at is not null) item from background_jobs where type like 'media.%' order by created_at desc,id limit $1 offset $2) page").bind(size).bind((page-1)*size).fetch_one(&state.pool).await?.0;
    Ok(Json(value))
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Control {
    action: String,
}
async fn control(
    State(state): State<MediaState>,
    Path(id): Path<String>,
    headers: HeaderMap,
    Json(input): Json<Control>,
) -> Result<Json<Value>> {
    storage::uuid(&id)?;
    if !matches!(input.action.as_str(), "cancel" | "retry") {
        return Err(storage::invalid());
    }
    let mut tx = state.pool.begin().await?;
    sqlx::query("set transaction read write")
        .execute(&mut *tx)
        .await?;
    let actor = crate::auth::lock_admin_session(&mut tx, &headers)
        .await
        .map_err(|_| Error(StatusCode::FORBIDDEN, "Administrator session expired"))?;
    let changed = if input.action == "cancel" {
        sqlx::query("update background_jobs set cancel_requested_at=now(),status=case when status='queued' then 'cancelled'::background_job_status else status end,updated_at=now() where id=$1::uuid and type in ('media.import','media.youtube.preview','media.file','media.upload','media.upload.verify') and status in ('queued','running')").bind(&id).execute(&mut *tx).await?
    } else {
        sqlx::query("update background_jobs set status='queued',attempts=0,error=null,cancel_requested_at=null,lease_owner=null,lease_expires_at=null,updated_at=now() where id=$1::uuid and type in ('media.import','media.youtube.preview','media.file','media.upload','media.upload.verify') and status in ('failed','cancelled')").bind(&id).execute(&mut *tx).await?
    };
    if changed.rows_affected() != 1 {
        return Err(Error(
            StatusCode::CONFLICT,
            "Job state changed; reload jobs",
        ));
    }
    sqlx::query("insert into audit_logs(actor_account_id,action,target_type,target_id,summary) values($1::uuid,$2,'background_jobs',$3,'Media job control')").bind(actor).bind(format!("media.job.{}",input.action)).bind(id).execute(&mut *tx).await?;
    tx.commit().await?;
    Ok(Json(json!({"ok":true})))
}
