//! Native service facade. Feature modules share one transport and session owner.
mod admin;
mod artwork;
mod catalog;
mod media;
mod profiles;
mod session;
#[cfg(test)]
mod tests;
mod tracking;
mod transport;

use crate::bridge::{Error, Request, valid_id};
pub use crate::connections::Services;
use reqwest::Client;
use serde::Deserialize;
use serde_json::{Value, json};
use session::{LoginResponse, User};
use std::sync::Arc;
use tokio::sync::{Mutex, Semaphore};
use url::Url;

#[derive(Clone)]
pub(crate) struct ServerSession {
    session_store: Option<Arc<crate::session_store::SessionStore>>,
    client: Client,
    media_client: Client,
    base: Url,
    token: Arc<Mutex<Option<String>>>,
    pub permits: Arc<Semaphore>,
    network_permits: Arc<Semaphore>,
    artwork_permits: Arc<Semaphore>,
    vault: Arc<crate::credential_store::Vault>,
    identity: Arc<Mutex<Option<User>>>,
    renewal: Arc<Mutex<Option<LoginResponse>>>,
    renewal_guard: Arc<Mutex<()>>,
    legacy_session: Arc<std::sync::atomic::AtomicBool>,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Resource {
    id: String,
}
fn parse<T: serde::de::DeserializeOwned>(value: Value) -> Result<T, Error> {
    serde_json::from_value(value).map_err(|_| Error::new("bad_request", "Invalid command fields"))
}

impl ServerSession {
    pub async fn execute(&self, request: Request) -> Result<Value, Error> {
        let _permit = self
            .network_permits
            .acquire()
            .await
            .map_err(|_| Error::new("internal", "Desktop requests stopped"))?;
        match request.command.as_str() {
            "loginAccounts" | "accounts.status" | "accounts.switch" | "accounts.forget"
            | "login" | "logout" | "session" => self.execute_session(request).await,
            "editorCall"
            | "workDocument"
            | "workRead"
            | "workReview"
            | "workSave"
            | "adminWorks"
            | "adminWorksSelection"
            | "databaseSchema"
            | "databaseRows"
            | "serverOverview"
            | "serverSettings"
            | "renameServer"
            | "serverOperations"
            | "requestServerOperation" => self.execute_admin(request).await,
            "homeMedia" | "adminMedia" | "adminMediaCoverage" | "adminMediaUnits"
            | "adminMediaIncoming" | "adminMediaJobs" | "adminMediaImport"
            | "adminMediaControl" | "adminMediaYoutube" | "adminMediaFile" => {
                self.execute_media(request).await
            }
            "profileOverview" | "profileEntries" | "publicProfile" | "profile" | "adminAccess"
            | "updateProfile" | "updatePassword" | "avatar" => self.execute_profiles(request).await,
            "workState" | "setFavorite" | "setWatched" | "syncTracking" | "workComment"
            | "workActivity" => self.execute_tracking(request).await,
            "releases" | "works" | "browse" | "facets" | "trailers" | "episodes"
            | "recommendations" | "filters" | "home" | "work" | "artwork" => {
                self.execute_catalog(request).await
            }
            "appInfo" => Ok(
                json!({"version":env!("CARGO_PKG_VERSION"),"apiUrl":self.base.as_str(),"platform":"linux","playerAvailable":false}),
            ),
            _ => Err(Error::new("bad_request", "Unknown desktop command")),
        }
    }
}
