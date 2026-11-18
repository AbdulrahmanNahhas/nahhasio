//! Characterization tests retained across the service-layer split.
use super::{Request, ServerSession, artwork::sanitize_release_posters, transport::bounded_body};
use serde_json::{Value, json};
use std::{sync::Arc, time::Duration};

#[tokio::test]
async fn response_limits_preserve_generic_and_editor_errors() {
    use axum::{
        Router,
        body::{Body, Bytes},
        http::StatusCode,
        routing::get,
    };
    use std::convert::Infallible;

    let app = Router::new()
        .route(
            "/chunks",
            get(|| async {
                Body::from_stream(tokio_stream::iter([
                    Ok::<_, Infallible>(Bytes::from_static(b"ab")),
                    Ok(Bytes::from_static(b"cd")),
                ]))
            }),
        )
        .route(
            "/editor",
            get(|| async {
                (
                    StatusCode::CONFLICT,
                    axum::Json(json!({"message": "Review changed"})),
                )
            }),
        )
        .route(
            "/oversized-editor",
            get(|| async { (StatusCode::BAD_REQUEST, "x".repeat(16 * 1024 + 1)) }),
        );
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let service =
        ServerSession::new(&format!("http://{}/", listener.local_addr().unwrap())).unwrap();
    let fixture = tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });

    let get = |path| service.client.get(service.url(path)).send();
    assert_eq!(
        bounded_body(get("chunks").await.unwrap(), 4).await.unwrap(),
        b"abcd"
    );
    let error = service
        .body(get("chunks").await.unwrap(), 3)
        .await
        .unwrap_err();
    assert_eq!(error.code, "too_large");
    let error = service
        .editor_reply(get("editor").await.unwrap())
        .await
        .unwrap_err();
    assert_eq!(
        (error.code.as_str(), error.message.as_str()),
        ("conflict", "Review changed")
    );
    let error = service
        .editor_reply(get("oversized-editor").await.unwrap())
        .await
        .unwrap_err();
    assert_eq!(
        (error.code.as_str(), error.message.as_str()),
        ("server", "Editor error response exceeds the limit")
    );
    fixture.abort();
}

use super::ServerSession as Services;
#[tokio::test]
async fn new_catalog_groups_reach_authorization_instead_of_bad_request() {
    let service = Services::new("http://127.0.0.1:9/").unwrap();
    for group in ["planet", "genre", "country", "studio"] {
        let error = service
            .execute(crate::bridge::Request {
                id: "group-check".into(),
                command: "browse".into(),
                payload: serde_json::json!({"group":group,"page":1,"pageSize":30}),
            })
            .await
            .unwrap_err();
        assert_eq!(
            error.code, "unauthorized",
            "group {group} must reach authorization"
        );
    }
    let error = service
        .execute(crate::bridge::Request {
            id: "group-check".into(),
            command: "browse".into(),
            payload: serde_json::json!({"group":"unsupported"}),
        })
        .await
        .unwrap_err();
    assert_eq!(error.code, "bad_request");
}

#[tokio::test]
async fn releases_validate_before_network_and_require_session() {
    let service = Services::new("http://127.0.0.1:1").unwrap();
    for payload in [
        json!({"year":0}),
        json!({"year":10000}),
        json!({"month":0}),
        json!({"month":13}),
        json!({"month":1,"day":0}),
        json!({"month":1,"day":32}),
        json!({"month":1,"day":1.5}),
        json!({"day":1}),
        json!({"scope":"upcoming","month":1,"day":1}),
        json!({"scope":"undated","day":1}),
        json!({"page":0}),
        json!({"page":100001}),
        json!({"pageSize":0}),
        json!({"pageSize":101}),
        json!({"kind":"private"}),
        json!({"scope":"available"}),
        json!({"scope":"upcoming","year":2026}),
        json!({"scope":"undated","month":1}),
        json!({"includePrivate":true}),
        json!({"url":"https://example.org"}),
        json!({"year":2026.5}),
    ] {
        let error = service
            .execute(Request {
                id: "test".into(),
                command: "releases".into(),
                payload,
            })
            .await
            .unwrap_err();
        assert_eq!(error.code, "bad_request");
    }
    for payload in [
        json!({}),
        json!({"scope":"upcoming"}),
        json!({"scope":"undated","kind":"episodes"}),
        json!({"year":1,"month":12,"pageSize":100}),
        json!({"month":1,"day":1,"pageSize":1}),
        json!({"scope":"year","month":2,"day":31}),
    ] {
        let error = service
            .execute(Request {
                id: "test".into(),
                command: "releases".into(),
                payload,
            })
            .await
            .unwrap_err();
        assert_eq!(error.code, "unauthorized");
    }
}

