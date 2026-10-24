//! One opt-in technical playback check, no family catalog/authentication or audio-language claim.
use adw::prelude::*;
use gtk::{gio, glib};
use std::{
    cell::Cell,
    rc::Rc,
    sync::Arc,
    time::{Duration, Instant},
};
pub fn run() -> glib::ExitCode {
    let runtime = match tokio::runtime::Runtime::new() {
        Ok(runtime) => Arc::new(runtime),
        Err(_) => return glib::ExitCode::FAILURE,
    };
    let result = Rc::new(Cell::new(false));
    let passed = result.clone();
    let app = adw::Application::builder()
        .application_id("io.nahhasio.AnimeSmoke")
        .flags(gio::ApplicationFlags::NON_UNIQUE)
        .build();
    app.connect_activate(move |app| {
        let content = gtk::Box::new(gtk::Orientation::Vertical, 0);
        let label = gtk::Label::new(Some("Resolving native anime stream…"));
        content.append(&label);
        let window = adw::ApplicationWindow::builder()
            .application(app)
            .title("Nahhasio · native anime playback check")
            .content(&content)
            .default_width(1100)
            .default_height(740)
            .build();
        window.present();
        let app = app.clone();
        let watchdog = app.clone();
        glib::timeout_add_local_once(Duration::from_secs(135), move || watchdog.quit());
        let runtime = runtime.clone();
        let passed = passed.clone();
        glib::MainContext::default().spawn_local(async move {
            let ready = runtime.spawn(async {
                let source = crate::anime::diagnostic_source().await?;
                crate::direct_gateway::DirectGateway::start(source).await.map_err(|_| {
                    crate::bridge::Error::new("stream", "Cannot prepare gateway")
                })
            }).await;
            let gateway = match ready {
                Ok(Ok(gateway)) => gateway,
                _ => {
                    eprintln!("anime-smoke: resolution failed");
                    app.quit();
                    return;
                }
            };
            let player = match native_player::NativePlayer::loopback_hls(gateway.endpoint()) {
                Ok(player) => player,
                Err(_) => {
                    eprintln!("anime-smoke: player failed");
                    app.quit();
                    return;
                }
            };
            content.remove(&label);
            content.append(player.area());
            let started = Instant::now();
            glib::timeout_add_local(Duration::from_millis(500), move || {
                let _keep = &gateway;
                let state = player.snapshot();
                if state.position > 2.0 && player.render_count() > 2 {
                    passed.set(true);
                    println!(
                        "anime-smoke: native-decoded=true position={:.1} duration={:.1} renders={} subtitles={}",
                        state.position, state.duration, player.render_count(),
                        state.tracks.iter().filter(|t| t.kind == native_player::TrackKind::Subtitle).count()
                    );
                    app.quit();
                    return glib::ControlFlow::Break;
                }
                if state.error.is_some() || started.elapsed() > Duration::from_secs(30) {
                    eprintln!("anime-smoke: native-decoded=false error={:?} time={:.1}", state.error, state.position);
                    app.quit();
                    return glib::ControlFlow::Break;
                }
                glib::ControlFlow::Continue
            });
        });
    });
    app.run_with_args(&["nahhasio-anime-smoke"]);
    if result.get() {
        glib::ExitCode::SUCCESS
    } else {
        glib::ExitCode::FAILURE
    }
}
