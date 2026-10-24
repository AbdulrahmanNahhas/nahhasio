//! Typed production controls; all mpv state is copied from asynchronous native events.
use crate::{Diagnostics, backend};
use gtk::{glib, prelude::*};
use std::{cell::RefCell, path::Path, rc::Rc, time::Duration};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum TrackKind {
    Audio,
    Subtitle,
}

#[derive(Clone, Debug)]
pub struct Track {
    pub id: i32,
    pub kind: TrackKind,
    pub title: Option<String>,
    pub language: Option<String>,
    pub codec: Option<String>,
    pub selected: bool,
    pub external: bool,
}

#[derive(Clone, Debug)]
pub struct PlaybackState {
    pub paused: bool,
    pub position: f64,
    pub duration: f64,
    pub seekable: bool,
    pub volume: f64,
    pub muted: bool,
    pub speed: f64,
    pub buffering: bool,
    pub ended: bool,
    pub audio_delay: f64,
    pub subtitle_delay: f64,
    pub subtitle_size: f64,
    pub subtitle_position: f64,
    pub tracks: Vec<Track>,
    pub hwdec: Option<String>,
    pub video_codec: Option<String>,
    pub error: Option<String>,
}

impl Default for PlaybackState {
    fn default() -> Self {
        Self {
            paused: false,
            position: 0.0,
            duration: 0.0,
            seekable: false,
            volume: 100.0,
            muted: false,
            speed: 1.0,
            buffering: true,
            ended: false,
            audio_delay: 0.0,
            subtitle_delay: 0.0,
            subtitle_size: 55.0,
            subtitle_position: 100.0,
            tracks: Vec::new(),
            hwdec: None,
            video_codec: None,
            error: None,
        }
    }
}

struct State {
    engine: Option<backend::Engine>,
    source: Option<glib::SourceId>,
    playback: PlaybackState,
    diagnostics: Diagnostics,
    pending_subtitles: Vec<(String, String, String)>,
}

/// A GTK-main-thread player. Callers receive copied properties, never raw mpv handles.
pub struct NativePlayer {
    area: gtk::GLArea,
    state: Rc<RefCell<State>>,
}

impl NativePlayer {
    pub fn local(path: &Path) -> Result<Self, String> {
        let path = path
            .canonicalize()
            .map_err(|_| "Video file is unavailable")?;
        if !path.is_file() {
            return Err("Choose a regular video file".into());
        }
        Self::create(
            path.to_str()
                .ok_or("Video path must be valid UTF-8")?
                .to_owned(),
            false,
            false,
        )
    }

    /// Only a native-owned loopback gateway is allowed, never arbitrary network URLs.
    pub fn loopback(source: &str) -> Result<Self, String> {
        Self::gateway(source, false)
    }
    /// Only sanitized HLS resources served by the native capability gateway.
    pub fn loopback_hls(source: &str) -> Result<Self, String> {
        Self::gateway(source, true)
    }
    fn gateway(source: &str, hls: bool) -> Result<Self, String> {
        let url = url::Url::parse(source).map_err(|_| "Invalid native stream endpoint")?;
        if url.scheme() != "http"
            || url.host_str() != Some("127.0.0.1")
            || url.port().is_none()
            || !url.username().is_empty()
            || url.password().is_some()
            || url.query().is_some()
            || url.fragment().is_some()
            || !url.path().starts_with("/video/")
        {
            return Err("Only the native loopback media gateway is allowed".into());
        }
        Self::create(url.to_string(), true, hls)
    }

