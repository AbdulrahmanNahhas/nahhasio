//! The ONLY unsafe boundary. Private to the GTK-owned proof.
//!
//! Invariants: Engine never leaves the GTK thread (GDK context + Rc marker);
//! renderer operations use the retained, current GLArea context; generated C
//! structs, stack parameter arrays and CString command arguments live through
//! their calls. mpv copies async command arguments before returning. Callback
//! userdata is boxed and lives until callbacks are detached AND context freed.
//! The callback only touches an atomic, cannot panic or access GTK/mpv.
//! Teardown frees renderer before core, then userdata and GL library.

use std::{
    ffi::{CStr, CString, c_char, c_void},
    marker::PhantomData,
    mem::ManuallyDrop,
    path::Path,
    ptr::{self, NonNull},
    rc::Rc,
    sync::atomic::{AtomicBool, Ordering},
};

use gtk::prelude::*;
use libmpv2_sys as mpv;

use crate::{Diagnostics, PlaybackState, Track, TrackKind};

type GetProc = unsafe extern "C" fn(*const c_char) -> *mut c_void;
type GetInteger = unsafe extern "C" fn(u32, *mut i32);
type BindFramebuffer = unsafe extern "C" fn(u32, u32);
type GetError = unsafe extern "C" fn() -> u32;
type ReadPixels = unsafe extern "C" fn(i32, i32, i32, i32, u32, u32, *mut c_void);

struct Gl {
    _library: libloading::Library,
    get_proc: GetProc,
    get_integer: GetInteger,
    bind_framebuffer: BindFramebuffer,
    get_error: GetError,
    read_pixels: ReadPixels,
}

impl Gl {
    fn new() -> Result<Box<Self>, String> {
        // EGL's dispatch resolver works with GTK's EGL contexts. GLX is
        // deliberately not claimed by this proof; test EGL on X11 separately.
        // SAFETY: system EGL library ABI and named function signatures.
        unsafe {
            let library =
                libloading::Library::new("libEGL.so.1").map_err(|_| "Cannot load system EGL")?;
            let current: libloading::Symbol<unsafe extern "C" fn() -> *mut c_void> = library
                .get(b"eglGetCurrentContext\0")
                .map_err(|_| "Cannot resolve eglGetCurrentContext")?;
            if current().is_null() {
                return Err("Proof requires GTK EGL (GLX is not supported)".into());
            }
            let get_proc: GetProc = *library
                .get(b"eglGetProcAddress\0")
                .map_err(|_| "Cannot resolve eglGetProcAddress")?;
            let integer = get_proc(c"glGetIntegerv".as_ptr());
            let pixels = get_proc(c"glReadPixels".as_ptr());
            let bind = get_proc(c"glBindFramebuffer".as_ptr());
            let error = get_proc(c"glGetError".as_ptr());
            if integer.is_null() || pixels.is_null() || bind.is_null() || error.is_null() {
                return Err("Required OpenGL functions unavailable".into());
            }
            Ok(Box::new(Self {
                _library: library,
                get_proc,
                get_integer: std::mem::transmute::<*mut c_void, GetInteger>(integer),
                bind_framebuffer: std::mem::transmute::<*mut c_void, BindFramebuffer>(bind),
                get_error: std::mem::transmute::<*mut c_void, GetError>(error),
                read_pixels: std::mem::transmute::<*mut c_void, ReadPixels>(pixels),
            }))
        }
    }
}

unsafe extern "C" fn resolve(data: *mut c_void, name: *const c_char) -> *mut c_void {
    // SAFETY: mpv calls this only during create with our live boxed Gl and a
    // NUL-terminated GL symbol name; Gl/library outlive the renderer as well.
    unsafe { ((&*data.cast::<Gl>()).get_proc)(name) }
}

unsafe extern "C" fn update(data: *mut c_void) {
    // SAFETY: stable boxed atomic retained until renderer has finished freeing.
    unsafe { (&*data.cast::<AtomicBool>()).store(true, Ordering::Release) };
}

