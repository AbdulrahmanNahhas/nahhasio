//! Unprivileged remote playback. Never share the catalog WebView, bridge or network session.
use crate::{
    bridge::Error,
    stream_provider::{Audio, Provider},
};
use adw::prelude::*;
use gtk::{gio, glib};
use serde::Serialize;
use std::{
    cell::{Cell, RefCell},
    rc::Rc,
    time::Duration,
};
use webkit6::prelude::*;

#[derive(Clone, Copy, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Phase {
    Closed,
    Loading,
    Loaded,
    Failed,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Status {
    provider: Provider,
    audio: Audio,
    session_id: Option<String>,
    phase: Phase,
    blocked_popups: u32,
    error: Option<String>,
    filter_ready: bool,
}

struct Active {
    content: gtk::Box,
    view: webkit6::WebView,
    state: Rc<RefCell<Status>>,
}

#[derive(Default)]
pub struct Host {
    active: RefCell<Option<Active>>,
    surface: RefCell<Option<gtk::Stack>>,
    generation: Cell<u64>,
    browser_session: RefCell<Option<(String, Provider, webkit6::NetworkSession)>>,
    protection: RefCell<Option<Rc<crate::embed_privacy::Protection>>>,
}

impl Host {
    pub fn provider_name(&self) -> Option<&'static str> {
        self.active
            .borrow()
            .as_ref()
            .map(|active| active.state.borrow().provider.name())
    }
    pub fn is_active(&self) -> bool {
        self.active.borrow().is_some()
    }
    #[cfg(feature = "native-diagnostics")]
    pub fn diagnose(&self, done: impl FnOnce(bool) + 'static) {
        let active = self.active.borrow();
        let Some(active) = active.as_ref() else {
            done(false);
            return;
        };
        println!(
            "embed-smoke status: {}",
            serde_json::to_string(&*active.state.borrow()).unwrap_or_default()
        );
        let loaded = active.state.borrow().phase == Phase::Loaded;
        let output = std::env::var_os("NAHHASIO_SMOKE_OUTPUT").map(std::path::PathBuf::from);
        active.view.snapshot(
            webkit6::SnapshotRegion::Visible,
            webkit6::SnapshotOptions::NONE,
            None::<&gio::Cancellable>,
            move |result| {
                if let (Some(output), Ok(texture)) = (output, result) {
                    let _ = texture.save_to_png(output.join("embed.png"));
                }
            },
        );
        active.view.evaluate_javascript("JSON.stringify({bridge:!!window.webkit?.messageHandlers?.nahhasio,title:document.title,videoCount:document.querySelectorAll('video').length,body:document.body?.innerText.slice(0,200),h264:document.createElement('video').canPlayType('video/mp4; codecs=\"avc1.42E01E\"')})", None, None, None::<&gio::Cancellable>, move |result| {
            let passed = if let Ok(value) = result {
                println!("embed-smoke page: {}", value.to_str());
                serde_json::from_str::<serde_json::Value>(&value.to_str()).is_ok_and(|page| page["bridge"] == false && page["h264"].as_str().is_some_and(|codec| !codec.is_empty()))
            } else { false };
            done(loaded && passed);
        });
    }
    pub fn attach(&self, surface: &gtk::Stack) {
        *self.surface.borrow_mut() = Some(surface.clone());
    }
    pub fn generation(&self) -> u64 {
        self.generation.get()
    }
    pub fn reload(&self) -> bool {
        if let Some(active) = self.active.borrow().as_ref() {
            active.view.reload_bypass_cache();
            true
        } else {
            false
        }
    }

    pub fn status(&self, session: &str) -> Status {
        self.active
            .borrow()
            .as_ref()
            .filter(|active| active.state.borrow().session_id.as_deref() == Some(session))
            .map(|active| active.state.borrow().clone())
            .unwrap_or(Status {
                provider: Provider::Vidsrc,
                audio: Audio::Original,
                session_id: None,
                phase: Phase::Closed,
                blocked_popups: 0,
                error: None,
                filter_ready: false,
            })
    }

    pub fn close(&self) {
        self.generation.set(self.generation.get().wrapping_add(1));
        if let Some(active) = self.active.borrow_mut().take() {
            active.state.borrow_mut().phase = Phase::Closed;
            active.view.stop_loading();
            active.view.load_html("", None);
            if let Some(surface) = self.surface.borrow().as_ref() {
                surface.set_visible_child_name("catalog");
                surface.remove(&active.content);
            }
            eprintln!(
                "stream: provider={:?} event=closed",
                active.state.borrow().provider
            );
        }
    }

    pub fn present(&self, session: &str) -> Result<(), Error> {
        let active = self.active.borrow();
        let active = active
            .as_ref()
            .filter(|active| {
                let state = active.state.borrow();
                state.session_id.as_deref() == Some(session) && state.phase != Phase::Closed
            })
            .ok_or_else(closed)?;
        if let Some(surface) = self.surface.borrow().as_ref() {
            surface.set_visible_child(&active.content);
        }
        active.view.grab_focus();
        Ok(())
    }

    pub fn open(
        self: &Rc<Self>,
        parent: &adw::ApplicationWindow,
        session: String,
        provider: Provider,
        audio: Audio,
        url: &str,
        title: &str,
    ) {
        self.close();
        // Retry the same playback session with its existing verification cookies.
        // A different episode/player session gets a fresh, private browser session.
        let network = self
            .browser_session
            .borrow()
            .as_ref()
            .filter(|(id, active_provider, _)| id == &session && *active_provider == provider)
            .map(|(_, _, network)| network.clone());
        let network = network.unwrap_or_else(|| {
            let network = webkit6::NetworkSession::new_ephemeral();
            if let Some(cookies) = network.cookie_manager() {
                cookies.set_accept_policy(webkit6::CookieAcceptPolicy::Always);
            }
            network.connect_download_started(|_, download| download.cancel());
            *self.browser_session.borrow_mut() = Some((session.clone(), provider, network.clone()));
            network
        });
        let state = Rc::new(RefCell::new(Status {
            provider,
            audio,
            session_id: Some(session),
            phase: Phase::Loading,
            blocked_popups: 0,
            error: None,
            filter_ready: false,
        }));
        let manager = webkit6::UserContentManager::new();
        #[cfg(feature = "native-diagnostics")]
        if std::env::args().any(|arg| arg == "--embed-smoke") {
            crate::embed_smoke::observe(&manager);
        }
        let view = webkit6::WebView::builder()
            .web_context(&webkit6::WebContext::new())
            .network_session(&network)
            .user_content_manager(&manager)
            .hexpand(true)
            .vexpand(true)
            .build();
        view.update_property(&[gtk::accessible::Property::Label(title)]);
        if let Some(settings) = webkit6::prelude::WebViewExt::settings(&view) {
            settings.set_enable_developer_extras(false);
            settings.set_javascript_can_open_windows_automatically(false);
            settings.set_allow_universal_access_from_file_urls(false);
            settings.set_enable_media_stream(false);
            settings.set_enable_webrtc(false);
            settings.set_enable_dns_prefetching(false);
            settings.set_enable_write_console_messages_to_stdout(false);
        }
        install_policy(&view, &state, provider);

        let status = gtk::Label::new(Some("جارٍ تحميل صفحة المشغّل…"));
        status.set_wrap(true);
        status.set_visible(false);
        status.set_margin_top(8);
        status.set_margin_bottom(8);
        let progress = gtk::ProgressBar::new();
        let content = gtk::Box::new(gtk::Orientation::Vertical, 0);
        content.append(&progress);
        content.append(&status);
        content.append(&view);
        let window = parent;
        view.connect_enter_fullscreen({
            let window = window.downgrade();
            move |_| {
                if let Some(window) = window.upgrade() {
                    window.fullscreen();
                }
                true
            }
        });
        view.connect_leave_fullscreen({
            let window = window.downgrade();
            move |_| {
                if let Some(window) = window.upgrade() {
                    window.unfullscreen();
                }
                true
            }
        });
        observe_page(&view, &state, &status, &progress);
        // Start no provider request until the local blocker is installed. Compilation is cached.
        let protection = self
            .protection
            .borrow()
            .clone()
            .map(Ok)
            .unwrap_or_else(crate::embed_privacy::Protection::new);
        match protection {
            Ok(protection) => {
                *self.protection.borrow_mut() = Some(protection.clone());
                let view = view.downgrade();
                let state = state.clone();
                let status = status.downgrade();
                let url = url.to_owned();
                glib::MainContext::default().spawn_local(async move {
                    let result = protection.install(&manager).await;
                    if state.borrow().phase == Phase::Closed {
                        return;
                    }
                    if let (Some(view), Some(status)) = (view.upgrade(), status.upgrade()) {
                        if result.is_ok() {
                            state.borrow_mut().filter_ready = true;
                            view.load_uri(&url);
                        } else {
                            fail(&state, &status, "تعذّر تجهيز حماية المشغّل. لم يُفتح المصدر.");
                        }
                    }
                });
            }
            Err(_) => fail(&state, &status, "تعذّر تجهيز حماية المشغّل. لم يُفتح المصدر."),
        }
        if let Some(surface) = self.surface.borrow().as_ref() {
            surface.add_named(&content, Some("embed"));
            surface.set_visible_child(&content);
        }
        view.grab_focus();
        *self.active.borrow_mut() = Some(Active {
            content,
            view,
            state,
        });
        eprintln!("stream: provider={provider:?} event=opened");
    }
}