    fn create(source: String, network: bool, hls: bool) -> Result<Self, String> {
        if !gtk::is_initialized_main_thread() {
            return Err("GTK must be initialized on its main thread".into());
        }
        let area = gtk::GLArea::builder()
            .hexpand(true)
            .vexpand(true)
            .auto_render(false)
            .build();
        area.set_required_version(3, 3);
        area.set_allowed_apis(gtk::gdk::GLAPI::GL);
        let state = Rc::new(RefCell::new(State {
            engine: None,
            source: None,
            playback: PlaybackState::default(),
            diagnostics: Diagnostics::default(),
            pending_subtitles: Vec::new(),
        }));
        area.connect_realize({
            let state = state.clone();
            move |area| {
                area.make_current();
                let mut state_ref = state.borrow_mut();
                if area.error().is_some() {
                    state_ref.playback.error =
                        Some("Could not create the video graphics context".into());
                    return;
                }
                let result = if let Some(engine) = state_ref.engine.as_mut() {
                    engine.reattach(area)
                } else {
                    backend::Engine::playback(area, &source, network, hls).map(|engine| {
                        state_ref.engine = Some(engine);
                    })
                };
                if let Err(error) = result {
                    state_ref.playback.error = Some(error);
                    return;
                }
                state_ref.diagnostics.realizes += 1;
                let weak_area = area.downgrade();
                let weak_state = Rc::downgrade(&state);
                state_ref.source = Some(glib::timeout_add_local(
                    Duration::from_millis(8),
                    move || {
                        let (Some(area), Some(state)) = (weak_area.upgrade(), weak_state.upgrade())
                        else {
                            return glib::ControlFlow::Break;
                        };
                        let mut state = state.borrow_mut();
                        let State {
                            engine,
                            diagnostics,
                            pending_subtitles,
                            ..
                        } = &mut *state;
                        if let Some(engine) = engine {
                            engine.poll(diagnostics);
                            if engine.playback_state().duration > 0.0 {
                                for (url, label, language) in pending_subtitles.drain(..) {
                                    let _ = engine
                                        .command(&["sub-add", &url, "auto", &label, &language]);
                                }
                            }
                            if engine.take_update() {
                                area.queue_render();
                            }
                        }
                        glib::ControlFlow::Continue
                    },
                ));
            }
        });
        area.connect_render({
            let state = state.clone();
            move |area, _| {
                let mut state = state.borrow_mut();
                let State {
                    engine,
                    playback,
                    diagnostics,
                    ..
                } = &mut *state;
                if let Some(engine) = engine
                    && let Err(error) = engine.render(area, diagnostics)
                {
                    playback.error = Some(error);
                }
                glib::Propagation::Stop
            }
        });
        area.connect_unrealize({
            let state = state.clone();
            move |area| {
                area.make_current();
                let mut state = state.borrow_mut();
                if let Some(source) = state.source.take() {
                    source.remove();
                }
                if let Some(engine) = state.engine.as_mut()
                    && let Err(error) = engine.detach()
                {
                    state.playback.error = Some(error);
                }
                state.diagnostics.teardowns += 1;
            }
        });
        Ok(Self { area, state })
    }

    pub fn area(&self) -> &gtk::GLArea {
        &self.area
    }

    pub fn snapshot(&self) -> PlaybackState {
        let state = self.state.borrow();
        let mut playback = state.engine.as_ref().map_or_else(
            || state.playback.clone(),
            |engine| engine.playback_state().clone(),
        );
        if state.playback.error.is_some() {
            playback.error = state.playback.error.clone();
        }
        playback
    }

    pub fn render_count(&self) -> u64 {
        self.state.borrow().diagnostics.renders
    }

    pub fn pause(&self, paused: bool) -> Result<(), String> {
        self.set("pause", if paused { "yes" } else { "no" })
    }

    pub fn seek(&self, seconds: f64, relative: bool) -> Result<(), String> {
        if !seconds.is_finite() {
            return Err("Invalid seek position".into());
        }
        self.command(&[
            "seek",
            &seconds.to_string(),
            if relative {
                "relative+exact"
            } else {
                "absolute+exact"
            },
        ])
    }

    pub fn volume(&self, volume: f64) -> Result<(), String> {
        if !(0.0..=100.0).contains(&volume) {
            return Err("Invalid volume".into());
        }
        self.set("volume", &volume.to_string())
    }

