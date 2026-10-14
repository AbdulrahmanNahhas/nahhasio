//! Opt-in, bounded verification of the real packaged player; no catalog writes or mock playback.
use crate::{
    player::Player,
    player_protocol::{Command, Snapshot, TrackKind},
};
use adw::prelude::*;
use gtk::glib;
use std::{
    cell::Cell,
    rc::Rc,
    time::{Duration, Instant},
};
use webkit6::prelude::*;

pub fn install(
    app: &adw::Application,
    window: &adw::ApplicationWindow,
    view: &webkit6::WebView,
    player: Rc<Player>,
    passed: Rc<Cell<bool>>,
    runtime: std::sync::Arc<tokio::runtime::Runtime>,
) {
    let app = app.clone();
    let window = window.clone();
    let view = view.clone();
    glib::MainContext::default().spawn_local(async move {
        #[cfg(feature = "native-diagnostics")]
        let fixture = if std::env::args().any(|arg| arg == "--torrent-smoke") {
            match crate::torrent_smoke::install(&player, runtime).await {
                Ok(fixture) => Some(fixture),
                Err(error) => {
                    eprintln!("torrent-smoke: FAIL {error}");
                    app.quit();
                    return;
                }
            }
        } else {
            None
        };
        #[cfg(not(feature = "native-diagnostics"))]
        {
            let _ = runtime;
            if std::env::args().any(|arg| arg == "--torrent-smoke") {
                eprintln!("torrent-smoke: enable the native-diagnostics build feature");
                app.quit();
                return;
            }
        }
        let result = run(&window, &view, &player).await;
        match result {
            Ok(()) => {
                passed.set(true);
                eprintln!("player-smoke: PASS");
            }
            Err(error) => eprintln!("player-smoke: FAIL {error}"),
        }
        player.close();
        #[cfg(feature = "native-diagnostics")]
        drop(fixture);
        app.quit();
    });
}

async fn wait(player: &Player, predicate: impl Fn(&Snapshot) -> bool) -> Result<Snapshot, String> {
    let deadline = Instant::now() + Duration::from_secs(15);
    loop {
        let state = player.snapshot();
        if let Some(error) = state.error {
            return Err(error);
        }
        if predicate(&state) {
            return Ok(state);
        }
        if Instant::now() >= deadline {
            return Err("Timed out waiting for measured player state".into());
        }
        glib::timeout_future(Duration::from_millis(100)).await;
    }
}

async fn click(view: &webkit6::WebView, label: &str) -> Result<(), String> {
    let selector = serde_json::to_string(&format!("button[aria-label=\"{label}\"]")).unwrap();
    let script = format!(
        "(() => {{ const button=document.querySelector({selector}); if(!button) return false; button.click(); return true; }})()"
    );
    let deadline = Instant::now() + Duration::from_secs(15);
    loop {
        if view
            .evaluate_javascript_future(&script, None, None)
            .await
            .is_ok_and(|value| value.to_boolean())
        {
            return Ok(());
        }
        if Instant::now() >= deadline {
            return Err(format!("Packaged UI control is unavailable: {label}"));
        }
        glib::timeout_future(Duration::from_millis(100)).await;
    }
}