fn check(code: i32) -> Result<(), String> {
    if code < 0 {
        // Numeric codes only: never forward raw libmpv/source error messages.
        Err(format!("libmpv status={code}"))
    } else {
        Ok(())
    }
}

fn check_option(key: &CStr, code: i32) -> Result<(), String> {
    // mpv omits ytdl entirely when built without Lua (as in our Flatpak).
    // With no scripting support there is no downloader hook to disable.
    if key == c"ytdl" && code == mpv::mpv_error_MPV_ERROR_OPTION_NOT_FOUND {
        return Ok(());
    }
    check(code).map_err(|error| format!("{error}; option={}", key.to_string_lossy()))
}

fn param<T>(kind: u32, value: &mut T) -> mpv::mpv_render_param {
    mpv::mpv_render_param {
        type_: kind,
        data: ptr::from_mut(value).cast(),
    }
}

fn end() -> mpv::mpv_render_param {
    mpv::mpv_render_param {
        type_: 0,
        data: ptr::null_mut(),
    }
}

pub(super) struct Engine {
    core: NonNull<mpv::mpv_handle>,
    render: Option<NonNull<mpv::mpv_render_context>>,
    context: gtk::gdk::GLContext,
    gl: ManuallyDrop<Box<Gl>>,
    update: ManuallyDrop<Box<AtomicBool>>,
    sample: Option<[u8; 12]>,
    ticks: u64,
    diagnostic: bool,
    playback: PlaybackState,
    _main_thread: PhantomData<Rc<()>>,
}

impl Engine {
    pub(super) fn new(area: &gtk::GLArea, path: &Path) -> Result<Self, String> {
        let path = path.to_str().ok_or("Local path must be valid UTF-8")?;
        Self::create(area, path, false, true, false)
    }

    pub(super) fn playback(
        area: &gtk::GLArea,
        source: &str,
        network: bool,
        hls: bool,
    ) -> Result<Self, String> {
        Self::create(area, source, network, false, hls)
    }

    fn create(
        area: &gtk::GLArea,
        source: &str,
        network: bool,
        diagnostic: bool,
        hls: bool,
    ) -> Result<Self, String> {
        let context = area.context().ok_or("No GLArea context")?;
        context.make_current();
        if gtk::gdk::GLContext::current().as_ref() != Some(&context) {
            return Err("Cannot make GLArea context current".into());
        }
        let gl = Gl::new()?;
        // SAFETY: mpv_create has no preconditions; owned by Engine immediately.
        let core = NonNull::new(unsafe { mpv::mpv_create() }).ok_or("mpv_create failed")?;
        let mut engine = Self {
            core,
            render: None,
            context,
            gl: ManuallyDrop::new(gl),
            update: ManuallyDrop::new(Box::new(AtomicBool::new(false))),
            sample: None,
            ticks: 0,
            diagnostic,
            playback: PlaybackState::default(),
            _main_thread: PhantomData,
        };
        // No user config/scripts or discovery. The diagnostic keeps software
        // decoding; production measures hwdec-current rather than assuming it.
        for (key, value) in [
            (c"config", c"no"),
            (c"load-scripts", c"no"),
            (c"ytdl", c"no"),
            (c"sub-auto", c"no"),
            (c"audio-file-auto", c"no"),
            // HLS references are rewritten to private native capabilities before
            // this mode is used. Ordinary local/torrent files retain no references.
            (c"access-references", if hls { c"yes" } else { c"no" }),
            (c"vo", c"libmpv"),
            (c"hwdec", if diagnostic { c"no" } else { c"auto-safe" }),
            (c"terminal", c"no"),
            (c"msg-level", c"all=no"),
            (c"keep-open", c"yes"),
            (c"video-timing-offset", c"0"),
            (c"demuxer", c"lavf"),
        ] {
            // SAFETY: live uninitialized core and static C strings.
            check_option(key, unsafe {
                mpv::mpv_set_option_string(core.as_ptr(), key.as_ptr(), value.as_ptr())
            })?;
        }
        lavf_options(core, network, hls)?;
        // SAFETY: valid configured core, no active playback/render dependency.
        check(unsafe { mpv::mpv_initialize(core.as_ptr()) })?;
        engine.observe()?;
        engine.attach()?;
        engine.command(&["loadfile", source, "replace"])?;
        if diagnostic {
            eprintln!("proof: libmpv OpenGL renderer created; hwdec=no; source=local-file");
        }
        Ok(engine)
    }

