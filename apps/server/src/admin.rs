//! Session-authorized administration. The legacy local database token is not a client credential.
mod editor;
mod full_editor;
mod inspection;
mod server;
use axum::{
    Json, Router,
    extract::{Query, State, rejection::QueryRejection},
    http::{StatusCode, header},
    middleware,
    response::{IntoResponse, Response},
    routing::get,
};
use serde::Deserialize;
use serde_json::{Value, json};
use sqlx::{AssertSqlSafe, PgPool, types::Json as SqlJson};

pub fn routes(pool: PgPool) -> Router {
    Router::new()
        .route("/api/v1/admin/works", get(works))
        .route("/api/v1/admin/works/selection", get(work_selection))
        .route_layer(middleware::from_fn_with_state(
            pool.clone(),
            crate::auth::require_admin,
        ))
        .layer(middleware::from_fn(no_store))
        .with_state(pool.clone())
        .merge(editor::routes(pool.clone()))
        .merge(full_editor::routes(pool.clone()))
        .merge(inspection::routes(pool.clone()))
        .merge(server::routes(pool))
}
async fn no_store(request: axum::extract::Request, next: middleware::Next) -> Response {
    let mut response = next.run(request).await;
    response.headers_mut().insert(
        header::CACHE_CONTROL,
        axum::http::HeaderValue::from_static("no-store"),
    );
    response
}
struct Error(StatusCode, &'static str);
impl IntoResponse for Error {
    fn into_response(self) -> Response {
        (self.0, Json(json!({"message":self.1}))).into_response()
    }
}
impl From<sqlx::Error> for Error {
    fn from(error: sqlx::Error) -> Self {
        tracing::warn!(code=?error.as_database_error().and_then(|value| value.code()), "admin query failed");
        let code = error.as_database_error().and_then(|value| value.code());
        match code.as_deref() {
            Some("23505" | "40001" | "40P01") => Self(
                StatusCode::CONFLICT,
                "تعارضت البيانات؛ أعد تحميل العمل ومراجعة التغييرات.",
            ),
            Some("23514" | "23502" | "23503" | "22P02" | "22P05" | "22021" | "22001") => Self(
                StatusCode::BAD_REQUEST,
                "البيانات لا تطابق قيود المكتبة؛ لم تُحفظ أي تغييرات.",
            ),
            _ => Self(
                StatusCode::SERVICE_UNAVAILABLE,
                "Administration is temporarily unavailable",
            ),
        }
    }
}
#[derive(Default, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct WorksQuery {
    page: Option<i64>,
    page_size: Option<i64>,
    q: Option<String>,
    format: Option<String>,
    structure: Option<String>,
    workflow: Option<String>,
    visibility: Option<String>,
    gap: Option<String>,
    sort: Option<String>,
}
impl WorksQuery {
    fn validate(&self) -> Result<(i64, i64, &'static str), Error> {
        let page = self.page.unwrap_or(1);
        let size = self.page_size.unwrap_or(30);
        let choice = |value: &Option<String>, allowed: &[&str]| {
            value.as_deref().is_none_or(|v| allowed.contains(&v))
        };
        if !(1..=100_000).contains(&page)
            || !(1..=100).contains(&size)
            || self.q.as_ref().is_some_and(|q| q.chars().count() > 200)
            || !choice(&self.format, &["animated", "live-action"])
            || !choice(&self.structure, &["movie", "series"])
            || !choice(
                &self.workflow,
                &["draft", "in_review", "approved", "published", "archived"],
            )
            || !choice(&self.visibility, &["public", "private"])
            || !choice(
                &self.gap,
                &[
                    "poster",
                    "summary",
                    "arabic-name",
                    "structure",
                    "banner",
                    "logo",
                    "trailers",
                    "scores",
                    "genres",
                    "planet",
                    "credits",
                    "episode-images",
                ],
            )
        {
            return Err(Error(
                StatusCode::BAD_REQUEST,
                "Invalid administration filters",
            ));
        }
        let order = match self.sort.as_deref().unwrap_or("updated") {
            "updated" => "t.updated_at DESC,t.id",
            "title" => "t.sort_title,t.id",
            "added" => "t.created_at DESC,t.id",
            "installments-desc" => {
                "(SELECT count(*) FROM installments i WHERE i.title_id=t.id) DESC,t.sort_title,t.id"
            }
            "episodes-desc" => {
                "(SELECT count(*) FROM episodes e JOIN installments i ON i.id=e.installment_id WHERE i.title_id=t.id) DESC,t.sort_title,t.id"
            }
            "year-desc" => "t.release_year DESC NULLS LAST,t.sort_title,t.id",
            "year-asc" => "t.release_year ASC NULLS LAST,t.sort_title,t.id",
            _ => {
                return Err(Error(
                    StatusCode::BAD_REQUEST,
                    "Invalid administration sort",
                ));
            }
        };
        Ok((page, size, order))
    }
}
// Parameters are bound; only the validated fixed sort fragment is interpolated.
const FILTER: &str = r#"
($1::text IS NULL OR strpos(lower(t.canonical_title),lower($1))>0 OR strpos(lower(coalesce(t.title_ar,'')),lower($1))>0 OR EXISTS(SELECT 1 FROM title_aliases a WHERE a.title_id=t.id AND strpos(lower(a.title),lower($1))>0))
AND ($2::text IS NULL OR t.format::text=$2)
AND ($3::text IS NULL OR ($3='series' AND EXISTS(SELECT 1 FROM installments i WHERE i.title_id=t.id AND i.kind='season')) OR ($3='movie' AND EXISTS(SELECT 1 FROM installments i WHERE i.title_id=t.id) AND NOT EXISTS(SELECT 1 FROM installments i WHERE i.title_id=t.id AND i.kind='season')))
AND ($4::text IS NULL OR t.workflow_status::text=$4)
AND ($5::text IS NULL OR t.is_private=($5='private'))
AND ($6::text IS NULL OR ($6='poster' AND NOT EXISTS(SELECT 1 FROM media_asset_assignments m WHERE m.title_id=t.id AND m.role='poster')) OR ($6='summary' AND trim(t.summary)='') OR ($6='arabic-name' AND trim(coalesce(t.title_ar,''))='') OR ($6='structure' AND NOT EXISTS(SELECT 1 FROM installments i WHERE i.title_id=t.id))
OR ($6='banner' AND NOT EXISTS(SELECT 1 FROM media_asset_assignments m WHERE m.title_id=t.id AND m.role='banner'))
OR ($6='logo' AND NOT EXISTS(SELECT 1 FROM media_asset_assignments m WHERE m.title_id=t.id AND m.role='logo'))
OR ($6='trailers' AND NOT EXISTS(SELECT 1 FROM title_trailers v WHERE v.title_id=t.id))
OR ($6='scores' AND EXISTS(SELECT 1 FROM installments i LEFT JOIN installment_scores s ON s.installment_id=i.id WHERE i.title_id=t.id AND (s.story IS NULL OR s.characters IS NULL OR s.depth IS NULL OR s.world_building IS NULL OR s.originality IS NULL OR s.craft IS NULL)))
OR ($6='genres' AND NOT EXISTS(SELECT 1 FROM title_genres g WHERE g.title_id=t.id))
OR ($6='planet' AND NOT EXISTS(SELECT 1 FROM title_planets p WHERE p.title_id=t.id))
OR ($6='credits' AND NOT EXISTS(SELECT 1 FROM contributions c WHERE c.title_id=t.id))
OR ($6='episode-images' AND EXISTS(SELECT 1 FROM installments i JOIN episodes e ON e.installment_id=i.id WHERE i.title_id=t.id AND NOT EXISTS(SELECT 1 FROM media_asset_assignments m WHERE m.episode_id=e.id AND m.role IN ('still','poster','banner')))))
"#;
async fn works(
    State(pool): State<PgPool>,
    input: Result<Query<WorksQuery>, QueryRejection>,
) -> Result<Json<Value>, Error> {
    let Query(input) =
        input.map_err(|_| Error(StatusCode::BAD_REQUEST, "Invalid administration query"))?;
    let (page, size, order) = input.validate()?;
    let query = format!(
        r#"WITH filtered AS (SELECT t.* FROM titles t WHERE {FILTER}), page_rows AS (
SELECT t.id, row_number() OVER(ORDER BY {order}) AS ordinal, jsonb_build_object(
'id',t.id,'canonicalTitle',t.canonical_title,'titleAr',t.title_ar,'releaseYear',t.release_year,
'format',t.format,'workflow',t.workflow_status,'isPrivate',t.is_private,
'updatedAt',t.updated_at,'verifiedAt',t.verified_at,
'isSeries',EXISTS(SELECT 1 FROM installments i WHERE i.title_id=t.id AND i.kind='season'),
'installmentCount',(SELECT count(*) FROM installments i WHERE i.title_id=t.id),
'episodeCount',(SELECT count(*) FROM episodes e JOIN installments i ON i.id=e.installment_id WHERE i.title_id=t.id),
'posterId',(SELECT m.asset_id FROM media_asset_assignments m WHERE m.title_id=t.id AND m.role='poster' ORDER BY m.is_primary DESC,m.id LIMIT 1)
) AS item FROM filtered t ORDER BY {order} LIMIT $8 OFFSET (($7-1)*$8))
SELECT jsonb_build_object('items',coalesce((SELECT jsonb_agg(item ORDER BY ordinal) FROM page_rows),'[]'::jsonb),'total',(SELECT count(*) FROM filtered),'page',$7::bigint,'pageSize',$8::bigint)"#
    );
    let value = sqlx::query_scalar::<_, SqlJson<Value>>(AssertSqlSafe(query))
        .bind(input.q.as_deref().map(str::trim).filter(|v| !v.is_empty()))
        .bind(input.format)
        .bind(input.structure)
        .bind(input.workflow)
        .bind(input.visibility)
        .bind(input.gap)
        .bind(page)
        .bind(size)
        .fetch_one(&pool)
        .await?;
    Ok(Json(value.0))
}

/// Explicit selection intent returns identity/labels only, using the same filters as the page.
async fn work_selection(
    State(pool): State<PgPool>,
    input: Result<Query<WorksQuery>, QueryRejection>,
) -> Result<Json<Value>, Error> {
    let Query(input) =
        input.map_err(|_| Error(StatusCode::BAD_REQUEST, "Invalid administration query"))?;
    let (_, _, order) = input.validate()?;
    let query = format!(
        "select coalesce(jsonb_agg(item order by ordinal),'[]'::jsonb) from (select row_number() over(order by {order}) ordinal,jsonb_build_object('id',t.id,'name',coalesce(nullif(trim(t.title_ar),''),t.canonical_title)) item from titles t where {FILTER}) selected"
    );
    let value = sqlx::query_scalar::<_, SqlJson<Value>>(AssertSqlSafe(query))
        .bind(input.q.as_deref().map(str::trim).filter(|v| !v.is_empty()))
        .bind(input.format)
        .bind(input.structure)
        .bind(input.workflow)
        .bind(input.visibility)
        .bind(input.gap)
        .fetch_one(&pool)
        .await?;
    Ok(Json(value.0))
}
