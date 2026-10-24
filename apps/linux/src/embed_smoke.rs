//! Bounded opt-in live provider probe; no catalog, credentials, bridge or persistent browser state.
use crate::{
    embed::Host,
    stream_provider::{Audio, Provider},
};
use adw::prelude::*;
use gtk::{gio, glib};
use std::{cell::Cell, rc::Rc, time::Duration};

pub fn observe(manager: &webkit6::UserContentManager) {
    manager.register_script_message_handler("embedProbe", None);
    manager.connect_script_message_received(Some("embedProbe"), |_, value| {
        if let Ok(value) = serde_json::from_str::<serde_json::Value>(&value.to_str()) {
            println!("embed-smoke frame: {value}");
        }
    });
    manager.add_script(&webkit6::UserScript::new(
        r#"let probeTick = 0;
        const probeTimer = setInterval(() => {
            const video = document.querySelector('video');
            const controls = Array.from(document.querySelectorAll('button,[role=button], [id]')).filter(el => /play/i.test(el.id + ' ' + el.getAttribute('aria-label') + ' ' + el.className)).slice(0, 10);
            window.webkit.messageHandlers.embedProbe.postMessage(JSON.stringify({
                origin: location.origin, secure: isSecureContext, crypto: !!crypto.subtle,
                text: document.body?.innerText.slice(0, 250),
                controls: controls.map(el => ({tag:el.tagName,id:el.id,label:el.getAttribute('aria-label')})),
                video: video ? { paused: video.paused, width: video.videoWidth, error: video.error?.code ?? null } : null
            }));
            if (++probeTick >= 5) clearInterval(probeTimer);
        }, 3000);"#,
        webkit6::UserContentInjectedFrames::AllFrames,
        webkit6::UserScriptInjectionTime::End,
        &[], &[],
    ));
}

pub fn run() -> glib::ExitCode {
    let passed = Rc::new(Cell::new(false));
    let result = passed.clone();
    let app = adw::Application::builder()
        .application_id("io.nahhasio.EmbedSmoke")
        .flags(gio::ApplicationFlags::NON_UNIQUE)
        .build();
    app.connect_activate(move |app| {
        let pages = gtk::Stack::new();
        pages.add_named(&gtk::Label::new(Some("مصادر الفيديو")), Some("catalog"));
        let window = adw::ApplicationWindow::builder()
            .application(app)
            .title("Nahhasio · isolated embed probe")
            .content(&pages)
            .default_width(1100)
            .default_height(740)
            .build();
        let host = Rc::new(Host::default());
        host.attach(&pages);
        let url = "https://vidsrc.sh/embed/movie/tt1300854";
        host.open(
            &window,
            "embed-smoke".into(),
            Provider::Vidsrc,
            Audio::Original,
            url,
            "اختبار VidSrc",
        );
        window.present();
        let watchdog = app.clone();
        glib::timeout_add_local_once(Duration::from_secs(25), move || watchdog.quit());
        let app = app.clone();
        let passed = passed.clone();
        glib::timeout_add_local_once(Duration::from_secs(18), move || {
            let quit = app.clone();
            let close = host.clone();
            host.diagnose(move |loaded| {
                close.close();
                let returned = pages.visible_child_name().as_deref() == Some("catalog");
                passed.set(loaded && returned);
                println!(
                    "embed-smoke: page-and-isolation={} returned-to-sources={returned}",
                    loaded
                );
                glib::timeout_add_local_once(Duration::from_secs(1), move || quit.quit());
            });
        });
    });
    app.run_with_args(&["nahhasio-embed-smoke"]);
    if result.get() {
        glib::ExitCode::SUCCESS
    } else {
        glib::ExitCode::FAILURE
    }
}
