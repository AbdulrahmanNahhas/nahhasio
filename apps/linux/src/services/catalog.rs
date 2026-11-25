//! Catalog queries and viewer resources; payloads never select arbitrary URLs.
use super::{Error, Request, ServerSession, parse, valid_id};
use super::{Resource, artwork::sanitize_release_posters, transport::network};
use base64::{Engine as _, engine::general_purpose::STANDARD};
use reqwest::Method;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Browse {
    #[serde(skip_serializing_if = "Option::is_none")]
    page: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    page_size: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    q: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    sort: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    format: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    audience: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    genre: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    status: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    year_from: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    year_to: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    include_private: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    planet: Option<String>,
}
#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct CatalogQuery {
    #[serde(skip_serializing_if = "Option::is_none")]
    page: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    page_size: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    q: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    sort: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    group: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    view: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    privacy: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    filters: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    year_from: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    year_to: Option<u32>,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct TrailersQuery {
    #[serde(skip_serializing_if = "Option::is_none")]
    page: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    page_size: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    q: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    format: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    sort: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    media: Option<String>,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct EpisodesQuery {
    #[serde(skip_serializing_if = "Option::is_none")]
    kind: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    visibility: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    include_movies: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    page: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    page_size: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    watch_state: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    include_private: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    q: Option<String>,
}

#[derive(Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ReleasesQuery {
    #[serde(skip_serializing_if = "Option::is_none")]
    year: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    month: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    season: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    day: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    kind: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    scope: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    page: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    page_size: Option<u32>,
}
impl ReleasesQuery {
    fn validate(&self) -> Result<(), Error> {
        let scope = self.scope.as_deref().unwrap_or("year");
        if self.year.is_some_and(|n| !(1..=9999).contains(&n))
            || self.month.is_some_and(|n| !(1..=12).contains(&n))
            || self.season.is_some_and(|n| !(1..=4).contains(&n))
            || (self.season.is_some()
                && (scope != "year" || self.month.is_some() || self.day.is_some()))
            || self.day.is_some_and(|n| !(1..=31).contains(&n))
            || (self.day.is_some() && (scope != "year" || self.month.is_none()))
            || self.page.is_some_and(|n| !(1..=100_000).contains(&n))
            || self.page_size.is_some_and(|n| !(1..=100).contains(&n))
            || !matches!(
                self.kind.as_deref().unwrap_or("all"),
                "all" | "installments" | "episodes"
            )
            || !matches!(scope, "year" | "upcoming" | "undated")
            || (scope != "year" && (self.year.is_some() || self.month.is_some()))
        {
            return Err(Error::new("bad_request", "Invalid releases query"));
        }
        Ok(())
    }
}
#[derive(Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
struct AwardsQuery {
    #[serde(skip_serializing_if = "Option::is_none")]
    slug: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    year: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    page: Option<u32>,
}