    pub fn mute(&self, muted: bool) -> Result<(), String> {
        self.set("mute", if muted { "yes" } else { "no" })
    }

    pub fn speed(&self, speed: f64) -> Result<(), String> {
        if !(0.25..=4.0).contains(&speed) {
            return Err("Invalid playback speed".into());
        }
        self.set("speed", &speed.to_string())
    }

    pub fn track(&self, kind: TrackKind, id: Option<i32>) -> Result<(), String> {
        if let Some(id) = id
            && !self
                .snapshot()
                .tracks
                .iter()
                .any(|track| track.id == id && track.kind == kind)
        {
            return Err("This track is no longer available".into());
        }
        let property = match kind {
            TrackKind::Audio => "aid",
            TrackKind::Subtitle => "sid",
        };
        let value = id.map_or_else(
            || {
                if kind == TrackKind::Audio {
                    "auto".into()
                } else {
                    "no".into()
                }
            },
            |id| id.to_string(),
        );
        self.set(property, &value)
    }

    pub fn add_subtitle(&self, path: &Path) -> Result<(), String> {
        let path = path
            .canonicalize()
            .map_err(|_| "Subtitle file is unavailable")?;
        if !path.is_file() {
            return Err("Choose a regular subtitle file".into());
        }
        if path
            .metadata()
            .map_err(|_| "Subtitle is unavailable")?
            .len()
            > 16 * 1024 * 1024
            || !path
                .extension()
                .and_then(|extension| extension.to_str())
                .is_some_and(|extension| {
                    ["srt", "ass", "ssa", "vtt"].contains(&extension.to_ascii_lowercase().as_str())
                })
        {
            return Err("Choose an SRT, ASS, SSA or VTT subtitle smaller than 16 MiB".into());
        }
        self.command(&[
            "sub-add",
            path.to_str().ok_or("Subtitle path must be valid UTF-8")?,
            "select",
        ])
    }
    /// Only app-owned loopback subtitle capabilities, never provider URLs.
    pub fn add_loopback_subtitle(
        &self,
        source: &str,
        label: &str,
        language: &str,
    ) -> Result<(), String> {
        let url = url::Url::parse(source).map_err(|_| "Invalid subtitle capability")?;
        if url.scheme() != "http"
            || url.host_str() != Some("127.0.0.1")
            || url.port().is_none()
            || !url.username().is_empty()
            || url.password().is_some()
            || !url.path().starts_with("/video/")
            || url.query().is_some()
            || url.fragment().is_some()
            || label.len() > 200
            || language.len() > 50
        {
            return Err("Invalid subtitle capability".into());
        }
        self.state.borrow_mut().pending_subtitles.push((
            source.into(),
            label.into(),
            language.into(),
        ));
        Ok(())
    }

    pub fn delay(&self, kind: TrackKind, seconds: f64) -> Result<(), String> {
        if !(-600.0..=600.0).contains(&seconds) {
            return Err("Invalid track delay".into());
        }
        self.set(
            match kind {
                TrackKind::Audio => "audio-delay",
                TrackKind::Subtitle => "sub-delay",
            },
            &seconds.to_string(),
        )
    }

    pub fn subtitle_style(&self, size: f64, position: f64) -> Result<(), String> {
        if !(10.0..=120.0).contains(&size) || !(0.0..=100.0).contains(&position) {
            return Err("Invalid subtitle appearance".into());
        }
        self.set("sub-font-size", &size.to_string())?;
        self.set("sub-pos", &position.to_string())
    }

    fn set(&self, property: &str, value: &str) -> Result<(), String> {
        self.command(&["set", property, value])
    }

    fn command(&self, args: &[&str]) -> Result<(), String> {
        self.state
            .borrow()
            .engine
            .as_ref()
            .ok_or("Video renderer is not ready")?
            .command(args)
    }
}