#[tokio::test]
async fn releases_transport_is_guarded_get_and_clears_expired_session() {
    use std::io::{Read, Write};
    const ID: &str = "00112233-4455-4677-8899-aabbccddeeff";
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let address = listener.local_addr().unwrap();
    let server = std::thread::spawn(move || {
        for index in 0..2 {
            let (mut stream, _) = listener.accept().unwrap();
            stream
                .set_read_timeout(Some(Duration::from_secs(5)))
                .unwrap();
            let mut incoming = Vec::new();
            loop {
                let mut chunk = [0; 1024];
                let count = stream.read(&mut chunk).unwrap();
                assert!(count > 0 && incoming.len() + count <= 4096);
                incoming.extend_from_slice(&chunk[..count]);
                if incoming.windows(4).any(|bytes| bytes == b"\r\n\r\n") {
                    break;
                }
            }
            let headers = String::from_utf8(incoming).unwrap();
            let line = headers.lines().next().unwrap();
            if index == 0 {
                assert_eq!(
                    line,
                    "GET /api/v1/releases?year=2026&month=10&day=11&kind=episodes&scope=year&page=2&pageSize=100 HTTP/1.1"
                );
            } else {
                assert_eq!(line, "GET /api/v1/releases?scope=upcoming HTTP/1.1");
            }
            assert!(
                headers
                    .to_ascii_lowercase()
                    .contains("authorization: bearer fixture-only-token")
            );
            assert!(!line.contains("token"));
            let (status, body) = if index == 0 {
                ("200 OK", json!({"items":[{"poster":{"id":ID,"mimeType":"image/png","url":"https://untrusted.example/image","storagePath":"/private"}}],"total":150,"page":2,"pageSize":100,"years":[2026],"days":[{"date":"2026-10-11","count":150}],"asOf":"2026-10-11"}).to_string())
            } else {
                ("401 Unauthorized", "{}".into())
            };
            write!(stream,"HTTP/1.1 {status}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",body.len()).unwrap();
        }
    });
    let service = Services::new(&format!("http://{address}/")).unwrap();
    *service.token.lock().await = Some("fixture-only-token".into());
    let result = service.execute(Request {id:"test".into(),command:"releases".into(),payload:json!({"year":2026,"month":10,"day":11,"kind":"episodes","scope":"year","page":2,"pageSize":100})}).await.unwrap();
    assert_eq!(
        result["items"][0]["poster"]["url"],
        format!("/api/v1/artwork/{ID}")
    );
    assert!(result["items"][0]["poster"].get("storagePath").is_none());
    assert!(result.get("token").is_none());
    assert_eq!(result["days"], json!([{"date":"2026-10-11","count":150}]));
    let error = service
        .execute(Request {
            id: "test".into(),
            command: "releases".into(),
            payload: json!({"scope":"upcoming"}),
        })
        .await
        .unwrap_err();
    assert_eq!(error.code, "unauthorized");
    assert!(service.token.lock().await.is_none());
    server.join().unwrap();
}

#[test]
fn releases_posters_use_only_registered_artwork_routes() {
    const ID: &str = "00112233-4455-4677-8899-aabbccddeeff";
    let mut page = json!({"items":[
        {"poster":{"id":ID,"url":"file:///private/image","mimeType":"image/png","storagePath":"/private/image","width":300}},
        {"poster":{"id":"../private","url":"https://example.org","mimeType":"image/png"}},
        {"poster":{"id":ID,"mimeType":"image/svg+xml"}},
        {"poster":null}
    ]});
    sanitize_release_posters(&mut page);
    assert_eq!(
        page["items"][0]["poster"]["url"],
        format!("/api/v1/artwork/{ID}")
    );
    assert_eq!(page["items"][0]["poster"]["width"], 300);
    assert!(page["items"][0]["poster"].get("storagePath").is_none());
    for index in 1..4 {
        assert!(page["items"][index]["poster"].is_null());
    }
}

