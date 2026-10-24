//! GTK-owned playback sessions and native file dialogs, separate from catalog services.
use crate::{
    bridge::Error,
    media::ResolvedTarget,
    media_gateway::Gateway,
    player_protocol::{Command, Snapshot, SourceKind, Track, TrackKind},
};
use adw::prelude::*;
use gtk::{gio, glib};
use native_player::NativePlayer;
use serde_json::Value;
use std::{
    cell::{Cell, RefCell},
    path::Path,
    rc::Rc,
};

struct Session {
    id: String,
    title: String,
    player: Option<NativePlayer>,
    gateway: Option<Gateway>,
    direct_gateway: Option<crate::direct_gateway::DirectGateway>,
    target: Option<ResolvedTarget>,
    pending: bool,
    error: Option<String>,
}

pub struct Player {
    window: glib::WeakRef<adw::ApplicationWindow>,
    surface: glib::WeakRef<gtk::Fixed>,
    viewport: Cell<Option<(f64, f64, i32, i32)>>,
    video_fullscreen: Cell<bool>,
    restore_fullscreen: Cell<bool>,
    session: RefCell<Option<Session>>,
    generation: Cell<u64>,
    dialog: Cell<bool>,
}

impl Player {
    pub fn new(window: &adw::ApplicationWindow, surface: &gtk::Fixed) -> Rc<Self> {
        Rc::new(Self {
            window: window.downgrade(),
            surface: surface.downgrade(),
            viewport: Cell::new(None),
            video_fullscreen: Cell::new(false),
            restore_fullscreen: Cell::new(false),
            session: RefCell::new(None),
            generation: Cell::new(0),
            dialog: Cell::new(false),
        })
    }

    fn clear_surface(&self) {
        if let Some(surface) = self.surface.upgrade() {
            while let Some(child) = surface.first_child() {
                surface.remove(&child);
            }
        }
    }
    fn attach_surface(&self, area: &gtk::GLArea) -> Result<(), Error> {
        let surface = self.surface.upgrade().ok_or_else(interrupted)?;
        self.clear_surface();
        let (x, y, width, height) = self.viewport.get().unwrap_or((
            0.0,
            0.0,
            surface.width().max(1),
            surface.height().max(1),
        ));
        area.set_size_request(width, height);
        surface.put(area, x, y);
        Ok(())
    }
    fn set_viewport(&self, x: f64, y: f64, width: i32, height: i32) {
        self.viewport.set(Some((x, y, width, height)));
        if let Some(surface) = self.surface.upgrade()
            && let Some(child) = surface.first_child()
        {
            child.set_size_request(width, height);
            surface.move_(&child, x, y);
        }
    }
    pub fn open_local(&self, path: &Path) -> Result<(), Error> {
        let player = NativePlayer::local(path).map_err(playback_error)?;
        let generation = self
            .generation
            .get()
            .checked_add(1)
            .ok_or_else(interrupted)?;
        self.generation.set(generation);
        self.cancel_stream();
        self.attach_surface(player.area())?;
        *self.session.borrow_mut() = Some(Session {
            id: format!("media-{generation}"),
            title: path.file_name().map_or_else(
                || "Local video".into(),
                |name| name.to_string_lossy().into_owned(),
            ),
            player: Some(player),
            gateway: None,
            direct_gateway: None,
            target: None,
            pending: false,
            error: None,
        });
        Ok(())
    }
    pub fn open_download(&self, path: &Path, title: String) -> Result<(), Error> {
        self.open_local(path)?;
        if let Some(session) = self.session.borrow_mut().as_mut() {
            session.title = crate::display::episode_title(&title);
        }
        Ok(())
    }

    /// Stop native media before handing playback to an isolated provider window.
    pub fn stop_source(&self, session_id: &str) -> Result<(), Error> {
        self.require_session(session_id)?;
        self.cancel_stream();
        if let Some(session) = self.session.borrow_mut().as_mut() {
            session.player = None;
            session.gateway = None;
            session.pending = false;
            session.error = None;
        }
        self.clear_surface();
        Ok(())
    }