    fn attach(&mut self) -> Result<(), String> {
        let mut init = mpv::mpv_opengl_init_params {
            get_proc_address: Some(resolve),
            get_proc_address_ctx: ptr::from_mut(self.gl.as_mut()).cast(),
        };
        let mut params = [
            mpv::mpv_render_param {
                type_: mpv::mpv_render_param_type_MPV_RENDER_PARAM_API_TYPE,
                data: c"opengl".as_ptr().cast_mut().cast(),
            },
            param(
                mpv::mpv_render_param_type_MPV_RENDER_PARAM_OPENGL_INIT_PARAMS,
                &mut init,
            ),
            end(),
        ];
        let mut render = ptr::null_mut();
        // SAFETY: same current GTK context; live C-layout params and resolver.
        check(unsafe {
            mpv::mpv_render_context_create(&mut render, self.core.as_ptr(), params.as_mut_ptr())
        })?;
        self.render = Some(NonNull::new(render).ok_or("Null render context")?);
        // SAFETY: callback only atomic; stable userdata outlives free.
        unsafe {
            mpv::mpv_render_context_set_update_callback(
                render,
                Some(update),
                ptr::from_mut(self.update.as_mut()).cast(),
            );
        }
        Ok(())
    }

    pub(super) fn reattach(&mut self, area: &gtk::GLArea) -> Result<(), String> {
        if self.render.is_some() {
            return Err("Previous video context could not be released".into());
        }
        self.context = area.context().ok_or("No video graphics context")?;
        self.context.make_current();
        if gtk::gdk::GLContext::current().as_ref() != Some(&self.context) {
            return Err("Could not restore the video graphics context".into());
        }
        self.attach()
    }

    pub(super) fn detach(&mut self) -> Result<(), String> {
        if self.render.is_none() {
            return Ok(());
        }
        self.context.make_current();
        if gtk::gdk::GLContext::current().as_ref() != Some(&self.context) {
            return Err("Video graphics context was lost".into());
        }
        if let Some(render) = self.render.take() {
            // SAFETY: current retained context; callback data/core/GL resolver
            // remain live through free. The core survives renderer recreation.
            unsafe {
                mpv::mpv_render_context_set_update_callback(render.as_ptr(), None, ptr::null_mut());
                mpv::mpv_render_context_free(render.as_ptr());
            }
        }
        Ok(())
    }

    pub(super) fn playback_state(&self) -> &PlaybackState {
        &self.playback
    }

    fn observe(&self) -> Result<(), String> {
        use mpv::{mpv_format_MPV_FORMAT_DOUBLE as DOUBLE, mpv_format_MPV_FORMAT_FLAG as FLAG};
        for (id, name, format) in [
            (100, c"pause", FLAG),
            (101, c"time-pos", DOUBLE),
            (102, c"duration", DOUBLE),
            (103, c"volume", DOUBLE),
            (104, c"mute", FLAG),
            (105, c"speed", DOUBLE),
            (106, c"paused-for-cache", FLAG),
            (107, c"eof-reached", FLAG),
            (108, c"seekable", FLAG),
            (109, c"audio-delay", DOUBLE),
            (110, c"sub-delay", DOUBLE),
            (111, c"sub-font-size", DOUBLE),
            (112, c"sub-pos", DOUBLE),
            (113, c"hwdec-current", mpv::mpv_format_MPV_FORMAT_STRING),
            (114, c"video-codec", mpv::mpv_format_MPV_FORMAT_STRING),
            (115, c"track-list", mpv::mpv_format_MPV_FORMAT_NODE),
        ] {
            // SAFETY: observer registration before rendering; async events
            // provide copied/cacheable data, no blocking property calls.
            check(unsafe {
                mpv::mpv_observe_property(self.core.as_ptr(), id, name.as_ptr(), format)
            })?;
        }
        Ok(())
    }

