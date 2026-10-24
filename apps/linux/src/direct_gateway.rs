//! Native-only HTTPS delivery. Every redirect/DNS answer is checked and pinned; HLS stays contained.
use axum::{
    Router,
    body::Body,
    extract::{Path, State},
    http::{HeaderMap, StatusCode, header},
    response::Response,
    routing::get,
};
use std::{
    collections::HashMap,
    net::{IpAddr, SocketAddr},
    sync::Arc,
    time::Duration,
};
use subtle::ConstantTimeEq;
use tokio::sync::{Mutex, Semaphore, oneshot};
use tokio_stream::StreamExt;
use url::Url;

#[derive(Clone)]
pub struct StreamSource {
    pub url: String,
    pub referrer: Option<String>,
    pub hls: bool,
}
#[derive(Clone)]
struct Resource {
    url: Url,
    playlist: bool,
}
struct Shared {
    host: String,
    token: String,
    referrer: Option<String>,
    resources: Mutex<Vec<Resource>>,
    clients: Mutex<HashMap<String, reqwest::Client>>,
    readers: Arc<Semaphore>,
}
pub struct DirectGateway {
    endpoint: String,
    shared: Arc<Shared>,
    shutdown: Option<oneshot::Sender<()>>,
}
impl DirectGateway {
    pub async fn start(source: StreamSource) -> Result<Self, &'static str> {
        let url = safe_url(&source.url)?;
        if let Some(referrer) = &source.referrer {
            safe_url(referrer)?;
        }
        let listener = tokio::net::TcpListener::bind(("127.0.0.1", 0))
            .await
            .map_err(|_| "Cannot prepare native stream")?;
        let host = listener
            .local_addr()
            .map_err(|_| "Cannot prepare native stream")?
            .to_string();
        let mut entropy = [0; 32];
        getrandom::fill(&mut entropy).map_err(|_| "Cannot prepare stream capability")?;
        let token = hex::encode(entropy);
        let endpoint = format!(
            "http://{host}/video/{token}/0.{}",
            if source.hls { "m3u8" } else { "mp4" }
        );
        let shared = Arc::new(Shared {
            host,
            token,
            referrer: source.referrer,
            resources: Mutex::new(vec![Resource {
                url,
                playlist: source.hls,
            }]),
            clients: Mutex::new(HashMap::new()),
            readers: Arc::new(Semaphore::new(6)),
        });
        let router = Router::new()
            .route("/video/{token}/{id}", get(serve))
            .with_state(shared.clone());
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
            shared,
            shutdown: Some(shutdown),
        })
    }
    pub fn endpoint(&self) -> &str {
        &self.endpoint
    }
    pub async fn subtitle(&self, source: &str) -> Result<String, &'static str> {
        let id = self.shared.register(safe_url(source)?, false).await?;
        Ok(format!(
            "http://{}/video/{}/{id}.vtt",
            self.shared.host, self.shared.token
        ))
    }
}
impl Drop for DirectGateway {
    fn drop(&mut self) {
        if let Some(tx) = self.shutdown.take() {
            let _ = tx.send(());
        }
    }
}

