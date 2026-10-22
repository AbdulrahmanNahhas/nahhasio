//! One artwork-root selection shared by delivery, editing and deployment diagnostics.
use std::path::{Path, PathBuf};

pub struct ArtworkRoots {
    pub uploads: PathBuf,
    pub public: PathBuf,
    pub explicit: bool,
}
impl ArtworkRoots {
    pub fn configured() -> Self {
        let uploads = std::env::var_os("NAHHASIO_MEDIA_ROOT")
            .or_else(|| std::env::var_os("ARCADIA_MEDIA_ROOT"));
        let explicit = uploads.is_some();
        let uploads = uploads.map(PathBuf::from).unwrap_or_else(|| {
            Path::new(env!("CARGO_MANIFEST_DIR")).join("../../data/media/uploads")
        });
        let public = std::env::var_os("NAHHASIO_PUBLIC_MEDIA_ROOT")
            .or_else(|| std::env::var_os("ARCADIA_PUBLIC_MEDIA_ROOT"))
            .map(PathBuf::from)
            .unwrap_or_else(|| uploads.parent().unwrap_or(&uploads).to_path_buf());
        Self {
            uploads,
            public,
            explicit,
        }
    }
}