    pub(super) fn command(&self, args: &[&str]) -> Result<(), String> {
        let strings = args
            .iter()
            .map(|arg| CString::new(*arg).map_err(|_| "Invalid command argument".to_owned()))
            .collect::<Result<Vec<_>, _>>()?;
        let mut pointers: Vec<_> = strings.iter().map(|arg| arg.as_ptr()).collect();
        pointers.push(ptr::null());
        // SAFETY: null-terminated live argv; async API copies strings and is
        // explicitly safe to call on mpv render API threads.
        check(unsafe { mpv::mpv_command_async(self.core.as_ptr(), 0, pointers.as_mut_ptr()) })
    }

    pub(super) fn take_update(&self) -> bool {
        self.update.swap(false, Ordering::AcqRel)
    }

    pub(super) fn poll(&mut self, diagnostics: &mut Diagnostics) {
        // Bounded nonblocking event drain; never log arbitrary payload strings.
        for _ in 0..64 {
            // SAFETY: valid core; copy event data before the next wait call.
            let event = unsafe { &*mpv::mpv_wait_event(self.core.as_ptr(), 0.0) };
            if event.event_id == mpv::mpv_event_id_MPV_EVENT_NONE {
                break;
            }
            if event.error < 0 {
                diagnostics.failures += 1;
                self.playback.error =
                    Some(format!("Player operation failed (status {})", event.error));
                if self.diagnostic {
                    eprintln!("proof: async event status={}", event.error);
                }
                continue;
            }
            match event.event_id {
                mpv::mpv_event_id_MPV_EVENT_FILE_LOADED => {
                    diagnostics.loaded += 1;
                    self.playback.buffering = false;
                    if self.diagnostic {
                        eprintln!("proof: file-loaded");
                    }
                }
                mpv::mpv_event_id_MPV_EVENT_PLAYBACK_RESTART => {
                    self.playback.buffering = false;
                    if self.diagnostic {
                        eprintln!("proof: playback-restart");
                    }
                }
                mpv::mpv_event_id_MPV_EVENT_END_FILE => {
                    // SAFETY: event id guarantees generated end-file layout.
                    let end = unsafe { &*event.data.cast::<mpv::mpv_event_end_file>() };
                    if self.diagnostic {
                        eprintln!("proof: end-file reason={} status={}", end.reason, end.error);
                    }
                    if end.error < 0 {
                        diagnostics.failures += 1;
                        self.playback.error =
                            Some(format!("Video could not be played (status {})", end.error));
                    }
                }
                mpv::mpv_event_id_MPV_EVENT_PROPERTY_CHANGE if !event.data.is_null() => {
                    // SAFETY: property event data lives until next wait_event.
                    let property = unsafe { &*event.data.cast::<mpv::mpv_event_property>() };
                    self.property(event.reply_userdata, property);
                }
                mpv::mpv_event_id_MPV_EVENT_GET_PROPERTY_REPLY if event.reply_userdata == 1 => {
                    // SAFETY: reply id reserved for time-pos DOUBLE requests;
                    // unavailable data is checked before dereferencing.
                    let property = unsafe { &*event.data.cast::<mpv::mpv_event_property>() };
                    if property.format == mpv::mpv_format_MPV_FORMAT_DOUBLE
                        && !property.data.is_null()
                    {
                        diagnostics.position = unsafe { *property.data.cast::<f64>() };
                    }
                }
                mpv::mpv_event_id_MPV_EVENT_QUEUE_OVERFLOW => {
                    diagnostics.failures += 1;
                    self.playback.error = Some("Player event queue overflowed".into());
                    if self.diagnostic {
                        eprintln!("proof: event queue overflow");
                    }
                }
                _ => {}
            }
        }
        self.ticks += 1;
        if self.diagnostic && self.ticks.is_multiple_of(125) && diagnostics.loaded > 0 {
            // SAFETY: async property API is render-thread-safe, static name.
            let code = unsafe {
                mpv::mpv_get_property_async(
                    self.core.as_ptr(),
                    1,
                    c"time-pos".as_ptr(),
                    mpv::mpv_format_MPV_FORMAT_DOUBLE,
                )
            };
            if code < 0 {
                diagnostics.failures += 1;
                eprintln!("proof: position request status={code}");
            }
            eprintln!(
                "proof: renders={} changed-samples={} position={:.2}",
                diagnostics.renders, diagnostics.changed_samples, diagnostics.position
            );
        }
    }

