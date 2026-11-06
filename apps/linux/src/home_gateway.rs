//! Native-only relay to one authenticated file on the selected trusted Nahhasio server.
use crate::{bridge::Error, services::ServerSession};
use axum::{
    Router,
    body::Body,
    extract::{Path, State},
    http::{HeaderMap, Method, StatusCode, header},
    response::Response,
    routing::get,
};
use std::sync::Arc;
use subtle::ConstantTimeEq;
use tokio::sync::{Semaphore, oneshot};
use tokio_stream::StreamExt;
#[derive(Clone, Debug, serde::Serialize, serde::Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Subtitle {
    pub relative_path: String,
    pub byte_size: u64,
    pub sha256: String,
}
impl Subtitle {
    pub fn extension(&self) -> Result<&str, Error> {
        let extension = self
            .relative_path
            .rsplit('.')
            .next()
            .ok_or_else(unavailable)?;
        if self.relative_path.len() > 2048
            || self.byte_size == 0
            || self.byte_size > 16 * 1024 * 1024
            || self.sha256.len() != 64
            || !self.sha256.bytes().all(|c| c.is_ascii_hexdigit())
            || !["srt", "ass", "ssa", "vtt", "sub", "idx"]
                .contains(&extension.to_ascii_lowercase().as_str())
        {
            return Err(unavailable());
        }
        Ok(extension)
    }
}
#[derive(Clone)]
struct Shared {
    transport: ServerSession,
    id: String,
    token: String,
    host: String,
    readers: Arc<Semaphore>,
}
pub struct HomeGateway {
    endpoint: String,
    shutdown: Option<oneshot::Sender<()>>,
    subtitles: Vec<(String, String, String)>,
}
impl HomeGateway {
    #[cfg(feature = "native-diagnostics")]
    pub async fn start(transport: ServerSession, id: String) -> Result<Self, Error> {
        Self::start_with_subtitles(transport, id, Vec::new()).await
    }
    pub(crate) async fn start_with_subtitles(
        transport: ServerSession,
        id: String,
        subtitles: Vec<Subtitle>,
    ) -> Result<Self, Error> {
        if subtitles.len() > 16 {
            return Err(unavailable());
        }
        let listener = tokio::net::TcpListener::bind(("127.0.0.1", 0))
            .await
            .map_err(|_| unavailable())?;
        let host = listener
            .local_addr()
            .map_err(|_| unavailable())?
            .to_string();
        let mut random = [0; 32];
        getrandom::fill(&mut random).map_err(|_| unavailable())?;
        let token = hex::encode(random);
        let endpoint = format!("http://{host}/video/{token}");
        let mut subtitle_urls = Vec::new();
        for (index, subtitle) in subtitles.iter().enumerate() {
            let extension = subtitle.extension()?.to_ascii_lowercase();
            if ["srt", "ass", "ssa", "vtt"].contains(&extension.as_str()) {
                subtitle_urls.push((
                    format!("{endpoint}/subtitles/{index}/subtitle.{extension}"),
                    format!("Subtitle {}", index + 1),
                    String::new(),
                ));
            }
        }
        let state = Shared {
            transport,
            id,
            token,
            host,
            readers: Arc::new(Semaphore::new(8)),
        };
        let router = Router::new()
            .route("/video/{token}", get(serve))
            .route(
                "/video/{token}/subtitles/{index}/{name}",
                get(serve_subtitle),
            )
            .with_state(state);
        let (shutdown, closed) = oneshot::channel();
        tokio::spawn(async move {
            let _ = axum::serve(listener, router)
                .with_graceful_shutdown(async {
                    let _ = closed.await;
                })
                .await;
        });
        Ok(Self {
            endpoint,
            shutdown: Some(shutdown),
            subtitles: subtitle_urls,
        })
    }
    pub fn endpoint(&self) -> &str {
        &self.endpoint
    }
    pub(crate) fn subtitles(&self) -> &[(String, String, String)] {
        &self.subtitles
    }
}
impl Drop for HomeGateway {
    fn drop(&mut self) {
        if let Some(tx) = self.shutdown.take() {
            let _ = tx.send(());
        }
    }
}
fn unavailable() -> Error {
    Error::new("home_media", "تعذّر الاتصال بملف مكتبة المنزل.")
}
async fn serve(
    State(state): State<Shared>,
    Path(token): Path<String>,
    method: Method,
    headers: HeaderMap,
) -> Response {
    relay(state, token, None, method, headers).await
}
async fn serve_subtitle(
    State(state): State<Shared>,
    Path((token, index, _name)): Path<(String, usize, String)>,
    method: Method,
    headers: HeaderMap,
) -> Response {
    relay(state, token, Some(index), method, headers).await
}
async fn relay(
    state: Shared,
    token: String,
    subtitle: Option<usize>,
    method: Method,
    headers: HeaderMap,
) -> Response {
    if headers.contains_key(header::ORIGIN)
        || headers.get(header::HOST).and_then(|v| v.to_str().ok()) != Some(&state.host)
        || token.len() != state.token.len()
        || !bool::from(token.as_bytes().ct_eq(state.token.as_bytes()))
    {
        return Response::builder()
            .status(StatusCode::FORBIDDEN)
            .body(Body::empty())
            .unwrap();
    }
    let Ok(permit) = state.readers.clone().try_acquire_owned() else {
        return Response::builder()
            .status(StatusCode::SERVICE_UNAVAILABLE)
            .body(Body::empty())
            .unwrap();
    };
    let range = match headers.get(header::RANGE) {
        Some(value) => match value.to_str() {
            Ok(v) => Some(v),
            Err(_) => {
                return Response::builder()
                    .status(StatusCode::BAD_REQUEST)
                    .body(Body::empty())
                    .unwrap();
            }
        },
        None => None,
    };
    let response = if let Some(index) = subtitle {
        state
            .transport
            .media_subtitle(&state.id, index, method, range)
            .await
    } else {
        state
            .transport
            .media_response(&state.id, method, range)
            .await
    };
    let upstream = match response {
        Ok(response) => response,
        Err(_) => {
            return Response::builder()
                .status(StatusCode::BAD_GATEWAY)
                .body(Body::empty())
                .unwrap();
        }
    };
    let status = upstream.status();
    if !matches!(status.as_u16(), 200 | 206 | 304 | 416) {
        return Response::builder()
            .status(status)
            .body(Body::empty())
            .unwrap();
    }
    let mut response = Response::builder().status(status);
    for key in [
        header::CONTENT_TYPE,
        header::CONTENT_LENGTH,
        header::CONTENT_RANGE,
        header::ACCEPT_RANGES,
        header::ETAG,
        header::LAST_MODIFIED,
    ] {
        if let Some(value) = upstream.headers().get(&key) {
            response = response.header(key, value);
        }
    }
    response = response.header(header::CACHE_CONTROL, "no-store");
    let stream = upstream.bytes_stream().map(move |chunk| {
        let _ = &permit;
        chunk.map_err(|_| std::io::Error::other("Home media transfer interrupted"))
    });
    response.body(Body::from_stream(stream)).unwrap()
}