#[test]
fn server_addresses_reject_plaintext_remote_and_credentials() {
    assert!(Services::new("http://127.0.0.1:23103").is_ok());
    assert!(Services::new("http://192.168.1.2:23103").is_err());
    assert!(Services::new("https://user:secret@example.org").is_err());
    assert!(Services::new("https://example.org/path").is_err());
}
#[tokio::test]
async fn viewer_commands_validate_targets_before_network_and_require_session() {
    const ID: &str = "00112233-4455-4677-8899-aabbccddeeff";
    let service = Services::new("http://127.0.0.1:1").unwrap();
    for (command, payload, code) in [
        ("workState", json!({"id":ID}), "unauthorized"),
        (
            "setFavorite",
            json!({"workId":ID,"isFavorite":false}),
            "unauthorized",
        ),
        (
            "setWatched",
            json!({"workId":ID,"isPlayed":true}),
            "unauthorized",
        ),
        ("workActivity", json!({"id":ID,"page":1}), "unauthorized"),
        (
            "setWatched",
            json!({"workId":ID,"episodeId":ID,"isPlayed":true}),
            "bad_request",
        ),
        (
            "setWatched",
            json!({"workId":ID,"installmentId":"../secret","isPlayed":true}),
            "bad_request",
        ),
        (
            "setWatched",
            json!({"workId":ID,"accountId":ID,"isPlayed":true}),
            "bad_request",
        ),
        (
            "setFavorite",
            json!({"workId":ID,"isFavorite":false,"notes":"overwrite"}),
            "bad_request",
        ),
        ("workActivity", json!({"id":ID,"page":0}), "bad_request"),
        (
            "workActivity",
            json!({"id":ID,"page":100_001}),
            "bad_request",
        ),
    ] {
        let error = service
            .execute(Request {
                id: "test".into(),
                command: command.into(),
                payload,
            })
            .await
            .unwrap_err();
        assert_eq!(error.code, code);
    }
}

#[tokio::test]
async fn viewer_transport_uses_allowlisted_routes_and_keeps_bearer_native() {
    use std::io::{Read, Write};
    const ID: &str = "00112233-4455-4677-8899-aabbccddeeff";
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let address = listener.local_addr().unwrap();
    let state = json!({"workId":ID,"isFavorite":true,"units":[],"installments":[],"summary":{"catalogUnits":0,"releasedUnits":0,"watchedReleasedUnits":0,"isFullyWatched":false,"watchState":"unwatched"}});
    let fixture_state = state.clone();
    let server = std::thread::spawn(move || {
        for (index, (method, suffix, expected_body)) in [
            ("GET", "state", None),
            ("PUT", "favorite", Some(json!({"isFavorite":true}))),
            (
                "PATCH",
                "watched",
                Some(json!({"installmentId":null,"episodeId":null,"isPlayed":true})),
            ),
            (
                "PATCH",
                "watched",
                Some(json!({"installmentId":ID,"episodeId":ID,"isPlayed":false})),
            ),
            ("GET", "activity?page=2", None),
            ("GET", "state", None),
        ]
        .into_iter()
        .enumerate()
        {
            let (mut stream, _) = listener.accept().unwrap();
            stream
                .set_read_timeout(Some(Duration::from_secs(5)))
                .unwrap();
            let mut incoming = Vec::new();
            let (end, length) = loop {
                let mut chunk = [0; 1024];
                let count = stream.read(&mut chunk).unwrap();
                assert!(count > 0 && incoming.len() + count <= 4096);
                incoming.extend_from_slice(&chunk[..count]);
                if let Some(end) = incoming.windows(4).position(|bytes| bytes == b"\r\n\r\n") {
                    let headers = String::from_utf8_lossy(&incoming[..end]);
                    let length = headers
                        .lines()
                        .find_map(|line| {
                            line.to_ascii_lowercase()
                                .strip_prefix("content-length:")
                                .and_then(|s| s.trim().parse::<usize>().ok())
                        })
                        .unwrap_or(0);
                    if incoming.len() >= end + 4 + length {
                        break (end, length);
                    }
                }
            };
            let headers = String::from_utf8_lossy(&incoming[..end]);
            assert!(headers.starts_with(&format!("{method} /api/v1/works/{ID}/{suffix} HTTP/1.1")));
            assert!(
                headers
                    .to_ascii_lowercase()
                    .contains("authorization: bearer fixture-only-token")
            );
            if let Some(expected) = expected_body {
                assert_eq!(
                    serde_json::from_slice::<Value>(&incoming[end + 4..end + 4 + length]).unwrap(),
                    expected
                );
            } else {
                assert_eq!(length, 0);
            }
            let status = if index == 5 {
                "404 Not Found"
            } else {
                "200 OK"
            };
            let response = if index == 4 {
                json!({"workId":ID,"items":[],"total":0,"page":2,"pageSize":20})
            } else {
                fixture_state.clone()
            }
            .to_string();
            write!(stream,"HTTP/1.1 {status}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{response}",response.len()).unwrap();
        }
    });
    let service = Services::new(&format!("http://{address}/")).unwrap();
    *service.token.lock().await = Some("fixture-only-token".into());
    for (command, payload) in [
        ("workState", json!({"id":ID})),
        ("setFavorite", json!({"workId":ID,"isFavorite":true})),
        ("setWatched", json!({"workId":ID,"isPlayed":true})),
        (
            "setWatched",
            json!({"workId":ID,"installmentId":ID,"episodeId":ID,"isPlayed":false}),
        ),
        ("workActivity", json!({"id":ID,"page":2})),
    ] {
        let response = service
            .execute(Request {
                id: "test".into(),
                command: command.into(),
                payload,
            })
            .await
            .unwrap();
        assert_eq!(response["workId"], ID);
        assert!(response.get("token").is_none());
        if command != "workActivity" {
            assert_eq!(response, state);
        }
    }
    let error = service
        .execute(Request {
            id: "test".into(),
            command: "workState".into(),
            payload: json!({"id":ID}),
        })
        .await
        .unwrap_err();
    assert_eq!(error.code, "not_found");
    assert!(service.token.lock().await.is_some());
    server.join().unwrap();
}