    fn property(&mut self, id: u64, property: &mpv::mpv_event_property) {
        if property.data.is_null() {
            return;
        }
        if property.format == mpv::mpv_format_MPV_FORMAT_DOUBLE {
            // SAFETY: format guarantees a double; copy before next event.
            let value = unsafe { *property.data.cast::<f64>() };
            if !value.is_finite() {
                return;
            }
            match id {
                101 => self.playback.position = value.max(0.0),
                102 => self.playback.duration = value.max(0.0),
                103 => self.playback.volume = value.clamp(0.0, 100.0),
                105 => self.playback.speed = value,
                109 => self.playback.audio_delay = value,
                110 => self.playback.subtitle_delay = value,
                111 => self.playback.subtitle_size = value,
                112 => self.playback.subtitle_position = value,
                _ => {}
            }
        } else if property.format == mpv::mpv_format_MPV_FORMAT_FLAG {
            // SAFETY: MPV_FORMAT_FLAG is a C int, not a Rust bool.
            let value = unsafe { *property.data.cast::<i32>() } != 0;
            match id {
                100 => self.playback.paused = value,
                104 => self.playback.muted = value,
                106 => self.playback.buffering = value,
                107 => self.playback.ended = value,
                108 => self.playback.seekable = value,
                _ => {}
            }
        } else if property.format == mpv::mpv_format_MPV_FORMAT_STRING {
            // SAFETY: string-format data points to a char pointer.
            let text = unsafe { text(*property.data.cast::<*const c_char>()) };
            match id {
                113 => self.playback.hwdec = text,
                114 => self.playback.video_codec = text,
                _ => {}
            }
        } else if property.format == mpv::mpv_format_MPV_FORMAT_NODE && id == 115 {
            // SAFETY: event owns this tree. Only scalar track fields are
            // copied; never free event-owned node contents.
            match unsafe { tracks(&*property.data.cast::<mpv::mpv_node>()) } {
                Ok(tracks) => self.playback.tracks = tracks,
                Err(error) => self.playback.error = Some(error),
            }
        }
    }

