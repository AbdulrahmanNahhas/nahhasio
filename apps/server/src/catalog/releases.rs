//! Public, recorded release dates only: no inferred episode schedule or media availability.
use super::{ApiError, ApiResult, home, queries};
use crate::auth::User;
use axum::{
    Extension, Json,
    extract::{Query, State, rejection::QueryRejection},
    http::StatusCode,
};
use serde::Deserialize;
use serde_json::Value;
use sqlx::{AssertSqlSafe, PgPool, types::Json as SqlJson};

#[derive(Default, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct Input {
    year: Option<i32>,
    month: Option<i32>,
    season: Option<i32>,
    day: Option<i32>,
    kind: Option<String>,
    scope: Option<String>,
    page: Option<i64>,
    page_size: Option<i64>,
}
fn invalid() -> ApiError {
    ApiError(StatusCode::BAD_REQUEST, "Invalid releases query")
}
impl Input {
    fn validate(&self) -> ApiResult<(i64, i64, &str, &str)> {
        let page = self.page.unwrap_or(1);
        let size = self.page_size.unwrap_or(24);
        let kind = self.kind.as_deref().unwrap_or("all");
        let scope = self.scope.as_deref().unwrap_or("year");
        if !(1..=100_000).contains(&page)
            || !(1..=100).contains(&size)
            || self.year.is_some_and(|n| !(1..=9999).contains(&n))
            || self.month.is_some_and(|n| !(1..=12).contains(&n))
            || self.season.is_some_and(|n| !(1..=4).contains(&n))
            || (self.season.is_some()
                && (scope != "year" || self.month.is_some() || self.day.is_some()))
            || self.day.is_some_and(|n| !(1..=31).contains(&n))
            || (self.day.is_some() && (scope != "year" || self.month.is_none()))
            || !matches!(kind, "all" | "installments" | "episodes")
            || !matches!(scope, "year" | "upcoming" | "undated")
            || (scope != "year" && (self.year.is_some() || self.month.is_some()))
        {
            return Err(invalid());
        }
        Ok((page, size, kind, scope))
    }
}