fn safe_url(value: &str) -> Result<Url, &'static str> {
    let url = Url::parse(value).map_err(|_| "Invalid stream URL")?;
    if value.len() > 8192
        || url.scheme() != "https"
        || url.host_str().is_none()
        || url.port_or_known_default() != Some(443)
        || !url.username().is_empty()
        || url.password().is_some()
        || url.fragment().is_some()
    {
        return Err("Unsafe stream URL");
    }
    Ok(url)
}
fn public(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(ip) => {
            let [a, b, _, _] = ip.octets();
            !(ip.is_private()
                || ip.is_loopback()
                || ip.is_link_local()
                || ip.is_unspecified()
                || ip.is_broadcast()
                || ip.is_documentation()
                || a == 0
                || a >= 224
                || (a == 100 && (64..=127).contains(&b))
                || (a == 198 && (b == 18 || b == 19)))
        }
        IpAddr::V6(ip) => ip.to_ipv4_mapped().map_or_else(
            || {
                ip.segments()[0] & 0xe000 == 0x2000
                    && !(ip.segments()[0] == 0x2001 && ip.segments()[1] == 0x0db8)
            },
            |ip| public(IpAddr::V4(ip)),
        ),
    }
}
impl Shared {
    async fn client(&self, url: &Url) -> Result<reqwest::Client, &'static str> {
        let host = url.host_str().ok_or("Invalid stream host")?;
        let mut clients = self.clients.lock().await;
        if let Some(client) = clients.get(host) {
            return Ok(client.clone());
        }
        if clients.len() >= 32 {
            return Err("Too many stream hosts");
        }
        let addresses: Vec<SocketAddr> =
            tokio::time::timeout(Duration::from_secs(8), tokio::net::lookup_host((host, 443)))
                .await
                .map_err(|_| "Stream DNS timed out")?
                .map_err(|_| "Stream DNS failed")?
                .collect();
        if addresses.is_empty() || addresses.iter().any(|addr| !public(addr.ip())) {
            return Err("Private stream destination denied");
        }
        let client = reqwest::Client::builder()
            .https_only(true)
            .no_proxy()
            .redirect(reqwest::redirect::Policy::none())
            .connect_timeout(Duration::from_secs(8))
            .read_timeout(Duration::from_secs(20))
            .resolve_to_addrs(host, &addresses)
            .user_agent("Nahhasio/0.1")
            .build()
            .map_err(|_| "Cannot prepare HTTPS stream")?;
        clients.insert(host.into(), client.clone());
        Ok(client)
    }
    async fn fetch(
        &self,
        mut url: Url,
        range: Option<&str>,
    ) -> Result<(Url, reqwest::Response), &'static str> {
        for _ in 0..6 {
            let client = self.client(&url).await?;
            let mut request = client.get(url.clone());
            if let Some(referrer) = &self.referrer {
                request = request.header(header::REFERER, referrer);
            }
            if let Some(range) = range {
                request = request.header(header::RANGE, range);
            }
            let response = request.send().await.map_err(|_| "Stream request failed")?;
            if response.status().is_redirection() {
                let next = response
                    .headers()
                    .get(header::LOCATION)
                    .and_then(|v| v.to_str().ok())
                    .ok_or("Invalid stream redirect")?;
                url = safe_url(
                    url.join(next)
                        .map_err(|_| "Invalid stream redirect")?
                        .as_str(),
                )?;
                continue;
            }
            if !response.status().is_success() {
                return Err("Upstream stream unavailable");
            }
            return Ok((url, response));
        }
        Err("Too many stream redirects")
    }
    async fn register(&self, url: Url, playlist: bool) -> Result<usize, &'static str> {
        let mut resources = self.resources.lock().await;
        if let Some(index) = resources.iter().position(|resource| resource.url == url) {
            return Ok(index);
        }
        if resources.len() >= 20000 {
            return Err("Stream resource limit reached");
        }
        let id = resources.len();
        resources.push(Resource { url, playlist });
        Ok(id)
    }
    async fn rewrite(&self, base: &Url, body: &str) -> Result<String, &'static str> {
        if !body.trim_start().starts_with("#EXTM3U") {
            return Err("Invalid HLS playlist");
        }
        let uri = regex::Regex::new(r#"URI="([^"]+)""#).map_err(|_| "Invalid HLS rule")?;
        let mut output = String::new();
        let mut variant = false;
        for line in body.lines() {
            if line.trim().is_empty() {
                output.push('\n');
                continue;
            }
            if line.starts_with('#') {
                let mut rewritten = line.to_owned();
                for capture in uri.captures_iter(line) {
                    let url = safe_url(
                        base.join(&capture[1])
                            .map_err(|_| "Invalid HLS resource")?
                            .as_str(),
                    )?;
                    let id = self
                        .register(
                            url,
                            line.starts_with("#EXT-X-MEDIA:")
                                || line.starts_with("#EXT-X-I-FRAME-STREAM-INF:"),
                        )
                        .await?;
                    rewritten = rewritten.replace(
                        &capture[0],
                        &format!(
                            "URI=\"http://{}/video/{}/{id}.{}\"",
                            self.host,
                            self.token,
                            if line.starts_with("#EXT-X-MEDIA:")
                                || line.starts_with("#EXT-X-I-FRAME-STREAM-INF:")
                            {
                                "m3u8"
                            } else {
                                "ts"
                            }
                        ),
                    );
                }
                variant = line.starts_with("#EXT-X-STREAM-INF:");
                output.push_str(&rewritten);
            } else {
                let url = safe_url(
                    base.join(line.trim())
                        .map_err(|_| "Invalid HLS resource")?
                        .as_str(),
                )?;
                let playlist = variant || url.path().ends_with(".m3u8");
                let id = self.register(url, playlist).await?;
                output.push_str(&format!(
                    "http://{}/video/{}/{id}.{}",
                    self.host,
                    self.token,
                    if playlist { "m3u8" } else { "ts" }
                ));
                variant = false;
            }
            output.push('\n');
        }
        Ok(output)
    }
}
async fn serve(
    State(shared): State<Arc<Shared>>,
    Path((token, resource_id)): Path<(String, String)>,
    headers: HeaderMap,
) -> Result<Response, StatusCode> {
    let id = resource_id
        .split('.')
        .next()
        .and_then(|value| value.parse::<usize>().ok())
        .ok_or(StatusCode::NOT_FOUND)?;
    if token.len() != shared.token.len()
        || !bool::from(token.as_bytes().ct_eq(shared.token.as_bytes()))
        || headers.get(header::HOST).and_then(|v| v.to_str().ok()) != Some(&shared.host)
        || headers.contains_key(header::ORIGIN)
    {
        return Err(StatusCode::FORBIDDEN);
    }
    let permit = shared
        .readers
        .clone()
        .try_acquire_owned()
        .map_err(|_| StatusCode::TOO_MANY_REQUESTS)?;
    let resource = shared
        .resources
        .lock()
        .await
        .get(id)
        .cloned()
        .ok_or(StatusCode::NOT_FOUND)?;
    let range = headers.get(header::RANGE).and_then(|v| v.to_str().ok());
    if range.is_some_and(|range| {
        range.len() > 80 || !range.starts_with("bytes=") || range.contains(',')
    }) {
        return Err(StatusCode::RANGE_NOT_SATISFIABLE);
    }
    let (base, mut response) = shared.fetch(resource.url, range).await.map_err(|reason| {
        eprintln!("anime-gateway: event=fetch-failed reason={reason}");
        StatusCode::BAD_GATEWAY
    })?;
    let status = response.status();
    let remote_headers = response.headers().clone();
    let mime = remote_headers
        .get(header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    let mut builder = Response::builder()
        .status(status)
        .header(header::CACHE_CONTROL, "no-store")
        .header("X-Content-Type-Options", "nosniff");
    let first = response
        .chunk()
        .await
        .map_err(|_| StatusCode::BAD_GATEWAY)?
        .unwrap_or_default();
    let looks_hls = first.starts_with(b"#EXTM3U");
    #[cfg(feature = "native-diagnostics")]
    if std::env::args().any(|arg| arg == "--anime-smoke") {
        eprintln!(
            "anime-gateway: event=resource id={id} status={} first-bytes={} playlist={}",
            status.as_u16(),
            first.len(),
            resource.playlist || looks_hls
        );
    }
    if resource.playlist || mime.contains("mpegurl") || looks_hls {
        let mut body = first.to_vec();
        while let Some(chunk) = response
            .chunk()
            .await
            .map_err(|_| StatusCode::BAD_GATEWAY)?
        {
            if body.len() + chunk.len() > 2 * 1024 * 1024 {
                return Err(StatusCode::BAD_GATEWAY);
            }
            body.extend_from_slice(&chunk);
        }
        let body = std::str::from_utf8(&body).map_err(|_| StatusCode::BAD_GATEWAY)?;
        let rewritten = shared.rewrite(&base, body).await.map_err(|reason| {
            eprintln!("anime-gateway: event=playlist-failed reason={reason}");
            StatusCode::BAD_GATEWAY
        })?;
        builder
            .status(StatusCode::OK)
            .header(header::CONTENT_TYPE, "application/vnd.apple.mpegurl")
            .body(Body::from(rewritten))
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
    } else {
        if mime.contains("text/html") || mime.contains("dash+xml") {
            return Err(StatusCode::UNSUPPORTED_MEDIA_TYPE);
        }
        for name in [
            header::CONTENT_TYPE,
            header::CONTENT_LENGTH,
            header::CONTENT_RANGE,
            header::ACCEPT_RANGES,
        ] {
            if let Some(value) = remote_headers.get(&name) {
                builder = builder.header(name, value);
            }
        }
        let stream = tokio_stream::once(Ok(first))
            .chain(response.bytes_stream())
            .map(move |chunk| {
                let _keep = &permit;
                chunk.map_err(|_| std::io::Error::other("Native stream interrupted"))
            });
        builder
            .body(Body::from_stream(stream))
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_local_addresses_and_unsafe_protocols() {
        for value in [
            "127.0.0.1",
            "10.1.2.3",
            "192.168.1.1",
            "100.64.0.1",
            "::1",
            "::ffff:127.0.0.1",
            "fc00::1",
        ] {
            assert!(!public(value.parse().unwrap()));
        }
        assert!(public("1.1.1.1".parse().unwrap()));
        assert!(safe_url("file:///etc/passwd").is_err());
        assert!(safe_url("https://user:pass@example.com/a").is_err());
    }
    #[tokio::test]
    async fn playlists_rewrite_variants_segments_and_keys_and_reject_local_file_references() {
        let gateway = DirectGateway::start(StreamSource {
            url: "https://example.com/root.m3u8".into(),
            referrer: None,
            hls: true,
        })
        .await
        .unwrap();
        let base = Url::parse("https://example.com/root.m3u8").unwrap();
        let output=gateway.shared.rewrite(&base,"#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI=\"key\"\n#EXT-X-STREAM-INF:BANDWIDTH=100\nvariant.m3u8\nsegment.ts\n").await.unwrap();
        assert!(!output.contains("https://example.com"));
        assert_eq!(output.matches("http://127.0.0.1:").count(), 3);
        assert!(
            gateway
                .shared
                .rewrite(&base, "#EXTM3U\nfile:///etc/passwd")
                .await
                .is_err()
        );
    }
}
