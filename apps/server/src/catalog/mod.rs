mod artwork;
mod browse;
mod episodes;
mod home;
mod queries;
mod recommendations;
mod releases;
pub(crate) mod tracking;
mod trailers;
mod viewer_state;

use axum::{
    Json, Router,
    extract::{Path, Query, State, rejection::QueryRejection},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::get,
};
use serde::Deserialize;
use serde_json::{Value, json};
use sqlx::{AssertSqlSafe, PgPool, types::Json as SqlJson};

// The caller installs database-backed viewer authentication and private/policy guards.
pub fn routes(pool: PgPool) -> Router {
    Router::new()
        .route("/api/v1/works", get(works))
        .route("/api/v1/releases", get(releases::releases))
        .route("/api/v1/catalog/browse", get(browse::browse))
        .route("/api/v1/catalog/facets", get(browse::options))
        .route(
            "/api/v1/catalog/recommendations",
            get(recommendations::recommend),
        )
        .route("/api/v1/works/{id}", get(work))
        .route("/api/v1/catalog/filters", get(filters))
        .route("/api/v1/catalog/home", get(home::feed))
        .route("/api/v1/catalog/episodes", get(episodes::list))
        .route("/api/v1/catalog/trailers", get(trailers::list))
        .route("/api/v1/artwork/{id}", get(artwork::serve))
        .merge(viewer_state::routes())
        .with_state(pool)
}

#[derive(Debug)]
pub(super) struct ApiError(pub StatusCode, pub &'static str);
impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (self.0, Json(json!({"message":self.1}))).into_response()
    }
}
impl From<sqlx::Error> for ApiError {
    fn from(error: sqlx::Error) -> Self {
        if let Some(database) = error.as_database_error() {
            tracing::warn!(code=?database.code(),message=database.message(),"catalog query failed");
        } else {
            tracing::warn!(kind=?std::mem::discriminant(&error), "catalog query failed");
        }
        Self(
            StatusCode::SERVICE_UNAVAILABLE,
            "Catalog is temporarily unavailable",
        )
    }
}
type ApiResult<T> = Result<T, ApiError>;

#[derive(Default, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Browse {
    page: Option<i64>,
    page_size: Option<i64>,
    q: Option<String>,
    sort: Option<String>,
    format: Option<String>,
    audience: Option<String>,
    genre: Option<String>,
    status: Option<String>,
    year_from: Option<i32>,
    year_to: Option<i32>,
    include_private: Option<bool>,
    planet: Option<String>,
}
impl Browse {
    fn validate(&self) -> ApiResult<(i64, i64, &'static str)> {
        let page = self.page.unwrap_or(1);
        let size = self.page_size.unwrap_or(24);
        let valid_choice = |value: &Option<String>, choices: &[&str]| {
            value.as_deref().is_none_or(|v| choices.contains(&v))
        };
        if !(1..=100_000).contains(&page)
            || !(1..=100).contains(&size)
            || self.q.as_ref().is_some_and(|q| q.chars().count() > 200)
            || self.genre.as_ref().is_some_and(|v| v.len() > 100)
            || self.planet.as_ref().is_some_and(|v| v.len() > 100)
            || !valid_choice(&self.format, &["animated", "live-action"])
            || !valid_choice(&self.audience, &["general", "teen", "young-adult", "adult"])
            || !valid_choice(
                &self.status,
                &["announced", "airing", "completed", "unknown"],
            )
            || self.year_from.is_some_and(|v| !(1..=9999).contains(&v))
            || self.year_to.is_some_and(|v| !(1..=9999).contains(&v))
            || self.year_from.zip(self.year_to).is_some_and(|(a, b)| a > b)
        {
            return Err(ApiError(StatusCode::BAD_REQUEST, "Invalid catalog filters"));
        }
        let order = match self.sort.as_deref().unwrap_or("title") {
            "title" => "t.sort_title asc,t.id asc",
            "year-desc" => "t.release_year desc nulls last,t.sort_title,t.id",
            "year-asc" => "t.release_year asc nulls last,t.sort_title,t.id",
            "updated-desc" => "t.updated_at desc,t.id",
            "added-desc" => "t.created_at desc,t.id",
            _ => return Err(ApiError(StatusCode::BAD_REQUEST, "Invalid catalog sort")),
        };
        Ok((page, size, order))
    }
}

