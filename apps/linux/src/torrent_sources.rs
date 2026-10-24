//! Independent bounded discovery; addon configuration stays on the native side.
use crate::{bridge::Error, torrentio};
use base64::{Engine as _, engine::general_purpose::STANDARD};
use serde::Serialize;
use serde_json::json;

#[derive(Serialize)]
pub struct ProviderStatus {
    pub id: &'static str,
    pub count: usize,
    pub error: Option<Error>,
}

pub struct Discovery {
    pub candidates: Vec<torrentio::Candidate>,
    pub providers: Vec<ProviderStatus>,
}

fn comet_config() -> String {
    // Aqua's English/Arabic preset. No account credentials or debrid playback URLs.
    STANDARD.encode(json!({
        "maxResultsPerResolution": 0,
        "maxSize": 0,
        "cachedOnly": false,
        "sortCachedUncachedTogether": false,
        "removeTrash": true,
        "resultFormat": ["all"],
        "debridServices": [],
        "enableTorrent": false,
        "deduplicateStreams": false,
        "scrapeDebridAccountTorrents": false,
        "debridStreamProxyPassword": "",
        "languages": {"required": ["en"], "allowed": ["ar", "en"], "exclude": [], "preferred": ["ar", "en"]},
        "resolutions": {"r576p": false, "r480p": false, "r360p": false, "r240p": false},
        "options": {"remove_ranks_under": -10000000000_i64, "allow_english_in_languages": true, "remove_unknown_languages": false}
    }).to_string())
}

pub async fn search(input: torrentio::Search) -> Discovery {
    let config = comet_config();
    let (torrentio, comet) = tokio::join!(
        torrentio::search(input.clone()),
        torrentio::search_addon(input, "https://comet.elfhosted.com", Some(&config), "Comet"),
    );
    let mut candidates = Vec::new();
    let mut providers = Vec::new();
    for (id, result) in [("Torrentio", torrentio), ("Comet", comet)] {
        match result {
            Ok(mut found) => {
                providers.push(ProviderStatus {
                    id,
                    count: found.len(),
                    error: None,
                });
                candidates.append(&mut found);
            }
            Err(mut error) => {
                // Shared parser/transport errors are bounded and contain no request URL.
                error.message = error.message.replace("Torrentio", id);
                providers.push(ProviderStatus {
                    id,
                    count: 0,
                    error: Some(error),
                });
            }
        }
    }
    Discovery {
        candidates,
        providers,
    }
}
