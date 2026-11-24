//! Work tracking and discussion commands with exact target validation.
use super::{Error, Request, ServerSession, parse, valid_id};
use super::{Resource, transport::network};
use reqwest::Method;
use serde::Deserialize;
use serde_json::{Value, json};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct CommentCommand {
    id: String,
    data: CommentData,
}
#[derive(serde::Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct CommentData {
    action: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    kind: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    rating: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    comment_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    parent_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    body: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    contains_spoilers: Option<bool>,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct FavoriteCommand {
    work_id: String,
    is_favorite: bool,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct WatchedCommand {
    work_id: String,
    installment_id: Option<String>,
    episode_id: Option<String>,
    is_played: bool,
}
impl WatchedCommand {
    fn validate(&self) -> Result<(), Error> {
        if !valid_id(&self.work_id)
            || self
                .installment_id
                .as_deref()
                .is_some_and(|id| !valid_id(id))
            || self.episode_id.as_deref().is_some_and(|id| !valid_id(id))
            || (self.episode_id.is_some() && self.installment_id.is_none())
        {
            return Err(Error::new("bad_request", "Invalid watched target"));
        }
        Ok(())
    }
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ActivityCommand {
    id: String,
    page: u32,
    #[serde(default)]
    include_own_review: bool,
}
impl ServerSession {
    pub(super) async fn execute_tracking(&self, request: Request) -> Result<Value, Error> {
        match request.command.as_str() {
            "workState" => {
                let input: Resource = parse(request.payload)?;
                if !valid_id(&input.id) {
                    return Err(Error::new("bad_request", "Invalid work identifier"));
                }
                let response = self
                    .authorized(Method::GET, &format!("api/v1/works/{}/state", input.id))
                    .await?
                    .send()
                    .await
                    .map_err(network)?;
                self.json(response).await
            }
            "setFavorite" => {
                let input: FavoriteCommand = parse(request.payload)?;
                if !valid_id(&input.work_id) {
                    return Err(Error::new("bad_request", "Invalid work identifier"));
                }
                let response = self
                    .authorized(
                        Method::PUT,
                        &format!("api/v1/works/{}/favorite", input.work_id),
                    )
                    .await?
                    .json(&json!({"isFavorite":input.is_favorite}))
                    .send()
                    .await
                    .map_err(network)?;
                self.json(response).await
            }
            "setWatched" => {
                let input: WatchedCommand = parse(request.payload)?;
                input.validate()?;
                let response = self.authorized(Method::PATCH, &format!("api/v1/works/{}/watched",input.work_id)).await?
                    .json(&json!({"installmentId":input.installment_id,"episodeId":input.episode_id,"isPlayed":input.is_played}))
                    .send().await.map_err(network)?;
                self.json(response).await
            }
            "syncTracking" => {
                let work = request.payload["workId"]
                    .as_str()
                    .filter(|id| valid_id(id))
                    .ok_or_else(|| Error::new("bad_request", "Invalid tracking target"))?;
                let mut payload = request.payload.clone();
                payload
                    .as_object_mut()
                    .ok_or_else(|| Error::new("bad_request", "Invalid tracking request"))?
                    .remove("workId");
                let response = self
                    .authorized(Method::PATCH, &format!("api/v1/works/{work}/tracking"))
                    .await?
                    .json(&payload)
                    .send()
                    .await
                    .map_err(network)?;
                if response.status() == reqwest::StatusCode::CONFLICT {
                    return Err(Error::new(
                        "conflict",
                        "تغيّرت حالة المشاهدة على الخادم. اختر نسخة الجهاز أو الخادم.",
                    ));
                }
                self.json(response).await
            }
            "workComment" => {
                let input: CommentCommand = parse(request.payload)?;
                if !valid_id(&input.id)
                    || !matches!(input.data.action.as_str(), "create" | "update" | "delete")
                    || !matches!(
                        input.data.kind.as_deref(),
                        None | Some("comment" | "review")
                    )
                    || input
                        .data
                        .rating
                        .is_some_and(|rating| !(1..=5).contains(&rating))
                    || input
                        .data
                        .comment_id
                        .as_ref()
                        .is_some_and(|id| !valid_id(id))
                    || input
                        .data
                        .parent_id
                        .as_ref()
                        .is_some_and(|id| !valid_id(id))
                    || input
                        .data
                        .body
                        .as_ref()
                        .is_some_and(|body| body.chars().count() > 1200)
                {
                    return Err(Error::new("bad_request", "Invalid comment"));
                }
                let response = self
                    .authorized(Method::POST, &format!("api/v1/works/{}/comments", input.id))
                    .await?
                    .json(&input.data)
                    .send()
                    .await
                    .map_err(network)?;
                self.json(response).await
            }
            "workActivity" => {
                let input: ActivityCommand = parse(request.payload)?;
                if !valid_id(&input.id) || !(1..=100_000).contains(&input.page) {
                    return Err(Error::new("bad_request", "Invalid discussion query"));
                }
                let request = self
                    .authorized(Method::GET, &format!("api/v1/works/{}/activity", input.id))
                    .await?
                    .query(&[("page", input.page)]);
                let request = if input.include_own_review {
                    request.query(&[("includeOwnReview", true)])
                } else {
                    request
                };
                let response = request.send().await.map_err(network)?;
                self.json(response).await
            }
            _ => Err(Error::new("bad_request", "Unknown desktop command")),
        }
    }
}
