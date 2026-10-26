//! Paginated catalog discovery. Facet names and SQL fragments are server-owned; values are bound.
use super::{ApiError, ApiResult, queries, tracking};
use crate::auth::User;
use axum::http::StatusCode;
use axum::{
    Extension, Json,
    extract::{Query, State},
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::{AssertSqlSafe, PgPool, types::Json as SqlJson};

#[derive(Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct Filters {
    #[serde(default)]
    facets: Vec<Selection>,
    #[serde(default)]
    minimum_rating: f64,
    #[serde(default)]
    maximum_rating: Option<f64>,
    #[serde(default)]
    minimum_scores: MinimumScores,
}
#[derive(Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct MinimumScores {
    #[serde(default)]
    story: f64,
    #[serde(default)]
    characters: f64,
    #[serde(default)]
    depth: f64,
    #[serde(default)]
    world_building: f64,
    #[serde(default)]
    originality: f64,
    #[serde(default)]
    craft: f64,
}
#[derive(Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
struct Selection {
    key: String,
    #[serde(default)]
    include: Vec<String>,
    #[serde(default)]
    exclude: Vec<String>,
}
#[derive(Default, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct Input {
    page: Option<i64>,
    page_size: Option<i64>,
    q: Option<String>,
    sort: Option<String>,
    group: Option<String>,
    view: Option<String>,
    privacy: Option<String>,
    filters: Option<String>,
    year_from: Option<i32>,
    year_to: Option<i32>,
}
const CRITERIA: [(&str, &str); 6] = [
    ("story", "story"),
    ("characters", "characters"),
    ("depth", "depth"),
    ("worldBuilding", "world_building"),
    ("originality", "originality"),
    ("craft", "craft"),
];
fn invalid() -> ApiError {
    ApiError(StatusCode::BAD_REQUEST, "Invalid catalog filters")
}
impl Input {
    fn validated(&self) -> ApiResult<(i64, i64, &str, &str, &str, Filters)> {
        let page = self.page.unwrap_or(1);
        let size = self.page_size.unwrap_or(30);
        let view = self.view.as_deref().unwrap_or("works");
        let privacy = self.privacy.as_deref().unwrap_or("public");
        if !(1..=100_000).contains(&page)
            || !(1..=100).contains(&size)
            || !matches!(view, "works" | "installments")
            || !matches!(privacy, "public" | "all" | "private")
            || !matches!(
                self.group.as_deref().unwrap_or("none"),
                "none"
                    | "year"
                    | "format"
                    | "audience"
                    | "status"
                    | "watchState"
                    | "planet"
                    | "genre"
                    | "country"
                    | "studio"
            )
            || self.q.as_ref().is_some_and(|v| v.chars().count() > 200)
            || self.filters.as_ref().is_some_and(|v| v.len() > 8000)
            || self.year_from.is_some_and(|v| !(1..=9999).contains(&v))
            || self.year_to.is_some_and(|v| !(1..=9999).contains(&v))
            || self.year_from.zip(self.year_to).is_some_and(|(a, b)| a > b)
        {
            return Err(invalid());
        }
        let order = match self.sort.as_deref().unwrap_or("year-desc") {
            "title" => "sort_title,id,unit_id",
            "year-desc" => "release_sort desc nulls last,sort_title,id,unit_id",
            "year-asc" => "release_sort asc nulls last,sort_title,id,unit_id",
            "score-desc" => "rating desc nulls last,sort_title,id,unit_id",
            "updated-desc" => "updated_at desc,id,unit_id",
            "latest-released-desc" => "latest_released_sort desc nulls last,sort_title,id,unit_id",
            "added-desc" => "created_at desc,id,unit_id",
            _ => return Err(invalid()),
        };
        let filters: Filters =
            serde_json::from_str(self.filters.as_deref().unwrap_or("{}")).map_err(|_| invalid())?;
        let values = [
            filters.minimum_rating,
            filters.maximum_rating.unwrap_or(10.0),
            filters.minimum_scores.story,
            filters.minimum_scores.characters,
            filters.minimum_scores.depth,
            filters.minimum_scores.world_building,
            filters.minimum_scores.originality,
            filters.minimum_scores.craft,
        ];
        let keys = facets();
        if values
            .iter()
            .any(|v| !v.is_finite() || !(0.0..=10.0).contains(v))
            || filters.minimum_rating > filters.maximum_rating.unwrap_or(10.0)
            || filters.facets.len() > keys.len()
            || filters.facets.iter().any(|s| {
                !keys.iter().any(|(key, _, _)| *key == s.key)
                    || s.include.len() > 32
                    || s.exclude.len() > 32
                    || s.include
                        .iter()
                        .chain(&s.exclude)
                        .any(|v| v.is_empty() || v.len() > 160)
            })
        {
            return Err(invalid());
        }
        let mut seen = std::collections::HashSet::new();
        if filters
            .facets
            .iter()
            .any(|s| !seen.insert(&s.key) || s.include.iter().any(|v| s.exclude.contains(v)))
        {
            return Err(invalid());
        }
        Ok((page, size, view, privacy, order, filters))
    }
}
const RELEASED_INSTALLMENT: &str =
    "(x.release_date<=current_date or (x.release_date is null and x.status='completed'))";
