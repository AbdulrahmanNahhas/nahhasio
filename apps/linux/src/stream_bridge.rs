//! Typed embed commands: catalog identities in, bounded provider status out. No caller URLs.
use crate::{
    bridge::{Error, Request},
    embed::Host,
    media::{Media, Target},
    player::Player,
    stream_provider::{Audio, Provider},
};
use serde::Deserialize;
use serde_json::Value;
use std::{rc::Rc, sync::Arc};

#[derive(Deserialize)]
#[serde(
    tag = "command",
    content = "payload",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub enum Command {
    #[serde(rename = "stream.open")]
    Open {
        session_id: String,
        provider: Provider,
        #[serde(default)]
        audio: Audio,
        target: Target,
    },
    #[serde(rename = "stream.providers")]
    Providers { session_id: String, target: Target },
    #[serde(rename = "stream.status")]
    Status { session_id: String },
    #[serde(rename = "stream.present")]
    Present { session_id: String },
    #[serde(rename = "stream.close")]
    Close { session_id: String },
}

impl Command {
    pub fn parse(request: &Request) -> Result<Self, Error> {
        serde_json::from_value(
            serde_json::json!({"command":request.command,"payload":request.payload}),
        )
        .map_err(|_| Error::new("bad_request", "Invalid stream request"))
    }
    fn session(&self) -> &str {
        match self {
            Self::Open { session_id, .. }
            | Self::Providers { session_id, .. }
            | Self::Status { session_id }
            | Self::Present { session_id }
            | Self::Close { session_id } => session_id,
        }
    }
}

pub async fn execute(
    host: Rc<Host>,
    player: Rc<Player>,
    media: Arc<Media>,
    runtime: Arc<tokio::runtime::Runtime>,
    parent: adw::ApplicationWindow,
    command: Command,
) -> Result<Value, Error> {
    let session = command.session().to_owned();
    player.require_session(&session)?;
    match command {
        Command::Providers { target, .. } => {
            let (_, context) = runtime
                .spawn(async move { media.embed_context(&target).await })
                .await
                .map_err(|_| Error::new("source_unavailable", "تعذّر تجهيز المصادر."))??;
            player.require_session(&session)?;
            return serde_json::to_value(context.listing())
                .map_err(|_| Error::new("internal", "Invalid provider listing"));
        }
        Command::Open {
            provider,
            audio,
            target,
            ..
        } => {
            // Re-read through authenticated Services; a UI-supplied IMDb ID cannot bypass visibility/policy.
            host.close();
            let generation = host.generation();
            let (target, context) = runtime
                .spawn(async move { media.embed_context(&target).await })
                .await
                .map_err(|_| Error::new("source_unavailable", "تعذّر تجهيز المشغّل."))??;
            let url = provider.embed_url(&context, audio)?;
            player.require_session(&session)?;
            if generation != host.generation() {
                return Err(Error::new("cancelled", "أُلغي فتح المشغّل بعد تغيير المصدر."));
            }
            player.stop_source(&session)?;
            player.set_target(&session, target.clone())?;
            host.open(
                &parent,
                session.clone(),
                provider,
                audio,
                &url,
                &target.title,
            );
        }
        Command::Present { .. } => host.present(&session)?,
        Command::Close { .. } => host.close(),
        Command::Status { .. } => {}
    }
    serde_json::to_value(host.status(&session))
        .map_err(|_| Error::new("internal", "Invalid stream status"))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_arbitrary_urls_and_unknown_providers() {
        for payload in [
            serde_json::json!({"sessionId":"media-1","provider":"other","target":{}}),
            serde_json::json!({"sessionId":"media-1","provider":"vidsrc","target":{},"url":"file:///etc/passwd"}),
        ] {
            assert!(
                Command::parse(&Request {
                    id: "test".into(),
                    command: "stream.open".into(),
                    payload
                })
                .is_err()
            );
        }
    }
}
