//! Isolated local-file diagnostic, not the application's playback adapter.
#![deny(unsafe_code)]

#[allow(unsafe_code)]
mod backend;
mod player;
pub use player::{NativePlayer, PlaybackDefaults, PlaybackState, Track, TrackKind};

use std::{cell::RefCell, path::Path, rc::Rc, time::Duration};

use gtk::{glib, prelude::*};

/// Cumulative diagnostics, including across GLArea unrealize/realize.
#[derive(Clone, Debug, Default)]
pub struct Diagnostics {
    pub realizes: u64,
    pub teardowns: u64,
    pub renders: u64,
    pub changed_samples: u64,
    pub loaded: u64,
    pub position: f64,
    pub failures: u64,
}

#[derive(Default)]
struct State {
    engine: Option<backend::Engine>,
    source: Option<glib::SourceId>,
    diagnostics: Diagnostics,
}

/// Owns a GTK GLArea. All native operations are confined to its GTK main thread.
/// Construction accepts only a canonical existing local regular file.
pub struct ProofPlayer {
    area: gtk::GLArea,
    state: Rc<RefCell<State>>,
}

impl ProofPlayer {
    pub fn new(path: &Path) -> Result<Self, String> {
        if !gtk::is_initialized_main_thread() {
            return Err("GTK must be initialized on this thread".into());
        }
        let path = path
            .canonicalize()
            .map_err(|_| "Local video does not exist")?;
        if !path.is_file() {
            return Err("Local video must be a regular file".into());
        }
        let path = Rc::new(path);
        let state = Rc::new(RefCell::new(State::default()));
        let area = gtk::GLArea::builder()
            .hexpand(true)
            .vexpand(true)
            .auto_render(false)
            .build();
        area.set_required_version(3, 3);
        area.set_allowed_apis(gtk::gdk::GLAPI::GL);

        area.connect_realize({
            let state = state.clone();
            move |area| {
                area.make_current();
                let mut state_ref = state.borrow_mut();
                if let Some(error) = area.error() {
                    state_ref.diagnostics.failures += 1;
                    eprintln!("proof: GLArea context creation failed: {error}");
                    return;
                }
                match backend::Engine::new(area, &path) {
                    Ok(engine) => {
                        state_ref.engine = Some(engine);
                        state_ref.diagnostics.realizes += 1;
                        eprintln!(
                            "proof: realize generation={}",
                            state_ref.diagnostics.realizes
                        );
                    }
                    Err(error) => {
                        state_ref.diagnostics.failures += 1;
                        eprintln!("proof: initialization failed: {error}");
                        return;
                    }
                }
                let weak_area = area.downgrade();
                let weak_state = Rc::downgrade(&state);
                // Foreign render callbacks only set an atomic bit. This bounded
                // main-thread source coalesces updates; no GTK or mpv in callbacks.
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
                            ..
                        } = &mut *state;
                        if let Some(engine) = engine {
                            engine.poll(diagnostics);
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
                    diagnostics,
                    ..
                } = &mut *state;
                if let Some(engine) = engine
                    && let Err(error) = engine.render(area, diagnostics)
                {
                    diagnostics.failures += 1;
                    eprintln!("proof: render failed: {error}");
                }
                glib::Propagation::Stop
            }
        });
        area.connect_unrealize({
            let state = state.clone();
            move |area| {
                let mut state = state.borrow_mut();
                if let Some(source) = state.source.take() {
                    source.remove();
                }
                // This signal runs before GTK releases the GL context. Engine
                // also retains a GDK context reference and makes it current.
                area.make_current();
                if let Some(engine) = state.engine.take() {
                    drop(engine);
                    state.diagnostics.teardowns += 1;
                    eprintln!("proof: unrealize renderer/core freed");
                }
            }
        });
        Ok(Self { area, state })
    }

    pub fn area(&self) -> &gtk::GLArea {
        &self.area
    }

    pub fn diagnostics(&self) -> Diagnostics {
        self.state.borrow().diagnostics.clone()
    }

    pub fn toggle_pause(&self) {
        self.command(&["cycle", "pause"]);
    }

    pub fn seek(&self, seconds: i32) {
        self.command(&["seek", &seconds.to_string(), "relative+exact"]);
    }

    fn command(&self, args: &[&str]) {
        let mut state = self.state.borrow_mut();
        if let Some(engine) = &state.engine
            && let Err(error) = engine.command(args)
        {
            state.diagnostics.failures += 1;
            eprintln!("proof: transport failed: {error}");
        }
    }
}