fn release_status() -> String {
    format!(
        "case when i.id is null then {} else i.status::text end",
        super::WORK_RELEASE_STATUS
    )
}
fn facets() -> Vec<(&'static str, &'static str, String)> {
    let mut list=vec![
        ("formats","نوع العمل","array[t.format::text]".into()),
        ("kinds","النوع","array[case when i.id is null then case when exists(select 1 from installments x where x.title_id=t.id and x.kind='season') then t.format::text||'-series' else t.format::text||'-movie' end else t.format::text||case when i.kind='season' then '-series' else '-movie' end end]".into()),
        ("releaseStatuses","حالة الإصدار",format!("array[{}]", release_status())),
        ("audiences","الجمهور","array[coalesce(i.audience_override,t.audience)::text]".into()),
        ("ages","الفئة العمرية","array[coalesce(i.age_override,t.age)::text]".into()),
        ("planets","الكواكب","array(select p.slug from title_planets v join planets p on p.id=v.planet_id where v.title_id=t.id and p.is_active)".into()),
        ("studios","الاستوديوهات","array(select distinct e.id::text from contributions c join entities e on e.id=c.entity_id where e.kind='organization' and c.title_id=t.id)".into()),
        ("contributors","الصنّاع","array(select distinct e.id::text from contributions c join entities e on e.id=c.entity_id where e.kind='person' and c.title_id=t.id)".into()),
        ("awardPrograms","جهات الجوائز","array(select distinct coalesce(organization_slug,organization_name) from award_recognitions where title_id=t.id and (i.id is null or installment_id is null or installment_id=i.id))".into()),
        ("awardCategories","فئات الجوائز","array(select distinct category from award_recognitions where title_id=t.id and (i.id is null or installment_id is null or installment_id=i.id))".into()),
        ("awardResults","نتائج الجوائز","array(select distinct result::text from award_recognitions where title_id=t.id and (i.id is null or installment_id is null or installment_id=i.id))".into()),
        ("ratingStates","حالة التقييم","array[case when rating is null then 'unrated' else 'rated' end]".into()),
        ("warningStates","تنبيهات المحتوى","array[case when coalesce(t.content_warnings,'')<>'' then 'warnings' else 'none' end]".into()),
        ("structureStates","البنية","array[case when i.id is null then 'title' when i.kind='season' then 'season' else 'standalone' end]".into()),
        ("playableStates","وجود فيديو مسجّل","array[case when exists(select 1 from media_files f where (f.installment_id in(select id from installments where title_id=t.id) or f.episode_id in(select e.id from episodes e join installments x on x.id=e.installment_id where x.title_id=t.id)) and (i.id is null or f.installment_id=i.id or f.episode_id in(select id from episodes where installment_id=i.id))) then 'available' else 'missing' end]".into()),
        ("watchStates","حالة المشاهدة","array[watch_state]".into()),
        ("favoriteStates","المفضلة","array[case when exists(select 1 from account_title_states ats join accounts a on a.id=ats.account_id where ats.title_id=t.id and a.auth_user_id=$1 and ats.is_favorite) then 'favorite' else 'other' end]".into()),
    ];
    list.push(("dubLanguages", "لغات الدبلجة", "t.dub_languages".into()));
    list.push((
        "playbackPolicies",
        "مصادر التشغيل",
        "array[t.playback_policy]".into(),
    ));
    list.push(("contributionRoles","أدوار المساهمة","array(select distinct r.slug from contributions c join roles r on r.id=c.role_id where c.title_id=t.id)".into()));
    list.push(("releaseStates", "توفر إصدارات", format!("array[case when exists(select 1 from installments x where x.title_id=t.id and (i.id is null or x.id=i.id) and {RELEASED_INSTALLMENT}) then 'released' else 'unreleased' end]")));
    for (key, label, table) in [
        ("genres", "الأنواع الفنية", "genres"),
        ("tones", "الطابع", "tones"),
        ("tags", "الوسوم", "tags"),
        ("countries", "البلدان", "countries"),
    ] {
        list.push((key,label,format!("array(select v.slug from title_{table} tv join {table} v on v.id=tv.value_id where tv.title_id=t.id)")));
    }
    for (key, label, field) in [
        ("sexualityRisks", "المحتوى الجنسي", "sexuality_risk"),
        ("behavioralRisks", "العنف والسلوك", "behavioral_risk"),
        ("theologyRisks", "الموضوعات العقدية", "theology_risk"),
    ] {
        list.push((
            key,
            label,
            format!("array[coalesce(i.{field}_override,t.{field})::text]"),
        ));
    }
    list
}
fn base(is_admin: bool) -> String {
    let work = queries::summary();
    let criteria=CRITERIA.iter().map(|(key,col)|format!("'{key}',case when i.id is null then (select avg(z.{col})::double precision from installments x left join installment_scores z on z.installment_id=x.id where x.title_id=t.id) else s.{col}::double precision end")).collect::<Vec<_>>().join(",");
    let facts = facets()
        .iter()
        .map(|(key, _, expr)| format!("'{key}',to_jsonb({expr})"))
        .collect::<Vec<_>>()
        .join(",");
    format!(
        r#"select t.id,i.id unit_id,t.sort_title,t.updated_at,t.created_at,
coalesce((select c.entity_id::text from contributions c join entities e on e.id=c.entity_id join roles r on r.id=c.role_id where c.title_id=t.id and e.kind='organization' and c.is_primary and r.slug in ('animation_studio','production_company') order by case r.slug when 'animation_studio' then 0 else 1 end,c.position,c.entity_id limit 1),'__none__') main_studio,
coalesce(i.release_date::text,t.release_year::text||'-01-01') release_sort,
coalesce(extract(year from i.release_date)::integer,t.release_year) as catalog_year,
(select max(coalesce(x.release_date::text,t.release_year::text||'-01-01')) from installments x where x.title_id=t.id and (i.id is null or x.id=i.id) and {RELEASED_INSTALLMENT}) latest_released_sort,
coalesce(i.title,'') unit_title,t.canonical_title,t.title_ar,
jsonb_build_object('work',({work}),'installment',case when i.id is null then null else jsonb_build_object(
'id',i.id,'workId',t.id,'workTitle',t.canonical_title,'workTitleAr',t.title_ar,'title',i.title,'kind',i.kind,'releaseDate',i.release_date,'runtimeMinutes',i.runtime_minutes,
'episodeCount',(select count(*) from episodes where installment_id=i.id),'poster',coalesce((select {art} from media_asset_assignments m join media_assets a on a.id=m.asset_id where m.installment_id=i.id and m.role='poster' order by m.is_primary desc,m.id limit 1),({work})->'poster'),'score',score_value) end,
'classification',jsonb_build_object('audience',coalesce(i.audience_override,t.audience),'age',coalesce(i.age_override,t.age),'sexualityRisk',coalesce(i.sexuality_risk_override,t.sexuality_risk),'behavioralRisk',coalesce(i.behavioral_risk_override,t.behavioral_risk),'theologyRisk',coalesce(i.theology_risk_override,t.theology_risk)),
'watchProgress',jsonb_build_object('releasedUnits',tracking.total,'watchedReleasedUnits',tracking.played),'status',{release_status},'watchState',watch_state,'criteria',jsonb_build_object({criteria})) entry,
jsonb_build_object({facts}) facts,rating,jsonb_build_object({criteria}) criteria
from titles t left join installments i on i.title_id=t.id and $2='installments'
left join installment_scores s on s.installment_id=i.id
cross join lateral (select case when i.id is null then ({work})->'score' else jsonb_build_object('rating',floor(({score})*10+0.5)/10,'scored',case when ({score}) is null then 0 else 1 end,'total',1) end score_value) scores
cross join lateral (select (score_value->>'rating')::double precision rating) ratings
cross join lateral (select {counts} from ({units}) units
left join account_playback_states ps on ps.account_id=(select a.id from accounts a where a.auth_user_id=$1 and a.status='active')
and ps.installment_id=units.installment_id and ps.episode_id is not distinct from units.episode_id) tracking
cross join lateral (select {watch_state} watch_state) watch
where ($2='works' or i.id is not null) and ($3='all' or t.is_private=($3='private')) and ({is_admin} or t.workflow_status in ('draft','published'))"#,
        release_status = release_status(),
        art = queries::ARTWORK,
        score = queries::SCORE_VALUE,
        units = tracking::units("t.id", "i.id"),
        counts = tracking::COUNTS,
        watch_state = tracking::WATCH_STATE
    )
}
fn condition() -> String {
    let mut parts=vec!["($5::text is null or strpos(lower(canonical_title||' '||coalesce(title_ar,'')||' '||unit_title),lower($5))>0 or exists(select 1 from title_aliases a where a.title_id=base.id and strpos(lower(a.title),lower($5))>0) or exists(select 1 from contributions c join entities e on e.id=c.entity_id where c.title_id=base.id and strpos(lower(e.name),lower($5))>0))".into(),"($6::integer is null or catalog_year>=$6)".into(),"($7::integer is null or catalog_year<=$7)".into(),"(coalesce(($4->>'minimumRating')::double precision,0)=0 or rating>=($4->>'minimumRating')::double precision)".into()];
    parts.push("(coalesce(($4->>'maximumRating')::double precision,10)=10 or rating<=($4->>'maximumRating')::double precision)".into());
    for (key, _, _) in facets() {
        parts.push(format!("not exists(select 1 from jsonb_array_elements(coalesce($4->'facets','[]')) sel where sel->>'key'='{key}' and ((jsonb_array_length(sel->'include')>0 and not (facts->'{key}' ?| array(select jsonb_array_elements_text(sel->'include')))) or facts->'{key}' ?| array(select jsonb_array_elements_text(sel->'exclude'))))"));
    }
    for (key, _) in CRITERIA {
        parts.push(format!("(coalesce(($4#>>'{{minimumScores,{key}}}')::double precision,0)=0 or (criteria->>'{key}')::double precision>=($4#>>'{{minimumScores,{key}}}')::double precision)"));
    }
    // Included award facets must match one recognition, not unrelated awards on the same work.
    parts.push("not exists(select 1 from jsonb_array_elements(coalesce($4->'facets','[]')) z where z->>'key' in('awardPrograms','awardCategories','awardResults') and jsonb_array_length(z->'include')>0) or exists(select 1 from award_recognitions ar where ar.title_id=base.id and (base.unit_id is null or ar.installment_id is null or ar.installment_id=base.unit_id) and not exists(select 1 from jsonb_array_elements(coalesce($4->'facets','[]')) z where z->>'key' in('awardPrograms','awardCategories','awardResults') and jsonb_array_length(z->'include')>0 and not (z->'include' ? (case z->>'key' when 'awardPrograms' then coalesce(ar.organization_slug,ar.organization_name) when 'awardCategories' then ar.category else ar.result::text end))))".into());
    parts
        .into_iter()
        .map(|s| format!("({s})"))
        .collect::<Vec<_>>()
        .join(" and ")
}
pub(super) async fn browse(
    State(pool): State<PgPool>,
    Extension(user): Extension<User>,
    Query(input): Query<Input>,
) -> ApiResult<Json<Value>> {
    let (page, size, view, privacy, order, filters) = input.validated()?;
    let group = input.group.as_deref().unwrap_or("none");
    let memberships = membership_groups(group);
    let (group_key, group_rank) = if memberships.is_some() {
        ("browse_group_key", "browse_group_rank")
    } else {
        grouping(group)
    };
    let expanded = memberships.map_or_else(|| "select * from filtered".to_owned(), |(fact, rank)| format!(
        "select filtered.*, membership.key browse_group_key, {rank} browse_group_rank from filtered cross join lateral (select distinct value key from jsonb_array_elements_text(case when jsonb_array_length(facts->'{fact}') > 0 then facts->'{fact}' else '[\"__none__\"]'::jsonb end) options(value)) membership"
    ));
    let order = if input.group.as_deref().unwrap_or("none") == "none" {
        order.to_owned()
    } else {
        format!("{group_rank} asc nulls last,{group_key},{order}")
    };
    let query = format!(
        "with base as ({base}), filtered as (select * from base where {condition}), expanded as ({expanded}), group_counts as (select {group_key} key,count(*) count,min({group_rank}) rank from expanded group by {group_key}), page as (select entry || jsonb_build_object('groupKey',{group_key},'contributionRoles',coalesce((select jsonb_agg(jsonb_build_object('entityId',entity_id,'value',role_slug,'label',role_label) order by role_label,role_slug,entity_id) from (select distinct c.entity_id entity_id,r.slug role_slug,coalesce(nullif(r.label_ar,''),r.label_en,r.slug) role_label from contributions c join roles r on r.id=c.role_id where c.title_id=expanded.id) work_roles),'[]'::jsonb)) entry,row_number() over(order by {order}) ord from expanded order by {order} limit $8 offset $9) select jsonb_build_object('items',coalesce((select jsonb_agg(entry order by ord) from page),'[]'::jsonb),'total',(select count(*) from expanded),'groups',coalesce((select jsonb_agg(jsonb_build_object('key',key,'count',count) order by rank nulls last,key) from group_counts),'[]'::jsonb),'page',{page},'pageSize',{size})",
        base = base(user.is_admin),
        condition = condition()
    );
    let value = sqlx::query_scalar::<_, SqlJson<Value>>(AssertSqlSafe(query))
        .bind(user.id)
        .bind(view)
        .bind(privacy)
        .bind(sqlx::types::Json(filters))
        .bind(input.q.as_deref().filter(|v| !v.trim().is_empty()))
        .bind(input.year_from)
        .bind(input.year_to)
        .bind(size)
        .bind((page - 1) * size)
        .fetch_one(&pool)
        .await?;
    Ok(Json(value.0))
}
fn membership_groups(group: &str) -> Option<(&'static str, &'static str)> {
    match group {
        "planet" => Some((
            "planets",
            "coalesce((select p.display_order from planets p where p.slug=membership.key and p.is_active),2147483647)",
        )),
        "genre" => Some(("genres", "0")),
        "country" => Some(("countries", "0")),
        _ => None,
    }
}
fn grouping(group: &str) -> (&'static str, &'static str) {
    match group {
        "studio" => ("main_studio", "null::integer"),
        "year" => ("coalesce(catalog_year::text,'unknown')", "-catalog_year"),
        "format" => (
            "entry#>>'{work,format}'",
            "case entry#>>'{work,format}' when 'animated' then 0 when 'live-action' then 1 else 2 end",
        ),
        "audience" => (
            "entry#>>'{classification,audience}'",
            "case entry#>>'{classification,audience}' when 'adult' then 0 when 'young-adult' then 1 when 'teen' then 2 when 'general' then 3 else 4 end",
        ),
        "status" => (
            "entry->>'status'",
            "case entry->>'status' when 'ongoing' then 0 when 'airing' then 0 when 'announced' then 1 when 'completed' then 2 else 3 end",
        ),
        "watchState" => (
            "entry->>'watchState'",
            "case entry->>'watchState' when 'in-progress' then 0 when 'unwatched' then 1 when 'watched' then 2 else 3 end",
        ),
        _ => ("'all'::text", "0"),
    }
}
fn entity_artwork() -> &'static str {
    // Organization images in the existing catalog may use profile instead of logo.
    "case when key in ('contributors','studios') then (select m.asset_id from media_asset_assignments m join media_assets a on a.id=m.asset_id where m.entity_id::text=value and m.role in ('profile','logo') and a.mime_type in ('image/png','image/jpeg','image/webp','image/gif','image/avif') order by case when key='contributors' and m.role='profile' or key='studios' and m.role='logo' then 0 else 1 end,m.is_primary desc,m.id limit 1) else null end"
}