#[tokio::test]
async fn login_keeps_credentials_native_and_expired_session_clears_them() {
    use std::io::{Read, Write};
    let listener = std::net::TcpListener::bind("127.0.0.1:0").expect("local test listener");
    let address = listener.local_addr().expect("local address");
    let server = std::thread::spawn(move || {
        for (status, body) in [
            (
                "200 OK",
                r#"{"token":"fixture-only-token","user":{"id":"owner","name":"Test","email":"test@example.invalid","role":"owner","accountId":"00000000-0000-4000-8000-000000000001","kind":"admin","avatarKey":"nahhasio-library.svg","bio":"","isAdmin":true,"updatedAt":"2026-10-12T00:00:00.000000Z"},"expiresAt":"2030-01-01T00:00:00Z"}"#,
            ),
            ("401 Unauthorized", r#"{"message":"expired"}"#),
        ] {
            let (mut stream, _) = listener.accept().expect("request");
            stream
                .set_read_timeout(Some(Duration::from_secs(5)))
                .expect("timeout");
            let mut incoming = Vec::new();
            loop {
                let mut chunk = [0; 1024];
                let count = stream.read(&mut chunk).expect("bounded request");
                assert!(count > 0 && incoming.len() + count <= 4096);
                incoming.extend_from_slice(&chunk[..count]);
                if let Some(end) = incoming.windows(4).position(|bytes| bytes == b"\r\n\r\n") {
                    let headers = String::from_utf8_lossy(&incoming[..end]);
                    let length = headers
                        .lines()
                        .find_map(|line| {
                            line.to_ascii_lowercase()
                                .strip_prefix("content-length:")
                                .and_then(|value| value.trim().parse::<usize>().ok())
                        })
                        .unwrap_or(0);
                    if incoming.len() >= end + 4 + length {
                        break;
                    }
                }
            }
            write!(stream, "HTTP/1.1 {status}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}", body.len()).expect("response");
        }
    });
    let service = Services::new(&format!("http://{address}/")).expect("service");
    let login = service
        .execute(Request {
            id: "login".into(),
            command: "login".into(),
            payload: json!({"email":"test@example.invalid","password":"fixture-only"}),
        })
        .await
        .expect("login should succeed");
    assert!(login.get("token").is_none());
    assert!(login.get("password").is_none());
    assert_eq!(login["user"]["id"], "owner");
    assert!(service.token.lock().await.is_some());
    let session = service
        .execute(Request {
            id: "session".into(),
            command: "session".into(),
            payload: json!({}),
        })
        .await
        .expect("expired session is signed out");
    assert!(session.is_null());
    assert!(service.token.lock().await.is_none());
    server.join().expect("mock server completed");
}
#[tokio::test]
async fn encrypted_accounts_restore_independently_and_temporary_login_stays_temporary() {
    use axum::{
        Json, Router,
        http::HeaderMap,
        routing::{get, post},
    };
    fn user(n: u8) -> Value {
        json!({"id":format!("fixture-{n}"),"name":format!("Account {n}"),"email":format!("fixture{n}@example.invalid"),"role":"member","accountId":format!("96000000-0000-4000-8000-{n:012}"),"kind":"family","avatarKey":"anon-1.png","bio":"","isAdmin":false,"updatedAt":"2026-10-31T00:00:00Z"})
    }
    let api=Router::new()
        .route("/api/v1/auth/login",post(|Json(body):Json<Value>| async move {
            let n=if body["email"]=="fixture1@example.invalid" {1}else if body["email"]=="fixture2@example.invalid" {2}else{3};
            Json(json!({"user":user(n),"token":format!("fixture-token-{n}"),"renewalToken":format!("fixture-renewal-{n}"),"expiresAt":"2099-01-01T00:00:00Z"}))
        }))
        .route("/api/v1/auth/session",get(|headers:HeaderMap| async move {
            let n=if headers["authorization"]=="Bearer fixture-token-1" {1}else if headers["authorization"]=="Bearer fixture-token-2" {2}else{3};
            Json(json!({"user":user(n),"expiresAt":"2099-01-01T00:00:00Z"}))
        }))
        .route("/api/v1/me/device",post(||async{Json(json!({"deviceId":"96000000-0000-4000-8000-000000000004"}))}))
        .route("/api/v1/auth/logout",post(||async{axum::http::StatusCode::NO_CONTENT}));
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let url = format!("http://{}/", listener.local_addr().unwrap());
    let server = tokio::spawn(async move { axum::serve(listener, api).await.unwrap() });
    let root = std::env::temp_dir().join(format!("nahhasio-account-vault-{}", std::process::id()));
    let store = Arc::new(crate::session_store::SessionStore::new(&root));
    let mut service = ServerSession::new(&url).unwrap();
    service.session_store = Some(store.clone());
    service.vault = Arc::new(crate::credential_store::Vault::fixture([7; 32]));
    for n in [1, 2] {
        let result=service.execute(Request {id:"test".into(),command:"login".into(),payload:json!({"email":format!("fixture{n}@example.invalid"),"password":"fixture-password","remember":true})}).await.unwrap();
        assert_eq!(result["user"]["accountId"], user(n)["accountId"]);
        assert!(result.get("token").is_none());
    }
    let accounts = crate::credential_store::read(&root, &url).unwrap();
    assert_eq!(accounts.accounts.len(), 2);
    let stored = std::fs::read_to_string(root.join(crate::credential_store::name(&url))).unwrap();
    assert!(!stored.contains("fixture-token"));
    assert!(!stored.contains("fixture-password"));
    let mut restored = ServerSession::new(&url).unwrap();
    restored.session_store = Some(store.clone());
    restored.vault = service.vault.clone();
    let request = |command: &str, payload| Request {
        id: "test".into(),
        command: command.into(),
        payload,
    };
    assert_eq!(
        restored
            .execute(request("session", json!({})))
            .await
            .unwrap()["user"]["accountId"],
        user(2)["accountId"]
    );
    restored
        .execute(request(
            "accounts.switch",
            json!({"accountId":user(1)["accountId"]}),
        ))
        .await
        .unwrap();
    assert_eq!(
        restored
            .execute(request("session", json!({})))
            .await
            .unwrap()["user"]["accountId"],
        user(1)["accountId"]
    );
    restored
        .execute(request("logout", json!({})))
        .await
        .unwrap();
    let accounts = crate::credential_store::read(&root, &url).unwrap();
    assert!(
        accounts
            .accounts
            .iter()
            .find(|a| a.id == user(1)["accountId"])
            .unwrap()
            .credentials
            .is_none()
    );
    assert!(
        accounts
            .accounts
            .iter()
            .find(|a| a.id == user(2)["accountId"])
            .unwrap()
            .credentials
            .is_some()
    );
    restored.execute(request("login",json!({"email":"fixture3@example.invalid","password":"fixture-password","remember":false}))).await.unwrap();
    restored
        .execute(request("session", json!({})))
        .await
        .unwrap();
    assert!(restored.renewal.lock().await.is_none());
    let accounts = crate::credential_store::read(&root, &url).unwrap();
    assert!(accounts.selected.is_none());
    assert_eq!(accounts.accounts.len(), 2);
    restored
        .execute(request(
            "accounts.forget",
            json!({"accountId":user(2)["accountId"]}),
        ))
        .await
        .unwrap();
    assert_eq!(
        restored
            .execute(request("session", json!({})))
            .await
            .unwrap()["user"]["accountId"],
        user(3)["accountId"]
    );
    assert_eq!(
        crate::credential_store::read(&root, &url)
            .unwrap()
            .accounts
            .len(),
        1
    );
    server.abort();
    std::fs::remove_dir_all(root).unwrap();
}