async fn run(
    window: &adw::ApplicationWindow,
    view: &webkit6::WebView,
    player: &Rc<Player>,
) -> Result<(), String> {
    let state = wait(player, |state| {
        state.duration > 15.0 && state.position > 0.3 && !state.tracks.is_empty()
    })
    .await?;
    eprintln!(
        "player-smoke: loaded codec={:?} actual-hwdec={:?} tracks={}",
        state.video_codec,
        state.hwdec,
        state.tracks.len()
    );
    let id = state.session_id.ok_or("Missing native session")?;
    if std::env::args().any(|arg| arg == "--player-smoke") {
        let path = std::env::var_os("NAHHASIO_PLAY_FILE").ok_or("Missing local fixture")?;
        player
            .play_saved(
                &id,
                crate::media::ResolvedTarget {
                    poster_id: None,
                    work_id: "00000000-0000-4000-8000-000000000001".into(),
                    installment_id: "00000000-0000-4000-8000-000000000002".into(),
                    episode_id: None,
                    title: state.title,
                    work_title: "Synthetic local fixture".into(),
                    search: crate::torrentio::Search {
                        imdb_id: "tt0000000".into(),
                        kind: crate::torrentio::Kind::Movie,
                        season: None,
                        episode: None,
                    },
                },
                std::path::Path::new(&path),
            )
            .map_err(|error| error.message)?;
        let saved = wait(player, |state| {
            state.position > 0.3 && state.work_id.is_some()
        })
        .await?;
        if saved.session_id.as_deref() != Some(&id)
            || !matches!(
                saved.source_kind,
                Some(crate::player_protocol::SourceKind::Local)
            )
        {
            return Err("Saved playback lost session/catalog identity".into());
        }
        eprintln!("player-smoke: saved-file attachment preserves session/catalog identity");
    }
    click(view, "إيقاف مؤقت").await?;
    wait(player, |state| state.paused).await?;
    let position = player.snapshot().position;
    glib::timeout_future(Duration::from_secs(1)).await;
    if (player.snapshot().position - position).abs() > 0.3 {
        return Err("Pause did not stop the playback clock".into());
    }
    player
        .execute(Command::Seek {
            session_id: id.clone(),
            seconds: 10.0,
            relative: false,
        })
        .await
        .map_err(|error| error.message)?;
    wait(player, |state| state.position >= 9.8).await?;
    player
        .execute(Command::Volume {
            session_id: id.clone(),
            volume: 0.0,
        })
        .await
        .map_err(|error| error.message)?;
    wait(player, |state| state.volume == 0.0).await?;
    let subtitle = player
        .snapshot()
        .tracks
        .into_iter()
        .find(|track| {
            track.kind == TrackKind::Subtitle
                && matches!(track.language.as_deref(), Some("ar" | "ara"))
        })
        .ok_or("Fixture must contain an Arabic subtitle track")?;
    player
        .execute(Command::Track {
            session_id: id.clone(),
            kind: TrackKind::Subtitle,
            track_id: Some(subtitle.id),
        })
        .await
        .map_err(|error| error.message)?;
    wait(player, |state| {
        state.tracks.iter().any(|track| {
            track.kind == TrackKind::Subtitle && track.id == subtitle.id && track.selected
        })
    })
    .await?;
    player
        .execute(Command::SubtitleStyle {
            session_id: id.clone(),
            size: 40.0,
            position: 80.0,
        })
        .await
        .map_err(|error| error.message)?;
    wait(player, |state| {
        state.subtitle_size == 40.0 && state.subtitle_position == 80.0
    })
    .await?;
    click(view, "تشغيل").await?;
    wait(player, |state| !state.paused && state.position > 10.3).await?;
    let before = player.render_count();
    glib::timeout_future(Duration::from_secs(2)).await;
    let frames = player.render_count() - before;
    if frames < 20 {
        return Err(format!(
            "Native rendering did not keep advancing: {frames} frames in two seconds"
        ));
    }
    click(view, "ملء الشاشة").await?;
    wait(player, |state| state.fullscreen).await?;
    click(view, "الخروج من ملء الشاشة").await?;
    wait(player, |state| !state.fullscreen).await?;
    if let Some(path) = std::env::var_os("NAHHASIO_PLAYER_SNAPSHOT") {
        capture(window, std::path::Path::new(&path))?;
    }
    player
        .execute(Command::Preview {
            title: "معاينة المشغّل — اختبار فعلي".into(),
        })
        .await
        .map_err(|error| error.message)?;
    wait(player, |state| {
        state.active && state.source_kind.is_none() && state.position == 0.0
    })
    .await?;
    glib::timeout_future(Duration::from_millis(700)).await;
    let preview = view
        .evaluate_javascript_future(
            "document.body.textContent.includes('معاينة المشغّل')",
            None,
            None,
        )
        .await
        .map_err(|_| "Could not inspect actual WebKit preview")?;
    if !preview.to_boolean() {
        return Err("Packaged player preview did not render".into());
    }
    eprintln!(
        "player-smoke: transport, Arabic track, seeking, fullscreen, {frames} live frames and honest preview verified"
    );
    Ok(())
}

fn capture(window: &adw::ApplicationWindow, path: &std::path::Path) -> Result<(), String> {
    let paintable = gtk::WidgetPaintable::new(Some(window));
    let snapshot = gtk::Snapshot::new();
    paintable.snapshot(&snapshot, window.width().into(), window.height().into());
    let node = snapshot
        .to_node()
        .ok_or("Window has no rendered snapshot")?;
    let renderer = window.renderer().ok_or("Window renderer is unavailable")?;
    let texture = renderer.render_texture(&node, None);
    texture
        .save_to_png(path)
        .map_err(|_| "Could not save native player snapshot".into())
}