    pub(super) fn render(
        &mut self,
        area: &gtk::GLArea,
        diagnostics: &mut Diagnostics,
    ) -> Result<(), String> {
        let Some(render) = self.render else {
            return Ok(());
        };
        let width = area.width() * area.scale_factor();
        let height = area.height() * area.scale_factor();
        if width <= 0 || height <= 0 {
            return Ok(());
        }
        area.make_current();
        if area.error().is_some() || gtk::gdk::GLContext::current().as_ref() != Some(&self.context)
        {
            return Err("GLArea context unavailable".into());
        }
        area.attach_buffers();
        let mut framebuffer = 0;
        // SAFETY: GTK render signal supplies this same current context; query
        // GTK's actual bound FBO, never assume default framebuffer zero.
        unsafe { (self.gl.get_integer)(0x8CA6, &mut framebuffer) };
        let mut target = mpv::mpv_opengl_fbo {
            fbo: framebuffer,
            w: width,
            h: height,
            internal_format: 0,
        };
        // GTK samples the GLArea texture with top-left widget coordinates.
        // Flip mpv's bottom-left GL framebuffer so video and subtitles stay upright.
        let mut flip: i32 = 1;
        let mut block: i32 = 0; // Never block GTK until the target presentation time.
        let mut params = [
            param(
                mpv::mpv_render_param_type_MPV_RENDER_PARAM_OPENGL_FBO,
                &mut target,
            ),
            param(
                mpv::mpv_render_param_type_MPV_RENDER_PARAM_FLIP_Y,
                &mut flip,
            ),
            param(
                mpv::mpv_render_param_type_MPV_RENDER_PARAM_BLOCK_FOR_TARGET_TIME,
                &mut block,
            ),
            end(),
        ];
        // SAFETY: same current context, valid bound complete GTK FBO and live
        // generated four-int target. No advanced-control promise is made.
        unsafe {
            mpv::mpv_render_context_update(render.as_ptr());
            check(mpv::mpv_render_context_render(
                render.as_ptr(),
                params.as_mut_ptr(),
            ))?;
        }
        diagnostics.renders += 1;
        // mpv may change framebuffer bindings. GTK must receive its own target
        // back even when production diagnostics/readback are disabled.
        unsafe { (self.gl.bind_framebuffer)(0x8D40, framebuffer as u32) };
        if !self.diagnostic {
            return Ok(());
        }
        // Diagnostic-only readback of 3 RGBA pixels: actual changing rendered
        // color, not just successful API return/decoding claims. Expensive GPU
        // synchronization is NOT intended for a production player.
        let mut sample = [0u8; 12];
        // mpv may change framebuffer binding; restore GTK's read target before
        // readback and leave its draw/read target bound for GTK composition.
        for (index, fraction) in [1, 2, 3].into_iter().enumerate() {
            // SAFETY: 1x1 RGBA/UNSIGNED_BYTE writes exactly four bytes, with
            // default pixel-pack state left by libmpv; no buffer is bound.
            unsafe {
                (self.gl.read_pixels)(
                    width * fraction / 4,
                    height / 2,
                    1,
                    1,
                    0x1908,
                    0x1401,
                    sample[index * 4..].as_mut_ptr().cast(),
                );
            }
        }
        if sample.iter().any(|byte| *byte > 0) && self.sample.is_some_and(|old| old != sample) {
            diagnostics.changed_samples += 1;
        }
        self.sample = Some(sample);
        // SAFETY: querying this current context's error state.
        let error = unsafe { (self.gl.get_error)() };
        if error != 0 {
            return Err(format!("OpenGL status=0x{error:x}"));
        }
        Ok(())
    }
}

fn lavf_options(core: NonNull<mpv::mpv_handle>, network: bool, hls: bool) -> Result<(), String> {
    // Node-map input avoids comma/escape ambiguities in mpv's string-map parser.
    // Ordinary sources reject playlists. HLS is limited to the guarded native gateway.
    let mut keys = [
        c"protocol_whitelist".as_ptr().cast_mut(),
        c"format_whitelist".as_ptr().cast_mut(),
    ];
    let mut values = [
        mpv::mpv_node {
            format: mpv::mpv_format_MPV_FORMAT_STRING,
            u: mpv::mpv_node__bindgen_ty_1 {
                string: if hls {
                    c"http,tcp,crypto"
                } else if network {
                    c"file,http,tcp"
                } else {
                    c"file"
                }
                .as_ptr()
                .cast_mut(),
            },
        },
        mpv::mpv_node {
            format: mpv::mpv_format_MPV_FORMAT_STRING,
            u: mpv::mpv_node__bindgen_ty_1 {
                string: if hls {
                    c"hls,matroska,webm,mov,mp4,m4a,3gp,3g2,mj2,avi,mpegts,mpeg,ogg,flv,ass,srt,webvtt"
                } else {
                    c"matroska,webm,mov,mp4,m4a,3gp,3g2,mj2,avi,mpegts,mpeg,ogg,flv,ass,srt,webvtt"
                }.as_ptr().cast_mut(),
            },
        },
    ];
    let mut list = mpv::mpv_node_list {
        num: 2,
        keys: keys.as_mut_ptr(),
        values: values.as_mut_ptr(),
    };
    let mut node = mpv::mpv_node {
        format: mpv::mpv_format_MPV_FORMAT_NODE_MAP,
        u: mpv::mpv_node__bindgen_ty_1 {
            list: ptr::from_mut(&mut list),
        },
    };
    // SAFETY: generated C layouts and live arrays/static strings; this setter
    // copies the input before returning, before initialization/render callbacks.
    check(unsafe {
        mpv::mpv_set_option(
            core.as_ptr(),
            c"demuxer-lavf-o".as_ptr(),
            mpv::mpv_format_MPV_FORMAT_NODE,
            ptr::from_mut(&mut node).cast(),
        )
    })
}