async fn works(
    State(pool): State<PgPool>,
    input: Result<Query<Browse>, QueryRejection>,
) -> ApiResult<Json<Value>> {
    let Query(input) =
        input.map_err(|_| ApiError(StatusCode::BAD_REQUEST, "Invalid catalog filters"))?;
    let (page, size, order) = input.validate()?;
    let query = format!(
        "select jsonb_build_object('items',coalesce(jsonb_agg(page.item order by page.ordinal),'[]'::jsonb),'total',(select count(*) from titles t where {filter}),'page',$8::bigint,'pageSize',$9::bigint) from (select {summary} as item,row_number() over(order by {order}) ordinal from titles t where {filter} order by {order} limit $9 offset (($8-1)*$9)) page",
        filter = queries::FILTER,
        summary = queries::summary()
    );
    let value = sqlx::query_scalar::<_, SqlJson<Value>>(AssertSqlSafe(query))
        .bind(input.q.as_deref().map(str::trim).filter(|s| !s.is_empty()))
        .bind(input.format)
        .bind(input.audience)
        .bind(input.genre)
        .bind(input.status)
        .bind(input.year_from)
        .bind(input.year_to)
        .bind(page)
        .bind(size)
        .bind(input.include_private.unwrap_or(false))
        .bind(input.planet)
        .fetch_one(&pool)
        .await?;
    Ok(Json(value.0))
}

pub(super) fn validate_id(id: &str) -> ApiResult<()> {
    if id.len() != 36
        || !id.bytes().enumerate().all(|(i, c)| {
            if [8, 13, 18, 23].contains(&i) {
                c == b'-'
            } else {
                c.is_ascii_hexdigit()
            }
        })
    {
        return Err(ApiError(StatusCode::BAD_REQUEST, "Invalid identifier"));
    }
    Ok(())
}

async fn work(State(pool): State<PgPool>, Path(id): Path<String>) -> ApiResult<Json<Value>> {
    validate_id(&id)?;
    let query = format!(
        "select {summary} || ({detail}) from titles t where t.id=$1::uuid",
        summary = queries::summary(),
        detail = queries::DETAIL
    );
    let value = sqlx::query_scalar::<_, SqlJson<Value>>(AssertSqlSafe(query))
        .bind(id)
        .fetch_optional(&pool)
        .await?
        .ok_or(ApiError(StatusCode::NOT_FOUND, "Work not found"))?;
    Ok(Json(value.0))
}

async fn filters(State(pool): State<PgPool>) -> ApiResult<Json<Value>> {
    let value = sqlx::query_scalar::<_, SqlJson<Value>>(r#"select jsonb_build_object(
'genres',coalesce((select jsonb_agg(jsonb_build_object('id',id,'slug',slug,'labelEn',label_en,'labelAr',label_ar,'descriptionEn',description_en,'descriptionAr',description_ar) order by position,slug) from genres where is_active),'[]'::jsonb),
'formats',jsonb_build_array('animated','live-action'),'audiences',jsonb_build_array('general','teen','young-adult','adult'),'statuses',jsonb_build_array('announced','airing','completed','unknown'),
'planets',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'slug',p.slug,'nameAr',p.name_ar,'nameEn',p.name_en,'icon',p.icon,'primaryColor',p.primary_color,'secondaryColor',p.secondary_color,'count',(select count(*) from title_planets tp join titles t on t.id=tp.title_id where tp.planet_id=p.id and not t.is_private and t.workflow_status='published')) order by p.display_order,p.id) from planets p where p.is_active),'[]'::jsonb),
'yearMin',(select min(release_year) from titles where not is_private and workflow_status='published'),'yearMax',(select max(release_year) from titles where not is_private and workflow_status='published'))"#).fetch_one(&pool).await?;
    Ok(Json(value.0))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn browse_rejects_unbounded_pages_and_unknown_sorts() {
        for value in [
            Browse {
                page_size: Some(101),
                ..Browse::default()
            },
            Browse {
                page: Some(0),
                ..Browse::default()
            },
            Browse {
                sort: Some("t.id; drop table titles".into()),
                ..Browse::default()
            },
            Browse {
                year_from: Some(2026),
                year_to: Some(2020),
                ..Browse::default()
            },
        ] {
            assert!(value.validate().is_err());
        }
        assert_eq!(
            Browse::default().validate().unwrap(),
            (1, 24, "t.sort_title asc,t.id asc")
        );
    }
    #[test]
    fn identifiers_are_checked_before_database_access() {
        assert!(validate_id("00000000-0000-0000-0000-000000000000").is_ok());
        assert!(validate_id("../secret").is_err());
    }
}
