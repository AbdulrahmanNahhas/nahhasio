//! Account/profile operations; session secrets remain inside the session owner.
use super::{Error, Request, ServerSession, parse, valid_id};
use super::{Resource, User, transport::network};
use base64::{Engine as _, engine::general_purpose::STANDARD};
use reqwest::Method;
use serde::Deserialize;
use serde_json::{Value, json};

impl ServerSession {
    pub(super) async fn execute_profiles(&self, request: Request) -> Result<Value, Error> {
        match request.command.as_str() {
            "profileOverview" | "profileEntries" => {
                #[derive(Deserialize)]
                #[serde(deny_unknown_fields)]
                struct Input {
                    id: String,
                    section: Option<String>,
                    page: Option<i64>,
                }
                let input: Input = parse(request.payload)?;
                if !valid_id(&input.id)
                    || input.section.as_ref().is_some_and(|v| {
                        v.len() > 40 || !v.bytes().all(|b| b.is_ascii_lowercase() || b == b'-')
                    })
                    || input.page.is_some_and(|p| !(1..=100_000).contains(&p))
                {
                    return Err(Error::new("bad_request", "Invalid profile request"));
                }
                let suffix = if request.command == "profileOverview" {
                    "overview"
                } else {
                    "entries"
                };
                let mut request = self
                    .authorized(
                        Method::GET,
                        &format!("api/v1/profiles/{}/{suffix}", input.id),
                    )
                    .await?;
                if let Some(section) = input.section {
                    request = request.query(&[("section", section)]);
                }
                if let Some(page) = input.page {
                    request = request.query(&[("page", page)]);
                }
                let response = request.send().await.map_err(network)?;
                self.json(response).await
            }
            "publicProfile" => {
                let input: Resource = parse(request.payload)?;
                if !valid_id(&input.id) {
                    return Err(Error::new("bad_request", "Invalid profile identifier"));
                }
                let response = self
                    .authorized(Method::GET, &format!("api/v1/profiles/{}", input.id))
                    .await?
                    .send()
                    .await
                    .map_err(network)?;
                self.json(response).await
            }
            "profile" | "adminAccess" => {
                let path = if request.command == "profile" {
                    "api/v1/me"
                } else {
                    "api/v1/admin/access"
                };
                let response = self
                    .authorized(Method::GET, path)
                    .await?
                    .send()
                    .await
                    .map_err(network)?;
                self.json(response).await
            }
            "updateProfile" | "updatePassword" => {
                let (method, path) = if request.command == "updateProfile" {
                    (Method::PATCH, "api/v1/me")
                } else {
                    (Method::POST, "api/v1/me/password")
                };
                // Fixed destinations only. Rust/server validate fields; no role or URL commands.
                if !request.payload.is_object() {
                    return Err(Error::new("bad_request", "Invalid account request"));
                }
                let response = self
                    .authorized(method, path)
                    .await?
                    .json(&request.payload)
                    .send()
                    .await
                    .map_err(network)?;
                let value = self.json(response).await?;
                if request.command == "updatePassword" {
                    self.forget_stored_session().await?;
                } else {
                    let user: User = serde_json::from_value(value.clone())
                        .map_err(|_| Error::new("response", "هوية حساب غير صالحة."))?;
                    *self.identity.lock().await = Some(user.clone());
                    let remembered = self.renewal.lock().await.clone();
                    if let Some(mut login) = remembered {
                        login.user = user;
                        self.save_remembered(&login).await?;
                        *self.renewal.lock().await = Some(login);
                    }
                }
                Ok(value)
            }
            "avatar" => {
                #[derive(Deserialize)]
                #[serde(deny_unknown_fields)]
                struct Avatar {
                    key: String,
                }
                let input: Avatar = parse(request.payload)?;
                if !matches!(
                    input.key.as_str(),
                    "nahhasio-library.svg" | "nahhasio-orbit.svg"
                ) {
                    return Err(Error::new("bad_request", "Invalid avatar"));
                }
                let response = self
                    .authorized(Method::GET, &format!("api/v1/auth/avatars/{}", input.key))
                    .await?
                    .send()
                    .await
                    .map_err(network)?;
                if !response.status().is_success() {
                    return self.json(response).await;
                }
                if response
                    .headers()
                    .get("content-type")
                    .and_then(|v| v.to_str().ok())
                    != Some("image/svg+xml")
                {
                    return Err(Error::new("response", "Invalid avatar response"));
                }
                let bytes = self.body(response, 16384).await?;
                Ok(
                    json!({"dataUrl":format!("data:image/svg+xml;base64,{}",STANDARD.encode(bytes))}),
                )
            }
            _ => Err(Error::new("bad_request", "Unknown desktop command")),
        }
    }
}
