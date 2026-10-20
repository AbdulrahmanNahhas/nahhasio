//! Resolve client-owned storage without creating directories or shell-evaluating user-dirs.
use gtk::glib;
use std::path::{Component, Path, PathBuf};

#[derive(Clone, Debug)]
pub struct Roots {
    pub state: PathBuf,
    pub videos: PathBuf,
}

impl Roots {
    pub fn discover() -> Result<Self, String> {
        let home = glib::home_dir();
        let videos = glib::user_special_dir(glib::UserDirectory::Videos);
        let state = std::env::var_os("XDG_STATE_HOME").map(PathBuf::from);
        let override_root = std::env::var_os("NAHHASIO_VIDEO_ROOT").map(PathBuf::from);
        roots_for(
            &home,
            videos.as_deref(),
            state.as_deref(),
            override_root.as_deref(),
        )
    }
}

fn roots_for(
    home: &Path,
    videos: Option<&Path>,
    state: Option<&Path>,
    override_root: Option<&Path>,
) -> Result<Roots, String> {
    if !clean_absolute(home) {
        return Err("Could not resolve the home directory".into());
    }
    let state = state
        .filter(|path| clean_absolute(path))
        .map_or_else(|| home.join(".local/state"), Path::to_path_buf)
        .join("nahhasio");
    let videos = match override_root {
        Some(path) if clean_absolute(path) && path.parent().is_some() => path.to_path_buf(),
        Some(_) => return Err("NAHHASIO_VIDEO_ROOT must be an absolute media directory".into()),
        None => videos
            .filter(|path| clean_absolute(path))
            .map_or_else(|| home.join("Videos"), Path::to_path_buf)
            .join("nahhasio"),
    };
    Ok(Roots { state, videos })
}

fn clean_absolute(path: &Path) -> bool {
    path.is_absolute()
        && !path
            .components()
            .any(|part| matches!(part, Component::ParentDir))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn server_artwork_setting_does_not_override_device_videos() {
        if std::env::var_os("NAHHASIO_STORAGE_FIXTURE_CHILD").is_some() {
            let roots = Roots::discover().unwrap();
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

    #[test]
    fn uses_configured_video_and_state_directories() {
        let roots = roots_for(
            Path::new("/home/test"),
            Some(Path::new("/media/فيديو")),
            Some(Path::new("/persistent/state")),
            None,
        )
        .unwrap();
        assert_eq!(roots.videos, Path::new("/media/فيديو/nahhasio"));
        assert_eq!(roots.state, Path::new("/persistent/state/nahhasio"));
    }

    #[test]
    fn defaults_and_overrides_do_not_mix_cache_with_retained_media() {
        let roots = roots_for(
            Path::new("/home/test"),
            None,
            Some(Path::new("relative")),
            None,
        )
        .unwrap();
        assert_eq!(roots.videos, Path::new("/home/test/Videos/nahhasio"));
        assert_eq!(roots.state, Path::new("/home/test/.local/state/nahhasio"));
        let overridden = roots_for(
            Path::new("/home/test"),
            None,
            None,
            Some(Path::new("/mnt/storage/nahhasio")),
        )
        .unwrap();
        assert_eq!(overridden.videos, Path::new("/mnt/storage/nahhasio"));
    }

    #[test]
    fn rejects_ambiguous_media_roots_without_evaluating_shell_syntax() {
        for path in ["/", "Videos", "$HOME/Videos", "/home/test/../other"] {
            assert!(roots_for(Path::new("/home/test"), None, None, Some(Path::new(path))).is_err());
        }
    }
}
