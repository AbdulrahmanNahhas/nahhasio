//! Fixed-route administration commands and bounded editor documents.
use super::{Error, Request, ServerSession, parse, valid_id};
use super::{Resource, transport::network};
use reqwest::Method;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::time::Duration;

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct AdminWorksQuery {
    #[serde(skip_serializing_if = "Option::is_none")]
    page: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    page_size: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    q: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    format: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    structure: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    workflow: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    visibility: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    gap: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    sort: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    language: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    status: Option<String>,
}
impl ServerSession {
    pub(super) async fn execute_admin(&self, request: Request) -> Result<Value, Error> {
        match request.command.as_str() {
            "editorCall" => {
                let response = self
                    .authorized(Method::POST, "api/v1/admin/editor")
                    .await?
                    .timeout(Duration::from_secs(60))
                    .json(&request.payload)
                    .send()
                    .await
                    .map_err(network)?;
                self.editor_reply(response).await
            }
            "workDocument" => {
                let input: Resource = parse(request.payload)?;
                if !valid_id(&input.id) {
                    return Err(Error::new("bad_request", "Invalid work identifier"));
                }
                let response = self
                    .authorized(Method::GET, &format!("api/v1/admin/works/{}", input.id))
                    .await?
                    .send()
                    .await
                    .map_err(network)?;
                self.json_limit(response, 16 * 1024 * 1024).await
            }
            "workRead" | "workReview" | "workSave" => {
                let path = match request.command.as_str() {
                    "workRead" => "api/v1/admin/works/read",
                    "workReview" => "api/v1/admin/works/review",
                    _ => "api/v1/admin/works/save",
                };
                // Typed UI contracts and strict server schemas bound documents; destination is fixed.
                let response = self
                    .authorized(Method::POST, path)
                    .await?
                    .json(&request.payload)
                    .send()
                    .await
                    .map_err(network)?;
                self.json_limit(response, 16 * 1024 * 1024).await
            }
            "adminWorks" | "adminWorksSelection" => {
                let input: AdminWorksQuery = parse(request.payload)?;
                if input.page.is_some_and(|v| !(1..=100_000).contains(&v))
                    || input.page_size.is_some_and(|v| !(1..=100).contains(&v))
                    || input.q.as_ref().is_some_and(|v| v.chars().count() > 200)
                    || [
                        &input.format,
                        &input.structure,
                        &input.workflow,
                        &input.visibility,
                        &input.gap,
                        &input.language,
                        &input.status,
                        &input.sort,
                    ]
                    .iter()
                    .any(|v| v.as_ref().is_some_and(|s| s.len() > 32))
                {
                    return Err(Error::new("bad_request", "Invalid administration query"));
                }
                let response = self
                    .authorized(
                        Method::GET,
                        if request.command == "adminWorksSelection" {
                            "api/v1/admin/works/selection"
                        } else {
                            "api/v1/admin/works"
                        },
                    )
                    .await?
                    .query(&input)
                    .send()
                    .await
                    .map_err(network)?;
                self.json_limit(response, 16 * 1024 * 1024).await
            }
            "databaseSchema" | "databaseRows" => {
                #[derive(Deserialize)]
                #[serde(rename_all = "camelCase", deny_unknown_fields)]
                struct Inspection {
                    table: Option<String>,
                    page: Option<u32>,
                    page_size: Option<u32>,
                    q: Option<String>,
                    filter_column: Option<String>,
                    filter_value: Option<String>,
                    sort_column: Option<String>,
                    sort_descending: Option<bool>,
                }
                let input: Inspection = parse(request.payload)?;
                let path = if request.command == "databaseSchema" {
                    "api/v1/admin/database/schema".to_owned()
                } else {
                    let table = input
                        .table
                        .as_deref()
                        .filter(|s| {
                            !s.is_empty()
                                && s.len() <= 63
                                && s.bytes().all(|b| {
                                    b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'_'
                                })
                        })
                        .ok_or_else(|| Error::new("bad_request", "Invalid table"))?;
                    format!("api/v1/admin/database/{table}")
                };
                if input.page.is_some_and(|v| v == 0 || v > 100000)
                    || input.page_size.is_some_and(|v| v == 0 || v > 50)
                    || input.q.as_ref().is_some_and(|q| q.chars().count() > 200)
                    || input
                        .filter_column
                        .as_ref()
                        .is_some_and(|column| column.len() > 63)
                    || input
                        .filter_value
                        .as_ref()
                        .is_some_and(|value| value.chars().count() > 200)
                    || input.filter_column.is_some() != input.filter_value.is_some()
                    || input
                        .sort_column
                        .as_ref()
                        .is_some_and(|column| column.len() > 63)
                    || (input.sort_descending.is_some() && input.sort_column.is_none())
                {
                    return Err(Error::new("bad_request", "Invalid table query"));
                }
                let mut parameters = vec![
                    ("page", input.page.unwrap_or(1).to_string()),
                    ("pageSize", input.page_size.unwrap_or(25).to_string()),
                    ("q", input.q.unwrap_or_default()),
                ];
                if let (Some(column), Some(value)) = (input.filter_column, input.filter_value) {
                    parameters.push(("filterColumn", column));
                    parameters.push(("filterValue", value));
                }
                if let Some(column) = input.sort_column {
                    parameters.push(("sortColumn", column));
                    parameters.push((
                        "sortDescending",
                        input.sort_descending.unwrap_or(false).to_string(),
                    ));
                }
                let response = self
                    .authorized(Method::GET, &path)
                    .await?
                    .query(&parameters)
                    .send()
                    .await
                    .map_err(network)?;
                self.json_limit(response, 16 * 1024 * 1024).await
            }
            "serverOverview"
            | "serverSettings"
            | "renameServer"
            | "updateProviders"
            | "serverOperations"
            | "requestServerOperation" => {
                let (method, path) = match request.command.as_str() {
                    "serverOverview" => (Method::GET, "api/v1/admin/server/overview"),
                    "serverSettings" => (Method::GET, "api/v1/admin/server/settings"),
                    "renameServer" => (Method::PATCH, "api/v1/admin/server/settings"),
                    "serverOperations" => (Method::GET, "api/v1/admin/server/operations"),
                    "requestServerOperation" => (Method::POST, "api/v1/admin/server/operations"),
                    _ => (Method::PUT, "api/v1/admin/server/providers"),
                };
                let write = method != Method::GET;
                let mut outgoing = self.authorized(method, path).await?;
                if write {
                    outgoing = outgoing.json(&request.payload);
                }
                let response = outgoing.send().await.map_err(network)?;
                self.json(response).await
            }
            _ => Err(Error::new("bad_request", "Unknown desktop command")),
        }
    }
}
