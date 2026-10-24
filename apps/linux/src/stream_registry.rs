//! Versioned, reviewed provider policy and exact-target playback observations.
//! This release-owned registry contains no URLs, credentials or remote executable code.
use crate::stream_provider::{Audio, Provider};
use serde::Deserialize;
use std::sync::OnceLock;

#[derive(Clone, Copy, Debug, PartialEq, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum MediaType {
    AnimeSeries,
    AnimeFilm,
    Series,
    Film,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Registry {
    schema_version: u32,
    providers: Vec<Rule>,
    results: Vec<PlaybackResult>,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Rule {
    provider: Provider,
    enabled: bool,
    media_types: Vec<MediaType>,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct PlaybackResult {
    provider: Provider,
    media_type: MediaType,
    // Public identity such as "mal:52991"; never a provider/CDN URL.
    identity: String,
    season: Option<u32>,
    episode: Option<u32>,
    audio: Audio,
    playback: bool,
    english_audio: bool,
    arabic_subtitles: bool,
    tested_at: String,
    client_build: String,
}

impl Registry {
    fn parse(source: &str) -> Option<Self> {
        let registry: Self = serde_json::from_str(source).ok()?;
        if registry.schema_version != 1
            || registry.providers.iter().enumerate().any(|(index, rule)| {
                registry.providers[..index]
                    .iter()
                    .any(|other| other.provider == rule.provider)
            })
            || registry.results.iter().any(|result| {
                result.tested_at.trim().is_empty() || result.client_build.trim().is_empty()
            })
        {
            return None;
        }
        Some(registry)
    }
    pub fn allows(&self, provider: Provider, media_type: MediaType) -> bool {
        self.providers.iter().any(|rule| {
            rule.provider == provider && rule.enabled && rule.media_types.contains(&media_type)
        })
    }
    pub fn preferred(
        &self,
        provider: Provider,
        audio: Audio,
        media_type: MediaType,
        identities: &[String],
        season: Option<u32>,
        episode: Option<u32>,
    ) -> bool {
        // Append observations in test order. A newer failure revokes an older star.
        self.results
            .iter()
            .rev()
            .find(|result| {
                result.provider == provider
                    && result.audio == audio
                    && result.media_type == media_type
                    && identities.contains(&result.identity)
                    && result.season == season
                    && result.episode == episode
            })
            .is_some_and(|result| {
                result.playback && result.english_audio && result.arabic_subtitles
            })
    }
}

pub fn registry() -> Option<&'static Registry> {
    static REGISTRY: OnceLock<Option<Registry>> = OnceLock::new();
    REGISTRY
        .get_or_init(|| Registry::parse(include_str!("../resources/streaming-registry.json")))
        .as_ref()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn release_policy_is_valid_and_empty_results_have_no_stars() {
        let registry = registry().expect("valid release registry");
        assert_eq!(registry.providers.len(), 17);
        assert!(registry.allows(Provider::Vidnest, MediaType::AnimeSeries));
        assert!(!registry.allows(Provider::Vidlink, MediaType::AnimeSeries));
        assert!(!registry.allows(Provider::Primesrc, MediaType::Series));
        assert!(!registry.preferred(
            Provider::Vidnest,
            Audio::Dub,
            MediaType::AnimeSeries,
            &["mal:52991".into()],
            Some(1),
            Some(1)
        ));
    }

    #[test]
    fn star_requires_exact_episode_audio_and_both_languages_and_newer_failure_revokes_it() {
        let source = include_str!("../resources/streaming-registry.json");
        let mut fixture = Registry::parse(source).unwrap();
        let result = r#"{"provider":"vidnest","mediaType":"anime-series","identity":"mal:52991","season":1,"episode":1,"audio":"dub","playback":true,"englishAudio":true,"arabicSubtitles":true,"testedAt":"fixture","clientBuild":"fixture"}"#;
        fixture.results.push(serde_json::from_str(result).unwrap());
        let identities = ["mal:52991".into()];
        assert!(fixture.preferred(
            Provider::Vidnest,
            Audio::Dub,
            MediaType::AnimeSeries,
            &identities,
            Some(1),
            Some(1)
        ));
        assert!(!fixture.preferred(
            Provider::Vidnest,
            Audio::Dub,
            MediaType::AnimeSeries,
            &identities,
            Some(1),
            Some(2)
        ));
        assert!(!fixture.preferred(
            Provider::Vidnest,
            Audio::Sub,
            MediaType::AnimeSeries,
            &identities,
            Some(1),
            Some(1)
        ));
        let mut failure: PlaybackResult = serde_json::from_str(result).unwrap();
        failure.arabic_subtitles = false;
        fixture.results.push(failure);
        assert!(!fixture.preferred(
            Provider::Vidnest,
            Audio::Dub,
            MediaType::AnimeSeries,
            &identities,
            Some(1),
            Some(1)
        ));
        assert!(!fixture.preferred(
            Provider::Vidnest,
            Audio::Dub,
            MediaType::AnimeSeries,
            &["mal:999".into()],
            Some(1),
            Some(1)
        ));
    }

    #[test]
    fn disabled_or_removed_provider_is_denied() {
        let mut fixture =
            Registry::parse(include_str!("../resources/streaming-registry.json")).unwrap();
        fixture
            .providers
            .iter_mut()
            .find(|r| r.provider == Provider::Vidnest)
            .unwrap()
            .enabled = false;
        assert!(!fixture.allows(Provider::Vidnest, MediaType::AnimeSeries));
        fixture.providers.retain(|r| r.provider != Provider::Vidsrc);
        assert!(!fixture.allows(Provider::Vidsrc, MediaType::Film));
    }
}
