//! Discover OS directories; the client core owns the unchanged device layout policy.
use gtk::glib;
pub use nahhasio_client_core::storage::Roots;
use std::path::PathBuf;

pub fn discover() -> Result<Roots, String> {
    let home = glib::home_dir();
    let videos = glib::user_special_dir(glib::UserDirectory::Videos);
    let state = std::env::var_os("XDG_STATE_HOME").map(PathBuf::from);
    let override_root = std::env::var_os("NAHHASIO_VIDEO_ROOT").map(PathBuf::from);
    Roots::resolve(
        &home,
        videos.as_deref(),
        state.as_deref(),
        override_root.as_deref(),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn server_artwork_setting_does_not_override_device_videos() {
        if std::env::var_os("NAHHASIO_STORAGE_FIXTURE_CHILD").is_some() {
            let roots = discover().unwrap();
            assert_ne!(
                roots.videos,
                PathBuf::from(std::env::var_os("NAHHASIO_MEDIA_ROOT").unwrap())
            );
            return;
        }
        let status = std::process::Command::new(std::env::current_exe().unwrap())
            .args([
                "--exact",
                "media_storage::tests::server_artwork_setting_does_not_override_device_videos",
            ])
            .env("NAHHASIO_STORAGE_FIXTURE_CHILD", "1")
            .env("NAHHASIO_MEDIA_ROOT", "/server/artwork/uploads")
            .env_remove("NAHHASIO_VIDEO_ROOT")
            .status()
            .unwrap();
        assert!(status.success());
    }
}