impl ServerSession {
    pub(super) async fn execute_catalog(&self, request: Request) -> Result<Value, Error> {
        match request.command.as_str() {
            "awards" => {
                let input: AwardsQuery = parse(request.payload)?;
                let response = self
                    .authorized(Method::GET, "api/v1/catalog/awards")
                    .await?
                    .query(&input)
                    .send()
                    .await
                    .map_err(network)?;
                self.json(response).await
            }
            "releases" => {
                let input: ReleasesQuery = parse(request.payload)?;
                input.validate()?;
                let response = self
                    .authorized(Method::GET, "api/v1/releases")
                    .await?
                    .query(&input)
                    .send()
                    .await
                    .map_err(network)?;
                let mut value = self.json(response).await?;
                sanitize_release_posters(&mut value);
                Ok(value)
            }
            "works" => {
                let input: Browse = parse(request.payload)?;
                if input.page_size.is_some_and(|n| n > 100 || n == 0)
                    || input.page.is_some_and(|n| n == 0 || n > 100_000)
                    || input.q.as_ref().is_some_and(|q| q.chars().count() > 200)
                {
                    return Err(Error::new("bad_request", "Invalid catalog pagination"));
                }
                let response = self
                    .authorized(Method::GET, "api/v1/works")
                    .await?
                    .query(&input)
                    .send()
                    .await
                    .map_err(network)?;
                self.json(response).await
            }
            "browse" | "facets" => {
                let input: CatalogQuery = parse(request.payload)?;
                if input.page_size.is_some_and(|n| n == 0 || n > 100)
                    || input.page.is_some_and(|n| n == 0 || n > 100_000)
                    || input.q.as_ref().is_some_and(|v| v.chars().count() > 200)
                    || input.filters.as_ref().is_some_and(|v| v.len() > 8000)
                    || input.group.as_deref().is_some_and(|v| {
                        !matches!(
                            v,
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
                    })
                {
                    return Err(Error::new("bad_request", "Invalid catalog query"));
                }
                let browse = request.command == "browse";
                let path = if browse {
                    "api/v1/catalog/browse"
                } else {
                    "api/v1/catalog/facets"
                };
                let mut request = self.authorized(Method::GET, path).await?.query(&input);
                if browse {
                    request = request.header("Prefer", "include=installment-banner");
                }
                let response = request.send().await.map_err(network)?;
                self.json(response).await
            }

            "trailers" => {
                let input: TrailersQuery = parse(request.payload)?;
                if input.page.is_some_and(|n| !(1..=100_000).contains(&n))
                    || input.page_size.is_some_and(|n| !(1..=60).contains(&n))
                    || input.q.as_ref().is_some_and(|q| q.chars().count() > 200)
                    || input
                        .format
                        .as_deref()
                        .is_some_and(|v| !matches!(v, "animated" | "live-action"))
                    || input
                        .sort
                        .as_deref()
                        .is_some_and(|v| !matches!(v, "newest" | "title"))
                    || input
                        .media
                        .as_deref()
                        .is_some_and(|v| !matches!(v, "music" | "trailer"))
                {
                    return Err(Error::new("bad_request", "Invalid trailer filters"));
                }
                let response = self
                    .authorized(Method::GET, "api/v1/catalog/trailers")
                    .await?
                    .query(&input)
                    .send()
                    .await
                    .map_err(network)?;
                self.json(response).await
            }
            "episodes" => {
                let input: EpisodesQuery = parse(request.payload)?;
                if input.page.is_some_and(|n| !(1..=100_000).contains(&n))
                    || input.page_size.is_some_and(|n| !(1..=100).contains(&n))
                    || input
                        .watch_state
                        .as_deref()
                        .is_some_and(|v| !matches!(v, "all" | "watched" | "unwatched"))
                    || input.q.as_ref().is_some_and(|q| q.chars().count() > 200)
                {
                    return Err(Error::new("bad_request", "Invalid episode pagination"));
                }
                let response = self
                    .authorized(Method::GET, "api/v1/catalog/episodes")
                    .await?
                    .query(&input)
                    .send()
                    .await
                    .map_err(network)?;
                self.json(response).await
            }
            "recommendations" => {
                let resource: Resource = parse(request.payload)?;
                if !valid_id(&resource.id) {
                    return Err(Error::new("bad_request", "Invalid catalog identifier"));
                }
                let response = self
                    .authorized(Method::GET, "api/v1/catalog/recommendations")
                    .await?
                    .query(&[("workId", resource.id)])
                    .send()
                    .await
                    .map_err(network)?;
                self.json(response).await
            }
            "filters" | "home" => {
                let response = self
                    .authorized(
                        Method::GET,
                        if request.command == "home" {
                            "api/v1/catalog/home"
                        } else {
                            "api/v1/catalog/filters"
                        },
                    )
                    .await?
                    .send()
                    .await
                    .map_err(network)?;
                self.json(response).await
            }
            "work" | "artwork" => {
                let resource: Resource = parse(request.payload)?;
                if !valid_id(&resource.id) {
                    return Err(Error::new("bad_request", "Invalid catalog identifier"));
                }
                let is_art = request.command == "artwork";
                let path = format!(
                    "api/v1/{}/{}",
                    if is_art { "artwork" } else { "works" },
                    resource.id
                );
                let response = self
                    .authorized(Method::GET, &path)
                    .await?
                    .send()
                    .await
                    .map_err(network)?;
                if !is_art {
                    return self.json(response).await;
                }
                if response.status() == reqwest::StatusCode::UNAUTHORIZED {
                    self.invalidate_session().await?;
                    return Err(Error::new(
                        "unauthorized",
                        "Your session has expired. Sign in again.",
                    ));
                }
                if !response.status().is_success() {
                    return Err(Error::new("server", "Artwork is currently unavailable"));
                }
                let mime = super::artwork::response_mime(&response).to_owned();
                if !super::artwork::supported_mime(&mime) {
                    return Err(Error::new("response", "Unsupported artwork format"));
                }
                let bytes = self
                    .body(response, super::artwork::ARTWORK_BODY_LIMIT)
                    .await?;
                Ok(json!({"dataUrl":format!("data:{mime};base64,{}",STANDARD.encode(bytes))}))
            }
            _ => Err(Error::new("bad_request", "Unknown desktop command")),
        }
    }
}