    pub fn snapshot(&self) -> Snapshot {
        let fullscreen = self.video_fullscreen.get();
        let session = self.session.borrow();
        let Some(session) = session.as_ref() else {
            return Snapshot {
                fullscreen,
                ..Snapshot::default()
            };
        };
        let Some(player) = session.player.as_ref() else {
            return Snapshot {
                active: true,
                session_id: Some(session.id.clone()),
                title: session.title.clone(),
                work_id: session.target.as_ref().map(|target| target.work_id.clone()),
                installment_id: session
                    .target
                    .as_ref()
                    .map(|target| target.installment_id.clone()),
                episode_id: session
                    .target
                    .as_ref()
                    .and_then(|target| target.episode_id.clone()),
                buffering: session.pending,
                error: session.error.clone(),
                fullscreen,
                ..Snapshot::default()
            };
        };
        let state = player.snapshot();
        Snapshot {
            active: true,
            session_id: Some(session.id.clone()),
            work_id: session.target.as_ref().map(|target| target.work_id.clone()),
            installment_id: session
                .target
                .as_ref()
                .map(|target| target.installment_id.clone()),
            episode_id: session
                .target
                .as_ref()
                .and_then(|target| target.episode_id.clone()),
            title: session.title.clone(),
            source_kind: Some(if session.direct_gateway.is_some() {
                SourceKind::Direct
            } else if session.gateway.is_some() {
                SourceKind::Torrent
            } else {
                SourceKind::Local
            }),
            paused: state.paused,
            position: state.position,
            duration: state.duration,
            seekable: state.seekable,
            volume: state.volume,
            muted: state.muted,
            speed: state.speed,
            buffering: state.buffering || session.pending,
            ended: state.ended,
            fullscreen,
            audio_delay: state.audio_delay,
            subtitle_delay: state.subtitle_delay,
            subtitle_size: state.subtitle_size,
            subtitle_position: state.subtitle_position,
            tracks: state
                .tracks
                .into_iter()
                .map(|track| Track {
                    id: track.id,
                    kind: match track.kind {
                        native_player::TrackKind::Audio => TrackKind::Audio,
                        native_player::TrackKind::Subtitle => TrackKind::Subtitle,
                    },
                    title: track.title,
                    language: track.language,
                    codec: track.codec,
                    selected: track.selected,
                    external: track.external,
                })
                .collect(),
            hwdec: state.hwdec,
            video_codec: state.video_codec,
            error: session.error.clone().or(state.error),
        }
    }

    pub fn render_count(&self) -> u64 {
        self.session
            .borrow()
            .as_ref()
            .and_then(|session| session.player.as_ref())
            .map_or(0, NativePlayer::render_count)
    }

    pub async fn execute(self: &Rc<Self>, command: Command) -> Result<Value, Error> {
        if let Some(id) = command.session_id() {
            self.require_session(id)?;
        }
        match command {
            Command::Status {} => {}
            Command::Viewport {
                x,
                y,
                width,
                height,
                ..
            } => self.set_viewport(x, y, width, height),
            Command::Preview { title } => {
                let generation = self
                    .generation
                    .get()
                    .checked_add(1)
                    .ok_or_else(interrupted)?;
                self.generation.set(generation);
                self.cancel_stream();
                self.clear_surface();
                *self.session.borrow_mut() = Some(Session {
                    id: format!("media-{generation}"),
                    title,
                    player: None,
                    gateway: None,
                    direct_gateway: None,
                    target: None,
                    pending: false,
                    error: None,
                });
            }
            Command::PickVideo {} => {
                let generation = self.generation.get();
                if let Some(file) = self.pick_file(false).await? {
                    if generation != self.generation.get() {
                        return Err(stale());
                    }
                    self.open_local(&file)?;
                }
            }
            Command::PickSubtitle { session_id } => {
                if let Some(file) = self.pick_file(true).await? {
                    self.require_session(&session_id)?;
                    self.with_player(|player| player.add_subtitle(&file))?;
                }
            }
            Command::Close { .. } => self.close(),
            Command::Pause { paused, .. } => self.with_player(|player| {
                if !paused && player.snapshot().ended {
                    player.seek(0.0, false)?;
                }
                player.pause(paused)
            })?,
            Command::Seek {
                seconds, relative, ..
            } => {
                self.with_player(|player| player.seek(seconds, relative))?;
            }
            Command::Volume { volume, .. } => self.with_player(|player| player.volume(volume))?,
            Command::Mute { muted, .. } => self.with_player(|player| player.mute(muted))?,
            Command::Speed { speed, .. } => self.with_player(|player| player.speed(speed))?,
            Command::Track { kind, track_id, .. } => {
                self.with_player(|player| player.track(native_kind(kind), track_id))?;
            }
            Command::Delay { kind, seconds, .. } => {
                self.with_player(|player| player.delay(native_kind(kind), seconds))?;
            }
            Command::SubtitleStyle { size, position, .. } => {
                self.with_player(|player| player.subtitle_style(size, position))?;
            }
            Command::Fullscreen { enabled } => {
                let window = self.window.upgrade().ok_or_else(interrupted)?;
                if enabled && !self.video_fullscreen.replace(true) {
                    self.restore_fullscreen.set(window.is_fullscreen());
                    window.fullscreen();
                } else if !enabled
                    && self.video_fullscreen.replace(false)
                    && !self.restore_fullscreen.get()
                {
                    window.unfullscreen();
                }
            }
        }
        serde_json::to_value(self.snapshot()).map_err(|_| interrupted())
    }

