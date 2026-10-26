//! Bounded, read-only home feeds. The enclosing catalog router requires owner authentication.
use super::{ApiResult, queries, tracking};
use crate::auth::User;
use axum::{Extension, Json, extract::State};
use serde_json::{Value, json};
use sqlx::{AssertSqlSafe, PgPool, types::Json as SqlJson};

pub(super) async fn feed(
    State(pool): State<PgPool>,
    Extension(user): Extension<User>,
) -> ApiResult<Json<Value>> {
    // Keep the feeds in one read-only snapshot and retain the existing discoverability rule.
    let mut transaction = pool.begin().await?;
    sqlx::query("set transaction isolation level repeatable read read only")
        .execute(&mut *transaction)
        .await?;
    let activity_sql = format!(
        r#"select coalesce(jsonb_agg(item order by created_at desc,kind,id),'[]'::jsonb) from (
select activity.created_at,activity.kind,activity.id,
jsonb_build_object('id',activity.id,'kind',activity.kind,'body',activity.body,
'containsSpoilers',activity.contains_spoilers,'rating',activity.rating,'createdAt',activity.created_at,
'authorName',a.display_name,'avatarKey',a.avatar_key,'work',({summary})) item
from (
select id,account_id,title_id,body,contains_spoilers,rating,created_at,'review'::text kind from title_reviews where moderation_status='published' and btrim(body)<>''
union all
select id,account_id,title_id,body,contains_spoilers,null::integer rating,created_at,'comment'::text kind from title_comments where moderation_status='published'
) activity join accounts a on a.id=activity.account_id join titles t on t.id=activity.title_id
where a.status='active' and a.is_discoverable and (not t.is_private and t.workflow_status in ('draft','published'))
order by activity.created_at desc,activity.kind,activity.id limit 6) entries"#,
        summary = queries::summary()
    );
    let comments = sqlx::query_scalar::<_, SqlJson<Value>>(AssertSqlSafe(activity_sql))
        .fetch_one(&mut *transaction)
        .await?
        .0;
    let upcoming_sql = format!(
        r#"select coalesce(jsonb_agg(item order by release_date asc nulls last,work_title,position,id),'[]'::jsonb) from (
select i.release_date,t.sort_title work_title,i.position,i.id,jsonb_build_object(
'id',i.id,'workId',t.id,'workTitle',t.canonical_title,'workTitleAr',t.title_ar,'title',i.title,'kind',i.kind,
'releaseDate',i.release_date,'runtimeMinutes',i.runtime_minutes,
'episodeCount',(select count(*) from episodes e where e.installment_id=i.id),
'poster',coalesce((select jsonb_build_object('id',a.id,'url','/api/v1/artwork/'||a.id,'mimeType',a.mime_type,'width',a.width,'height',a.height,'byteSize',a.byte_size,'sha256',a.sha256,'originalFilename',a.original_filename,'focalX',a.focal_x,'focalY',a.focal_y) from media_asset_assignments m join media_assets a on a.id=m.asset_id where m.installment_id=i.id and m.role='poster' order by m.is_primary desc,m.id limit 1),({summary})->'poster'),
'score',jsonb_build_object('rating',floor(({score})*10+0.5)/10,'scored',case when ({score}) is null then 0 else 1 end,'total',1)) item
from installments i join titles t on t.id=i.title_id left join installment_scores s on s.installment_id=i.id
where (not t.is_private and t.workflow_status in ('draft','published')) and ((i.status='announced' and (i.release_date is null or i.release_date>=current_date)) or (i.status='unknown' and i.release_date>current_date))
order by i.release_date asc nulls last,t.sort_title,i.position,i.id limit 10) entries"#,
        summary = queries::SUMMARY,
        score = queries::SCORE_VALUE
    );
    let upcoming = sqlx::query_scalar::<_, SqlJson<Value>>(AssertSqlSafe(upcoming_sql))
        .fetch_one(&mut *transaction)
        .await?
        .0;
    let viewing_item = viewing_item(false);
    let recent_sql = format!(
        r#"select coalesce(jsonb_agg(item order by release_date desc nulls last,created_at desc,id),'[]'::jsonb) from (
select e.id,e.release_date,e.created_at,{viewing_item} item from episodes e
join installments i on i.id=e.installment_id join titles t on t.id=i.title_id
left join account_playback_states ps on ps.account_id=(select id from accounts where auth_user_id=$1 and status='active') and ps.installment_id=i.id and ps.episode_id=e.id
where (not t.is_private and t.workflow_status in ('draft','published')) and e.release_date<=current_date
order by e.release_date desc nulls last,e.created_at desc,e.id limit 12) episodes"#
    );
    let recent = sqlx::query_scalar::<_, SqlJson<Value>>(AssertSqlSafe(recent_sql))
        .bind(&user.id)
        .fetch_one(&mut *transaction)
        .await?
        .0;
    let resume_sql = format!(
        r#"select coalesce(jsonb_agg(item order by updated_at desc,id),'[]'::jsonb) from (select * from (
select distinct on (t.id) ps.id,ps.updated_at,{viewing_item} item from account_playback_states ps
join accounts account on account.id=ps.account_id join installments i on i.id=ps.installment_id
join titles t on t.id=i.title_id left join episodes e on e.id=ps.episode_id and e.installment_id=i.id
where account.auth_user_id=$1 and account.status='active' and (not t.is_private and t.workflow_status in ('draft','published')) and not ps.is_played and ps.position_seconds>0
and ((e.id is not null and (e.release_date<=current_date or (e.release_date is null and i.status='completed')))
or (ps.episode_id is null and i.kind in ('movie','special') and (i.release_date<=current_date or (i.release_date is null and i.status='completed'))))
order by t.id,ps.updated_at desc,ps.id) distinct_resume order by updated_at desc,id limit 12) resumed"#
    );
    let resume = sqlx::query_scalar::<_, SqlJson<Value>>(AssertSqlSafe(resume_sql))
        .bind(&user.id)
        .fetch_one(&mut *transaction)
        .await?
        .0;
    let next_sql = format!(
        r#"select coalesce(jsonb_agg(item order by updated_at desc,id),'[]'::jsonb) from (
select t.id,activity.updated_at,{viewing_item} item from titles t
join accounts account on account.auth_user_id=$1 and account.status='active'
cross join lateral (select max(ps.updated_at) updated_at from account_playback_states ps join installments x on x.id=ps.installment_id where x.title_id=t.id and ps.account_id=account.id and (ps.is_played or ps.position_seconds>0)) activity
cross join lateral (select units.* from ({units}) units left join account_playback_states state on state.account_id=account.id and state.installment_id=units.installment_id and state.episode_id is not distinct from units.episode_id where units.is_released and not coalesce(state.is_played,false) order by units.installment_position,units.episode_position,units.installment_id,units.episode_id nulls first limit 1) next_unit
join installments i on i.id=next_unit.installment_id left join episodes e on e.id=next_unit.episode_id
left join account_playback_states ps on ps.account_id=account.id and ps.installment_id=i.id and ps.episode_id is not distinct from e.id
where not t.is_private and t.workflow_status in ('draft','published') and activity.updated_at is not null
order by activity.updated_at desc,t.id limit 12) next_items"#,
        units = tracking::units("t.id", "null::uuid")
    );
    let next_up = sqlx::query_scalar::<_, SqlJson<Value>>(AssertSqlSafe(next_sql))
        .bind(&user.id)
        .fetch_one(&mut *transaction)
        .await?
        .0;
    let following_sql = format!(
        r#"select coalesce(jsonb_agg(item order by release_date desc,created_at desc,id),'[]'::jsonb) from (select * from (
select distinct on (t.id) e.id,e.release_date,e.created_at,{viewing_item} item
from episodes e join installments i on i.id=e.installment_id join titles t on t.id=i.title_id
join accounts account on account.auth_user_id=$1 and account.status='active'
left join account_playback_states ps on ps.account_id=account.id and ps.installment_id=i.id and ps.episode_id=e.id
where not t.is_private and t.workflow_status in ('draft','published') and e.release_date<=current_date and not coalesce(ps.is_played,false)
and (exists(select 1 from account_playback_states state join installments x on x.id=state.installment_id where x.title_id=t.id and state.account_id=account.id and (state.is_played or state.position_seconds>0)) or exists(select 1 from account_title_states ats where ats.title_id=t.id and ats.account_id=account.id and ats.is_favorite))
order by t.id,e.release_date desc,e.created_at desc,e.id) distinct_following order by release_date desc,created_at desc,id limit 12) following"#
    );
    let following_episodes = sqlx::query_scalar::<_, SqlJson<Value>>(AssertSqlSafe(following_sql))
        .bind(&user.id)
        .fetch_one(&mut *transaction)
        .await?
        .0;
    let featured_sql = format!(
        r#"select coalesce(jsonb_agg(item order by release_date desc nulls last,sort_title,id),'[]'::jsonb) from (
select t.id,t.sort_title,coalesce((select max(x.release_date) from installments x where x.title_id=t.id),make_date(t.release_year,1,1)) release_date,({summary}) item
from titles t where (not t.is_private and t.workflow_status in ('draft','published')) and exists(select 1 from media_asset_assignments m join media_assets a on a.id=m.asset_id where m.title_id=t.id and m.role='banner')
order by release_date desc nulls last,t.sort_title,t.id limit 10) featured"#,
        summary = queries::summary()
    );
    let featured = sqlx::query_scalar::<_, SqlJson<Value>>(AssertSqlSafe(featured_sql))
        .fetch_one(&mut *transaction)
        .await?
        .0;
    transaction.commit().await?;
    let recommendations = super::recommendations::personal(&pool, &user.id).await?;
    Ok(Json(
        json!({"comments":comments,"upcoming":upcoming,"recentEpisodes":recent,"resume":resume,"nextUp":next_up,"followingEpisodes":following_episodes,"recommendations":recommendations,"featured":featured}),
    ))
}