pub(super) async fn options(
    State(pool): State<PgPool>,
    Extension(user): Extension<User>,
    Query(input): Query<Input>,
) -> ApiResult<Json<Value>> {
    let (_, _, view, privacy, _, _) = input.validated()?;
    let groups=facets().iter().map(|(key,label,_)|format!("select '{key}' key,'{label}' label,value,count(*)::bigint count from base cross join lateral jsonb_array_elements_text(facts->'{key}') v(value) group by value")).collect::<Vec<_>>().join(" union all ");
    let labels = r#"case when key in('genres','tones','tags','countries') then coalesce((select coalesce(label_ar,label_en) from (select 'genres' vocab,slug,label_ar,label_en from genres union all select 'tones',slug,label_ar,label_en from tones union all select 'tags',slug,label_ar,label_en from tags union all select 'countries',slug,label_ar,label_en from countries) vocabulary where vocab=key and slug=value limit 1),value) when key in('contributors','studios') then coalesce((select name from entities where id::text=value),value) when key='contributionRoles' then coalesce((select coalesce(nullif(label_ar,''),label_en) from roles where slug=value limit 1),value) when key='planets' then coalesce((select icon||' '||name_ar from planets where slug=value),value) else value end"#;
    let search_terms = r#"to_jsonb(array[value,display] || case when key in('genres','tones','tags','countries') then array(select concat_ws(' ',label_en,label_ar,slug) from (select 'genres' vocab,slug,label_ar,label_en from genres union all select 'tones',slug,label_ar,label_en from tones union all select 'tags',slug,label_ar,label_en from tags union all select 'countries',slug,label_ar,label_en from countries) v where v.vocab=key and v.slug=value) when key='planets' then array(select concat_ws(' ',name_ar,name_en,slug) from planets where slug=value) when key in('contributors','studios') then array(select concat_ws(' ',name,sort_name) from entities where id::text=value) || array(select alias from entity_aliases where entity_id::text=value) when key='contributionRoles' then array(select concat_ws(' ',slug,label_ar,label_en) from roles where slug=value) when key='awardPrograms' then array(select concat_ws(' ',slug,name_ar,name_en) from award_organizations where slug=value) when key='awardCategories' then array(select concat_ws(' ',slug,name_ar,name_en) from award_categories where name_ar=value or name_en=value or slug=value) else array[]::text[] end)"#;
    let artwork = entity_artwork();
    let query = format!(
        "with base as ({base}), options as ({groups}), labelled as (select *,{labels} display from options), grouped as(select key,label,jsonb_agg(jsonb_build_object('value',value,'label',display,'searchTerms',({search_terms}),'count',count,'artworkId',({artwork})) || case when key in ('studios','contributors') then jsonb_build_object('languages',coalesce((select jsonb_agg(distinct language order by language) from contributions c cross join lateral unnest(c.languages) language where c.entity_id::text=labelled.value and exists(select 1 from base b where b.id=c.title_id)),'[]'::jsonb),'roles',coalesce((select jsonb_agg(jsonb_build_object('value',role_slug,'label',role_label,'languages',languages) order by role_label,role_slug) from (select r.slug role_slug,coalesce(nullif(r.label_ar,''),r.label_en,r.slug) role_label,coalesce((select jsonb_agg(distinct language order by language) from contributions x cross join lateral unnest(x.languages) language where x.entity_id=c.entity_id and x.role_id=c.role_id and exists(select 1 from base b where b.id=x.title_id)),'[]'::jsonb) languages from contributions c join roles r on r.id=c.role_id where c.entity_id::text=labelled.value and exists(select 1 from base b where b.id=c.title_id) group by r.slug,r.label_ar,r.label_en,c.entity_id,c.role_id) entity_roles),'[]'::jsonb)) else '{{}}'::jsonb end order by count desc,value) options from labelled group by key,label) select jsonb_build_object('groups',coalesce((select jsonb_agg(jsonb_build_object('key',key,'label',label,'options',options) order by key) from grouped),'[]'::jsonb),'yearMin',(select min(catalog_year) from base),'yearMax',(select max(catalog_year) from base))",
        base = base(user.is_admin)
    );
    let value = sqlx::query_scalar::<_, SqlJson<Value>>(AssertSqlSafe(query))
        .bind(user.id)
        .bind(view)
        .bind(privacy)
        .fetch_one(&pool)
        .await?;
    Ok(Json(value.0))
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn entity_images_use_registered_portraits_and_organization_fallbacks() {
        let sql = entity_artwork();
        assert!(sql.contains("m.entity_id::text=value"));
        assert!(sql.contains("key='contributors' and m.role='profile'"));
        assert!(sql.contains("key='studios' and m.role='logo'"));
        assert!(sql.contains("m.role in ('profile','logo')"));
        assert!(sql.contains("m.is_primary desc,m.id limit 1"));
        assert!(!sql.contains("image/svg+xml"));
    }

    #[test]
    fn bounds_and_facet_names_are_validated() {
        assert!(
            Input {
                filters: Some(
                    r#"{"facets":[{"key":"secret","include":["x"],"exclude":[]}]}"#.into()
                ),
                ..Input::default()
            }
            .validated()
            .is_err()
        );
        assert!(
            Input {
                page_size: Some(101),
                ..Input::default()
            }
            .validated()
            .is_err()
        );
        assert!(Input::default().validated().is_ok());
    }
}