    pub fn close(&self) {
        self.generation.set(self.generation.get().saturating_add(1));
        self.cancel_stream();
        self.clear_surface();
        self.session.borrow_mut().take();
        if self.video_fullscreen.replace(false)
            && !self.restore_fullscreen.get()
            && let Some(window) = self.window.upgrade()
        {
            window.unfullscreen();
        }
    }
    pub fn window_fullscreen_changed(&self, fullscreen: bool) {
        if !fullscreen {
            self.video_fullscreen.set(false);
        }
    }

    pub fn require_session(&self, id: &str) -> Result<(), Error> {
        if self
            .session
            .borrow()
            .as_ref()
            .is_some_and(|session| session.id == id)
        {
            Ok(())
        } else {
            Err(stale())
        }
    }

    fn cancel_stream(&self) {
        if let Some(session) = self.session.borrow_mut().as_mut() {
            drop(session.gateway.take());
            drop(session.direct_gateway.take());
        }
    }
    pub fn loading(&self, id: &str, pending: bool, error: Option<String>) -> Result<(), Error> {
        self.require_session(id)?;
        if let Some(session) = self.session.borrow_mut().as_mut() {
            session.pending = pending;
            session.error = error;
        }
        Ok(())
    }
    pub fn set_target(&self, id: &str, target: ResolvedTarget) -> Result<(), Error> {
        self.require_session(id)?;
        if let Some(session) = self.session.borrow_mut().as_mut() {
            if session.player.is_none() {
                session.title = target.title.clone();
            }
            session.target = Some(target);
        }
        Ok(())
    }
    pub fn play_torrent(
        &self,
        id: &str,
        target: ResolvedTarget,
        gateway: Gateway,
    ) -> Result<(), Error> {
        self.require_session(id)?;
        let player = NativePlayer::loopback(gateway.endpoint()).map_err(playback_error)?;
        self.cancel_stream();
        self.attach_surface(player.area())?;
        if let Some(session) = self.session.borrow_mut().as_mut() {
            session.player = Some(player);
            session.gateway = Some(gateway);
            session.title = target.title.clone();
            session.target = Some(target);
            session.pending = false;
            session.error = None;
        }
        Ok(())
    }
    pub fn play_saved(&self, id: &str, target: ResolvedTarget, path: &Path) -> Result<(), Error> {
        self.require_session(id)?;
        let player = NativePlayer::local(path).map_err(playback_error)?;
        self.cancel_stream();
        self.attach_surface(player.area())?;
        if let Some(session) = self.session.borrow_mut().as_mut() {
            session.player = Some(player);
            session.gateway = None;
            session.title = target.title.clone();
            session.target = Some(target);
            session.pending = false;
            session.error = None;
        }
        Ok(())
    }
    pub fn play_direct(
        &self,
        id: &str,
        target: ResolvedTarget,
        gateway: crate::direct_gateway::DirectGateway,
        subtitles: Vec<(String, String, String)>,
    ) -> Result<(), Error> {
        self.require_session(id)?;
        let player = NativePlayer::loopback_hls(gateway.endpoint()).map_err(playback_error)?;
        for (url, label, language) in subtitles.into_iter().take(8) {
            player
                .add_loopback_subtitle(&url, &label, &language)
                .map_err(playback_error)?;
        }
        self.cancel_stream();
        self.attach_surface(player.area())?;
        if let Some(session) = self.session.borrow_mut().as_mut() {
            session.player = Some(player);
            session.direct_gateway = Some(gateway);
            session.title = target.title.clone();
            session.target = Some(target);
            session.pending = false;
            session.error = None;
        }
        Ok(())
    }
    pub fn download_target(
        &self,
        id: &str,
    ) -> Result<(media_transfer::TorrentId, u32, ResolvedTarget), Error> {
        self.require_session(id)?;
        let session = self.session.borrow();
        let gateway = session
            .as_ref()
            .and_then(|session| session.gateway.as_ref())
            .ok_or_else(|| Error::new("no_torrent", "لا يوجد تورنت جارٍ لهذا الفيديو."))?;
        let title = session
            .as_ref()
            .and_then(|session| session.target.as_ref())
            .ok_or_else(stale)?
            .clone();
        Ok((gateway.id.clone(), gateway.file.index, title))
    }

    fn with_player(
        &self,
        action: impl FnOnce(&NativePlayer) -> Result<(), String>,
    ) -> Result<(), Error> {
        let session = self.session.borrow();
        let player = session
            .as_ref()
            .ok_or_else(stale)?
            .player
            .as_ref()
            .ok_or_else(|| {
                Error::new(
                    "no_source",
                    "Choose a video source before starting playback",
                )
            })?;
        action(player).map_err(playback_error)
    }

