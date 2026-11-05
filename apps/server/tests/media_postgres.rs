//! Owned exclusively by bin/test-server-media, using a new socket-only database.
use axum::{
    Router,
    body::{Body, to_bytes},
    http::{Request, StatusCode},
};
use nahhasio_server::{database_pool, router};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use sqlx::PgPool;
use tower::ServiceExt;
const WORK: &str = "a1000000-0000-4000-8000-000000000001";
const PART: &str = "a2000000-0000-4000-8000-000000000001";
const FILE: &str = "a3000000-0000-4000-8000-000000000001";
const ACTOR: &str = "a4000000-0000-4000-8000-000000000001";
fn token() -> String {
    format!("nh1_{}", "ac".repeat(32))
}
async fn request(
    api: &Router,
    method: &str,
    path: &str,
    body: Value,
    range: Option<&str>,
    auth: bool,
) -> (StatusCode, axum::http::HeaderMap, Vec<u8>) {
    let mut request = Request::builder()
        .method(method)
        .uri(path)
        .header("content-type", "application/json");
    if auth {
        request = request.header("authorization", format!("Bearer {}", token()));
    }
    if let Some(range) = range {
        request = request.header("range", range);
    }
    let reply = api
        .clone()
        .oneshot(
            request
                .body(if method == "POST" {
                    Body::from(body.to_string())
                } else {
                    Body::empty()
                })
                .unwrap(),
        )
        .await
        .unwrap();
    let status = reply.status();
    let headers = reply.headers().clone();
    let body = to_bytes(reply.into_body(), 1024 * 1024)
        .await
        .unwrap()
        .to_vec();
    (status, headers, body)
}
async fn execute(pool: &PgPool, sql: &str) {
    let mut tx = pool.begin().await.unwrap();
    sqlx::query("set transaction read write")
        .execute(&mut *tx)
        .await
        .unwrap();
    sqlx::raw_sql(sqlx::AssertSqlSafe(sql.to_owned()))
        .execute(&mut *tx)
        .await
        .unwrap();
    tx.commit().await.unwrap();
}
#[tokio::test]
#[ignore = "requires bin/test-server-media"]
async fn range_authorization_and_durable_import() {
    let url =
        std::env::var("NAHHASIO_TEST_MEDIA_DATABASE_URL").expect("explicit media fixture URL");
    assert!(url.contains("nahhasio_test_media?host=/tmp/nahhasio-media."));
    let pool = database_pool(&url).unwrap();
    let mut conn = pool.begin().await.unwrap();
    sqlx::query("set transaction read write")
        .execute(&mut *conn)
        .await
        .unwrap();
    nahhasio_catalog::migrations::apply(
        &mut conn,
        &nahhasio_catalog::migrations::bundled().unwrap(),
    )
    .await
    .unwrap();
    conn.commit().await.unwrap();
    let root = std::env::var("NAHHASIO_LIBRARY_ROOT").unwrap();
    let hash = format!("nh1:{}", hex::encode(Sha256::digest(token().as_bytes())));
    execute(&pool,&format!("insert into auth_users(id,name,email,role) values('media-admin','Media','media@example.invalid','owner');insert into accounts(id,auth_user_id,kind,status,display_name) values('{ACTOR}','media-admin','admin','active','Media');insert into auth_sessions(id,token,user_id,expires_at) values('media-session','{hash}','media-admin',now()+interval '1 day');insert into titles(id,canonical_title,sort_title) values('{WORK}','Media fixture','Media fixture');insert into installments(id,title_id,title,kind,position) values('{PART}','{WORK}','Film','movie',1);insert into library_roots(id,name,path) values('a5000000-0000-4000-8000-000000000001','Fixture','{root}');insert into media_files(id,installment_id,path,library_root_id,relative_path,byte_size,availability) values('{FILE}','{PART}','{root}/range.mp4','a5000000-0000-4000-8000-000000000001','range.mp4',10,'present');")).await;
    let api = router(pool.clone());
    let (_, _, reply) = request(
        &api,
        "GET",
        "/api/v1/admin/media?mediaState=present",
        Value::Null,
        None,
        true,
    )
    .await;
    let inventory: Value = serde_json::from_slice(&reply).unwrap();
    assert_eq!(inventory["total"], 1);
    assert_eq!(inventory["trashBytes"], 0);
    let (_, _, reply) = request(
        &api,
        "GET",
        "/api/v1/admin/media/coverage",
        Value::Null,
        None,
        true,
    )
    .await;
    let coverage: Value = serde_json::from_slice(&reply).unwrap();
    assert_eq!(coverage["items"][0]["expectedUnits"], 1);
    assert_eq!(coverage["items"][0]["availableUnits"], 1);
    let (_, _, reply) = request(
        &api,
        "GET",
        "/api/v1/admin/media/coverage?mediaState=missing",
        Value::Null,
        None,
        true,
    )
    .await;
    assert_eq!(serde_json::from_slice::<Value>(&reply).unwrap()["total"], 0);
    let path = format!("/api/v1/media/{FILE}/content");
    assert_eq!(
        request(&api, "GET", &path, Value::Null, None, false)
            .await
            .0,
        StatusCode::UNAUTHORIZED
    );
    let (status, headers, bytes) =
        request(&api, "GET", &path, Value::Null, Some("bytes=2-5"), true).await;
    assert_eq!(status, StatusCode::PARTIAL_CONTENT);
    assert_eq!(bytes, b"2345");
    assert_eq!(headers["content-range"], "bytes 2-5/10");
    let (status, _, bytes) = request(&api, "HEAD", &path, Value::Null, None, true).await;
    assert_eq!(status, StatusCode::OK);
    assert!(bytes.is_empty());
    assert_eq!(
        request(&api, "GET", &path, Value::Null, Some("bytes=99-"), true)
            .await
            .0,
        StatusCode::RANGE_NOT_SATISFIABLE
    );
    let incoming = std::path::PathBuf::from(std::env::var("NAHHASIO_IMPORT_ROOT").unwrap());
    let library = std::path::PathBuf::from(&root);
    std::fs::create_dir(library.join("series")).unwrap();
    std::fs::rename(
        incoming.join("episode.mp4"),
        library.join("series/episode.mp4"),
    )
    .unwrap();
    std::fs::write(library.join("series/._episode.mp4"), b"companion").unwrap();
    std::fs::write(library.join("series/empty.mp4"), b"").unwrap();
    std::os::unix::fs::symlink(&incoming, library.join("series/escape")).unwrap();
    for index in 0..3 {
        std::fs::create_dir(library.join(format!("series/folder{index}"))).unwrap();
    }
    let (_, _, reply) = request(
        &api,
        "GET",
        "/api/v1/admin/media/incoming?sourceRoot=library&q=series&pageSize=2&page=1",
        Value::Null,
        None,
        true,
    )
    .await;
    let first: Value = serde_json::from_slice(&reply).unwrap();
    assert_eq!(first["total"], 4, "{first}");
    assert_eq!(first["files"].as_array().unwrap().len(), 1);
    assert_eq!(first["folders"].as_array().unwrap().len(), 1);
    assert_eq!(first["truncated"], true);
    let (_, _, reply) = request(
        &api,
        "GET",
        "/api/v1/admin/media/incoming?sourceRoot=library&q=series&pageSize=2&page=2",
        Value::Null,
        None,
        true,
    )
    .await;
    let second: Value = serde_json::from_slice(&reply).unwrap();
    assert_eq!(second["folders"].as_array().unwrap().len(), 2);
    assert_eq!(second["truncated"], false);
    for folder in [".trash", "series/escape", "../incoming"] {
        assert_eq!(
            request(
                &api,
                "GET",
                &format!("/api/v1/admin/media/incoming?sourceRoot=library&q={folder}"),
                Value::Null,
                None,
                true
            )
            .await
            .0,
            StatusCode::BAD_REQUEST
        );
    }
    let stat = std::fs::metadata(library.join("series/episode.mp4")).unwrap();
    let body = json!({"workId":WORK,"items":[{"sourceRoot":"library","relativePath":"series/episode.mp4","installmentId":PART,"episodeId":null,"byteSize":stat.len(),"modifiedSeconds":stat.modified().unwrap().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs(),"copy":false}],"idempotencyKey":"fixture-import"});
    let (status, _, reply) = request(
        &api,
        "POST",
        "/api/v1/admin/media/jobs",
        body.clone(),
        None,
        true,
    )
    .await;
    assert_eq!(
        status,
        StatusCode::OK,
        "{}",
        String::from_utf8_lossy(&reply)
    );
    let id = serde_json::from_slice::<Value>(&reply).unwrap()["id"]
        .as_str()
        .unwrap()
        .to_string();
    let (status, _, reply) = request(
        &api,
        "POST",
        "/api/v1/admin/media/jobs",
        body.clone(),
        None,
        true,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(serde_json::from_slice::<Value>(&reply).unwrap()["id"], id);
    let mut changed = body.clone();
    changed["items"][0]["copy"] = json!(true);
    assert_eq!(
        request(
            &api,
            "POST",
            "/api/v1/admin/media/jobs",
            changed,
            None,
            true
        )
        .await
        .0,
        StatusCode::CONFLICT
    );
    let mut duplicate = body.clone();
    duplicate["idempotencyKey"] = json!("another-request");
    assert_eq!(
        request(
            &api,
            "POST",
            "/api/v1/admin/media/jobs",
            duplicate.clone(),
            None,
            true
        )
        .await
        .0,
        StatusCode::CONFLICT
    );
    let duplicate_item = duplicate["items"][0].clone();
    duplicate["items"]
        .as_array_mut()
        .unwrap()
        .push(duplicate_item);
    assert_eq!(
        request(
            &api,
            "POST",
            "/api/v1/admin/media/jobs",
            duplicate,
            None,
            true
        )
        .await
        .0,
        StatusCode::BAD_REQUEST
    );
    let worker_pool = pool.clone();
    let worker =
        tokio::spawn(async move { nahhasio_server::run_media_worker(worker_pool).await.is_ok() });
    let mut final_state = String::new();
    let mut error = None;
    for _ in 0..30 {
        tokio::time::sleep(std::time::Duration::from_secs(1)).await;
        let row: (String, Option<String>) =
            sqlx::query_as("select status::text,error from background_jobs where id=$1::uuid")
                .bind(&id)
                .fetch_one(&pool)
                .await
                .unwrap();
        final_state = row.0;
        error = row.1;
        if matches!(final_state.as_str(), "completed" | "failed") {
            break;
        }
    }
    for action in ["verify", "trash", "restore", "trash", "purge"] {
        if action == "restore" {
            // Simulate a crash after the restore link moved, before its database commit.
            let trash = std::path::PathBuf::from(std::env::var("NAHHASIO_TRASH_ROOT").unwrap());
            let trash_file = trash.join(format!("{FILE}.video"));
            std::fs::hard_link(&trash_file, library.join("range.mp4")).unwrap();
            std::fs::remove_file(trash_file).unwrap();
        }
        let (status, _, reply) = request(
            &api,
            "POST",
            &format!("/api/v1/admin/media/{FILE}"),
            json!({"action":action}),
            None,
            true,
        )
        .await;
        assert_eq!(status, StatusCode::OK);
        let job = serde_json::from_slice::<Value>(&reply).unwrap()["id"]
            .as_str()
            .unwrap()
            .to_string();
        let mut done = false;
        for _ in 0..20 {
            tokio::time::sleep(std::time::Duration::from_millis(300)).await;
            let (state, error): (String, Option<String>) =
                sqlx::query_as("select status::text,error from background_jobs where id=$1::uuid")
                    .bind(&job)
                    .fetch_one(&pool)
                    .await
                    .unwrap();
            if state == "completed" {
                done = true;
                break;
            }
            assert_ne!(state, "failed", "{action}: {error:?}");
        }
        assert!(done, "{action} did not complete");
        let status = request(&api, "GET", &path, Value::Null, None, true).await.0;
        assert_eq!(
            status,
            if ["trash", "purge"].contains(&action) {
                StatusCode::NOT_FOUND
            } else {
                StatusCode::OK
            }
        );
        let (_, _, reply) = request(
            &api,
            "GET",
            "/api/v1/admin/media?mediaState=trash",
            Value::Null,
            None,
            true,
        )
        .await;
        let inventory: Value = serde_json::from_slice(&reply).unwrap();
        assert_eq!(
            inventory["trashFiles"],
            if action == "trash" { 1 } else { 0 }
        );
        assert_eq!(
            inventory["trashBytes"],
            if action == "trash" { 10 } else { 0 }
        );
    }
    let (status, _, reply) = request(
        &api,
        "POST",
        "/api/v1/admin/media/uploads",
        json!({"name":"upload.mp4","byteSize":10,"idempotencyKey":"upload-fixture","sha256":hex::encode(Sha256::digest(b"0123456789"))}),
        None,
        true,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let upload = serde_json::from_slice::<Value>(&reply).unwrap()["id"]
        .as_str()
        .unwrap()
        .to_string();
    for (offset, body) in [(0, "01234"), (5, "56789")] {
        let response = api
            .clone()
            .oneshot(
                Request::put(format!(
                    "/api/v1/admin/media/uploads/{upload}?offset={offset}"
                ))
                .header("authorization", format!("Bearer {}", token()))
                .body(Body::from(body))
                .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK);
    }
    let upload_stage = incoming.join(format!(".uploads/{upload}.part"));
    std::fs::write(&upload_stage, b"changed!!!").unwrap();
    assert_eq!(
        request(
            &api,
            "POST",
            &format!("/api/v1/admin/media/uploads/{upload}/complete"),
            Value::Null,
            None,
            true
        )
        .await
        .0,
        StatusCode::CONFLICT
    );
    assert!(!incoming.join("uploads").exists());
    std::fs::write(&upload_stage, b"0123456789").unwrap();
    let (status, _, reply) = request(
        &api,
        "POST",
        &format!("/api/v1/admin/media/uploads/{upload}/complete"),
        Value::Null,
        None,
        true,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let relative = serde_json::from_slice::<Value>(&reply).unwrap()["relativePath"]
        .as_str()
        .unwrap()
        .to_string();
    assert_eq!(
        std::fs::read(incoming.join(relative)).unwrap(),
        b"0123456789"
    );
    assert_eq!(request(&api,"POST",&format!("/api/v1/admin/media/{FILE}"),json!({"action":"reassign","workId":WORK,"installmentId":PART,"expectedRevision":"stale"}),None,true).await.0,StatusCode::CONFLICT);
    worker.abort();
    assert_eq!(final_state, "completed", "{error:?}");
    assert!(!library.join("series/episode.mp4").exists());
    // A replay still returns the original job after the source has been moved.
    assert_eq!(
        request(&api, "POST", "/api/v1/admin/media/jobs", body, None, true)
            .await
            .0,
        StatusCode::OK
    );
    let count: i64 = sqlx::query_scalar(
        "select count(*) from media_files where probe_metadata->>'importJobId'=$1",
    )
    .bind(id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(count, 1);
    execute(
        &pool,
        &format!("update media_files set availability='missing' where id='{FILE}'"),
    )
    .await;
    assert_eq!(
        request(&api, "GET", &path, Value::Null, None, true).await.0,
        StatusCode::NOT_FOUND
    );
    execute(
        &pool,
        "update auth_users set role='member' where id='media-admin'",
    )
    .await;
    assert_eq!(
        request(&api, "GET", "/api/v1/admin/media", Value::Null, None, true)
            .await
            .0,
        StatusCode::FORBIDDEN
    );
    pool.close().await;
}