unsafe fn text(pointer: *const c_char) -> Option<String> {
    if pointer.is_null() {
        return None;
    }
    // SAFETY: mpv scalar string fields are NUL terminated and live through the
    // current event. Discard oversized/invalid text; never return native paths.
    let string = unsafe { CStr::from_ptr(pointer) };
    if string.to_bytes().len() > 2048 {
        return None;
    }
    string
        .to_str()
        .ok()
        .filter(|value| !value.is_empty())
        .map(str::to_owned)
}

unsafe fn tracks(node: &mpv::mpv_node) -> Result<Vec<Track>, String> {
    if node.format != mpv::mpv_format_MPV_FORMAT_NODE_ARRAY {
        return Ok(Vec::new());
    }
    // SAFETY: matching format selects the generated union's list member.
    let pointer = unsafe { node.u.list };
    if pointer.is_null() {
        return Err("Invalid player track list".into());
    }
    let list = unsafe { &*pointer };
    if !(0..=256).contains(&list.num) {
        return Err("Player track list exceeds the supported limit".into());
    }
    if list.num == 0 {
        return Ok(Vec::new());
    }
    if list.values.is_null() {
        return Err("Invalid player track values".into());
    }
    // SAFETY: mpv list contains num initialized nodes; copy before next event.
    let values = unsafe { std::slice::from_raw_parts(list.values, list.num as usize) };
    let mut result = Vec::new();
    for value in values {
        if value.format != mpv::mpv_format_MPV_FORMAT_NODE_MAP {
            continue;
        }
        let pointer = unsafe { value.u.list };
        if pointer.is_null() {
            return Err("Invalid player track".into());
        }
        let map = unsafe { &*pointer };
        if !(1..=64).contains(&map.num) || map.keys.is_null() || map.values.is_null() {
            return Err("Invalid player track fields".into());
        }
        let keys = unsafe { std::slice::from_raw_parts(map.keys, map.num as usize) };
        let values = unsafe { std::slice::from_raw_parts(map.values, map.num as usize) };
        let mut kind = None;
        let mut track = Track {
            id: 0,
            kind: TrackKind::Audio,
            title: None,
            language: None,
            codec: None,
            selected: false,
            external: false,
        };
        for (&key, value) in keys.iter().zip(values) {
            let Some(key) = (unsafe { text(key) }) else {
                continue;
            };
            match (key.as_str(), value.format) {
                ("id", mpv::mpv_format_MPV_FORMAT_INT64) => {
                    track.id = i32::try_from(unsafe { value.u.int64 }).unwrap_or(0);
                }
                ("type", mpv::mpv_format_MPV_FORMAT_STRING) => {
                    kind = match unsafe { text(value.u.string) }.as_deref() {
                        Some("audio") => Some(TrackKind::Audio),
                        Some("sub") => Some(TrackKind::Subtitle),
                        _ => None,
                    };
                }
                ("title", mpv::mpv_format_MPV_FORMAT_STRING) => {
                    track.title = unsafe { text(value.u.string) }
                }
                ("lang", mpv::mpv_format_MPV_FORMAT_STRING) => {
                    track.language = unsafe { text(value.u.string) }
                }
                ("codec", mpv::mpv_format_MPV_FORMAT_STRING) => {
                    track.codec = unsafe { text(value.u.string) }
                }
                ("selected", mpv::mpv_format_MPV_FORMAT_FLAG) => {
                    track.selected = unsafe { value.u.flag } != 0
                }
                ("external", mpv::mpv_format_MPV_FORMAT_FLAG) => {
                    track.external = unsafe { value.u.flag } != 0
                }
                _ => {}
            }
        }
        if let Some(kind) = kind
            && track.id > 0
        {
            track.kind = kind;
            result.push(track);
        }
    }
    Ok(result)
}