    async fn pick_file(&self, subtitle: bool) -> Result<Option<std::path::PathBuf>, Error> {
        if self.dialog.replace(true) {
            return Err(Error::new("busy", "A media file dialog is already open"));
        }
        let window = match self.window.upgrade() {
            Some(window) => window,
            None => {
                self.dialog.set(false);
                return Err(interrupted());
            }
        };
        let filter = gtk::FileFilter::new();
        filter.set_name(Some(if subtitle { "Subtitles" } else { "Videos" }));
        for extension in if subtitle {
            &["srt", "ass", "ssa", "vtt"][..]
        } else {
            &[
                "mkv", "mp4", "m4v", "webm", "avi", "mov", "ts", "m2ts", "ogv", "mpeg", "mpg",
            ][..]
        } {
            filter.add_suffix(extension);
        }
        let filters = gio::ListStore::new::<gtk::FileFilter>();
        filters.append(&filter);
        let dialog = gtk::FileDialog::builder()
            .title(if subtitle {
                "اختر ملف ترجمة"
            } else {
                "افتح فيديو"
            })
            .modal(true)
            .filters(&filters)
            .default_filter(&filter)
            .build();
        let result = dialog.open_future(Some(&window)).await;
        self.dialog.set(false);
        match result {
            Ok(file) => file
                .path()
                .map(Some)
                .ok_or_else(|| Error::new("bad_request", "Choose a local media file")),
            Err(error)
                if error.matches(gtk::DialogError::Dismissed)
                    || error.matches(gtk::DialogError::Cancelled) =>
            {
                Ok(None)
            }
            Err(_) => Err(Error::new(
                "media_dialog",
                "Could not open the media file dialog",
            )),
        }
    }
}

fn native_kind(kind: TrackKind) -> native_player::TrackKind {
    match kind {
        TrackKind::Audio => native_player::TrackKind::Audio,
        TrackKind::Subtitle => native_player::TrackKind::Subtitle,
    }
}
fn playback_error(message: String) -> Error {
    Error::new("playback", &message)
}
fn stale() -> Error {
    Error::new(
        "stale_session",
        "This playback session has ended or changed",
    )
}
fn interrupted() -> Error {
    Error::new("playback", "The player window is unavailable")
}

#[cfg(test)]
mod viewport_tests {
    use super::*;
    fn settle() {
        let context = glib::MainContext::default();
        for _ in 0..60 {
            while context.pending() {
                context.iteration(false);
            }
            std::thread::sleep(std::time::Duration::from_millis(3));
        }
    }
    #[test]
    #[ignore = "Requires a real GTK display; run explicitly with one test thread"]
    fn bounded_video_surface_does_not_lock_window_size() {
        adw::init().expect("GTK display is required");
        let app = adw::Application::builder()
            .application_id("io.nahhasio.ViewportTest")
            .flags(gio::ApplicationFlags::NON_UNIQUE)
            .build();
        app.register(None::<&gio::Cancellable>).unwrap();
        let window = adw::ApplicationWindow::builder()
            .application(&app)
            .default_width(900)
            .default_height(700)
            .build();
        let overlay = gtk::Overlay::new();
        let surface = gtk::Fixed::new();
        surface.set_hexpand(true);
        surface.set_vexpand(true);
        overlay.add_overlay(&surface);
        overlay.set_measure_overlay(&surface, false);
        overlay.set_clip_overlay(&surface, true);
        let page = gtk::DrawingArea::new();
        page.set_hexpand(true);
        page.set_vexpand(true);
        overlay.add_overlay(&page);
        overlay.set_measure_overlay(&page, true);
        window.set_content(Some(&overlay));
        window.present();
        settle();
        let player = Player::new(&window, &surface);
        let area = gtk::GLArea::new();
        player.set_viewport(40.0, 50.0, 700, 394);
        player.attach_surface(&area).unwrap();
        settle();
        assert_eq!((area.width(), area.height()), (700, 394));
        let bounds = area.compute_bounds(&surface).unwrap();
        assert_eq!(
            (bounds.x().round() as i32, bounds.y().round() as i32),
            (40, 50)
        );
        window.set_default_size(600, 500);
        settle();
        assert!(
            window.measure(gtk::Orientation::Horizontal, -1).0 <= 600,
            "Native video must not impose its previous width as a window minimum"
        );
        player.set_viewport(20.0, -30.0, 500, 281);
        settle();
        assert_eq!((area.width(), area.height()), (500, 281));
        player.clear_surface();
        window.close();
        settle();
    }
}