fn install_policy(view: &webkit6::WebView, state: &Rc<RefCell<Status>>, provider: Provider) {
    view.connect_permission_request(|_, request| {
        request.deny();
        true
    });
    view.connect_decide_policy({
        let state = Rc::clone(state);
        move |_, decision, kind| {
            if kind == webkit6::PolicyDecisionType::NewWindowAction {
                let mut state = state.borrow_mut();
                state.blocked_popups = state.blocked_popups.saturating_add(1);
                decision.ignore();
                return true;
            }
            if kind == webkit6::PolicyDecisionType::NavigationAction {
                let uri = decision
                    .downcast_ref::<webkit6::NavigationPolicyDecision>()
                    .and_then(|nav| nav.navigation_action())
                    .and_then(|mut action| action.request())
                    .and_then(|request| request.uri());
                if !uri.as_deref().is_some_and(permits_navigation) {
                    eprintln!(
                        "stream: provider={provider:?} event=navigation-blocked scheme={}",
                        uri.as_deref()
                            .and_then(|uri| uri.split_once(':'))
                            .map_or("unknown", |(scheme, _)| scheme)
                    );
                    decision.ignore();
                    return true;
                }
            }
            // Hosts may use cross-origin subframes, but cannot replace the top-level provider.
            if kind == webkit6::PolicyDecisionType::Response
                && let Some(response) = decision.downcast_ref::<webkit6::ResponsePolicyDecision>()
                && response.is_main_frame_main_resource()
            {
                let allowed = response
                    .response()
                    .and_then(|response| response.uri())
                    .and_then(|uri| url::Url::parse(&uri).ok())
                    .is_some_and(|url| provider.permits_document(&url));
                if !allowed {
                    eprintln!("stream: provider={provider:?} event=top-level-navigation-blocked");
                    decision.ignore();
                    return true;
                }
            }
            false
        }
    });
}

