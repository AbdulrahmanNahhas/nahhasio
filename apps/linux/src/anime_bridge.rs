//! Authenticated catalog/session checks surround the client resolver; only GTK attaches playback.
use crate::{
    anime::{Command, Resolver},
    bridge::Error,
    embed::Host,
    media::Media,
    player::Player,
};
use serde_json::Value;
use std::{rc::Rc, sync::Arc};

pub async fn execute(
    resolver: Arc<Resolver>,
    player: Rc<Player>,
    media: Arc<Media>,
    runtime: Arc<tokio::runtime::Runtime>,
    embed: Rc<Host>,
    command: Command,
) -> Result<Value, Error> {
    let session = command.session().to_owned();
    let target = command.target().clone();
    player.require_session(&session)?;
    let context = target.clone();
    let (resolved, episode, film) = runtime
        .spawn(async move { media.anime_context(&context).await })
        .await
        .map_err(|_| interrupted())??;
    player.require_session(&session)?;
    match command {
        Command::Search {
            provider, query, ..
        } => {
            let expected = session.clone();
            let resolver = resolver.clone();
            let result = runtime
                .spawn(async move { resolver.search(expected, target, provider, query).await })
                .await
                .map_err(|_| interrupted())?;
            player.require_session(&session)?;
            result
        }
        Command::Resolve { candidate_id, .. } => {
            let expected = session.clone();
            let resolver = resolver.clone();
            let result = runtime
                .spawn(async move {
                    resolver
                        .resolve(&expected, &target, &candidate_id, episode, film)
                        .await
                })
                .await
                .map_err(|_| interrupted())?;
            player.require_session(&session)?;
            result
        }
        Command::Play { stream_id, .. } => {
            let ticket = resolver.ticket();
            let expected = session.clone();
            let worker = resolver.clone();
            let (gateway, subtitles) = runtime
                .spawn(async move {
                    let (source, subtitles) = worker.stream(&expected, &target, &stream_id).await?;
                    let gateway = crate::direct_gateway::DirectGateway::start(source)
                        .await
                        .map_err(|_| Error::new("anime_stream", "تعذّر تجهيز الفيديو."))?;
                    let mut tracks = Vec::new();
                    for subtitle in subtitles.into_iter().take(8) {
                        if let Ok(url) = gateway.subtitle(&subtitle.url).await {
                            tracks.push((
                                url,
                                subtitle.label.chars().take(100).collect(),
                                subtitle.language.chars().take(25).collect(),
                            ));
                        }
                    }
                    Ok::<_, Error>((gateway, tracks))
                })
                .await
                .map_err(|_| interrupted())??;
            player.require_session(&session)?;
            resolver.require_ticket(ticket)?;
            embed.close();
            player.play_direct(&session, resolved, gateway, subtitles)?;
            serde_json::to_value(player.snapshot()).map_err(|_| interrupted())
        }
    }
}
fn interrupted() -> Error {
    Error::new("cancelled", "أُلغي اختيار مصدر الأنمي. اختر الحلقة مجددًا.")
}
