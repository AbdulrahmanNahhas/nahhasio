//! Dated episodes and movies with account-scoped state and bounded pagination.
use super::{ApiError, ApiResult, home};
use crate::auth::User;
use axum::{
    Extension, Json,
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
    watch_state: Option<String>,
    include_private: Option<bool>,
    include_movies: Option<bool>,
    kind: Option<String>,
    visibility: Option<String>,
    q: Option<String>,
}
pub(super) async fn list(
    State(pool): State<PgPool>,
    Extension(user): Extension<User>,
    Query(input): Query<Input>,
) -> ApiResult<Json<Value>> {
    let page = input.page.unwrap_or(1);
    let size = input.page_size.unwrap_or(36);
    let watched = input.watch_state.as_deref().unwrap_or("all");
    let kind = input
        .kind
        .as_deref()
        .unwrap_or(if input.include_movies.unwrap_or(false) {
            "all"
        } else {
            "episodes"
        });
    let visibility =
        input
            .visibility
            .as_deref()
            .unwrap_or(if input.include_private.unwrap_or(false) {
                "all"
            } else {
                "public"
            });
    let private = visibility != "public";
    if private && !user.is_admin {
        return Err(ApiError(
            StatusCode::FORBIDDEN,
            "Private catalog requires administrator permission",
        ));
    }
    if !(1..=100_000).contains(&page)
        || !(1..=100).contains(&size)
        || !matches!(watched, "all" | "watched" | "unwatched")
        || !matches!(kind, "all" | "movies" | "episodes")
        || !matches!(visibility, "all" | "private" | "public")
        || input.q.as_ref().is_some_and(|q| q.chars().count() > 200)
    {
        return Err(ApiError(
            StatusCode::BAD_REQUEST,
            "Invalid episode pagination",
        ));
    }
    // Page and total share the same joins and predicate, including account-scoped watched state.
    let from = "from (select id,installment_id,id episode_id,release_date,position from episodes where $8::boolean and release_date<=current_date union all select id,id installment_id,null::uuid episode_id,release_date,0 position from installments where $7::boolean and kind='movie' and release_date<=current_date) released join installments i on i.id=released.installment_id join titles t on t.id=i.title_id left join episodes e on e.id=released.episode_id left join account_playback_states ps on ps.account_id=(select id from accounts where auth_user_id=$1 and status='active') and ps.installment_id=i.id and ps.episode_id is not distinct from released.episode_id";
    let condition = "($4::boolean or (not t.is_private and t.workflow_status='published')) and (not $9::boolean or t.is_private) and ($5='all' or coalesce(ps.is_played,false)=($5='watched')) and ($6::text is null or strpos(lower(t.canonical_title||' '||coalesce(t.title_ar,'')||' '||coalesce(e.title,'')||' '||i.title),lower($6))>0)";
    let query = format!(
        r#"select jsonb_build_object('items',coalesce((select jsonb_agg(item order by release_date desc,work_title,installment_position,episode_position,id) from (
select released.id,released.release_date,t.sort_title work_title,i.position installment_position,released.position episode_position,{item} item
{from} where {condition}
order by released.release_date desc,t.sort_title,i.position,released.position,released.id limit $2 offset $3) entries),'[]'::jsonb),
'total',(select count(*) {from} where {condition}),
'page',{page},'pageSize',{size})"#,
        item = home::viewing_item(true)
    );
    let response = sqlx::query_scalar::<_, SqlJson<Value>>(AssertSqlSafe(query))
        .bind(&user.id)
        .bind(size)
        .bind((page - 1) * size)
        .bind(private)
        .bind(watched)
        .bind(input.q.as_deref().map(str::trim).filter(|q| !q.is_empty()))
        .bind(kind != "episodes")
        .bind(kind != "movies")
        .bind(visibility == "private")
        .fetch_one(&pool)
        .await?
        .0;
    Ok(Json(response))
}