// Page loading is observable; this deliberately makes no inference about media playback.
fn observe_page(
    view: &webkit6::WebView,
    state: &Rc<RefCell<Status>>,
    status: &gtk::Label,
    progress: &gtk::ProgressBar,
) {
    view.connect_estimated_load_progress_notify({
        let progress = (*progress).clone();
        move |view| progress.set_fraction(view.estimated_load_progress())
    });
    let load_generation = Rc::new(Cell::new(0_u64));
    view.connect_load_changed({
            let load_generation = load_generation.clone();
            let state = Rc::clone(state);
            let status = (*status).clone();
            let progress = (*progress).clone();
            move |view, event| {
                if event == webkit6::LoadEvent::Started {
                    let ticket = load_generation.get().wrapping_add(1);
                    load_generation.set(ticket);
                    glib::timeout_add_local_once(Duration::from_secs(30), {
                        let state = Rc::downgrade(&state);
                        let status = status.downgrade();
                        let progress = progress.downgrade();
                        let generation = load_generation.clone();
                        move || {
                            if let (Some(state), Some(status), Some(progress)) = (state.upgrade(), status.upgrade(), progress.upgrade())
                                && generation.get() == ticket && state.borrow().phase == Phase::Loading {
                                fail(&state, &status, "استغرق تحميل المشغّل وقتًا طويلًا. يمكنك إعادة التحميل أو تغيير المصدر.");
                                progress.set_visible(false);
                            }
                        }
                    });
                    let mut state = state.borrow_mut();
                    if state.phase == Phase::Closed {
                        return;
                    }
                    state.phase = Phase::Loading;
                    state.error = None;
                    status.set_visible(false);
                    progress.set_visible(true);
                } else if event == webkit6::LoadEvent::Finished
                    && state.borrow().phase == Phase::Loading
                {
                    let code = view.main_resource().and_then(|resource| resource.response()).map(|response| response.status_code());
                    if let Some(code) = code.filter(|code| *code >= 400) {
                        fail(&state, &status, &format!("تعذّر تحميل المصدر (HTTP {code}). ارجع لاختيار مزوّد آخر."));
                        progress.set_visible(false);
                        return;
                    }
                    state.borrow_mut().phase = Phase::Loaded;
                    status.set_visible(false);
                    progress.set_visible(false);
                    eprintln!("stream: provider={:?} event=page-loaded", state.borrow().provider);
                }
            }
        });
    view.connect_load_failed({
        let state = Rc::clone(state);
        let status = (*status).clone();
        let progress = (*progress).clone();
        move |_, _, _, error| {
            if error.matches(webkit6::NetworkError::Cancelled)
                || error.matches(gio::IOErrorEnum::Cancelled)
                || state.borrow().phase == Phase::Closed
            {
                return false;
            }
            eprintln!(
                "stream: provider={:?} event=load-error domain={:?} code={}",
                state.borrow().provider,
                error.domain(),
                error.code()
            );
            fail(
                &state,
                &status,
                "تعذّر تحميل المشغّل. أعد التحميل أو ارجع لاختيار مصدر آخر.",
            );
            progress.set_visible(false);
            true
        }
    });
    view.connect_web_process_terminated({
        let state = Rc::clone(state);
        let status = (*status).clone();
        move |_, _| {
            fail(&state, &status, "توقف المشغّل. أعد التحميل للمحاولة مجددًا.");
        }
    });
}

