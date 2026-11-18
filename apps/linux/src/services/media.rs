//! Authenticated media/upload transport, separate from acquisition engines and UI.
use super::{Error, Request, ServerSession, parse, valid_id};
use super::{Resource, transport::network};
use reqwest::{Method, Response};
use serde_json::{Value, json};
use std::time::Duration;

impl ServerSession {
    pub(crate) async fn upload_start(&self, data: Value) -> Result<Value, Error> {
        let response = self
            .authorized(Method::POST, "api/v1/admin/media/uploads")
            .await?
            .json(&data)
            .send()
            .await
            .map_err(network)?;
        self.json(response).await
    }
    pub(crate) async fn upload_chunk(
        &self,
        id: &str,
        offset: u64,
        bytes: Vec<u8>,
    ) -> Result<Value, Error> {
        if !valid_id(id) || bytes.len() > 8 * 1024 * 1024 {
            return Err(Error::new("bad_request", "Invalid upload chunk"));
        }
        let response = self
            .authorized(Method::PUT, &format!("api/v1/admin/media/uploads/{id}"))
            .await?
            .query(&[("offset", offset)])
            .timeout(Duration::from_secs(180))
            .body(bytes)
            .send()
            .await
            .map_err(network)?;
        self.json(response).await
    }
    pub(crate) async fn upload_complete(&self, id: &str) -> Result<Value, Error> {
        if !valid_id(id) {
            return Err(Error::new("bad_request", "Invalid upload identity"));
        }
        let response = self
            .authorized(
                Method::POST,
                &format!("api/v1/admin/media/uploads/{id}/complete"),
            )
            .await?
            .send()
            .await
            .map_err(network)?;
        self.json(response).await
    }
    pub(crate) async fn media_response(
        &self,
        id: &str,
        method: Method,
        range: Option<&str>,
    ) -> Result<Response, Error> {
        self.media_resource(id, None, method, range).await
    }
    pub(crate) async fn media_subtitle(
        &self,
        id: &str,
        index: usize,
        method: Method,
        range: Option<&str>,
    ) -> Result<Response, Error> {
        if index >= 16 {
            return Err(Error::new("bad_request", "Invalid subtitle identity"));
        }
        self.media_resource(id, Some(index), method, range).await
    }
    async fn media_resource(
        &self,
        id: &str,
        subtitle: Option<usize>,
        method: Method,
        range: Option<&str>,
    ) -> Result<Response, Error> {
        if !valid_id(id) {
            return Err(Error::new("bad_request", "Invalid media identity"));
        }
        let path = subtitle.map_or_else(
            || format!("api/v1/media/{id}/content"),
            |index| format!("api/v1/media/{id}/subtitles/{index}"),
        );
        let mut request = self.authorized(method, &path).await?;
        if let Some(range) = range {
            if range.len() > 256 || !range.starts_with("bytes=") {
                return Err(Error::new("bad_request", "Invalid byte range"));
            }
            request = request.header(reqwest::header::RANGE, range);
        }
        self.media_client
            .execute(request.build().map_err(network)?)
            .await
            .map_err(network)
    }
    pub(super) async fn execute_media(&self, request: Request) -> Result<Value, Error> {
        match request.command.as_str() {
            "homeMedia" => {
                let input: Resource = parse(request.payload)?;
                if !valid_id(&input.id) {
                    return Err(Error::new("bad_request", "Invalid work identity"));
                }
                let response = self
                    .authorized(Method::GET, &format!("api/v1/works/{}/media", input.id))
                    .await?
                    .send()
                    .await
                    .map_err(network)?;
                self.json(response).await
            }
            "adminMedia" | "adminMediaCoverage" | "adminMediaUnits" | "adminMediaIncoming"
            | "adminMediaJobs" | "adminMediaImport" | "adminMediaControl" | "adminMediaYoutube"
            | "adminMediaFile" => {
                let path = match request.command.as_str() {
                    "adminMediaFile" => {
                        let id = request.payload["id"]
                            .as_str()
                            .filter(|id| valid_id(id))
                            .ok_or_else(|| Error::new("bad_request", "Invalid media identity"))?;
                        format!("api/v1/admin/media/{id}")
                    }
                    "adminMediaYoutube" => "api/v1/admin/media/youtube".to_string(),
                    "adminMedia" => "api/v1/admin/media".to_string(),
                    "adminMediaCoverage" => "api/v1/admin/media/coverage".to_string(),
                    "adminMediaUnits" => "api/v1/admin/media/units".to_string(),
                    "adminMediaIncoming" => "api/v1/admin/media/incoming".to_string(),
                    "adminMediaJobs" | "adminMediaImport" => "api/v1/admin/media/jobs".to_string(),
                    _ => {
                        let id = request.payload["id"]
                            .as_str()
                            .filter(|id| valid_id(id))
                            .ok_or_else(|| Error::new("bad_request", "Invalid job identity"))?;
                        format!("api/v1/admin/media/jobs/{id}")
                    }
                };
                let post = matches!(
                    request.command.as_str(),
                    "adminMediaImport"
                        | "adminMediaControl"
                        | "adminMediaYoutube"
                        | "adminMediaFile"
                );
                let mut call = self
                    .authorized(if post { Method::POST } else { Method::GET }, &path)
                    .await?;
                if request.command == "adminMediaFile" {
                    call=call.json(&json!({"action":request.payload["action"],"workId":request.payload["workId"],"installmentId":request.payload["installmentId"],"episodeId":request.payload["episodeId"],"expectedRevision":request.payload["expectedRevision"],"replacementFileId":request.payload["replacementFileId"]}));
                } else if request.command == "adminMediaControl" {
                    call = call.json(&json!({"action":request.payload["action"]}));
                } else if post {
                    call = call.json(&request.payload);
                } else {
                    call = call.query(&request.payload);
                }
                self.json(call.send().await.map_err(network)?).await
            }
            _ => Err(Error::new("bad_request", "Unknown desktop command")),
        }
    }
}
