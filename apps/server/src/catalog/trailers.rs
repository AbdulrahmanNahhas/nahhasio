//! Searchable, bounded trailer discovery using registered YouTube references.
use super::{ApiError, ApiResult, queries};
use axum::{
    Json,
    extract::{Query, State},
    http::StatusCode,
};
use serde::Deserialize;
use serde_json::Value;
use sqlx::{AssertSqlSafe, PgPool, types::Json as SqlJson};

#[derive(Default, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct Input {
    page: Option<i64>,
    page_size: Option<i64>,
    q: Option<String>,
    format: Option<String>,
    sort: Option<String>,
}

pub(super) async fn list(
    State(pool): State<PgPool>,
    Query(input): Query<Input>,
) -> ApiResult<Json<Value>> {
    let page = input.page.unwrap_or(1);
    let size = input.page_size.unwrap_or(24);
    if !(1..=100_000).contains(&page)
        || !(1..=60).contains(&size)
        || input.q.as_ref().is_some_and(|v| v.chars().count() > 200)
        || input
            .format
            .as_deref()
            .is_some_and(|v| !matches!(v, "animated" | "live-action"))
    {
        return Err(ApiError(StatusCode::BAD_REQUEST, "Invalid trailer filters"));
    }
    let order = match input.sort.as_deref().unwrap_or("newest") {
        "newest" => "v.created_at desc,t.sort_title,v.position,v.id",
        "title" => "t.sort_title,v.position,v.id",
        _ => return Err(ApiError(StatusCode::BAD_REQUEST, "Invalid trailer sort")),
    };
    let filter = "not t.is_private and t.workflow_status in ('draft','published') and ($1::text is null or strpos(lower(t.canonical_title||' '||coalesce(t.title_ar,'')||' '||v.title),lower($1))>0 or exists(select 1 from title_aliases a where a.title_id=t.id and strpos(lower(a.title),lower($1))>0)) and ($2::text is null or t.format::text=$2)";
    let query = format!(
        r#"select jsonb_build_object('items',coalesce((select jsonb_agg(item order by ordinal) from (
select row_number() over(order by {order}) ordinal,jsonb_build_object('work',({summary}),'trailer',jsonb_build_object('id',v.id,'youtubeVideoId',v.youtube_video_id,'title',v.title,'language',v.language,'isPrimary',v.is_primary,'position',v.position)) item
from title_trailers v join titles t on t.id=v.title_id where {filter} order by {order} limit $3 offset $4) entries),'[]'::jsonb),
'total',(select count(*) from title_trailers v join titles t on t.id=v.title_id where {filter}),'page',$5::bigint,'pageSize',$3::bigint)"#,
        summary = queries::summary()
    );
    let result = sqlx::query_scalar::<_, SqlJson<Value>>(AssertSqlSafe(query))
        .bind(input.q.as_deref().map(str::trim).filter(|q| !q.is_empty()))
        .bind(input.format)
        .bind(size)
        .bind((page - 1) * size)
        .bind(page)
        .fetch_one(&pool)
        .await?;
    Ok(Json(result.0))
}
