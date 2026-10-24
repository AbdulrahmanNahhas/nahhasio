//! Fixed embed adapters and catalog-derived capabilities. No caller-supplied URLs.
use crate::{bridge::Error, media::ResolvedTarget, torrentio::Kind};
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Clone, Copy, Debug, PartialEq, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Provider {
    Vidsrc,
    Vidlink,
    Vidfast,
    Vidrock,
    Vidnest,
    Vidhawk,
    Cinezo,
    Vidsrcto,
    Superembed,
    Mapple,
    Vixsrc,
    Vidcore,
    Vidzee,
    Cinextream,
    Nontongo,
    Vidapi,
    Primesrc,
}
#[derive(Clone, Copy, Debug, Default, PartialEq, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Audio {
    Dub,
    Sub,
    #[default]
    Original,
}
#[derive(Clone, Debug)]
pub struct CatalogTarget {
    pub files_only: bool,
    pub anime: bool,
    imdb: Option<String>,
    tmdb: Option<u64>,
    mal: Option<u64>,
    anilist: Option<u64>,
    series: bool,
    season: Option<u32>,
    episode: Option<u32>,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Offer {
    provider: Provider,
    name: &'static str,
    audio: Audio,
    available: bool,
    reason: Option<String>,
    tier: Tier,
    notes: Vec<&'static str>,
    capabilities: crate::stream_capabilities::Capabilities,
    preferred: bool,
}
#[derive(Clone, Copy, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Tier {
    Tested,
    Trial,
    Issues,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Listing {
    pub files_only: bool,
    pub anime: bool,
    pub providers: Vec<Offer>,
}
const PROVIDERS: [Provider; 17] = [
    Provider::Vidlink,
    Provider::Vidnest,
    Provider::Vidsrc,
    Provider::Vidfast,
    Provider::Vidsrcto,
    Provider::Vidrock,
    Provider::Vixsrc,
    Provider::Vidcore,
    Provider::Vidzee,
    Provider::Cinextream,
    Provider::Nontongo,
    Provider::Vidapi,
    Provider::Primesrc,
    Provider::Vidhawk,
    Provider::Cinezo,
    Provider::Superembed,
    Provider::Mapple,
];

fn numeric(value: &Value) -> Option<u64> {
    value.as_u64().filter(|id| *id > 0 && *id <= 2_147_483_647)
}
fn imdb(value: &Value) -> Option<String> {
    let id = value.as_str()?;
    let digits = id.strip_prefix("tt")?;
    ((7..=12).contains(&digits.len()) && digits.bytes().all(|c| c.is_ascii_digit()))
        .then(|| id.to_owned())
}
impl CatalogTarget {
    pub fn from_catalog(work: &Value, resolved: &ResolvedTarget) -> Self {
        let parts = work["installments"].as_array();
        let part = parts
            .and_then(|parts| {
                parts
                    .iter()
                    .find(|part| part["id"] == resolved.installment_id)
            })
            .unwrap_or(&Value::Null);
        let series = matches!(resolved.search.kind, Kind::Series);
        // Anime identifiers describe individual seasons. Work-level fallback is safe only
        // for the first season (or the sole film), never an unrelated sequel.
        let first_season = resolved.search.season == Some(1);
        let sole_film = !series
            && parts
                .is_some_and(|parts| parts.iter().filter(|p| p["kind"] != "season").count() == 1);
        let anime_id = |key: &str| {
            numeric(&part["externalIds"][key]).or_else(|| {
                (first_season || sole_film)
                    .then(|| numeric(&work["externalIds"][key]))
                    .flatten()
            })
        };
        let anime = ["malId", "anilistId"].iter().any(|key| {
            numeric(&work["externalIds"][key]).is_some()
                || parts.is_some_and(|parts| {
                    parts
                        .iter()
                        .any(|part| numeric(&part["externalIds"][key]).is_some())
                })
        }) || ["tags", "planets"].iter().any(|key| {
            work[key].as_array().is_some_and(|items| {
                items.iter().any(|item| {
                    item["slug"]
                        .as_str()
                        .is_some_and(|slug| slug == "anime" || slug.starts_with("anime-"))
                })
            })
        });
        let generic_id = |key: &str| {
            if series || (sole_film && part["externalIds"][key].is_null()) {
                work["externalIds"][key].clone()
            } else {
                part["externalIds"][key].clone()
            }
        };
        Self {
            files_only: work["playbackPolicy"] == "files-only",
            anime,
            imdb: imdb(&generic_id("imdbId")),
            tmdb: numeric(&generic_id("tmdbId")),
            mal: anime_id("malId"),
            anilist: anime_id("anilistId"),
            series,
            season: resolved.search.season,
            episode: resolved.search.episode,
        }
    }
    pub fn listing(&self) -> Listing {
        let mut providers = Vec::new();
        if !self.files_only {
            for provider in PROVIDERS {
                if !self.allows(provider) {
                    continue;
                }
                let audio_modes: &[Audio] = if self.anime
                    && matches!(
                        provider,
                        Provider::Vidhawk
                            | Provider::Cinezo
                            | Provider::Vidnest
                            | Provider::Vixsrc
                            | Provider::Vidcore
                            | Provider::Cinextream
                            | Provider::Nontongo
                    ) {
                    if provider == Provider::Nontongo {
                        &[Audio::Original]
                    } else if matches!(provider, Provider::Vixsrc | Provider::Vidcore) {
                        &[Audio::Dub]
                    } else {
                        &[Audio::Dub, Audio::Sub]
                    }
                } else {
                    &[Audio::Original]
                };
                for &audio in audio_modes {
                    let result = provider.embed_url(self, audio);
                    let (tier, notes) = provider.review(self, audio);
                    providers.push(Offer {
                        provider,
                        name: provider.name(),
                        audio,
                        available: result.is_ok(),
                        reason: result.err().map(|error| error.message),
                        tier,
                        notes,
                        capabilities: crate::stream_capabilities::describe(provider, self.anime),
                        preferred: self.preferred(provider, audio),
                    });
                }
            }
        }
        Listing {
            files_only: self.files_only,
            anime: self.anime,
            providers,
        }
    }
    fn media_type(&self) -> crate::stream_registry::MediaType {
        use crate::stream_registry::MediaType;
        match (self.anime, self.series) {
            (true, true) => MediaType::AnimeSeries,
            (true, false) => MediaType::AnimeFilm,
            (false, true) => MediaType::Series,
            (false, false) => MediaType::Film,
        }
    }
    fn allows(&self, provider: Provider) -> bool {
        crate::stream_registry::registry()
            .is_some_and(|registry| registry.allows(provider, self.media_type()))
    }
    fn preferred(&self, provider: Provider, audio: Audio) -> bool {
        let identities: Vec<_> = [
            self.imdb.as_ref().map(|id| format!("imdb:{id}")),
            self.tmdb.map(|id| format!("tmdb:{id}")),
            self.mal.map(|id| format!("mal:{id}")),
            self.anilist.map(|id| format!("anilist:{id}")),
        ]
        .into_iter()
        .flatten()
        .collect();
        crate::stream_registry::registry().is_some_and(|registry| {
            registry.preferred(
                provider,
                audio,
                self.media_type(),
                &identities,
                if self.series { self.season } else { None },
                if self.series { self.episode } else { None },
            )
        })
    }
}
impl Provider {
    pub fn name(self) -> &'static str {
        match self {
            Self::Vidsrc => "VidSrc",
            Self::Vidlink => "VidLink",
            Self::Vidfast => "VidFast",
            Self::Vidrock => "VidRock",
            Self::Vidnest => "VidNest",
            Self::Vidhawk => "VidHawk",
            Self::Cinezo => "Cinezo",
            Self::Vidsrcto => "VidSrc.to",
            Self::Superembed => "SuperEmbed",
            Self::Mapple => "Mapple",
            Self::Vixsrc => "VixSrc",
            Self::Vidcore => "VidCore",
            Self::Vidzee => "VidZee",
            Self::Cinextream => "Cinextream",
            Self::Nontongo => "NontonGo",
            Self::Vidapi => "VidAPI",
            Self::Primesrc => "PrimeSrc",
        }
    }
    fn review(self, target: &CatalogTarget, audio: Audio) -> (Tier, Vec<&'static str>) {
        let (tier, mut notes) = match self {
            Self::Vidnest if target.anime && target.series && audio == Audio::Dub => (
                Tier::Tested,
                vec![
                    "نجحت الدبلجة في فريـرن وقبعة الساحرة.",
                    "في الاختبار: ترجمة إنجليزية فقط؛ لا عربية أو رفع ملف.",
                ],
            ),
            Self::Vidnest if target.anime && !target.series => (
                Tier::Trial,
                vec![
                    "يستخدم مسار الأنمي للفيلم.",
                    "قد تقتصر الترجمة على الإنجليزية دون رفع ملف.",
                ],
            ),
            Self::Vidnest if target.anime => {
                (Tier::Trial, vec!["نسخة مترجمة؛ الخيارات تختلف حسب الخادم."])
            }
            Self::Vidnest => (
                Tier::Tested,
                vec!["نجح على Toy Story؛ الخيارات تختلف حسب الخادم."],
            ),
            Self::Vidlink => (Tier::Tested, vec!["نجح على Toy Story؛ للأفلام والمسلسلات."]),
            Self::Vidfast => (
                Tier::Tested,
                vec!["نجح على Toy Story؛ ترجمة ورفع ملف ترجمة."],
            ),
            Self::Vidsrc => (
                Tier::Tested,
                vec![
                    "نجح على Toy Story؛ ترجمة عربية عبر OpenSubtitles.",
                    "عند فشل التحقق جرّب إعادة التحميل مرة.",
                ],
            ),
            Self::Vidsrcto => (
                Tier::Tested,
                vec!["نجح على Toy Story؛ خيارات ترجمة داخل المشغّل."],
            ),
            Self::Vidrock => (
                Tier::Tested,
                vec!["نجح على Toy Story؛ OpenSubtitles، مع ملاحظات على التحكم."],
            ),
            Self::Vidhawk => (
                Tier::Issues,
                vec!["لم يعمل في اختبار فريـرن وقبعة الساحرة."],
            ),
            Self::Cinezo => (
                Tier::Issues,
                vec!["لم يعمل في الأنمي؛ خطأ non-finite على Toy Story."],
            ),
            Self::Superembed => (Tier::Issues, vec!["تعذّر تحميل المشغّل في الاختبار."]),
            Self::Mapple => (Tier::Issues, vec!["ظهر خطأ 404؛ يُجرّب الآن مع معرّف TMDB."]),
            Self::Vixsrc | Self::Vidcore => (Tier::Trial, vec!["يفضّل الصوت الإنجليزي عند توفره."]),
            Self::Cinextream | Self::Nontongo | Self::Vidapi | Self::Primesrc => {
                (Tier::Trial, vec!["الصوت والترجمة من إعدادات المشغّل."])
            }
            Self::Vidzee => (Tier::Trial, vec!["خيارات الصوت والترجمة حسب الخادم."]),
        };
        if target.anime && audio == Audio::Original {
            notes.push("الدبلجة الإنجليزية غير مؤكدة.");
        }
        if target.anime && audio == Audio::Sub {
            notes.push("نسخة مترجمة؛ ليست طلب دبلجة إنجليزية.");
        }
        (tier, notes)
    }
    fn host(self) -> &'static str {
        match self {
            Self::Vidsrc => "vidsrc.sh",
            Self::Vidlink => "vidlink.pro",
            Self::Vidfast => "vidfast.vc",
            Self::Vidrock => "vidrock.net",
            Self::Vidnest => "vidnest.fun",
            Self::Vidhawk => "vidhawk.buzz",
            Self::Cinezo => "player.cinezo.live",
            Self::Vidsrcto => "vidsrc.to",
            Self::Superembed => "multiembed.mov",
            Self::Mapple => "mapple.fun",
            Self::Vixsrc => "vixsrc.to",
            Self::Vidcore => "vidcore.org",
            Self::Vidzee => "player.vidzee.wtf",
            Self::Cinextream => "cinextream.cc",
            Self::Nontongo => "www.nontongo.win",
            Self::Vidapi => "vaplayer.ru",
            Self::Primesrc => "primesrc.me",
        }
    }
    pub fn permits_document(self, url: &url::Url) -> bool {
        url.scheme() == "https"
            && url.port_or_known_default() == Some(443)
            && url.username().is_empty()
            && url.password().is_none()
            && (url.host_str() == Some(self.host())
                || (self == Self::Vidhawk && url.host_str() == Some("www.vidhawk.buzz"))
                || (self == Self::Nontongo && url.host_str() == Some("nontongo.win")))
    }
    pub fn embed_url(self, target: &CatalogTarget, audio: Audio) -> Result<String, Error> {
        if target.files_only {
            return Err(Error::new("files_only", "هذا العمل يُشغّل من الملفات فقط."));
        }
        if !target.allows(self) {
            return Err(mapping_error("هذا المزوّد غير متاح لهذا النوع من الأعمال."));
        }
        let (season, episode) = if target.series {
            let (Some(season), Some(episode)) = (target.season, target.episode) else {
                return Err(mapping_error("تعذّر تحديد الموسم والحلقة."));
            };
            if season == 0 || season > 10000 || episode == 0 || episode > 100000 {
                return Err(mapping_error("رقم الحلقة غير مدعوم لدى المزوّد."));
            }
            (season, episode)
        } else {
            (0, 1)
        };
        let anime_route = target.anime
            && matches!(
                self,
                Self::Vidhawk | Self::Cinezo | Self::Vidnest | Self::Cinextream | Self::Nontongo
            );
        if anime_route {
            if audio == Audio::Original && self != Self::Nontongo {
                return Err(mapping_error("اختر الدبلجة أو النسخة المترجمة."));
            }
            let track = if audio == Audio::Dub { "dub" } else { "sub" };
            let path = match self {
                Self::Cinextream => {
                    if let Some(id) = target.anilist {
                        format!("/api/embed/anime/{track}/{id}/{episode}?autoplay=false")
                    } else {
                        format!(
                            "/api/embed/anime/mal/{track}/{}/{episode}?autoplay=false",
                            target.mal.ok_or_else(|| mapping_error(
                                "معرّف AniList أو MAL لهذا الإصدار غير مسجّل."
                            ))?
                        )
                    }
                }
                Self::Nontongo => {
                    if audio != Audio::Original {
                        return Err(mapping_error("لا يوفّر هذا المسار طلب دبلجة إنجليزية موثّقًا."));
                    }
                    if let Some(id) = target.anilist {
                        format!("/anime/{id}/{episode}/play")
                    } else {
                        format!(
                            "/anime/stream?id={}&e={episode}&type=MAL_ID",
                            target.mal.ok_or_else(|| mapping_error(
                                "معرّف AniList أو MAL لهذا الإصدار غير مسجّل."
                            ))?
                        )
                    }
                }
                Self::Vidhawk => format!(
                    "/embed/mal/{}/{episode}/{track}?server=flow",
                    target
                        .mal
                        .ok_or_else(|| mapping_error("معرّف MAL لهذا الإصدار غير مسجّل."))?
                ),
                Self::Cinezo => format!(
                    "/embed/anime/{}/{episode}?dub={}",
                    target
                        .anilist
                        .ok_or_else(|| mapping_error("معرّف AniList لهذا الإصدار غير مسجّل."))?,
                    audio == Audio::Dub
                ),
                Self::Vidnest => format!(
                    "/anime/{}/{episode}/{track}",
                    target
                        .anilist
                        .ok_or_else(|| mapping_error("معرّف AniList لهذا الإصدار غير مسجّل."))?
                ),
                _ => unreachable!(),
            };
            return Ok(format!("https://{}{path}", self.host()));
        }
        if self == Self::Vidhawk
            || (target.anime && self == Self::Vidlink)
            || (audio != Audio::Original
                && !(audio == Audio::Dub
                    && target.anime
                    && matches!(self, Self::Vixsrc | Self::Vidcore)))
        {
            return Err(mapping_error("هذا المزوّد لا يدعم هذا الاختيار."));
        }
        let id = if matches!(
            self,
            Self::Vidlink
                | Self::Vidnest
                | Self::Cinezo
                | Self::Mapple
                | Self::Vidcore
                | Self::Vidzee
                | Self::Cinextream
        ) {
            target
                .tmdb
                .map(|id| id.to_string())
                .ok_or_else(|| mapping_error("معرّف TMDB غير مسجّل."))?
        } else {
            target
                .imdb
                .clone()
                .or_else(|| target.tmdb.map(|id| id.to_string()))
                .ok_or_else(|| mapping_error("معرّف IMDb أو TMDB غير مسجّل."))?
        };
        let kind = if target.series { "tv" } else { "movie" };
        let suffix = if target.series {
            format!("/{season}/{episode}")
        } else {
            String::new()
        };
        let path = match self {
            Self::Vidsrc | Self::Vidsrcto | Self::Cinezo | Self::Vidzee | Self::Nontongo => {
                format!("/embed/{kind}/{id}{suffix}")
            }
            Self::Cinextream => format!("/api/embed/{kind}/{id}{suffix}?autoplay=false"),
            Self::Vidapi => format!("/embed/{kind}/{id}{suffix}?ds_lang=ar&autoplay=0"),
            Self::Primesrc => {
                if target.series {
                    return Err(mapping_error("ترقيم حلقات TVMaze غير موصول لهذا المزوّد."));
                }
                let key = if id.starts_with("tt") { "imdb" } else { "tmdb" };
                format!("/embed/movie?{key}={id}")
            }
            Self::Superembed => {
                let tmdb = if id.starts_with("tt") { "" } else { "&tmdb=1" };
                let episode = if target.series {
                    format!("&s={season}&e={episode}")
                } else {
                    String::new()
                };
                format!("/?video_id={id}{tmdb}{episode}")
            }
            Self::Mapple => {
                if target.series {
                    format!("/watch/tv/{id}-{season}-{episode}?autoPlay=false")
                } else {
                    format!("/watch/movie/{id}?autoPlay=false")
                }
            }
            Self::Vixsrc => format!("/{kind}/{id}{suffix}?lang=en&autoplay=false"),
            Self::Vidcore => format!("/embed/{kind}/{id}{suffix}?lang=en&autoplay=false"),
            Self::Vidfast => format!("/{kind}/{id}{suffix}?autoPlay=false"),
            _ => format!("/{kind}/{id}{suffix}"),
        };
        Ok(format!("https://{}{path}", self.host()))
    }
}
fn mapping_error(message: &str) -> Error {
    Error::new("source_mapping", message)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn target() -> CatalogTarget {
        CatalogTarget {
            files_only: false,
            anime: false,
            imdb: Some("tt1300854".into()),
            tmdb: Some(68721),
            mal: Some(52991),
            anilist: Some(154587),
            series: true,
            season: Some(1),
            episode: Some(13),
        }
    }
    #[test]
    fn adapters_keep_fixed_origins_and_exact_episode() {
        let target = target();
        for provider in PROVIDERS
            .into_iter()
            .filter(|provider| !matches!(provider, Provider::Vidhawk | Provider::Primesrc))
        {
            let url =
                url::Url::parse(&provider.embed_url(&target, Audio::Original).unwrap()).unwrap();
            assert!(provider.permits_document(&url));
            assert!(!provider.permits_document(&url::Url::parse("https://example.com/").unwrap()));
        }
        assert_eq!(
            Provider::Mapple
                .embed_url(&target, Audio::Original)
                .unwrap(),
            "https://mapple.fun/watch/tv/68721-1-13?autoPlay=false"
        );
    }
    #[test]
    fn anime_films_get_explicit_dub_routes_and_english_audio_trials() {
        let mut target = target();
        target.anime = true;
        target.series = false;
        target.season = None;
        target.episode = None;
        assert_eq!(
            Provider::Vidnest.embed_url(&target, Audio::Dub).unwrap(),
            "https://vidnest.fun/anime/154587/1/dub"
        );
        assert_eq!(
            Provider::Vixsrc.embed_url(&target, Audio::Dub).unwrap(),
            "https://vixsrc.to/movie/tt1300854?lang=en&autoplay=false"
        );
        assert_eq!(
            Provider::Vidcore.embed_url(&target, Audio::Dub).unwrap(),
            "https://vidcore.org/embed/movie/68721?lang=en&autoplay=false"
        );
        let offers = target.listing().providers;
        assert!(
            offers
                .iter()
                .any(|offer| offer.provider == Provider::Vidnest
                    && offer.audio == Audio::Dub
                    && offer.available
                    && offer.tier == Tier::Trial)
        );
        assert!(
            offers
                .iter()
                .filter(|offer| offer.provider == Provider::Cinezo)
                .all(|offer| offer.tier == Tier::Issues)
        );
        target.anilist = None;
        assert!(Provider::Vidnest.embed_url(&target, Audio::Dub).is_err());
        assert!(Provider::Vixsrc.embed_url(&target, Audio::Dub).is_ok());
    }
    #[test]
    fn anime_dub_is_explicit_and_files_only_blocks_every_adapter() {
        let mut target = target();
        target.anime = true;
        assert_eq!(
            Provider::Vidhawk.embed_url(&target, Audio::Dub).unwrap(),
            "https://vidhawk.buzz/embed/mal/52991/13/dub?server=flow"
        );
        assert!(
            Provider::Cinezo
                .embed_url(&target, Audio::Dub)
                .unwrap()
                .ends_with("?dub=true")
        );
        assert!(
            !target
                .listing()
                .providers
                .iter()
                .any(|offer| offer.provider == Provider::Vidlink)
        );
        target.anilist = None;
        assert!(Provider::Cinezo.embed_url(&target, Audio::Dub).is_err());
        target.files_only = true;
        assert!(target.listing().providers.is_empty());
        for provider in PROVIDERS {
            assert!(provider.embed_url(&target, Audio::Original).is_err());
        }
    }
}
