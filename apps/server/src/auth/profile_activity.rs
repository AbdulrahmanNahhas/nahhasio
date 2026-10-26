//! Bounded member activity. Personal sections are strictly owner-only; no credentials or paths.
use super::*;
use crate::catalog::tracking;
use axum::extract::{Path, Query};
use serde_json::{Value, json};
use sqlx::{AssertSqlSafe, types::Json as SqlJson};

const SECTIONS: &[(&str, &str)] = &[
    ("watched", "المشاهدة المكتملة"),
    ("watching", "قيد المشاهدة"),
    ("favorites", "المفضلة"),
    ("ratings", "التقييمات الشخصية"),
    ("follows", "الأعمال المتابَعة"),
    ("saved", "علامات الحفظ"),
    ("comments", "التعليقات"),
    ("reviews", "المراجعات"),
    ("collections", "القوائم"),
    ("notes", "الملاحظات الشخصية"),
    ("history", "زيارات صفحات الأعمال"),
    ("saved-views", "طرق العرض المحفوظة"),
    ("downloads", "التنزيلات المسجلة"),
    ("recommendations", "الترشيحات"),
    ("events", "جلسات المشاهدة"),
    ("reactions", "التفاعلات"),
    ("notifications", "الإشعارات"),
    ("preferences", "التفضيلات"),
    ("devices", "الأجهزة"),
    ("policies", "سياسة المحتوى"),
];
fn shared(section: &str) -> bool {
    matches!(section, "comments" | "reviews" | "collections")
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct Page {
    section: String,
    page: Option<i64>,
}
async fn access(state: &AuthState, headers: &HeaderMap, id: &str) -> Result<bool, AuthError> {
    // Reuse identity/discoverability validation, including self access to hidden profiles.
    let _ =
        super::profile::public(State(state.clone()), headers.clone(), Path(id.to_owned())).await?;
    let viewer = lookup(&state.pool, headers).await?.user;
    if !viewer.unrestricted {
        return Err(AuthError(
            StatusCode::FORBIDDEN,
            "This account's content policy requires a restricted catalog",
        ));
    }
    Ok(viewer.account_id.eq_ignore_ascii_case(id))
}
const VISIBLE: &str = "(not t.is_private and t.workflow_status in ('draft','published'))";
fn work_rows(from: &str, condition: &str, fields: (&str, &str, &str, &str, &str, &str)) -> String {
    let (body, date, detail, value, spoiler, status) = fields;
    format!(
        "select x.id::text id,coalesce(nullif(t.title_ar,''),t.canonical_title) name,{body} body,t.id::text work_id,(select m.asset_id::text from media_asset_assignments m where m.title_id=t.id and m.role='poster' order by m.is_primary desc,m.id limit 1) artwork_id,{date} created_at,{detail} detail,({value})::bigint value,{spoiler} spoiler,({status})::text status from {from} where ({condition}) and {VISIBLE}"
    )
}
fn work_progress() -> String {
    format!(
        "select {},max(ps.updated_at) updated_at from ({}) units left join account_playback_states ps on ps.account_id=$1::uuid and ps.installment_id=units.installment_id and ps.episode_id is not distinct from units.episode_id",
        tracking::COUNTS,
        tracking::units("t.id", "null::uuid")
    )
}
fn rows(section: &str) -> String {
    match section {
        "comments" | "reviews" => {
            let table=if section=="comments" {"title_comments"} else {"title_reviews"};
            work_rows(&format!("{table} x join titles t on t.id=x.title_id"),"x.account_id=$1::uuid and ($2::boolean or x.moderation_status='published')",("x.body","x.created_at","null::text",if section=="reviews" {"x.rating"} else {"null"},"x.contains_spoilers","x.moderation_status"))
        }
        "watching" => {
            let progress = work_progress();
            let watch_state = tracking::WATCH_STATE;
            format!("select t.id::text id,coalesce(nullif(t.title_ar,''),t.canonical_title) name,null::text body,t.id::text work_id,(select m.asset_id::text from media_asset_assignments m where m.title_id=t.id and m.role='poster' order by m.is_primary desc,m.id limit 1) artwork_id,tracking.updated_at created_at,tracking.played::text||' / '||tracking.total::text||' وحدة مكتملة' detail,null::bigint value,false spoiler,'watching'::text status from titles t cross join lateral ({progress}) tracking where ({watch_state})='in-progress' and {VISIBLE}")
        }
        "watched" => {
            let units=tracking::units("t.id","i.id");
            work_rows(&format!("account_playback_states x join installments i on i.id=x.installment_id join titles t on t.id=i.title_id left join episodes e on e.id=x.episode_id join lateral ({units}) units on units.installment_id=x.installment_id and units.episode_id is not distinct from x.episode_id"),"x.account_id=$1::uuid and x.is_played and units.is_released",("null::text","coalesce(x.played_at,x.updated_at)","i.title || case when e.id is null then '' else ' — ' || coalesce(e.title,'الحلقة '||trim_scale(e.number)::text) end","null","false","'watched'"))
        }
        "favorites" | "ratings" | "notes" | "saved" => {
            let condition=match section {"favorites"=>"x.is_favorite","ratings"=>"x.personal_rating is not null","notes"=>"btrim(x.notes)<>''",_=>"x.saved_offline"};
            work_rows("(select title_id id,* from account_title_states) x join titles t on t.id=x.title_id",&format!("x.account_id=$1::uuid and {condition}"),(if section=="notes" {"x.notes"} else {"null::text"},"x.updated_at","null::text",if section=="ratings" {"x.personal_rating"} else {"null"},"false","null"))
        }
        "follows" => work_rows("(select title_id id,* from title_follows) x join titles t on t.id=x.title_id","x.account_id=$1::uuid",("null::text","x.created_at","null::text","x.reminder_days","false","null")),
        "history" => work_rows("(select title_id id,* from account_view_history) x join titles t on t.id=x.title_id","x.account_id=$1::uuid",("null::text","x.viewed_at","null::text","x.visit_count","false","null")),
        "downloads" => work_rows("account_downloads x join installments i on i.id=x.installment_id join titles t on t.id=i.title_id","x.account_id=$1::uuid",("null::text","x.updated_at","i.title","x.size_bytes","false","x.state")),
        "recommendations" => work_rows("family_recommendations x join titles t on t.id=x.title_id","x.sender_account_id=$1::uuid or x.recipient_account_id=$1::uuid",("x.reason","x.created_at","case when x.sender_account_id=$1::uuid then 'ترشيح أرسلته' else 'ترشيح وصل إليك' end","null","false","x.status")),
        "collections" => "select x.id::text,x.name,x.description body,null::text work_id,null::text artwork_id,x.updated_at created_at,null::text detail,(select count(*) from collection_items ci join titles t on t.id=ci.title_id where ci.collection_id=x.id and (not t.is_private and t.workflow_status in ('draft','published'))) value,false spoiler,x.visibility::text status from collections x where x.owner_account_id=$1::uuid and ($2::boolean or x.visibility='family')".into(),
        "saved-views" => "select x.id::text,x.name,null::text body,null::text work_id,null::text artwork_id,x.updated_at created_at,null::text detail,null::bigint value,false spoiler,case when x.is_default then 'default' else null end status from saved_views x where x.account_id=$1::uuid".into(),
        "events" => "select x.id::text,x.name,x.notes body,null::text work_id,null::text artwork_id,coalesce(x.scheduled_for,x.created_at) created_at,case when x.created_by_account_id=$1::uuid then 'أنشأت هذه الجلسة' else 'شاركت في التصويت' end detail,(select count(*) from family_event_votes v where v.event_id=x.id and v.account_id=$1::uuid) value,false spoiler,x.status::text status from family_events x where x.created_by_account_id=$1::uuid or exists(select 1 from family_event_votes v where v.event_id=x.id and v.account_id=$1::uuid)".into(),
        "notifications" => "select x.id::text,'إشعار'::text name,x.message body,null::text work_id,null::text artwork_id,x.created_at,null::text detail,null::bigint value,false spoiler,case when x.read_at is null then 'unread' else 'read' end status from notifications x where x.account_id=$1::uuid and (x.title_id is null or exists(select 1 from titles t where t.id=x.title_id and (not t.is_private and t.workflow_status in ('draft','published'))))".into(),
        "reactions" => work_rows("(select ('review:'||r.review_id::text||':'||r.emoji) id,r.account_id,r.emoji,r.created_at,v.title_id from review_reactions r join title_reviews v on v.id=r.review_id where v.moderation_status='published' union all select ('comment:'||r.comment_id::text||':'||r.emoji),r.account_id,r.emoji,r.created_at,v.title_id from comment_reactions r join title_comments v on v.id=r.comment_id where v.moderation_status='published') x join titles t on t.id=x.title_id","x.account_id=$1::uuid",("x.emoji","x.created_at","null::text","null","false","null")),
        "devices" => "select d.id::text,d.name,d.platform body,null::text work_id,null::text artwork_id,d.last_seen_at created_at,null::text detail,null::bigint value,false spoiler,case when d.revoked_at is null then 'active' else 'revoked' end status from devices d where exists(select 1 from auth_sessions s join accounts a on a.auth_user_id=s.user_id where s.device_id=d.id and a.id=$1::uuid)".into(),
        "preferences" => "select k id,k name,v body,null::text work_id,null::text artwork_id,null::timestamptz created_at,null::text detail,null::bigint value,false spoiler,null::text status from account_preferences p cross join lateral (values ('اللغة',p.locale),('المظهر',p.theme),('الصوت المفضّل',array_to_string(p.preferred_audio,', ')),('الترجمة المفضّلة',array_to_string(p.preferred_subtitles,', ')),('الترجمة',p.subtitle_mode),('إخفاء الحرق',case when p.hide_spoilers then 'مفعّل' else 'متوقف' end),('التشغيل التلقائي',case when p.autoplay then 'مفعّل' else 'متوقف' end),('أنواع الأعمال',array_to_string(p.visible_title_kinds,', ')),('إشعارات الردود',case when p.notify_replies then 'مفعّلة' else 'متوقفة' end)) fields(k,v) where p.account_id=$1::uuid".into(),
        "policies" => "select p.audience::text id,'سياسة المحتوى'::text name,concat_ws(' · ',p.audience::text,p.age::text,p.sexuality_risk::text,p.behavioral_risk::text,p.theology_risk::text) body,null::text work_id,null::text artwork_id,null::timestamptz created_at,null::text detail,null::bigint value,false spoiler,null::text status from account_content_policies p where p.account_id=$1::uuid".into(),
        _ => unreachable!("validated section"),
    }
}
fn envelope(source: &str) -> String {
    format!("with access as(select $1::uuid target,$2::boolean owner), entries as ({source})")
}
pub(super) async fn overview(
    State(state): State<AuthState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<Value>, AuthError> {
    let owner = access(&state, &headers, &id).await?;
    let mut tx = state.pool.begin().await.map_err(unavailable)?;
    sqlx::query("set transaction isolation level repeatable read read only")
        .execute(&mut *tx)
        .await
        .map_err(unavailable)?;
    let mut stats = Vec::new();
    for (key, label) in SECTIONS.iter().filter(|(key, _)| owner || shared(key)) {
        let query = format!("{} select count(*) from entries", envelope(&rows(key)));
        let count = sqlx::query_scalar::<_, i64>(AssertSqlSafe(query))
            .bind(&id)
            .bind(owner)
            .fetch_one(&mut *tx)
            .await
            .map_err(unavailable)?;
        stats.push(json!({"key":key,"label":label,"value":count}));
    }
    let viewing = if owner {
        let progress = work_progress();
        let units = tracking::units("t.id", "i.id");
        let query = format!(
            "select jsonb_build_object('works',(select count(*) from titles t cross join lateral ({progress}) tracking where tracking.total>0 and tracking.played=tracking.total and {VISIBLE}),'episodes',count(*) filter(where ps.is_played and ps.episode_id is not null and units.is_released),'movies',count(*) filter(where ps.is_played and ps.episode_id is null and i.kind in ('movie','special') and units.is_released),'recordedSeconds',coalesce(sum(ps.position_seconds),0)) from account_playback_states ps join installments i on i.id=ps.installment_id join titles t on t.id=i.title_id join lateral ({units}) units on units.installment_id=ps.installment_id and units.episode_id is not distinct from ps.episode_id where ps.account_id=$1::uuid and $2::boolean and {VISIBLE}"
        );
        sqlx::query_scalar::<_, SqlJson<Value>>(AssertSqlSafe(query))
            .bind(&id)
            .bind(owner)
            .fetch_one(&mut *tx)
            .await
            .map_err(unavailable)?
            .0
    } else {
        Value::Null
    };
    tx.commit().await.map_err(unavailable)?;
    Ok(Json(json!({"owner":owner,"stats":stats,"viewing":viewing})))
}
pub(super) async fn entries(
    State(state): State<AuthState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Query(input): Query<Page>,
) -> Result<Json<Value>, AuthError> {
    let owner = access(&state, &headers, &id).await?;
    let page = input.page.unwrap_or(1);
    if !(1..=100_000).contains(&page) || !SECTIONS.iter().any(|(key, _)| *key == input.section) {
        return Err(AuthError(
            StatusCode::BAD_REQUEST,
            "Invalid profile section or page",
        ));
    }
    if !owner && !shared(&input.section) {
        return Err(AuthError(StatusCode::FORBIDDEN, "Personal profile section"));
    }
    let query = format!(
        "{} , page as(select * from entries order by created_at desc nulls last,id limit 20 offset $3) select jsonb_build_object('items',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'body',body,'workId',work_id,'artworkId',artwork_id,'createdAt',created_at,'detail',detail,'value',value,'spoiler',spoiler,'status',status) order by created_at desc nulls last,id) from page),'[]'::jsonb),'total',(select count(*) from entries),'page',$4::bigint,'pageSize',20)",
        envelope(&rows(&input.section))
    );
    let value = sqlx::query_scalar::<_, SqlJson<Value>>(AssertSqlSafe(query))
        .bind(&id)
        .bind(owner)
        .bind((page - 1) * 20)
        .bind(page)
        .fetch_one(&state.pool)
        .await
        .map_err(unavailable)?
        .0;
    Ok(Json(value))
}
