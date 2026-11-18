//! Artwork revalidation, metadata projection and registered-image boundaries.
use super::transport::network;
use super::{Error, ServerSession, valid_id};
use reqwest::{Method, Response, header};
use serde_json::Value;

pub(super) const ARTWORK_BODY_LIMIT: usize = 10 * 1024 * 1024;

pub(super) fn supported_mime(mime: &str) -> bool {
    matches!(
        mime,
        "image/jpeg" | "image/png" | "image/webp" | "image/avif" | "image/gif"
    )
}

pub(super) fn response_mime(response: &Response) -> &str {
    response
        .headers()
        .get(header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or_default()
        .split(';')
        .next()
        .unwrap_or_default()
}

pub(super) fn sanitize_release_posters(value: &mut Value) {
    if let Some(items) = value.get_mut("items").and_then(Value::as_array_mut) {
        for item in items {
            if let Some(poster) = item.get_mut("poster") {
                let id = poster
                    .get("id")
                    .and_then(Value::as_str)
                    .filter(|id| valid_id(id))
                    .map(str::to_owned);
                let mime = poster.get("mimeType").and_then(Value::as_str);
                if let Some(id) = id
                    && mime.is_some_and(supported_mime)
                    && let Some(fields) = poster.as_object_mut()
                {
                    // Artwork requests resolve registered UUIDs, never server-supplied external URLs or paths.
                    fields.retain(|key, _| {
                        matches!(
                            key.as_str(),
                            "id" | "url"
                                | "mimeType"
                                | "width"
                                | "height"
                                | "byteSize"
                                | "sha256"
                                | "originalFilename"
                                | "focalX"
                                | "focalY"
                        )
                    });
                    fields.insert("url".into(), Value::String(format!("/api/v1/artwork/{id}")));
                } else {
                    *poster = Value::Null;
                }
            }
        }
    }
}
impl ServerSession {
    pub async fn artwork_bytes(
        &self,
        id: &str,
        width: u32,
        cached: Option<crate::artwork_cache::Cached>,
    ) -> Result<(Vec<u8>, crate::artwork_cache::Metadata, bool, u64, u64), Error> {
        let queued = std::time::Instant::now();
        let _permit = self
            .artwork_permits
            .acquire()
            .await
            .map_err(|_| Error::new("internal", "Artwork stopped"))?;
        let queue = queued.elapsed().as_micros() as u64;
        let start = std::time::Instant::now();
        let mut request = self
            .authorized(Method::GET, &format!("api/v1/artwork/{id}?width={width}"))
            .await?;
        if let Some(cached) = &cached {
            request = request.header(reqwest::header::IF_NONE_MATCH, &cached.metadata.etag);
        }
        let response = request.send().await.map_err(network)?;
        if response.status() == reqwest::StatusCode::NOT_MODIFIED {
            let mut cached =
                cached.ok_or_else(|| Error::new("response", "Invalid artwork revalidation"))?;
            cached.metadata.verified_at = chrono::Utc::now().timestamp().max(0) as u64;
            return Ok((
                cached.bytes,
                cached.metadata,
                true,
                queue,
                start.elapsed().as_micros() as u64,
            ));
        }
        let mime = response_mime(&response).to_owned();
        let etag = response
            .headers()
            .get(reqwest::header::ETAG)
            .and_then(|v| v.to_str().ok())
            .unwrap_or("")
            .to_owned();
        let revision = response
            .headers()
            .get("x-artwork-revision")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("")
            .to_owned();
        let bytes = self.body(response, ARTWORK_BODY_LIMIT).await?;
        if !supported_mime(&mime) {
            return Err(Error::new("response", "Unsupported artwork format"));
        }
        Ok((
            bytes,
            crate::artwork_cache::Metadata {
                etag,
                mime,
                revision,
                verified_at: chrono::Utc::now().timestamp().max(0) as u64,
            },
            false,
            queue,
            start.elapsed().as_micros() as u64,
        ))
    }
}
