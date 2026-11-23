use axum::{
    Json,
    extract::{Query, State, rejection::QueryRejection},
    http::StatusCode,
};
use serde::Deserialize;
use serde_json::Value;
use sqlx::{PgPool, types::Json as SqlJson};

use super::{ApiError, ApiResult};

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct AwardsQuery {
    slug: Option<String>,
    year: Option<String>,
    page: Option<i64>,
}

pub(super) async fn list(
    State(pool): State<PgPool>,
    input: Result<Query<AwardsQuery>, QueryRejection>,
) -> ApiResult<Json<Value>> {
    let invalid = || ApiError(StatusCode::BAD_REQUEST, "Invalid awards query");
    let Query(input) = input.map_err(|_| invalid())?;
    let page = input.page.unwrap_or(1);
    if !(1..=100_000).contains(&page)
        || input
            .slug
            .as_ref()
            .is_some_and(|slug| slug.trim().is_empty() || slug.chars().count() > 200)
        || input.year.as_ref().is_some_and(|year| {
            input.slug.is_none()
                || (year != "undated"
                    && !(year.len() == 4
                        && year
                            .parse::<u32>()
                            .is_ok_and(|n| (1900..=2100).contains(&n))))
        })
    {
        return Err(invalid());
    }
    let value = sqlx::query_scalar::<_, SqlJson<Value>>(include_str!("awards.sql"))
        .bind(input.slug)
        .bind(input.year)
        .bind(page)
        .fetch_one(&pool)
        .await?;
    Ok(Json(value.0))
}
