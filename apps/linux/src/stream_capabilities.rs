//! Evidence about player facilities, never an assertion about this title's available tracks.
use crate::stream_provider::Provider;
use serde::Serialize;

#[derive(Clone, Copy, Default, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Support {
    #[default]
    Unknown,
    Reported,
    Documented,
    NotSeen,
}
#[derive(Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Capabilities {
    pub subtitles: Support,
    pub arabic: Support,
    pub upload: Support,
}
pub fn describe(provider: Provider, anime: bool) -> Capabilities {
    use Support::*;
    match provider {
        Provider::Vidnest if anime => Capabilities {
            subtitles: Reported,
            arabic: NotSeen,
            upload: NotSeen,
        },
        Provider::Vidfast => Capabilities {
            subtitles: Reported,
            arabic: Unknown,
            upload: Reported,
        },
        Provider::Vidsrc | Provider::Vidsrcto => Capabilities {
            subtitles: Reported,
            arabic: if provider == Provider::Vidsrc {
                Reported
            } else {
                Unknown
            },
            upload: Unknown,
        },
        Provider::Vidrock => Capabilities {
            subtitles: Reported,
            arabic: Unknown,
            upload: Unknown,
        },
        Provider::Vidapi => Capabilities {
            subtitles: Documented,
            arabic: Documented,
            upload: Unknown,
        },
        Provider::Cinextream | Provider::Vidcore => Capabilities {
            subtitles: Documented,
            ..Default::default()
        },
        _ => Capabilities::default(),
    }
}