pub(super) fn viewing_item(poster_installments: bool) -> String {
    let installment_role = if poster_installments {
        "case when e.id is null then 'poster' else 'banner' end"
    } else {
        "'banner'"
    };
    format!(
        r#"jsonb_build_object('work',({summary}),'installmentId',i.id,'installmentTitle',i.title,
'episodeId',e.id,'episodeNumber',e.number::text,'episodeTitle',e.title,
'releaseDate',case when e.id is null then i.release_date else e.release_date end,'positionSeconds',coalesce(ps.position_seconds,0),
'durationSeconds',ps.duration_seconds,'isPlayed',coalesce(ps.is_played,false),
'artwork',coalesce((select {artwork} from media_asset_assignments m join media_assets a on a.id=m.asset_id
where (m.episode_id=e.id and m.is_primary and m.role in ('still','poster','banner')) or (m.installment_id=i.id and m.role=({installment_role})::media_asset_role)
order by case when m.episode_id=e.id then 0 else 1 end,case m.role when 'still' then 0 else 1 end,m.is_primary desc,m.id limit 1),nullif(({summary})->({installment_role}),'null'::jsonb),nullif(({summary})->'poster','null'::jsonb)))"#,
        summary = queries::summary(),
        artwork = queries::ARTWORK,
    )
}
