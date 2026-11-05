//! YouTube sources are reduced to canonical IDs before entering an external process.
use super::{Error, Result, storage};
use axum::{
    Json,
    extract::State,
    http::{HeaderMap, StatusCode},
};
use serde::Deserialize;
use serde_json::{Value, json};
use sqlx::types::Json as SqlJson;
fn identifier(value: &str, min: usize, max: usize) -> bool {
    (min..=max).contains(&value.len())
        && value
            .bytes()
            .all(|c| c.is_ascii_alphanumeric() || c == b'_' || c == b'-')
}
pub(super) fn video_id(value: &str) -> bool {
    identifier(value, 11, 11)
}
pub(super) fn canonical(value: &str) -> Result<String> {
    let value = value.trim();
    for prefix in [
        "https://www.youtube.com/watch?v=",
        "https://youtube.com/watch?v=",
        "https://youtu.be/",
    ] {
        if let Some(id) = value.strip_prefix(prefix) {
            let id = id.split(['&', '?']).next().unwrap_or("");
            if video_id(id) {
                return Ok(format!("https://www.youtube.com/watch?v={id}"));
            }
        }
    }
    for prefix in [
        "https://www.youtube.com/playlist?list=",
        "https://youtube.com/playlist?list=",
    ] {
        if let Some(id) = value.strip_prefix(prefix) {
            let id = id.split('&').next().unwrap_or("");
            if identifier(id, 10, 150) {
                return Ok(format!("https://www.youtube.com/playlist?list={id}"));
            }
        }
    }
    Err(storage::invalid())
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct Preview {
    url: String,
}
pub(super) async fn preview(
    State(state): State<super::MediaState>,
    headers: HeaderMap,
    Json(input): Json<Preview>,
) -> Result<Json<Value>> {
    let url = canonical(&input.url)?;
    let mut tx = state.pool.begin().await?;
    sqlx::query("set transaction read write")
        .execute(&mut *tx)
        .await?;
    let actor = crate::auth::lock_admin_session(&mut tx, &headers)
        .await
        .map_err(|_| Error(StatusCode::FORBIDDEN, "Administrator session expired"))?;
    let id:String=sqlx::query_scalar("insert into background_jobs(type,created_by_account_id,payload) values('media.youtube.preview',$1::uuid,$2) returning id::text").bind(actor).bind(SqlJson(json!({"url":url}))).fetch_one(&mut *tx).await?;
    tx.commit().await?;
    Ok(Json(json!({"id":id})))
}
pub(super) async fn extract(url: &str) -> std::result::Result<Value, &'static str> {
    let url = canonical(url).map_err(|_| "Invalid YouTube URL")?;
    let output = super::worker::command(
        "yt-dlp",
        &[
            "--ignore-config",
            "--flat-playlist",
            "--dump-single-json",
            "--skip-download",
            "--no-warnings",
            "--playlist-end",
            "500",
            "--socket-timeout",
            "20",
            "--",
            &url,
        ],
        180,
        4 * 1024 * 1024,
    )
    .await?;
    let data: Value =
        serde_json::from_slice(&output).map_err(|_| "Invalid YouTube preview response")?;
    let entries = if let Some(entries) = data["entries"].as_array() {
        entries.clone()
    } else {
        vec![data.clone()]
    };
    let result:Vec<Value>=entries.iter().map(|entry|{
        let id=entry["id"].as_str().filter(|id|video_id(id));
        let available=id.is_some()&&!matches!(entry["availability"].as_str(),Some("private"|"subscriber_only"|"premium_only"))&&!matches!(entry["title"].as_str(),Some("[Deleted video]"|"[Private video]"));
        json!({"videoId":id,"title":entry["title"].as_str().unwrap_or("Unavailable video"),"durationSeconds":entry["duration"].as_f64(),"available":available})
    }).collect();
    Ok(json!({"phase":"preview","title":data["title"],"entries":result}))
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn only_canonical_youtube_sources() {
        assert_eq!(
            canonical("https://youtu.be/abcdefghijk?x=y").unwrap(),
            "https://www.youtube.com/watch?v=abcdefghijk"
        );
        for url in [
            "http://youtube.com/watch?v=abcdefghijk",
            "https://evil.test/playlist?list=abcdefghijk",
            "https://youtube.com@127.0.0.1/watch?v=abcdefghijk",
            "--exec=evil",
            "https://youtu.be/../etc/passwd",
        ] {
            assert!(canonical(url).is_err());
        }
    }
}
