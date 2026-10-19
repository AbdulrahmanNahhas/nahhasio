//! Bounded, fixed-endpoint provider access. Errors never include URLs or credentials.
use super::*;
use reqwest::{Client, Response};
use std::time::Duration;
use unicode_normalization::UnicodeNormalization;

fn client() -> Result<&'static Client> {
    static CLIENT: std::sync::OnceLock<std::result::Result<Client, reqwest::Error>> =
        std::sync::OnceLock::new();
    CLIENT
        .get_or_init(|| {
            Client::builder()
                .https_only(true)
                .redirect(reqwest::redirect::Policy::none())
                .timeout(Duration::from_secs(15))
                .connect_timeout(Duration::from_secs(5))
                .pool_max_idle_per_host(2)
                .build()
        })
        .as_ref()
        .map_err(|_| invalid("Provider client unavailable"))
}
async fn bytes(mut response: Response, limit: usize) -> Result<Vec<u8>> {
    if !response.status().is_success() {
        return Err(invalid("Provider request failed"));
    }
    if response
        .content_length()
        .is_some_and(|size| size > limit as u64)
    {
        return Err(invalid("Provider response too large"));
    }
    let mut body = Vec::new();
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|_| invalid("Provider response failed"))?
    {
        if body.len() + chunk.len() > limit {
            return Err(invalid("Provider response too large"));
        }
        body.extend_from_slice(&chunk);
    }
    Ok(body)
}
async fn json(response: Response) -> Result<Value> {
    if response.status() == reqwest::StatusCode::NOT_FOUND {
        return Ok(Value::Null);
    }
    Ok(serde_json::from_slice(
        &bytes(response, 8 * 1024 * 1024).await?,
    )?)
}
async fn tmdb(path: &str, params: &[(&str, String)]) -> Result<Value> {
    let Ok(token) = std::env::var("TMDB_API_READ_ACCESS_KEY") else {
        return Ok(Value::Null);
    };
    let response = client()?
        .get(format!("https://api.themoviedb.org/3{path}"))
        .query(params)
        .bearer_auth(token)
        .send()
        .await
        .map_err(|_| invalid("TMDB request failed"))?;
    json(response).await
}
fn safe_image_path(path: &str) -> bool {
    path.starts_with('/')
        && path.len() < 300
        && path[1..]
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b"_.-".contains(&b))
}
fn image_url(path: &Value, size: &str) -> Value {
    let path = path.as_str().unwrap_or("");
    if safe_image_path(path) {
        json!(format!("https://image.tmdb.org/t/p/{size}{path}"))
    } else {
        Value::Null
    }
}
fn candidate(
    provider: &str,
    id: Value,
    role: &str,
    url: Value,
    preview: Value,
    label: Value,
    metadata: (Value, Value, Value),
) -> Value {
    let (width, height, language) = metadata;
    json!({"provider":provider,"externalId":id.as_str().map(str::to_owned).unwrap_or_else(||id.to_string()),"role":role,"downloadUrl":url,"previewUrl":preview,"matchLabel":label,"width":width,"height":height,"language":language})
}
async fn tmdb_art(input: &Value) -> Result<(Vec<Value>, Value)> {
    let kind = input["kind"].as_str().unwrap_or("animated-movie");
    let movie = kind.ends_with("movie");
    let media = if movie { "movie" } else { "tv" };
    let role = text(input, "role");
    let title = if movie {
        text(input, "title")
    } else {
        input["seriesTitle"]
            .as_str()
            .unwrap_or(text(input, "title"))
    };
    let (id, mut label) = if let Some(id) = input.get("tmdbId") {
        (id.clone(), json!(title))
    } else {
        let mut params = vec![("query", title.to_owned())];
        if movie && let Some(year) = input.get("year") {
            params.push(("year", year.to_string()));
        }
        let result = tmdb(&format!("/search/{media}"), &params).await?;
        let Some(first) = array(&result["results"]).first() else {
            return Ok((vec![], Value::Null));
        };
        if !first["id"].is_u64() {
            return Err(invalid("Invalid TMDB response"));
        }
        (
            first["id"].clone(),
            first
                .get("title")
                .filter(|v| v.is_string())
                .or(first.get("name").filter(|v| v.is_string()))
                .cloned()
                .unwrap_or(json!(title)),
        )
    };
    let season = if !movie && role == "poster" {
        input.get("season")
    } else {
        None
    };
    let path = if let Some(season) = season {
        format!("/tv/{id}/season/{season}/images")
    } else {
        format!("/{media}/{id}/images")
    };
    let mut images = tmdb(&path, &[]).await?;
    if season.is_some() && array(&images["posters"]).is_empty() {
        images = tmdb(&format!("/tv/{id}/images"), &[]).await?;
        label = json!(format!(
            "{title} · صور المسلسل (لا تتوفر ملصقات الموسم {})",
            season.unwrap_or(&Value::Null)
        ));
    }
    let key = match role {
        "poster" => "posters",
        "banner" => "backdrops",
        _ => "logos",
    };
    let result = array(&images[key])
        .iter()
        .take(100)
        .filter(|i| {
            safe_image_path(text(i, "file_path"))
                && i["width"].as_u64().is_some_and(|v| v > 0)
                && i["height"].as_u64().is_some_and(|v| v > 0)
        })
        .map(|i| {
            candidate(
                "tmdb",
                id.clone(),
                role,
                image_url(&i["file_path"], "original"),
                image_url(&i["file_path"], "w500"),
                label.clone(),
                (
                    i["width"].clone(),
                    i["height"].clone(),
                    i["iso_639_1"].clone(),
                ),
            )
        })
        .collect();
    Ok((result, id))
}
fn normalized(value: &str) -> String {
    value
        .nfkc()
        .flat_map(char::to_lowercase)
        .map(|c| if c.is_alphanumeric() { c } else { ' ' })
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}
async fn anilist(input: &Value) -> Result<Vec<Value>> {
    let role = text(input, "role");
    if role == "logo" {
        return Ok(vec![]);
    }
    let fields = "id title {romaji english} coverImage {extraLarge large} bannerImage";
    let by_id = input.get("anilistId").is_some();
    let title = input["seriesTitle"]
        .as_str()
        .unwrap_or(text(input, "title"));
    let (query, variables) = if by_id {
        (
            format!("query($id:Int){{Media(id:$id,type:ANIME){{{fields}}}}}"),
            json!({"id":input["anilistId"]}),
        )
    } else {
        (
            [
                "query($search:String){Page(page:1,perPage:8){media(search:$search,type:ANIME){",
                fields,
                "}}}",
            ]
            .concat(),
            json!({"search":title}),
        )
    };
    let body = json(
        client()?
            .post("https://graphql.anilist.co")
            .json(&json!({"query":query,"variables":variables}))
            .send()
            .await
            .map_err(|_| invalid("AniList request failed"))?,
    )
    .await?;
    let matches = if by_id {
        vec![body["data"]["Media"].clone()]
    } else {
        array(&body["data"]["Page"]["media"]).to_vec()
    };
    let mut result = vec![];
    for item in matches {
        if !item["id"].is_u64() {
            continue;
        }
        if !by_id
            && !["english", "romaji"].iter().any(|key| {
                format!(" {} ", normalized(text(&item["title"], key)))
                    .contains(&format!(" {} ", normalized(title)))
            })
        {
            continue;
        }
        let url = if role == "poster" {
            item["coverImage"]
                .get("extraLarge")
                .filter(|v| v.is_string())
                .unwrap_or(&item["coverImage"]["large"])
        } else {
            &item["bannerImage"]
        };
        if !url.is_string() {
            continue;
        }
        image_endpoint(url.as_str().expect("string"))?;
        result.push(candidate(
            "anilist",
            item["id"].clone(),
            role,
            url.clone(),
            url.clone(),
            item["title"]
                .get("english")
                .filter(|v| v.is_string())
                .or(item["title"].get("romaji").filter(|v| v.is_string()))
                .cloned()
                .unwrap_or(json!(title)),
            (Value::Null, Value::Null, Value::Null),
        ));
    }
    Ok(result)
}
async fn fanart(input: &Value, id: &Value) -> Result<Vec<Value>> {
    let Ok(key) = std::env::var("FANART_API_KEY") else {
        return Ok(vec![]);
    };
    let role = text(input, "role");
    let body = json(
        client()?
            .get(format!("https://webservice.fanart.tv/v3/movies/{id}"))
            .query(&[("api_key", key)])
            .send()
            .await
            .map_err(|_| invalid("Fanart request failed"))?,
    )
    .await?;
    let keys = match role {
        "logo" => ["hdmovielogo", "movielogo"],
        "banner" => ["moviebackground", "moviebackground"],
        _ => ["movieposter", "movieposter"],
    };
    let images = if array(&body[keys[0]]).is_empty() {
        array(&body[keys[1]])
    } else {
        array(&body[keys[0]])
    };
    let mut result = vec![];
    for image in images.iter().take(100) {
        if image_endpoint(text(image, "url")).is_err() {
            continue;
        }
        result.push(candidate(
            "fanart",
            id.clone(),
            role,
            image["url"].clone(),
            image["url"].clone(),
            input["title"].clone(),
            (
                Value::Null,
                Value::Null,
                image["lang"]
                    .as_str()
                    .filter(|s| !s.is_empty() && *s != "00")
                    .map(|s| json!(s))
                    .unwrap_or(Value::Null),
            ),
        ));
    }
    Ok(result)
}
pub(super) fn image_endpoint(value: &str) -> Result<reqwest::Url> {
    let url = reqwest::Url::parse(value).map_err(|_| invalid("Invalid artwork URL"))?;
    if url.scheme() != "https"
        || !url.username().is_empty()
        || url.password().is_some()
        || url.port().is_some_and(|p| p != 443)
        || !matches!(
            url.host_str(),
            Some("image.tmdb.org" | "assets.fanart.tv" | "s4.anilist.co")
        )
    {
        return Err(invalid("مصدر الصورة غير مسموح."));
    }
    Ok(url)
}
pub(super) async fn download(value: &str) -> Result<(Vec<u8>, String)> {
    let response = client()?
        .get(image_endpoint(value)?)
        .send()
        .await
        .map_err(|_| invalid("Artwork download failed"))?;
    let mime = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|h| h.to_str().ok())
        .unwrap_or("")
        .split(';')
        .next()
        .unwrap_or("")
        .to_owned();
    if !["image/jpeg", "image/png", "image/webp"].contains(&mime.as_str()) {
        return Err(invalid("Unsupported artwork response"));
    }
    Ok((bytes(response, 10 * 1024 * 1024).await?, mime))
}
async fn season(input: &Value) -> Result<Value> {
    let id = &input["tmdbId"];
    let season = &input["season"];
    if input.get("groupId").is_none() {
        let response = tmdb(
            &format!("/tv/{id}/season/{season}"),
            &[("language", "ar-SA".into())],
        )
        .await?;
        if !response.is_null() {
            return Ok(json!(
                array(&response["episodes"])
                    .iter()
                    .take(2000)
                    .map(|e| episode(
                        e,
                        e["episode_number"].clone(),
                        season.clone(),
                        e["episode_number"].clone(),
                        format!("TMDB · الموسم {season}")
                    ))
                    .collect::<Vec<_>>()
            ));
        }
    }
    let listing = tmdb(&format!("/tv/{id}/episode_groups"), &[]).await?;
    if listing.is_null() {
        return Ok(Value::Null);
    }
    let named: Vec<_> = array(&listing["results"])
        .iter()
        .filter(|g| {
            text(g, "name").to_lowercase().contains("seasons") || text(g, "name").contains("مواسم")
        })
        .collect();
    let candidates = if named.is_empty() {
        array(&listing["results"])
            .iter()
            .filter(|g| g["type"] == 6 || g["type"] == 7)
            .collect::<Vec<_>>()
    } else {
        named
    };
    let selected = if let Some(group) = input.get("groupId") {
        array(&listing["results"])
            .iter()
            .find(|g| g["id"] == *group)
    } else if candidates.len() == 1 {
        Some(candidates[0])
    } else if candidates.len() > 1 {
        return Err(invalid(
            "Multiple TMDB episode groups; select a group explicitly",
        ));
    } else {
        None
    };
    let Some(selected) = selected else {
        if input.get("groupId").is_some() {
            return Err(invalid("Episode group does not belong to this series"));
        }
        return Ok(Value::Null);
    };
    let group = text(selected, "id");
    if group.is_empty()
        || !group
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b"_-".contains(&b))
    {
        return Err(invalid("Invalid TMDB episode group"));
    }
    let body = tmdb(&format!("/tv/episode_group/{group}"), &[]).await?;
    let matches: Vec<_> = array(&body["groups"])
        .iter()
        .filter(|g| g["order"] == *season)
        .collect();
    if matches.len() != 1 {
        return Ok(Value::Null);
    }
    let mut episodes = array(&matches[0]["episodes"]).to_vec();
    episodes.sort_by_key(|e| e["order"].as_i64().unwrap_or(0));
    Ok(json!(
        episodes
            .iter()
            .take(2000)
            .map(|e| episode(
                e,
                json!(e["order"].as_u64().unwrap_or(0).saturating_add(1)),
                e["season_number"].clone(),
                e["episode_number"].clone(),
                format!("{} · {}", text(selected, "name"), text(matches[0], "name"))
            ))
            .collect::<Vec<_>>()
    ))
}
fn episode(e: &Value, number: Value, season: Value, source: Value, label: String) -> Value {
    json!({"number":number,"title":e["name"].as_str().map(str::trim).filter(|s|!s.is_empty()),"summary":text(e,"overview").trim(),"releaseDate":e["air_date"].as_str().filter(|s|!s.is_empty()),"runtimeMinutes":e["runtime"],"stillUrl":image_url(&e["still_path"],"original"),"sourceSeason":season,"sourceEpisode":source,"sourceLabel":label})
}
pub(super) async fn execute(operation: &str, input: &Value) -> Result<Value> {
    match operation {
        "search" => {
            let kind = input["kind"].as_str().unwrap_or("animated-movie");
            let mut warnings = vec![];
            if std::env::var("TMDB_API_READ_ACCESS_KEY").is_err() {
                warnings.push("TMDB: مفتاح المصدر غير مفعّل.".to_owned());
            }
            if kind.ends_with("movie") && std::env::var("FANART_API_KEY").is_err() {
                warnings.push("Fanart: مفتاح المصدر غير مفعّل.".to_owned());
            }
            let (tmdb, anime) = tokio::join!(tmdb_art(input), async {
                if kind.starts_with("animated") {
                    anilist(input).await
                } else {
                    Ok(vec![])
                }
            });
            let (mut tmdb, id) = match tmdb {
                Ok(v) => v,
                Err(_) => {
                    warnings.push("TMDB: تعذّر جلب الصور.".into());
                    (vec![], Value::Null)
                }
            };
            let mut candidates = match anime {
                Ok(v) => v,
                Err(_) => {
                    warnings.push("AniList: تعذّر جلب الصور.".into());
                    vec![]
                }
            };
            candidates.append(&mut tmdb);
            if kind.ends_with("movie") && !id.is_null() {
                match fanart(input, &id).await {
                    Ok(mut v) => candidates.append(&mut v),
                    Err(_) => warnings.push("Fanart: تعذّر جلب الصور.".into()),
                }
            }
            let mut seen = std::collections::BTreeSet::new();
            candidates.retain(|c| seen.insert(c["downloadUrl"].to_string()));
            Ok(json!({"candidates":candidates,"warnings":warnings}))
        }
        "season" | "episodeImages" => {
            if std::env::var("TMDB_API_READ_ACCESS_KEY").is_err() {
                return Err(invalid("مفتاح TMDB غير مفعّل."));
            }
            if operation == "season" {
                return season(input).await;
            }
            let mut mapping = input.clone();
            let mut response = tmdb(
                &format!(
                    "/tv/{}/season/{}/episode/{}/images",
                    input["tmdbId"], input["season"], input["episode"]
                ),
                &[],
            )
            .await?;
            if response.is_null() {
                let group = season(input).await?;
                if let Some(mapped) = array(&group)
                    .iter()
                    .find(|e| e["number"] == input["episode"])
                {
                    mapping["season"] = mapped["sourceSeason"].clone();
                    mapping["episode"] = mapped["sourceEpisode"].clone();
                    if mapping["season"] != input["season"]
                        || mapping["episode"] != input["episode"]
                    {
                        response = tmdb(
                            &format!(
                                "/tv/{}/season/{}/episode/{}/images",
                                input["tmdbId"], mapping["season"], mapping["episode"]
                            ),
                            &[],
                        )
                        .await?;
                    }
                }
            }
            let mut images = array(&response["stills"]).to_vec();
            images.sort_by(|a, b| {
                b["vote_count"]
                    .as_u64()
                    .unwrap_or(0)
                    .cmp(&a["vote_count"].as_u64().unwrap_or(0))
                    .then_with(|| {
                        (b["width"]
                            .as_u64()
                            .unwrap_or(0)
                            .saturating_mul(b["height"].as_u64().unwrap_or(0)))
                        .cmp(
                            &(a["width"]
                                .as_u64()
                                .unwrap_or(0)
                                .saturating_mul(a["height"].as_u64().unwrap_or(0))),
                        )
                    })
            });
            Ok(json!(images.iter().filter(|i|safe_image_path(text(i,"file_path"))).take(60).map(|i|json!({"url":image_url(&i["file_path"],"original"),"previewUrl":image_url(&i["file_path"],"w300"),"width":i["width"],"height":i["height"]})).collect::<Vec<_>>()))
        }
        _ => Err(invalid("Unknown provider operation")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn artwork_urls_reject_credentials_ports_and_other_hosts() {
        for value in [
            "http://image.tmdb.org/file.png",
            "https://image.tmdb.org.evil.invalid/file.png",
            "https://user:password@image.tmdb.org/file.png",
            "https://image.tmdb.org:8443/file.png",
            "https://127.0.0.1/file.png",
            "file:///etc/passwd",
        ] {
            assert!(image_endpoint(value).is_err());
        }
        assert!(image_endpoint("https://image.tmdb.org/t/p/original/file.png").is_ok());
        assert!(!safe_image_path("/../secret"));
        assert!(safe_image_path("/file_name-1.jpg"));
    }
}