const ENTRIES: &str = r#"with entries as (
select i.id,t.id work_id,t.sort_title,i.id installment_id,i.position installment_position,
-1 episode_position,i.title,i.release_date,i.runtime_minutes,i.status::text status,'installment'::text kind,
null::text episode_number
from installments i join titles t on t.id=i.title_id where (not t.is_private and t.workflow_status='published')
union all
select e.id,t.id,t.sort_title,i.id,i.position,e.position,e.title,e.release_date,e.runtime_minutes,
i.status::text,'episode'::text,e.number::text
from episodes e join installments i on i.id=e.installment_id join titles t on t.id=i.title_id
where (not t.is_private and t.workflow_status='published')
), filtered as (
select * from entries where ($1='all' or ($1='installments' and kind='installment') or ($1='episodes' and kind='episode'))
and case $2
when 'year' then extract(year from release_date)=coalesce($3::integer,extract(year from current_date)::integer)
    and ($4::integer is null or extract(month from release_date)=$4)
    and ($7::integer is null or extract(day from release_date)=$7)
    and ($8::integer is null or extract(quarter from release_date)=$8)
when 'upcoming' then release_date>=current_date
when 'undated' then release_date is null and ((kind='installment' and status='announced') or (kind='episode' and status in ('announced','airing')))
else false end
), day_counts as (
select release_date,count(*) count from filtered where release_date is not null group by release_date
), page_entries as (
select * from filtered order by release_date asc nulls last,sort_title,installment_position,episode_position,kind,id
limit $6::bigint offset (($5::bigint-1)*$6::bigint)
)"#;
// The same typed item projection is used for paginated cards and bounded calendar previews.
fn item() -> String {
    format!(
        r#"jsonb_build_object(
'id',p.id,'workId',t.id,'workTitle',t.canonical_title,'workTitleAr',t.title_ar,
'installmentId',i.id,'installmentTitle',i.title,'installmentKind',i.kind,
'episodeNumber',p.episode_number,'title',p.title,'kind',p.kind,
'releaseDate',to_char(p.release_date,'YYYY-MM-DD'),'status',p.status,'runtimeMinutes',p.runtime_minutes,
'episodeCount',case when p.kind='installment' then (select count(*) from episodes e where e.installment_id=i.id) else null end,
'poster',(select {artwork} from media_asset_assignments m join media_assets a on a.id=m.asset_id
where m.role='poster' and (m.installment_id=i.id or m.title_id=t.id)
order by (m.installment_id=i.id) desc nulls last,m.is_primary desc,m.id limit 1))"#,
        artwork = queries::ARTWORK
    )
}
fn query() -> String {
    let installment = format!(
        r#"jsonb_build_object('id',i.id,'workId',t.id,'workTitle',t.canonical_title,'workTitleAr',t.title_ar,'title',i.title,'kind',i.kind,'releaseDate',to_char(i.release_date,'YYYY-MM-DD'),'runtimeMinutes',i.runtime_minutes,'episodeCount',(select count(*) from episodes where installment_id=i.id),'poster',({item})->'poster','score',(select jsonb_build_object('rating',floor(({score})*10+0.5)/10,'scored',case when ({score}) is null then 0 else 1 end,'total',1) from (select 1) unit left join installment_scores s on s.installment_id=i.id))"#,
        item = item(),
        score = queries::SCORE_VALUE
    );
    format!(
        r#"{ENTRIES}
select jsonb_build_object('items',coalesce((select jsonb_agg(({item}) || jsonb_build_object('work',({summary}),'installment',({installment}),'viewing',case when p.kind='episode' and $7::integer is not null then ({viewing}) else null end)
order by p.release_date asc nulls last,p.sort_title,p.installment_position,p.episode_position,p.kind,p.id)
from page_entries p join titles t on t.id=p.work_id join installments i on i.id=p.installment_id
left join episodes e on e.id=p.id and p.kind='episode'
left join account_playback_states ps on ps.account_id=(select id from accounts where auth_user_id=$9 and status='active') and ps.installment_id=i.id and ps.episode_id=e.id),'[]'::jsonb),
'total',(select count(*) from filtered),'page',$5::bigint,'pageSize',$6::bigint,
'days',coalesce((select jsonb_agg(jsonb_build_object('date',to_char(d.release_date,'YYYY-MM-DD'),'count',d.count,
'previews',case when $4::integer is not null and $1='episodes' then coalesce((select jsonb_agg({item} order by p.sort_title,p.installment_position,p.episode_position,p.id)
from (select * from (select distinct on (installment_id) * from filtered where release_date=d.release_date order by installment_id,episode_position,id) representatives order by sort_title,installment_position,episode_position,id limit 3) p
join titles t on t.id=p.work_id join installments i on i.id=p.installment_id),'[]'::jsonb) else '[]'::jsonb end)
order by d.release_date) from day_counts d),'[]'::jsonb),
'years',coalesce((select jsonb_agg(known_year order by known_year) from
(select distinct extract(year from release_date)::integer as known_year from entries where release_date is not null
and extract(year from release_date) between 1 and 9999) known_years),'[]'::jsonb),
'asOf',to_char(current_date,'YYYY-MM-DD'))"#,
        item = item(),
        summary = queries::summary(),
        viewing = home::viewing_item(false),
    )
}

