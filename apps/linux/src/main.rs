//! Native shell bootstrap. Client Rust exercises begin after this baseline is reviewed.
mod assets;
mod bridge;
mod browse_preferences;
mod connections;
mod media;
mod media_bridge;
mod media_gateway;
mod media_range;
mod media_storage;
mod offline;
mod player;
mod player_protocol;
mod player_smoke;
mod private_state;
mod server_trust;
mod services;
mod session_store;
mod smoke;
#[cfg(feature = "native-diagnostics")]
mod torrent_smoke;
mod torrentio;

use adw::prelude::*;
use bridge::{Error, Request, reply};
use gtk::{gio, glib};
use services::Services;
use std::{path::PathBuf, sync::Arc};
use webkit6::prelude::*;

#[derive(Clone)]
struct Config {
    ui: String,
    dev: bool,
    asset_root: Option<PathBuf>,
    playback_file: Option<PathBuf>,
}
impl Config {
    fn load() -> Result<Self, String> {
        let playback_file = std::env::var_os("NAHHASIO_PLAY_FILE").map(PathBuf::from);
        if let Ok(ui) = std::env::var("NAHHASIO_UI_URL") {
            if ui != "http://127.0.0.1:23110/" && ui != "http://127.0.0.1:23110" {
                return Err("The desktop development UI must be http://127.0.0.1:23110/".into());
            }
            return Ok(Self {
                ui: "http://127.0.0.1:23110/".into(),
                dev: true,
                asset_root: None,
                playback_file,
            });
        }
        let file = std::env::var_os("NAHHASIO_UI_DIR")
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("ui/dist"))
            .join("index.html")
            .canonicalize()
            .map_err(|_| {
                "Build the client UI first or set NAHHASIO_UI_URL=http://127.0.0.1:23110/"
                    .to_owned()
            })?;
        let root = file
            .parent()
            .ok_or("Invalid packaged UI path")?
            .to_path_buf();
        Ok(Self {
            ui: assets::ENTRY.into(),
            dev: false,
            asset_root: Some(root),
            playback_file,
        })
    }
    fn permits(&self, uri: &str) -> bool {
        // Only our own top-level entry point can hold native privileges. Hash routing is local.
        uri.split('#').next() == Some(self.ui.as_str())
    }
}
fn main() -> glib::ExitCode {
    // WebKitGTK 2.54 GPU painting corrupts poster tiles on the target desktop.
    // CPU rasterization was verified with the affected catalog. Keep an explicit
    // WEBKIT_SKIA_ENABLE_CPU_RENDERING=0 override for renderer diagnostics.
    // Renderer environment must be set before GTK or worker threads start.
    if glib::setenv("WEBKIT_SKIA_ENABLE_CPU_RENDERING", "1", false).is_err() {
        eprintln!("Could not configure desktop image painting");
        return glib::ExitCode::FAILURE;
    }
    // WebKit 2.52's Skia software backing store blends transparent updates over
    // old pixels. Keep the launcher's no-DMA-BUF default, but use the shared-memory
    // compositor instead. Set this before GTK or workers create any threads.
    if std::env::var("NAHHASIO_WEBKIT_DMABUF").as_deref() != Ok("1")
        && (glib::setenv("WEBKIT_DISABLE_DMABUF_RENDERER", "0", true).is_err()
            || glib::setenv("WEBKIT_DMABUF_RENDERER_FORCE_SHM", "1", true).is_err())
    {
        eprintln!("Could not configure the desktop compositor");
        return glib::ExitCode::FAILURE;
    }
    // libmpv requires C numeric parsing. Establish this before GTK and workers;
    // never mutate process-global locale from an active player.
    gtk::disable_setlocale();
    let services = match Services::new_persistent(
        &std::env::var("NAHHASIO_SERVER_URL").unwrap_or_else(|_| "http://127.0.0.1:23103/".into()),
    ) {
        Ok(value) => value,
        Err(error) => {
            eprintln!("{}", error.message);
            return glib::ExitCode::FAILURE;
        }
    };
    let runtime = match tokio::runtime::Builder::new_multi_thread()
        .worker_threads(2)
        .enable_all()
        .build()
    {
        Ok(value) => Arc::new(value),
        Err(_) => {
            eprintln!("Could not start native request workers");
            return glib::ExitCode::FAILURE;
        }
    };
    // A bounded stdin smoke mode exercises the same bridge/services without GTK or secrets in argv.
    if std::env::args().any(|arg| arg == "--bridge-smoke") {
        return smoke(&runtime, &services);
    }
    let smoke = if std::env::args().any(|arg| arg == "--ui-smoke") {
        match smoke::Input::read() {
            Ok(input) => Some(input),
            Err(error) => {
                eprintln!("{error}");
                return glib::ExitCode::FAILURE;
            }
        }
    } else {
        None
    };
    let passed = std::rc::Rc::new(std::cell::Cell::new(false));
    let config = match Config::load() {
        Ok(value) => value,
        Err(error) => {
            eprintln!("{error}");
            return glib::ExitCode::FAILURE;
        }
    };
    let player_smoke =
        std::env::args().any(|arg| arg == "--player-smoke" || arg == "--torrent-smoke");
    let smoke_mode = smoke.is_some() || player_smoke;
    let application = adw::Application::builder()
        .application_id("io.nahhasio.Linux")
        .flags(if smoke_mode {
            gio::ApplicationFlags::NON_UNIQUE
        } else {
            gio::ApplicationFlags::empty()
        })
        .build();
    let result = passed.clone();
    application.connect_activate(move |app| {
        build_window(
            app,
            &config,
            &services,
            &runtime,
            smoke.clone(),
            passed.clone(),
        )
    });
    let exit = application.run_with_args(&["nahhasio-linux"]);
    if smoke_mode && !result.get() {
        glib::ExitCode::FAILURE
    } else {
        exit
    }
}
fn build_window(
    app: &adw::Application,
    config: &Config,
    services: &Services,
    runtime: &Arc<tokio::runtime::Runtime>,
    smoke: Option<smoke::Input>,
    passed: std::rc::Rc<std::cell::Cell<bool>>,
) {
    if let Some(window) = app.active_window() {
        window.present();
        return;
    }
    adw::StyleManager::default().set_color_scheme(adw::ColorScheme::ForceDark);
    let manager = webkit6::UserContentManager::new();
    if !manager.register_script_message_handler("nahhasio", None) {
        eprintln!("Could not initialize desktop bridge");
        return;
    }
    manager.add_script(&webkit6::UserScript::new(
        "window.__NAHHASIO_NATIVE__ = true;",
        webkit6::UserContentInjectedFrames::TopFrame,
        webkit6::UserScriptInjectionTime::Start,
        &[&config.ui],
        &[],
    ));
    let context = webkit6::WebContext::new();
    // Packaged assets are replaced during local builds. Avoid reusing an old entry bundle.
    if config.asset_root.is_some() {
        context.set_cache_model(webkit6::CacheModel::DocumentViewer);
    }
    if let Some(root) = &config.asset_root {
        assets::install(&context, root.clone());
    }
    let network = webkit6::NetworkSession::new_ephemeral();
    network.connect_download_started(|_, download| download.cancel());
    let view = webkit6::WebView::builder()
        .web_context(&context)
        .user_content_manager(&manager)
        .network_session(&network)
        .build();
    view.set_background_color(&gtk::gdk::RGBA::new(0.0, 0.0, 0.0, 0.0));
    if let Some(settings) = webkit6::prelude::WebViewExt::settings(&view) {
        settings.set_enable_developer_extras(config.dev);
        settings.set_enable_smooth_scrolling(true);
        settings.set_allow_universal_access_from_file_urls(false);
        settings.set_enable_html5_database(false);
        settings.set_enable_html5_local_storage(false);
        settings.set_enable_write_console_messages_to_stdout(config.dev);
        settings.set_enable_media_stream(false);
    }
    let policy_config = config.clone();
    view.connect_decide_policy(move |_view, decision, kind| {
        if matches!(
            kind,
            webkit6::PolicyDecisionType::NavigationAction
                | webkit6::PolicyDecisionType::NewWindowAction
        ) {
            let action = decision
                .downcast_ref::<webkit6::NavigationPolicyDecision>()
                .and_then(|nav| nav.navigation_action());
            let (uri, gesture) = action
                .map(|mut action| {
                    let gesture = action.is_user_gesture();
                    (
                        action
                            .request()
                            .and_then(|request| request.uri())
                            .map(|uri| uri.to_string()),
                        gesture,
                    )
                })
                .unwrap_or_default();
            let allowed = uri.as_ref().is_some_and(|uri| policy_config.permits(uri));
            if !allowed
                && gesture
                && let Some(uri) = uri.as_deref()
                && let Ok(url) = url::Url::parse(uri)
                && url.scheme() == "https"
                && url.host_str().is_some()
                && url.username().is_empty()
                && url.password().is_none()
                && url.port_or_known_default() == Some(443)
            {
                // Explicit link activation leaves the privileged WebView; remote pages never receive the bridge.
                gio::AppInfo::launch_default_for_uri_async(
                    uri,
                    None::<&gio::AppLaunchContext>,
                    None::<&gio::Cancellable>,
                    |result| {
                        if result.is_err() {
                            eprintln!("Could not open link in the system browser");
                        }
                    },
                );
            }
            if !allowed || kind == webkit6::PolicyDecisionType::NewWindowAction {
                decision.ignore();
                return true;
            }
        }
        false
    });
    view.connect_permission_request(|_, request| {
        request.deny();
        true
    });
    let weak_view = view.downgrade();
    let bridge_config = config.clone();
    let services = services.clone();
    let runtime = runtime.clone();
    let diagnostic_runtime = runtime.clone();
    let media = media::Media::new(services.clone()).ok();
    let player_handle =
        std::rc::Rc::new(std::cell::RefCell::new(None::<std::rc::Rc<player::Player>>));
    let bridge_player = player_handle.clone();
    manager.connect_script_message_received(Some("nahhasio"), move |_, value| {
        let Some(view) = weak_view.upgrade() else {
            return;
        };
        if !view
            .uri()
            .is_some_and(|uri| bridge_config.permits(uri.as_str()))
        {
            return;
        }
        if !value.is_string() {
            return;
        }
        let raw = value.to_str().to_string();
        let request = match Request::parse(&raw) {
            Ok(request) => request,
            Err(_) => return,
        };
        let id = request.id.clone();
        let revision = services.revision();
        let boundary = services.clone();
        if matches!(
            request.command.as_str(),
            "servers.select" | "offline.open" | "offline.close" | "login" | "logout"
        ) {
            let permit = services.permits.clone().try_acquire_owned();
            let player = bridge_player.borrow().clone();
            let media = media.clone();
            let service = services.clone();
            let runtime = runtime.clone();
            let weak = view.downgrade();
            glib::MainContext::default().spawn_local(async move {
                let Ok(_permit) = permit else {
                    if let Some(view) = weak.upgrade() {
                        send_reply(
                            &view,
                            reply(
                                &id,
                                Err(Error::new(
                                    "busy",
                                    "طلبات الاتصال مشغولة. أعد المحاولة بعد قليل.",
                                )),
                            ),
                        );
                    }
                    return;
                };
                let operations = service.operations.clone();
                let operation = runtime
                    .spawn(async move {
                        tokio::time::timeout(
                            std::time::Duration::from_secs(8),
                            operations.write_owned(),
                        )
                        .await
                    })
                    .await;
                let Ok(Ok(operation)) = operation else {
                    if let Some(view) = weak.upgrade() {
                        send_reply(
                            &view,
                            reply(
                                &id,
                                Err(Error::new(
                                    "busy",
                                    "هناك عملية قيد التنفيذ. انتظر اكتمالها ثم أعد تبديل الخادم.",
                                )),
                            ),
                        );
                    }
                    return;
                };
                let result = if let Err(error) = service.check_revision(revision) {
                    Err(error)
                } else if player
                    .as_ref()
                    .is_some_and(|player| player.snapshot().active)
                {
                    Err(Error::new(
                        "busy",
                        "أغلق المشغّل قبل تغيير المكتبة أو الخادم. ستبقى ملفات الجهاز محفوظة.",
                    ))
                } else {
                    runtime
                        .spawn(async move {
                            let _operation = operation;
                            let result = service.execute(request).await;
                            if result.is_ok()
                                && let Some(media) = media
                            {
                                media.reset_sources().await;
                            }
                            result
                        })
                        .await
                        .unwrap_or_else(|_| Err(Error::new("internal", "تعذّر تبديل الخادم.")))
                };
                if let Some(view) = weak.upgrade() {
                    send_reply(&view, reply(&id, result));
                }
            });
            return;
        }
        if request.command.starts_with("media.") {
            let player = bridge_player.borrow().clone();
            let media = media.clone();
            let runtime = runtime.clone();
            let command = media::Command::parse(&request);
            let operations = services.operations.clone();
            let permit = services.permits.clone().try_acquire_owned();
            let weak = view.downgrade();
            glib::MainContext::default().spawn_local(async move {
                let result = match (player, media, command, permit) {
                    (Some(player), Some(media), Ok(command), Ok(permit)) => {
                        let _permit = permit;
                        let _operation = operations.read_owned().await;
                        match boundary.check_revision(revision) {
                            Ok(()) => media_bridge::execute(player, media, runtime, command).await,
                            Err(error) => Err(error),
                        }
                    }
                    (_, _, Err(error), _) => Err(error),
                    (_, _, _, Err(_)) => Err(Error::new("busy", "Media requests are busy")),
                    _ => Err(Error::new("transfer", "Media storage is unavailable")),
                };
                if let Some(view) = weak.upgrade() {
                    send_reply(&view, reply(&id, result));
                }
            });
            return;
        }
        if request.command == "torrentio.search" {
            let input = serde_json::from_value::<torrentio::Search>(request.payload)
                .map_err(|_| Error::new("bad_request", "Invalid Torrentio search"));
            let permit = services.permits.clone().try_acquire_owned();
            let weak = view.downgrade();
            let task = runtime.spawn(async move {
                let _permit = permit.map_err(|_| Error::new("busy", "Source requests are busy"))?;
                let candidates = torrentio::search(input?).await?;
                Ok(serde_json::Value::Array(
                    candidates
                        .iter()
                        .map(torrentio::Candidate::public_value)
                        .collect::<Result<Vec<_>, _>>()?,
                ))
            });
            glib::MainContext::default().spawn_local(async move {
                let result = task.await.unwrap_or_else(|_| {
                    Err(Error::new(
                        "source_unavailable",
                        "Source request was interrupted",
                    ))
                });
                if let Some(view) = weak.upgrade() {
                    send_reply(&view, reply(&id, result));
                }
            });
            return;
        }
        if request.command.starts_with("player.") {
            let player = bridge_player.borrow().clone();
            let command = player_protocol::Command::parse(&request);
            let operations = services.operations.clone();
            let weak = view.downgrade();
            glib::MainContext::default().spawn_local(async move {
                let result = match (player, command) {
                    (Some(player), Ok(command)) => {
                        let _operation = operations.read_owned().await;
                        match boundary.check_revision(revision) {
                            Ok(()) => player.execute(command).await,
                            Err(error) => Err(error),
                        }
                    }
                    (_, Err(error)) => Err(error),
                    _ => Err(Error::new("playback", "Player is not ready")),
                };
                if let Some(view) = weak.upgrade() {
                    send_reply(&view, reply(&id, result));
                }
            });
            return;
        }
        let permit = match services.permits.clone().try_acquire_owned() {
            Ok(permit) => permit,
            Err(_) => {
                send_reply(
                    &view,
                    reply(
                        &id,
                        Err(Error::new(
                            "busy",
                            "Desktop requests are busy. Try again shortly.",
                        )),
                    ),
                );
                return;
            }
        };
        let service = services.clone();
        let task = runtime.spawn(async move {
            let _permit = permit;
            let _operation = service.operations.clone().read_owned().await;
            service.check_revision(revision)?;
            service.execute(request).await
        });
        let weak = view.downgrade();
        glib::MainContext::default().spawn_local(async move {
            let result = task
                .await
                .unwrap_or_else(|_| Err(Error::new("internal", "Desktop request was interrupted")));
            if let Some(view) = weak.upgrade() {
                send_reply(&view, reply(&id, result));
            }
        });
    });
    let header = adw::HeaderBar::builder()
        .title_widget(&adw::WindowTitle::new("Nahhasio", "Family library"))
        .build();
    let content = gtk::Box::new(gtk::Orientation::Vertical, 0);
    content.append(&header);
    let overlay = gtk::Overlay::new();
    overlay.set_hexpand(true);
    overlay.set_vexpand(true);
    let video_surface = gtk::Fixed::new();
    video_surface.set_hexpand(true);
    video_surface.set_vexpand(true);
    overlay.add_overlay(&video_surface);
    overlay.set_measure_overlay(&video_surface, false);
    overlay.set_clip_overlay(&video_surface, true);
    overlay.add_overlay(&view);
    overlay.set_measure_overlay(&view, true);
    content.append(&overlay);
    let recovery = adw::StatusPage::builder()
        .title("تعذّر عرض واجهة نحّاسيو")
        .description("أعد تحميل الواجهة دون إغلاق التطبيق.")
        .icon_name("dialog-error-symbolic")
        .build();
    let retry = gtk::Button::with_label("إعادة تحميل الواجهة");
    retry.add_css_class("suggested-action");
    retry.set_halign(gtk::Align::Center);
    retry.connect_clicked({
        let weak = view.downgrade();
        move |_| {
            if let Some(view) = weak.upgrade() {
                view.reload_bypass_cache();
            }
        }
    });
    recovery.set_child(Some(&retry));
    recovery.set_visible(false);
    overlay.add_overlay(&recovery);
    view.connect_web_process_terminated({
        let recovery = recovery.clone();
        move |_, reason| {
            eprintln!("desktop: WebKit process terminated: {reason:?}");
            recovery.set_visible(true);
        }
    });
    view.connect_load_failed({
        let recovery = recovery.clone();
        move |_, _, _, error| {
            if error.matches(webkit6::NetworkError::Cancelled)
                || error.matches(gio::IOErrorEnum::Cancelled)
            {
                return false;
            }
            eprintln!("desktop: interface load failed: {error}");
            recovery.set_visible(true);
            true
        }
    });
    view.connect_load_changed(move |_, event| {
        if matches!(
            event,
            webkit6::LoadEvent::Started | webkit6::LoadEvent::Committed
        ) {
            recovery.set_visible(false);
        }
    });
    view.set_vexpand(true);
    view.set_hexpand(true);
    let width = if smoke.is_some() {
        std::env::var("NAHHASIO_SMOKE_WIDTH")
            .ok()
            .and_then(|value| value.parse::<i32>().ok())
            .filter(|value| (520..=2560).contains(value))
            .unwrap_or(1280)
    } else {
        1280
    };
    let window = adw::ApplicationWindow::builder()
        .application(app)
        .title("Nahhasio")
        .default_width(width)
        .default_height(820)
        .content(&content)
        .build();
    window.set_size_request(520, 480);
    let player = player::Player::new(&window, &video_surface);
    let fullscreen_player = std::rc::Rc::downgrade(&player);
    window.connect_fullscreened_notify(move |window| {
        if let Some(player) = fullscreen_player.upgrade() {
            player.window_fullscreen_changed(window.is_fullscreen());
        }
    });
    *player_handle.borrow_mut() = Some(player.clone());
    if !std::env::args().any(|arg| arg == "--torrent-smoke")
        && let Some(path) = &config.playback_file
        && let Err(error) = player.open_local(path)
    {
        eprintln!("media: {}", error.message);
    }
    let open = gtk::Button::from_icon_name("document-open-symbolic");
    open.set_tooltip_text(Some("فتح فيديو (Ctrl+O)"));
    open.connect_clicked({
        let player = player.clone();
        move |_| {
            let player = player.clone();
            glib::MainContext::default().spawn_local(async move {
                if let Err(error) = player.execute(player_protocol::Command::PickVideo {}).await {
                    eprintln!("media: {}", error.message);
                }
            });
        }
    });
    header.pack_start(&open);
    window.connect_close_request({
        let player = player.clone();
        move |_| {
            player.close();
            glib::Propagation::Proceed
        }
    });
    let fullscreen_header = header.clone();
    window.connect_fullscreened_notify(move |window| {
        fullscreen_header.set_visible(!window.is_fullscreen());
    });
    let keys = gtk::EventControllerKey::new();
    keys.set_propagation_phase(gtk::PropagationPhase::Capture);
    let weak_window = window.downgrade();
    let reload_view = view.downgrade();
    keys.connect_key_pressed(move |_, key, _, modifiers| {
        if key == gtk::gdk::Key::F5
            || ((key == gtk::gdk::Key::r || key == gtk::gdk::Key::R)
                && modifiers.contains(gtk::gdk::ModifierType::CONTROL_MASK))
        {
            if let Some(view) = reload_view.upgrade() {
                view.reload_bypass_cache();
            }
            return glib::Propagation::Stop;
        }
        if (key == gtk::gdk::Key::o || key == gtk::gdk::Key::O)
            && modifiers.contains(gtk::gdk::ModifierType::CONTROL_MASK)
        {
            let player = player.clone();
            glib::MainContext::default().spawn_local(async move {
                if let Err(error) = player.execute(player_protocol::Command::PickVideo {}).await {
                    eprintln!("media: {}", error.message);
                }
            });
            return glib::Propagation::Stop;
        }
        if key == gtk::gdk::Key::F11 {
            if let Some(window) = weak_window.upgrade() {
                if window.is_fullscreen() {
                    window.unfullscreen();
                } else {
                    window.fullscreen();
                }
            }
            return glib::Propagation::Stop;
        }
        glib::Propagation::Proceed
    });
    window.add_controller(keys);
    view.load_uri(&config.ui);
    window.present();
    if std::env::args().any(|arg| arg == "--player-smoke" || arg == "--torrent-smoke") {
        if config.playback_file.is_none() {
            eprintln!("player-smoke: NAHHASIO_PLAY_FILE must name a generated local fixture");
            app.quit();
        } else if let Some(player) = player_handle.borrow().clone() {
            player_smoke::install(
                app,
                &window,
                &view,
                player,
                passed.clone(),
                diagnostic_runtime.clone(),
            );
        }
    }
    if let Some(input) = smoke {
        smoke::install(app, &view, input, passed);
    }
}
fn send_reply(view: &webkit6::WebView, value: serde_json::Value) {
    let script = format!("window.__nahhasioReply?.({value});");
    view.evaluate_javascript(&script, None, None, None::<&gio::Cancellable>, |_| {});
}
fn smoke(runtime: &tokio::runtime::Runtime, service: &Services) -> glib::ExitCode {
    use std::io::{BufRead, Write};
    let stdin = std::io::stdin();
    let mut reader = stdin.lock();
    let mut bytes = Vec::new();
    loop {
        bytes.clear();
        let mut take = std::io::Read::take(&mut reader, 16 * 1024 * 1024 + 1);
        match take.read_until(b'\n', &mut bytes) {
            Ok(0) => break,
            Ok(_) => {}
            Err(_) => return glib::ExitCode::FAILURE,
        };
        if bytes.len() > 16 * 1024 * 1024 {
            return glib::ExitCode::FAILURE;
        }
        let Ok(raw) = std::str::from_utf8(&bytes) else {
            return glib::ExitCode::FAILURE;
        };
        let Ok(request) = Request::parse(raw) else {
            return glib::ExitCode::FAILURE;
        };
        let id = request.id.clone();
        let response = reply(&id, runtime.block_on(service.execute(request)));
        println!("{response}");
        if std::io::stdout().flush().is_err() {
            return glib::ExitCode::FAILURE;
        }
    }
    glib::ExitCode::SUCCESS
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_foreign_and_development_routes() {
        let config = Config {
            ui: "http://127.0.0.1:23110/".into(),
            dev: true,
            asset_root: None,
            playback_file: None,
        };
        assert!(config.permits("http://127.0.0.1:23110/#library"));
        assert!(!config.permits("http://localhost:23110/"));
        assert!(!config.permits("http://127.0.0.1:23110/evil"));
        assert!(!config.permits("https://example.com/"));
    }
}
