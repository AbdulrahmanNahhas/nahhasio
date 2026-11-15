//! Linux storage-path policy with explicit inputs; OS discovery stays in the adapter.
use std::path::{Component, Path, PathBuf};

#[derive(Clone, Debug)]
pub struct Roots {
    pub state: PathBuf,
    pub videos: PathBuf,
}

impl Roots {
    /// Resolve the existing device layout without reading the environment or touching disk.
    pub fn resolve(
        home: &Path,
        videos: Option<&Path>,
        state: Option<&Path>,
        override_root: Option<&Path>,
    ) -> Result<Self, String> {
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
        Ok(Self { state, videos })
    }
}

fn clean_absolute(path: &Path) -> bool {
    path.is_absolute()
        && !path
            .components()
            .any(|part| matches!(part, Component::ParentDir))
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;

    #[test]
    fn uses_configured_video_and_state_directories() {
        let roots = Roots::resolve(
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
        let roots = Roots::resolve(
            Path::new("/home/test"),
            None,
            Some(Path::new("relative")),
            None,
        )
        .unwrap();
        assert_eq!(roots.videos, Path::new("/home/test/Videos/nahhasio"));
        assert_eq!(roots.state, Path::new("/home/test/.local/state/nahhasio"));
        let overridden = Roots::resolve(
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
            assert!(
                Roots::resolve(Path::new("/home/test"), None, None, Some(Path::new(path))).is_err()
            );
        }
        for home in ["relative", "/home/test/../other"] {
            assert!(Roots::resolve(Path::new(home), None, None, None).is_err());
        }
    }
}
