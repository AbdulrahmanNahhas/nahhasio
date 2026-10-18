//! Core work documents. Child relations and identity/ownership columns are never replaced.
use super::Error;
use crate::auth::User;
use axum::response::IntoResponse;
use axum::{
    Extension, Json, Router,
    extract::{DefaultBodyLimit, Path, State},
    http::{HeaderMap, StatusCode},
    middleware,
    routing::{get, post},
};
use hmac::{Hmac, KeyInit, Mac};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use sqlx::{AssertSqlSafe, PgPool, Postgres, Transaction, types::Json as SqlJson};
use std::{
    collections::HashSet,
    sync::Arc,
    time::{SystemTime, UNIX_EPOCH},
};

#[derive(Clone)]
struct EditorState {
    pool: PgPool,
    secret: Arc<[u8; 32]>,
}
pub(super) fn routes(pool: PgPool) -> Router {
    let mut secret = [0; 32];
    getrandom::fill(&mut secret)
        .expect("Operating system randomness is required for review signing");
    Router::new()
        .route("/api/v1/admin/works/{id}", get(read))
        .route("/api/v1/admin/works/read", post(read_many))
        .route("/api/v1/admin/works/review", post(review))
        .route("/api/v1/admin/works/save", post(save))
        .route_layer(middleware::from_fn_with_state(
            pool.clone(),
            crate::auth::require_admin,
        ))
        .layer(DefaultBodyLimit::max(4 * 1024 * 1024))
        .layer(middleware::from_fn(super::no_store))
        .with_state(EditorState {
            pool,
            secret: Arc::new(secret),
        })
}
// Server-owned column mapping: no caller column names, IDs or arbitrary SQL.
const FIELDS: &[(&str, &str)] = &[
    ("canonicalTitle", "canonical_title"),
    ("sortTitle", "sort_title"),
    ("titleAr", "title_ar"),
    ("summary", "summary"),
    ("contentWarnings", "content_warnings"),
    ("analysisNotes", "analysis_notes"),
    ("curatorNotes", "curator_notes"),
    ("releaseYear", "release_year"),
    ("format", "format"),
    ("workflow", "workflow_status"),
    ("isPrivate", "is_private"),
    ("audience", "audience"),
    ("age", "age"),
    ("sexualityRisk", "sexuality_risk"),
    ("behavioralRisk", "behavioral_risk"),
    ("theologyRisk", "theology_risk"),
];
#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Fields {
    canonical_title: String,
    sort_title: String,
    #[serde(deserialize_with = "required_nullable")]
    title_ar: Option<String>,
    summary: String,
    #[serde(deserialize_with = "required_nullable")]
    content_warnings: Option<String>,
    #[serde(deserialize_with = "required_nullable")]
    analysis_notes: Option<String>,
    curator_notes: String,
    #[serde(deserialize_with = "required_nullable")]
    release_year: Option<i32>,
    format: String,
    workflow: String,
    is_private: bool,
    audience: String,
    age: String,
    sexuality_risk: String,
    behavioral_risk: String,
    theology_risk: String,
}
fn required_nullable<'de, D, T>(deserializer: D) -> Result<Option<T>, D::Error>
where
    D: serde::Deserializer<'de>,
    T: Deserialize<'de>,
{
    Option::<T>::deserialize(deserializer)
}
impl Fields {
    fn validate(&self) -> Result<(), Error> {
        if self.canonical_title.trim().is_empty()
            || self.sort_title.trim().is_empty()
            || [&self.canonical_title, &self.sort_title]
                .iter()
                .any(|v| v.chars().count() > 1000)
            || self
                .title_ar
                .as_ref()
                .is_some_and(|v| v.chars().count() > 1000)
            || self.summary.chars().count() > 100_000
            || self.curator_notes.chars().count() > 100_000
            || [&self.content_warnings, &self.analysis_notes]
                .iter()
                .any(|v| v.as_ref().is_some_and(|s| s.chars().count() > 100_000))
            || self.release_year.is_some_and(|v| !(1..=9999).contains(&v))
            || !["animated", "live-action"].contains(&self.format.as_str())
            || !["draft", "in_review", "approved", "published", "archived"]
                .contains(&self.workflow.as_str())
            || !["general", "teen", "young-adult", "adult"].contains(&self.audience.as_str())
            || !["all", "7+", "10+", "13+", "16+", "18+"].contains(&self.age.as_str())
            || [
                &self.sexuality_risk,
                &self.behavioral_risk,
                &self.theology_risk,
            ]
            .iter()
            .any(|v| !["none", "low", "medium", "high"].contains(&v.as_str()))
        {
            return Err(Error(
                StatusCode::BAD_REQUEST,
                "تحقق من العناوين والسنة وقيم التصنيف وحدود النصوص.",
            ));
        }
        Ok(())
    }
}
#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Draft {
    id: String,
    revision: String,
    fields: Fields,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Document {
    id: String,
    revision: String,
    fields: Fields,
    poster_id: Option<String>,
    installment_count: i64,
    episode_count: i64,
}
#[derive(Serialize)]
struct DocumentList {
    documents: Vec<Document>,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct ReadRequest {
    ids: Vec<String>,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct ReviewRequest {
    documents: Vec<Draft>,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct SaveRequest {
    documents: Vec<Draft>,
    ticket: String,
}
#[derive(Serialize)]
struct Change {
    field: String,
    before: String,
    after: String,
}
#[derive(Serialize)]
struct Reviewed {
    id: String,
    revision: String,
    fields: Fields,
    changes: Vec<Change>,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Review {
    documents: Vec<Reviewed>,
    ticket: String,
    expires_at: u64,
}
#[derive(Serialize)]
struct Saved {
    saved: usize,
    documents: Vec<Document>,
}
fn identifier(id: &str) -> Result<(), Error> {
    if id.len() != 36
        || !id.bytes().enumerate().all(|(i, c)| {
            if [8, 13, 18, 23].contains(&i) {
                c == b'-'
            } else {
                c.is_ascii_hexdigit()
            }
        })
    {
        return Err(Error(StatusCode::BAD_REQUEST, "معرّف العمل غير صالح."));
    }
    Ok(())
}
fn ids_valid(ids: &[String]) -> Result<(), Error> {
    if ids.is_empty()
        || ids
            .iter()
            .map(|id| id.to_ascii_lowercase())
            .collect::<HashSet<_>>()
            .len()
            != ids.len()
    {
        return Err(Error(
            StatusCode::BAD_REQUEST,
            "اختر عملًا واحدًا أو أكثر دون تكرار.",
        ));
    }
    for id in ids {
        identifier(id)?;
    }
    Ok(())
}
fn drafts_valid(documents: &mut [Draft]) -> Result<(), Error> {
    ids_valid(&documents.iter().map(|d| d.id.clone()).collect::<Vec<_>>())?;
    for d in documents.iter() {
        d.fields.validate()?;
        if d.revision.len() != 64 || !d.revision.bytes().all(|c| c.is_ascii_hexdigit()) {
            return Err(Error(
                StatusCode::BAD_REQUEST,
                "نسخة العمل غير صالحة؛ أعد تحميله.",
            ));
        }
    }
    documents.sort_by(|a, b| a.id.cmp(&b.id));
    Ok(())
}
fn revision(row: &Value) -> String {
    hex::encode(Sha256::digest(row.to_string().as_bytes()))
}
fn fields(row: &Value) -> Result<Fields, Error> {
    let object = FIELDS
        .iter()
        .map(|(key, column)| ((*key).to_owned(), row[*column].clone()))
        .collect::<serde_json::Map<_, _>>();
    serde_json::from_value(Value::Object(object))
        .map_err(|_| Error(StatusCode::INTERNAL_SERVER_ERROR, "تعذّر قراءة حقول العمل."))
}
async fn row(
    transaction: &mut Transaction<'_, Postgres>,
    id: &str,
    lock: bool,
) -> Result<Value, Error> {
    let query = if lock {
        "SELECT to_jsonb(t) FROM titles t WHERE id=$1::uuid FOR UPDATE"
    } else {
        "SELECT to_jsonb(t) FROM titles t WHERE id=$1::uuid"
    };
    sqlx::query_scalar::<_, SqlJson<Value>>(query)
        .bind(id)
        .fetch_optional(&mut **transaction)
        .await?
        .map(|v| v.0)
        .ok_or(Error(StatusCode::NOT_FOUND, "العمل غير موجود."))
}
async fn document(
    transaction: &mut Transaction<'_, Postgres>,
    id: &str,
    row: &Value,
) -> Result<Document, Error> {
    let (poster_id,installment_count,episode_count): (Option<String>,i64,i64) = sqlx::query_as("SELECT (SELECT asset_id::text FROM media_asset_assignments WHERE title_id=$1::uuid AND role='poster' ORDER BY is_primary DESC,id LIMIT 1),(SELECT count(*) FROM installments WHERE title_id=$1::uuid),(SELECT count(*) FROM episodes e JOIN installments i ON i.id=e.installment_id WHERE i.title_id=$1::uuid)").bind(id).fetch_one(&mut **transaction).await?;
    Ok(Document {
        id: id.to_owned(),
        revision: revision(row),
        fields: fields(row)?,
        poster_id,
        installment_count,
        episode_count,
    })
}
async fn read(
    State(state): State<EditorState>,
    Path(id): Path<String>,
) -> Result<Json<Document>, Error> {
    identifier(&id)?;
    let mut tx = state.pool.begin().await?;
    sqlx::query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ")
        .execute(&mut *tx)
        .await?;
    let row = row(&mut tx, &id, false).await?;
    let document = document(&mut tx, &id, &row).await?;
    tx.commit().await?;
    Ok(Json(document))
}
async fn read_many(
    State(state): State<EditorState>,
    Json(input): Json<ReadRequest>,
) -> Result<Json<DocumentList>, Error> {
    ids_valid(&input.ids)?;
    let mut tx = state.pool.begin().await?;
    sqlx::query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ")
        .execute(&mut *tx)
        .await?;
    let mut output = Vec::new();
    for id in input.ids {
        let row = row(&mut tx, &id, false).await?;
        output.push(document(&mut tx, &id, &row).await?);
    }
    tx.commit().await?;
    Ok(Json(DocumentList { documents: output }))
}
fn now() -> Result<u64, Error> {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .map_err(|_| Error(StatusCode::SERVICE_UNAVAILABLE, "ساعة الخادم غير صالحة."))
}
fn signature(
    state: &EditorState,
    actor: &str,
    documents: &[Draft],
    expires: u64,
) -> Result<Hmac<Sha256>, Error> {
    let mut mac = Hmac::<Sha256>::new_from_slice(state.secret.as_ref())
        .expect("HMAC accepts a fixed 32-byte key");
    let payload = serde_json::to_vec(&(actor, documents, expires))
        .map_err(|_| Error(StatusCode::BAD_REQUEST, "تعذّر توقيع المراجعة."))?;
    mac.update(&payload);
    Ok(mac)
}
fn changes(before: &Fields, after: &Fields) -> Vec<Change> {
    let before = serde_json::to_value(before).expect("Fields are JSON-serializable");
    let after = serde_json::to_value(after).expect("Fields are JSON-serializable");
    let display = |value: &Value| match value {
        Value::String(s) => s.clone(),
        Value::Null => "—".into(),
        v => v.to_string(),
    };
    FIELDS
        .iter()
        .filter(|(key, _)| before[*key] != after[*key])
        .map(|(key, _)| Change {
            field: (*key).to_owned(),
            before: display(&before[*key]),
            after: display(&after[*key]),
        })
        .collect()
}
async fn review(
    State(state): State<EditorState>,
    Extension(user): Extension<User>,
    Json(mut input): Json<ReviewRequest>,
) -> Result<Json<Review>, Error> {
    drafts_valid(&mut input.documents)?;
    let mut tx = state.pool.begin().await?;
    sqlx::query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ")
        .execute(&mut *tx)
        .await?;
    let mut output = Vec::new();
    for draft in &input.documents {
        let row = row(&mut tx, &draft.id, false).await?;
        if revision(&row) != draft.revision {
            return Err(Error(
                StatusCode::CONFLICT,
                "تغيّر عمل منذ تحميله. أعد التحميل قبل المراجعة.",
            ));
        }
        output.push(Reviewed {
            id: draft.id.clone(),
            revision: draft.revision.clone(),
            fields: draft.fields.clone(),
            changes: changes(&fields(&row)?, &draft.fields),
        });
    }
    if output.iter().all(|d| d.changes.is_empty()) {
        return Err(Error(StatusCode::BAD_REQUEST, "لا توجد تغييرات للمراجعة."));
    }
    tx.commit().await?;
    let expires_at = now()? + 600;
    let ticket = format!(
        "{}.{}",
        expires_at,
        hex::encode(
            signature(&state, &user.account_id, &input.documents, expires_at)?
                .finalize()
                .into_bytes()
        )
    );
    Ok(Json(Review {
        documents: output,
        ticket,
        expires_at,
    }))
}
async fn save(
    State(state): State<EditorState>,
    headers: HeaderMap,
    Json(mut input): Json<SaveRequest>,
) -> Result<Json<Saved>, Error> {
    drafts_valid(&mut input.documents)?;
    if input.ticket.len() > 100 {
        return Err(Error(StatusCode::BAD_REQUEST, "المراجعة غير صالحة."));
    }
    let (expiry, code) = input
        .ticket
        .split_once('.')
        .ok_or(Error(StatusCode::BAD_REQUEST, "المراجعة غير صالحة."))?;
    let expires = expiry
        .parse::<u64>()
        .map_err(|_| Error(StatusCode::BAD_REQUEST, "المراجعة غير صالحة."))?;
    let current_time = now()?;
    if expires < current_time || expires > current_time + 600 {
        return Err(Error(
            StatusCode::CONFLICT,
            "انتهت المراجعة. أعد مراجعة التغييرات.",
        ));
    }
    let code =
        hex::decode(code).map_err(|_| Error(StatusCode::BAD_REQUEST, "المراجعة غير صالحة."))?;
    let mut tx = state.pool.begin().await?;
    sqlx::query("SET TRANSACTION READ WRITE")
        .execute(&mut *tx)
        .await?;
    let actor = crate::auth::lock_admin_session(&mut tx, &headers)
        .await
        .map_err(|error| {
            Error(
                error.into_response().status(),
                "تعذّر تأكيد صلاحيات الجلسة؛ لم تُحفظ أي تغييرات.",
            )
        })?;
    signature(&state, &actor, &input.documents, expires)?
        .verify_slice(&code)
        .map_err(|_| {
            Error(
                StatusCode::CONFLICT,
                "تغيّرت المسودة بعد المراجعة. أعد مراجعتها.",
            )
        })?;
    let mut originals = Vec::new();
    for draft in &input.documents {
        let current = row(&mut tx, &draft.id, true).await?;
        if revision(&current) != draft.revision {
            return Err(Error(
                StatusCode::CONFLICT,
                "تغيّر عمل بعد المراجعة؛ لم تُحفظ أي تغييرات.",
            ));
        }
        originals.push(current);
    }
    let assignments = FIELDS
        .iter()
        .map(|(_, column)| format!("{column}=v.{column}"))
        .collect::<Vec<_>>()
        .join(",");
    let query = format!(
        "UPDATE titles t SET {assignments},updated_at=greatest(clock_timestamp(),t.updated_at+interval '1 microsecond') FROM jsonb_populate_record(NULL::titles,$2::jsonb) v WHERE t.id=$1::uuid RETURNING to_jsonb(t)"
    );
    let mut output = Vec::new();
    let mut saved = 0;
    for (draft, before) in input.documents.iter().zip(originals) {
        let previous = fields(&before)?;
        if changes(&previous, &draft.fields).is_empty() {
            output.push(document(&mut tx, &draft.id, &before).await?);
            continue;
        }
        let camel = serde_json::to_value(&draft.fields).expect("Fields are JSON-serializable");
        let snake = Value::Object(
            FIELDS
                .iter()
                .map(|(key, column)| ((*column).to_owned(), camel[*key].clone()))
                .collect(),
        );
        let after = sqlx::query_scalar::<_, SqlJson<Value>>(AssertSqlSafe(query.clone()))
            .bind(&draft.id)
            .bind(SqlJson(snake))
            .fetch_one(&mut *tx)
            .await?
            .0;
        let diff = json!({"before":before,"after":after});
        sqlx::query("INSERT INTO audit_logs(actor_account_id,action,target_type,target_id,summary,changes) VALUES($1::uuid,'admin.work.update','titles',$2,'Desktop work editor',$3)").bind(&actor).bind(&draft.id).bind(SqlJson(&diff)).execute(&mut *tx).await?;
        sqlx::query("INSERT INTO editorial_revisions(actor_account_id,entity_type,entity_id,revision,action,summary,snapshot,changes) SELECT $1::uuid,'titles',$2,coalesce(max(revision),0)+1,'update','Desktop work editor',$3,$4 FROM editorial_revisions WHERE entity_type='titles' AND entity_id=$2").bind(&actor).bind(&draft.id).bind(SqlJson(&after)).bind(SqlJson(&diff)).execute(&mut *tx).await?;
        output.push(document(&mut tx, &draft.id, &after).await?);
        saved += 1;
    }
    tx.commit().await?;
    Ok(Json(Saved {
        saved,
        documents: output,
    }))
}

#[cfg(test)]
mod selection_tests {
    #[test]
    fn accepts_more_than_thirty_unique_work_ids_and_still_rejects_duplicates() {
        let mut ids = (1..=75)
            .map(|index| format!("00000000-0000-4000-8000-{index:012}"))
            .collect::<Vec<_>>();
        assert!(super::ids_valid(&ids).is_ok());
        ids.push(ids[0].clone());
        assert!(super::ids_valid(&ids).is_err());
    }
}