fn fail(state: &RefCell<Status>, label: &gtk::Label, message: &str) {
    let mut state = state.borrow_mut();
    state.phase = Phase::Failed;
    state.error = Some(message.into());
    label.set_text(message);
    label.set_visible(true);
    eprintln!("stream: provider={:?} event=page-failed", state.provider);
}

fn permits_navigation(uri: &str) -> bool {
    // Turnstile uses inherited-origin documents during provider verification.
    // These live only in the unprivileged provider view; top-level responses
    // still pass the provider-origin check above.
    if matches!(uri, "about:blank" | "about:srcdoc") {
        return true;
    }
    url::Url::parse(uri).is_ok_and(|url| {
        url.scheme() == "https" && url.username().is_empty() && url.password().is_none()
    })
}

fn closed() -> Error {
    Error::new("embed_closed", "أُغلق المشغّل. افتحه مجددًا.")
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn remote_pages_cannot_navigate_to_native_schemes() {
        for uri in [
            "file:///etc/passwd",
            "nahhasio://app/",
            "javascript:alert(1)",
            "http://localhost/",
            "https://user:secret@vidsrc.sh/",
        ] {
            assert!(!permits_navigation(uri));
        }
        assert!(permits_navigation(
            "https://vidsrc.sh/embed/movie/tt1300854"
        ));
        assert!(permits_navigation("about:blank"));
        assert!(permits_navigation("about:srcdoc"));
    }
}