impl Drop for Engine {
    fn drop(&mut self) {
        self.context.make_current();
        if self.render.is_some() && gtk::gdk::GLContext::current().as_ref() != Some(&self.context) {
            // Context loss: freeing on another/no GL context would be UB.
            // Intentionally retain core, renderer, callback, library and GDK
            // context until process exit rather than invoke invalid GL or UAF.
            std::mem::forget(self.context.clone());
            eprintln!("proof: context lost during teardown; native resources retained");
            return;
        }
        // SAFETY: retained GDK context is current even during unrealize; detach
        // callback, free renderer (waits for in-flight callbacks) while boxed
        // userdata/GL library/core remain live, then destroy core. Fields drop
        // only after this body. No other handles or worker threads exist.
        unsafe {
            if let Some(render) = self.render.take() {
                mpv::mpv_render_context_set_update_callback(render.as_ptr(), None, ptr::null_mut());
                mpv::mpv_render_context_free(render.as_ptr());
            }
            mpv::mpv_terminate_destroy(self.core.as_ptr());
            ManuallyDrop::drop(&mut self.update);
            ManuallyDrop::drop(&mut self.gl);
        }
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn lua_free_build_only_allows_the_missing_downloader_option() {
        let missing = libmpv2_sys::mpv_error_MPV_ERROR_OPTION_NOT_FOUND;
        assert!(super::check_option(c"ytdl", missing).is_ok());
        assert!(super::check_option(c"access-references", missing).is_err());
        assert!(super::check_option(c"load-scripts", missing).is_err());
        assert!(super::check_option(c"ytdl", -7).is_err());
        assert!(super::check_option(c"ytdl", 0).is_ok());
    }

    #[test]
    fn generated_fbo_matches_four_c_ints() {
        assert_eq!(
            std::mem::size_of::<libmpv2_sys::mpv_opengl_fbo>(),
            4 * std::mem::size_of::<std::ffi::c_int>()
        );
        assert_eq!(
            std::mem::align_of::<libmpv2_sys::mpv_opengl_fbo>(),
            std::mem::align_of::<std::ffi::c_int>()
        );
        assert_eq!(std::mem::offset_of!(libmpv2_sys::mpv_opengl_fbo, fbo), 0);
        assert_eq!(std::mem::offset_of!(libmpv2_sys::mpv_opengl_fbo, w), 4);
        assert_eq!(std::mem::offset_of!(libmpv2_sys::mpv_opengl_fbo, h), 8);
        assert_eq!(
            std::mem::offset_of!(libmpv2_sys::mpv_opengl_fbo, internal_format),
            12
        );
    }

    #[test]
    fn render_callback_only_sets_coalesced_notification() {
        use std::sync::atomic::{AtomicBool, Ordering};
        let mut notification = Box::new(AtomicBool::new(false));
        let data = std::ptr::from_mut(notification.as_mut()).cast();
        // SAFETY: same stable boxed userdata and callback contract as Engine.
        unsafe {
            super::update(data);
            super::update(data);
        }
        assert!(notification.swap(false, Ordering::AcqRel));
        assert!(!notification.swap(false, Ordering::AcqRel));
    }
}
