//! Main-thread attachment of asynchronous, native-owned media results.
use crate::{
    bridge::Error,
    media::{Command, Media, Ready},
    player::Player,
};
use serde_json::{Value, json};
use std::{rc::Rc, sync::Arc};

pub async fn execute(
    player: Rc<Player>,
    media: Arc<Media>,
    runtime: Arc<tokio::runtime::Runtime>,
    command: Command,
) -> Result<Value, Error> {
    if let Some(id) = command.session() {
        player.require_session(id)?;
    }
    let pause_requested = matches!(&command, Command::Pause { .. });
    match command {
        Command::Library {} => runtime
            .spawn(async move { media.library().await })
            .await
            .map_err(|_| interrupted())?,
        Command::ForgetDownload { id } => {
            runtime
                .spawn(async move { media.manage_download(id, None, None).await })
                .await
                .map_err(|_| interrupted())??;
            Ok(json!({"ok":true}))
        }
        Command::SavedAction { id, file, action } => {
            if matches!(action, crate::media::SavedAction::DeleteVideo)
                && matches!(
                    player.snapshot().source_kind,
                    Some(crate::player_protocol::SourceKind::Local)
                )
            {
                return Err(Error::new(
                    "playing_file",
                    "أغلق المشغّل قبل حذف فيديو محفوظ.",
                ));
            }
            runtime
                .spawn(async move { media.manage_download(id, Some(file), Some(action)).await })
                .await
                .map_err(|_| interrupted())??;
            Ok(json!({"ok":true}))
        }
        Command::OpenSaved { id, file } => {
            let expected = player.snapshot().session_id;
            let (path, title, target) = runtime
                .spawn(async move {
                    let target = media.saved_context(id.clone(), file).await;
                    media
                        .saved_path(id, file)
                        .await
                        .map(|(path, title)| (path, title, target))
                })
                .await
                .map_err(|_| interrupted())??;
            if player.snapshot().session_id != expected {
                return Err(interrupted());
            }
            player.open_download(&path, title)?;
            if let Some(target) = target
                && let Some(session) = player.snapshot().session_id
            {
                player.set_target(&session, target)?;
            }
            serde_json::to_value(player.snapshot()).map_err(|_| interrupted())
        }
        Command::RevealSaved { id, file } => {
            use gtk::gio::prelude::*;
            let (path, _) = runtime
                .spawn(async move { media.saved_path(id, file).await })
                .await
                .map_err(|_| interrupted())??;
            let folder = path.parent().ok_or_else(interrupted)?;
            gtk::gio::AppInfo::launch_default_for_uri(
                gtk::gio::File::for_path(folder).uri().as_str(),
                None::<&gtk::gio::AppLaunchContext>,
            )
            .map_err(|_| Error::new("folder", "تعذّر فتح مدير الملفات."))?;
            Ok(json!({"ok":true}))
        }
        Command::Saved {} => runtime
            .spawn(async move { media.saved().await })
            .await
            .map_err(|_| interrupted())?,
        Command::DeleteCache {} => runtime
            .spawn(async move { media.delete_cache().await })
            .await
            .map_err(|_| interrupted())?,
        Command::Local { session_id, target } => {
            let result = runtime
                .spawn(async move { media.local(target).await })
                .await
                .map_err(|_| interrupted())??;
            player.require_session(&session_id)?;
            if let Some((path, target)) = result {
                player.play_saved(&session_id, target, &path)?;
                Ok(json!({"found":true,"snapshot":player.snapshot()}))
            } else {
                Ok(json!({"found":false}))
            }
        }
        Command::DownloadSearch { session_id, target } => runtime
            .spawn(async move {
                serde_json::to_value(media.search(session_id, target).await?)
                    .map_err(|_| interrupted())
            })
            .await
            .map_err(|_| interrupted())?,
        Command::Download {
            session_id,
            source_id,
            file_index,
        } => {
            let ready = runtime
                .spawn(async move {
                    media
                        .prepare(&session_id, &source_id, file_index, true)
                        .await
                })
                .await
                .map_err(|_| interrupted())??;
            match ready {
                Ready::Choices { files, target } => {
                    Ok(json!({"mode":"choose_file","files":files,"target":target}))
                }
                Ready::Downloading { target } => Ok(json!({"mode":"downloading","target":target})),
                _ => Err(interrupted()),
            }
        }
        Command::Search { session_id, target } => {
            let result = runtime
                .spawn(async move {
                    media
                        .search(session_id.clone(), target)
                        .await
                        .map(|sources| (session_id, sources))
                })
                .await
                .map_err(|_| interrupted())??;
            player.set_target(&result.0, result.1.target.clone())?;
            serde_json::to_value(result.1).map_err(|_| interrupted())
        }
        Command::Play {
            session_id,
            source_id,
            file_index,
        } => {
            player.loading(&session_id, true, None)?;
            let expected = session_id.clone();
            let result = runtime
                .spawn(async move {
                    media
                        .prepare(&session_id, &source_id, file_index, false)
                        .await
                })
                .await
                .map_err(|_| interrupted())?;
            player.require_session(&expected)?;
            match result {
                Ok(Ready::Local { path, target }) => {
                    player.play_saved(&expected, target, &path)?;
                    Ok(json!({"mode":"playing","snapshot":player.snapshot()}))
                }
                Ok(Ready::Choices { files, target }) => {
                    player.loading(&expected, false, None)?;
                    player.set_target(&expected, target.clone())?;
                    Ok(json!({"mode":"choose_file","files":files,"target":target}))
                }
                Ok(Ready::Downloading { target }) => {
                    player.loading(&expected, false, None)?;
                    Ok(json!({"mode":"downloading","target":target}))
                }
                Ok(Ready::Playing { gateway, target }) => {
                    player.play_torrent(&expected, target, gateway)?;
                    Ok(json!({"mode":"playing","snapshot":player.snapshot()}))
                }
                Err(error) => {
                    player.loading(&expected, false, Some(error.message.clone()))?;
                    Err(error)
                }
            }
        }
        Command::Keep { session_id } => {
            let (id, file, title) = player.download_target(&session_id)?;
            runtime
                .spawn(async move { media.keep(id, file, title).await })
                .await
                .map_err(|_| interrupted())??;
            Ok(json!({"ok":true}))
        }
        Command::Jobs {} => runtime
            .spawn(async move { media.jobs().await })
            .await
            .map_err(|_| interrupted())?,
        Command::Pause { id } | Command::Resume { id } => {
            let paused = pause_requested;
            runtime
                .spawn(async move { media.set_paused(id, paused).await })
                .await
                .map_err(|_| interrupted())??;
            Ok(json!({"ok":true}))
        }
    }
}
fn interrupted() -> Error {
    Error::new("transfer", "انقطعت عملية تجهيز الفيديو.")
}
