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
}
impl HomeGateway {
    pub async fn start(transport: ServerSession, id: String) -> Result<Self, Error> {
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
        let state = Shared {
            transport,
            id,
            token,
            host,
            readers: Arc::new(Semaphore::new(8)),
        };
        let router = Router::new()
            .route("/video/{token}", get(serve))
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
        })
    }
    pub fn endpoint(&self) -> &str {
        &self.endpoint
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
    let upstream = match state
        .transport
        .media_response(&state.id, method, range)
        .await
    {
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