pub(super) async fn releases(
    State(pool): State<PgPool>,
    Extension(user): Extension<User>,
    input: Result<Query<Input>, QueryRejection>,
) -> ApiResult<Json<Value>> {
    let Query(input) = input.map_err(|_| invalid())?;
    let (page, size, kind, scope) = input.validate()?;
    let result = sqlx::query_scalar::<_, SqlJson<Value>>(AssertSqlSafe(query()))
        .bind(kind)
        .bind(scope)
        .bind(input.year)
        .bind(input.month)
        .bind(page)
        .bind(size)
        .bind(input.day)
        .bind(input.season)
        .bind(&user.id)
        .fetch_one(&pool)
        .await?;
    Ok(Json(result.0))
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{body::Body, http::Request};
    use tower::ServiceExt;

    #[test]
    fn validates_bounds_choices_and_scope_combinations() {
        assert_eq!(Input::default().validate().unwrap(), (1, 24, "all", "year"));
        for value in [
            serde_json::json!({"year":0}),
            serde_json::json!({"year":10000}),
            serde_json::json!({"month":0}),
            serde_json::json!({"month":13}),
            serde_json::json!({"month":1,"day":0}),
            serde_json::json!({"month":1,"day":32}),
            serde_json::json!({"day":1}),
            serde_json::json!({"scope":"upcoming","month":1,"day":1}),
            serde_json::json!({"scope":"undated","day":1}),
            serde_json::json!({"page":0}),
            serde_json::json!({"page":100001}),
            serde_json::json!({"pageSize":0}),
            serde_json::json!({"pageSize":101}),
            serde_json::json!({"kind":"private"}),
            serde_json::json!({"scope":"available"}),
            serde_json::json!({"scope":"upcoming","year":2026}),
            serde_json::json!({"scope":"undated","month":1}),
        ] {
            assert!(
                serde_json::from_value::<Input>(value)
                    .unwrap()
                    .validate()
                    .is_err()
            );
        }
        assert!(
            serde_json::from_value::<Input>(serde_json::json!({"includePrivate":true})).is_err()
        );
        for day in [1, 31] {
            let input: Input =
                serde_json::from_value(serde_json::json!({"month":2,"day":day,"pageSize":1}))
                    .unwrap();
            assert!(input.validate().is_ok());
        }
        for scope in ["year", "upcoming", "undated"] {
            for kind in ["all", "installments", "episodes"] {
                let input: Input = serde_json::from_value(
                    serde_json::json!({"scope":scope,"kind":kind,"pageSize":100}),
                )
                .unwrap();
                assert!(input.validate().is_ok());
            }
        }
    }

    fn unavailable_database() -> PgPool {
        sqlx::postgres::PgPoolOptions::new()
            .connect_lazy("postgres://localhost:1/unavailable")
            .unwrap()
    }

    #[tokio::test]
    async fn route_requires_owner_authentication_before_database_access() {
        let response = crate::router(unavailable_database())
            .oneshot(
                Request::get("/api/v1/releases")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    }

    #[tokio::test]
    async fn malformed_queries_fail_before_database_access() {
        for query in [
            "year=no",
            "kind=private",
            "pageSize=101",
            "includePrivate=true",
            "month=1&month=2",
            "scope=undated&year=2026",
            "day=1",
            "month=1&day=0",
            "month=1&day=32",
            "month=1&day=1.5",
            "month=1&day=1&day=2",
            "scope=upcoming&month=1&day=1",
        ] {
            let response = super::super::routes(unavailable_database())
                // The real router installs this after authentication. Supply it here so
                // malformed query handling, rather than a missing extension, is exercised.
                .layer(Extension(User {
                    id: "fixture-release-user".into(),
                    name: "Fixture".into(),
                    email: "fixture@example.invalid".into(),
                    role: "member".into(),
                    account_id: "00000000-0000-4000-8000-000000000001".into(),
                    kind: "family".into(),
                    avatar_key: "orbit".into(),
                    bio: String::new(),
                    is_admin: false,
                    updated_at: String::new(),
                    unrestricted: false,
                }))
                .oneshot(
                    Request::get(format!("/api/v1/releases?{query}"))
                        .body(Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();
            assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        }
    }

    #[test]
    fn query_uses_actual_dates_public_rows_and_bounded_stable_order() {
        let sql = query();
        assert!(sql.contains("e.title,e.release_date,e.runtime_minutes"));
        assert_eq!(
            sql.matches("where (not t.is_private and t.workflow_status='published')")
                .count(),
            2
        );
        // Work-card metadata may display a release year; scheduling must use real dates.
        assert!(!ENTRIES.contains("release_year"));
        assert!(sql.contains("limit $6::bigint offset"));
        assert!(sql.contains(
            "release_date asc nulls last,sort_title,installment_position,episode_position,kind,id"
        ));
        assert!(sql.contains("when 'upcoming' then release_date>=current_date"));
        assert!(
            sql.contains("select distinct extract(year from release_date)::integer as known_year")
        );
        assert!(sql.contains("and ($7::integer is null or extract(day from release_date)=$7)"));
        assert!(sql.contains("select release_date,count(*) count from filtered where release_date is not null group by release_date"));
        assert!(sql.find("day_counts as (").unwrap() < sql.find("page_entries as (").unwrap());
        assert!(sql.contains("order by d.release_date) from day_counts d),'[]'::jsonb)"));
    }
}
