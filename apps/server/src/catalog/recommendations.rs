//! Explainable catalog suggestions, without fabricated viewing history or popularity.
use super::{ApiResult, queries, tracking, validate_id};
use crate::auth::User;
use axum::{
    Extension, Json,
    extract::{Query, State},
};
use serde::Deserialize;
use serde_json::Value;
use sqlx::{AssertSqlSafe, PgPool, types::Json as SqlJson};
#[derive(Default, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct Input {
    work_id: Option<String>,
}
pub(super) async fn recommend(
    State(pool): State<PgPool>,
    Extension(user): Extension<User>,
    Query(input): Query<Input>,
) -> ApiResult<Json<Value>> {
    if let Some(id) = &input.work_id {
        validate_id(id)?;
        let query =
            include_str!("work_recommendations.sql").replace("{summary}", &queries::summary());
        let result = sqlx::query_scalar::<_, SqlJson<Value>>(AssertSqlSafe(query))
            .bind(id)
            .fetch_one(&pool)
            .await?;
        return Ok(Json(result.0));
    }
    Ok(Json(personal(&pool, &user.id).await?))
}

pub(super) async fn personal(pool: &PgPool, user_id: &str) -> ApiResult<Value> {
    let query = format!(
        r#"with seeds as(select t.id from titles t where not t.is_private and t.workflow_status in ('draft','published') and (($2::uuid is not null and t.id=$2::uuid) or ($2::uuid is null and exists(select 1 from account_title_states ats join accounts a on a.id=ats.account_id where a.auth_user_id=$1 and a.status='active' and ats.title_id=t.id and (ats.is_favorite or ats.personal_rating>=4))))), ranked as (
select ({summary}) item,t.sort_title,t.id,
(select count(*) from title_genres g where g.title_id=t.id and g.value_id in(select sg.value_id from title_genres sg join seeds x on x.id=sg.title_id))*3+
(select count(*) from title_planets p where p.title_id=t.id and p.planet_id in(select sp.planet_id from title_planets sp join seeds x on x.id=sp.title_id))*2 affinity
from titles t where not t.is_private and t.workflow_status in ('draft','published') and not exists(select 1 from seeds x where x.id=t.id)
and not exists(select 1 from account_playback_states ps join accounts a on a.id=ps.account_id join installments i on i.id=ps.installment_id where a.auth_user_id=$1 and a.status='active' and i.title_id=t.id and (ps.is_played or ps.position_seconds>0))
and exists(select 1 from ({released_units}) units where is_released)
), page as(select * from ranked where affinity>0 or not exists(select 1 from seeds) order by affinity desc,(item#>>'{{score,rating}}')::double precision desc nulls last,sort_title,id limit 24)
select jsonb_build_object('items',coalesce((select jsonb_agg(item order by affinity desc,(item#>>'{{score,rating}}')::double precision desc nulls last,sort_title,id) from page),'[]'::jsonb),'basis',case when $2::uuid is not null then 'related' when exists(select 1 from seeds) then 'personal' else 'editorial' end)"#,
        summary = queries::summary(),
        released_units = tracking::units("t.id", "null::uuid")
    );
    let result = sqlx::query_scalar::<_, SqlJson<Value>>(AssertSqlSafe(query))
        .bind(user_id)
        .bind(None::<String>)
        .fetch_one(pool)
        .await?;
    Ok(result.0)
}
