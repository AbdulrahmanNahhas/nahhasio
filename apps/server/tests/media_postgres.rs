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
async fn wait_job(pool: &PgPool, job: &str, expected: &str) {
    for _ in 0..40 {
        tokio::time::sleep(std::time::Duration::from_millis(300)).await;
        let (status, error): (String, Option<String>) =
            sqlx::query_as("select status::text,error from background_jobs where id=$1::uuid")
                .bind(job)
                .fetch_one(pool)
                .await
                .unwrap();
        if status == expected {
            return;
        }
        assert!(
            !matches!(status.as_str(), "completed" | "failed" | "cancelled"),
            "wanted {expected}, received {status}: {error:?}"
        );
    }
    panic!("job did not reach {expected}");
}
async fn unit_statuses(api: &Router, work: &str, part: &str, episodes: &str) -> Value {
    let (status, _, body) = request(
        api,
        "GET",
        &format!(
            "/api/v1/admin/media/units?workId={work}&installmentId={part}&episodeIds={episodes}"
        ),
        Value::Null,
        None,
        true,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{}", String::from_utf8_lossy(&body));
    serde_json::from_slice(&body).unwrap()
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
    let subtitle = b"1\n00:00:00,000 --> 00:00:01,000\nSubtitle fixture\n";
    std::fs::write(std::path::Path::new(&root).join("range.ar.srt"), subtitle).unwrap();
    let companions = json!({"sidecars":[{"relativePath":"range.ar.srt","originalRelativePath":"range.ar.srt","byteSize":subtitle.len(),"sha256":hex::encode(Sha256::digest(subtitle))}]});
    execute(
        &pool,
        &format!(
            "update media_files set probe_metadata='{}'::jsonb where id='{FILE}'",
            companions
        ),
    )
    .await;
    let subtitle_path = format!("/api/v1/media/{FILE}/subtitles/0");
    assert_eq!(
        request(&api, "GET", &subtitle_path, Value::Null, None, false)
            .await
            .0,
        StatusCode::UNAUTHORIZED
    );
    assert_eq!(
        request(&api, "GET", &subtitle_path, Value::Null, None, true)
            .await
            .2,
        subtitle
    );
    assert_eq!(
        request(&api, "HEAD", &subtitle_path, Value::Null, None, true)
            .await
            .2
            .len(),
        0
    );
    assert_eq!(
        request(
            &api,
            "GET",
            &subtitle_path,
            Value::Null,
            Some("bytes=0-0"),
            true
        )
        .await
        .2,
        b"1"
    );
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
    std::fs::rename(
        incoming.join("episode.ar.srt"),
        library.join("series/episode.ar.srt"),
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
    let mut worker =
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
        let subtitle_reply = request(&api, "GET", &subtitle_path, Value::Null, None, true).await;
        if ["trash", "purge"].contains(&action) {
            assert_eq!(subtitle_reply.0, StatusCode::NOT_FOUND);
        } else {
            assert_eq!(subtitle_reply.2, subtitle);
        }
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
            if action == "trash" {
                10 + subtitle.len()
            } else {
                0
            }
        );
        let units = unit_statuses(&api, WORK, PART, "none").await;
        if action == "purge" {
            assert_eq!(
                units[0]["missingFiles"], 0,
                "intentional purge is not a missing disk error"
            );
            assert_eq!(
                units[0]["totalFiles"], 1,
                "purged identities remain in history, outside the active library"
            );
        }
        assert_eq!(
            units[0]["trashedFiles"],
            if action == "trash" { 1 } else { 0 }
        );
        assert_eq!(
            units[0]["availableFiles"],
            if ["verify", "restore"].contains(&action) {
                2
            } else {
                1
            }
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
        if offset == 0 {
            assert_eq!(
                request(
                    &api,
                    "POST",
                    &format!("/api/v1/admin/media/jobs/{upload}"),
                    json!({"action":"cancel"}),
                    None,
                    true
                )
                .await
                .0,
                StatusCode::OK
            );
            let restarted = request(&api,"POST","/api/v1/admin/media/uploads",json!({"name":"upload.mp4","byteSize":10,"idempotencyKey":"upload-fixture","sha256":hex::encode(Sha256::digest(b"0123456789"))}),None,true).await;
            assert_eq!(restarted.0, StatusCode::OK);
            assert_eq!(
                serde_json::from_slice::<Value>(&restarted.2).unwrap()["offset"],
                5,
                "explicit restart preserves acknowledged upload bytes"
            );
        }
    }
    let upload_stage = incoming.join(format!(".uploads/{upload}.part"));
    std::fs::write(&upload_stage, b"changed!!!").unwrap();
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
    let queued: Value = serde_json::from_slice(&reply).unwrap();
    assert_eq!(queued["complete"], false);
    let finalization = queued["jobId"].as_str().unwrap();
    wait_job(&pool, finalization, "failed").await;
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
    // Only an explicit upload restart requeues a failed verification job.
    assert_eq!(request(&api,"POST","/api/v1/admin/media/uploads",json!({"name":"upload.mp4","byteSize":10,"idempotencyKey":"upload-fixture","sha256":hex::encode(Sha256::digest(b"0123456789"))}),None,true).await.0,StatusCode::OK);
    wait_job(&pool, finalization, "completed").await;
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
    let completed: Value = serde_json::from_slice(&reply).unwrap();
    assert_eq!(completed["complete"], true);
    let relative = completed["relativePath"].as_str().unwrap().to_owned();
    let verifications:i64=sqlx::query_scalar("select count(*) from background_jobs where type='media.upload.verify' and payload->>'uploadId'=$1").bind(&upload).fetch_one(&pool).await.unwrap();
    assert_eq!(
        verifications, 1,
        "retry preserves the durable verification identity"
    );
    assert_eq!(
        std::fs::read(incoming.join(&relative)).unwrap(),
        b"0123456789"
    );
    // Simulate a crash after the parent committed but before its staging unlink.
    worker.abort();
    let _ = worker.await;
    std::fs::hard_link(incoming.join(&relative), &upload_stage).unwrap();
    execute(&pool, &format!("update background_jobs set status='running',attempts=1,finished_at=null,lease_owner='crashed-worker',lease_expires_at=now()-interval '1 second',run_after=now() where id='{finalization}'::uuid")).await;
    let restarted_pool = pool.clone();
    worker = tokio::spawn(async move {
        nahhasio_server::run_media_worker(restarted_pool)
            .await
            .is_ok()
    });
    wait_job(&pool, finalization, "completed").await;
    assert!(
        !upload_stage.exists(),
        "recovery removes the redundant staging link"
    );
    assert_eq!(
        std::fs::read(incoming.join(&relative)).unwrap(),
        b"0123456789"
    );
    // Purged identities cannot be revived through stale actions.
    assert_eq!(request(&api,"POST",&format!("/api/v1/admin/media/{FILE}"),json!({"action":"reassign","workId":WORK,"installmentId":PART,"expectedRevision":"stale"}),None,true).await.0,StatusCode::NOT_FOUND);
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
    .bind(&id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(count, 1);
    let imported: sqlx::types::Json<Value> = sqlx::query_scalar(
        "select probe_metadata from media_files where probe_metadata->>'importJobId'=$1",
    )
    .bind(&id)
    .fetch_one(&pool)
    .await
    .unwrap();
    let companion = &imported.0["sidecars"][0];
    assert_eq!(companion["originalRelativePath"], "series/episode.ar.srt");
    assert_eq!(
        std::fs::read(library.join(companion["relativePath"].as_str().unwrap())).unwrap(),
        subtitle
    );
    assert!(!library.join("series/episode.ar.srt").exists());
    let tracks: i64 = sqlx::query_scalar("select count(*) from media_tracks where source='external' and relative_path=$1 and sha256=$2").bind(companion["relativePath"].as_str()).bind(companion["sha256"].as_str()).fetch_one(&pool).await.unwrap();
    assert_eq!(tracks, 1);
    // A replacement only retires the old copy after checking an already imported alternative.
    std::fs::write(library.join("range.mp4"), b"0123456789").unwrap();
    std::fs::write(library.join("range.ar.srt"), subtitle).unwrap();
    execute(
        &pool,
        &format!(
            "update media_files set availability='present',probe_metadata=probe_metadata-'purgedAt',updated_at=now() where id='{FILE}'"
        ),
    )
    .await;
    let alternative: String = sqlx::query_scalar(
        "select id::text from media_files where probe_metadata->>'importJobId'=$1",
    )
    .bind(&id)
    .fetch_one(&pool)
    .await
    .unwrap();
    let revision: String =
        sqlx::query_scalar("select updated_at::text from media_files where id=$1::uuid")
            .bind(FILE)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(
        request(
            &api,
            "POST",
            &format!("/api/v1/admin/media/{FILE}"),
            json!({"action":"replace","replacementFileId":alternative}),
            None,
            true
        )
        .await
        .0,
        StatusCode::BAD_REQUEST
    );
    let (status, _, reply) = request(
        &api,
        "POST",
        &format!("/api/v1/admin/media/{FILE}"),
        json!({"action":"replace","replacementFileId":alternative,"expectedRevision":revision}),
        None,
        true,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let replacement_job = serde_json::from_slice::<Value>(&reply).unwrap()["id"]
        .as_str()
        .unwrap()
        .to_owned();
    let mut done = false;
    for _ in 0..25 {
        tokio::time::sleep(std::time::Duration::from_millis(300)).await;
        let (state, error): (String, Option<String>) =
            sqlx::query_as("select status::text,error from background_jobs where id=$1::uuid")
                .bind(&replacement_job)
                .fetch_one(&pool)
                .await
                .unwrap();
        assert_ne!(state, "failed", "replacement: {error:?}");
        if state == "completed" {
            done = true;
            break;
        }
    }
    assert!(done, "replacement did not complete");
    let receipt: sqlx::types::Json<Value> =
        sqlx::query_scalar("select probe_metadata from media_files where id=$1::uuid")
            .bind(FILE)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(receipt.0["trash"]["replacedBy"], alternative);
    assert!(!library.join("range.mp4").exists());
    assert!(!library.join("range.ar.srt").exists());
    assert_eq!(
        request(
            &api,
            "GET",
            &format!("/api/v1/media/{alternative}/content"),
            Value::Null,
            None,
            true
        )
        .await
        .0,
        StatusCode::OK
    );
    // An interrupted item must not undo or repeat an earlier completed item.
    let first_part = "a2000000-0000-4000-8000-000000000002";
    let second_part = "a2000000-0000-4000-8000-000000000003";
    execute(&pool,&format!("insert into installments(id,title_id,title,kind,position) values('{first_part}','{WORK}','First batch film','movie',2),('{second_part}','{WORK}','Second batch film','movie',3)")).await;
    let source: String =
        sqlx::query_scalar("select relative_path from media_files where id=$1::uuid")
            .bind(&alternative)
            .fetch_one(&pool)
            .await
            .unwrap();
    for name in ["first.mp4", "second.mp4"] {
        std::fs::copy(library.join(&source), incoming.join(name)).unwrap();
    }
    let items: Vec<Value> = [("first.mp4",first_part),("second.mp4",second_part)].into_iter().map(|(name,part)| {
        let stat=std::fs::metadata(incoming.join(name)).unwrap();
        json!({"relativePath":name,"installmentId":part,"episodeId":null,"byteSize":stat.len(),"modifiedSeconds":stat.modified().unwrap().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs(),"copy":false})
    }).collect();
    let (status, _, reply) = request(
        &api,
        "POST",
        "/api/v1/admin/media/jobs",
        json!({"workId":WORK,"items":items,"idempotencyKey":"mixed-recovery"}),
        None,
        true,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let mixed_job = serde_json::from_slice::<Value>(&reply).unwrap()["id"]
        .as_str()
        .unwrap()
        .to_owned();
    std::fs::rename(incoming.join("second.mp4"), incoming.join("second.held")).unwrap();
    wait_job(&pool, &mixed_job, "failed").await;
    let count: i64 = sqlx::query_scalar(
        "select count(*) from media_files where probe_metadata->>'importJobId'=$1",
    )
    .bind(&mixed_job)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(count, 1);
    assert!(!incoming.join("first.mp4").exists());
    std::fs::rename(incoming.join("second.held"), incoming.join("second.mp4")).unwrap();
    assert_eq!(
        request(
            &api,
            "POST",
            &format!("/api/v1/admin/media/jobs/{mixed_job}"),
            json!({"action":"retry"}),
            None,
            true
        )
        .await
        .0,
        StatusCode::OK
    );
    wait_job(&pool, &mixed_job, "completed").await;
    let count: i64 = sqlx::query_scalar(
        "select count(*) from media_files where probe_metadata->>'importJobId'=$1",
    )
    .bind(&mixed_job)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(count, 2);
    verify_episode_file_views(&api, &pool).await;
    // A genuinely removed file is distinguished from an episode never imported.
    let removed: (String, String) = sqlx::query_as(
        "select id::text,relative_path from media_files where installment_id=$1::uuid",
    )
    .bind(first_part)
    .fetch_one(&pool)
    .await
    .unwrap();
    std::fs::remove_file(library.join(&removed.1)).unwrap();
    let (status, _, reply) = request(
        &api,
        "POST",
        &format!("/api/v1/admin/media/{}", removed.0),
        json!({"action":"verify"}),
        None,
        true,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    wait_job(
        &pool,
        serde_json::from_slice::<Value>(&reply).unwrap()["id"]
            .as_str()
            .unwrap(),
        "failed",
    )
    .await;
    let missing = unit_statuses(&api, WORK, first_part, "none").await;
    assert_eq!(missing[0]["missingFiles"], 1);
    assert_eq!(missing[0]["availableFiles"], 0);
    let kept_subtitle = format!("{}.ar.srt", removed.1);
    let absent_subtitle = format!("{}.en.srt", removed.1);
    let subtitle_bytes = b"1\n00:00:00,000 --> 00:00:01,000\nRetained subtitle\n";
    std::fs::write(library.join(&kept_subtitle), subtitle_bytes).unwrap();
    let sidecars = json!([
        {"relativePath":kept_subtitle,"originalRelativePath":"original.ar.srt","byteSize":subtitle_bytes.len(),"sha256":hex::encode(Sha256::digest(subtitle_bytes))},
        {"relativePath":absent_subtitle,"originalRelativePath":"original.en.srt","byteSize":100,"sha256":"a".repeat(64)}
    ]);
    let mut fixture_write = pool.begin().await.unwrap();
    sqlx::query("set transaction read write")
        .execute(&mut *fixture_write)
        .await
        .unwrap();
    sqlx::query("update media_files set probe_metadata=jsonb_set(probe_metadata,'{sidecars}',$2::jsonb) where id=$1::uuid").bind(&removed.0).bind(sqlx::types::Json(sidecars)).execute(&mut *fixture_write).await.unwrap();
    sqlx::query("insert into account_playback_states(account_id,installment_id,position_seconds,duration_seconds,is_played,played_manually) values($1::uuid,$2::uuid,120,300,true,true)").bind(ACTOR).bind(first_part).execute(&mut *fixture_write).await.unwrap();
    fixture_write.commit().await.unwrap();
    let original_root: String =
        sqlx::query_scalar("select library_root_id::text from media_files where id=$1::uuid")
            .bind(&removed.0)
            .fetch_one(&pool)
            .await
            .unwrap();
    let foreign_root = "a5000000-0000-4000-8000-000000000099";
    execute(&pool, &format!("insert into library_roots(id,name,path) values('{foreign_root}','Unmanaged fixture','/not-a-managed-library');update media_files set library_root_id='{foreign_root}' where id='{}'", removed.0)).await;
    let (_, _, rejected) = request(
        &api,
        "POST",
        &format!("/api/v1/admin/media/{}", removed.0),
        json!({"action":"trash"}),
        None,
        true,
    )
    .await;
    wait_job(
        &pool,
        serde_json::from_slice::<Value>(&rejected).unwrap()["id"]
            .as_str()
            .unwrap(),
        "failed",
    )
    .await;
    assert_eq!(
        std::fs::read(library.join(&kept_subtitle)).unwrap(),
        subtitle_bytes,
        "foreign registrations cannot touch a matching managed path"
    );
    execute(
        &pool,
        &format!(
            "update media_files set library_root_id='{original_root}' where id='{}'",
            removed.0
        ),
    )
    .await;
    std::fs::write(library.join(&removed.1), b"unexpected replacement bytes").unwrap();
    let (_, _, rejected) = request(
        &api,
        "POST",
        &format!("/api/v1/admin/media/{}", removed.0),
        json!({"action":"trash"}),
        None,
        true,
    )
    .await;
    wait_job(
        &pool,
        serde_json::from_slice::<Value>(&rejected).unwrap()["id"]
            .as_str()
            .unwrap(),
        "failed",
    )
    .await;
    assert_eq!(
        std::fs::read(library.join(&removed.1)).unwrap(),
        b"unexpected replacement bytes"
    );
    assert!(
        library.join(&kept_subtitle).exists(),
        "video conflicts are caught before moving subtitles"
    );
    std::fs::remove_file(library.join(&removed.1)).unwrap();
    let tracking_before: Value = sqlx::query_scalar(
        "select jsonb_agg(to_jsonb(p) order by id) from account_playback_states p",
    )
    .fetch_one(&pool)
    .await
    .unwrap();
    let catalog_before: Value = sqlx::query_scalar("select jsonb_build_object('work',to_jsonb(t),'parts',(select jsonb_agg(to_jsonb(i) order by id) from installments i where title_id=t.id),'episodes',(select jsonb_agg(to_jsonb(e) order by e.id) from episodes e join installments i on i.id=e.installment_id where i.title_id=t.id)) from titles t where t.id=$1::uuid").bind(WORK).fetch_one(&pool).await.unwrap();
    let (_, _, inventory_before) = request(
        &api,
        "GET",
        "/api/v1/admin/media?mediaState=trash",
        Value::Null,
        None,
        true,
    )
    .await;
    let baseline_bytes = serde_json::from_slice::<Value>(&inventory_before).unwrap()["trashBytes"]
        .as_u64()
        .unwrap();
    // Recover the subtitle half of an interrupted retirement before its DB commit.
    let retired_subtitle = std::env::var_os("NAHHASIO_TRASH_ROOT")
        .map(std::path::PathBuf::from)
        .unwrap()
        .join(format!("{}.subtitle-0", removed.0));
    std::fs::hard_link(library.join(&kept_subtitle), &retired_subtitle).unwrap();
    std::fs::remove_file(library.join(&kept_subtitle)).unwrap();
    for operation in ["trash", "restore", "trash", "purge"] {
        let (status, _, reply) = request(
            &api,
            "POST",
            &format!("/api/v1/admin/media/{}", removed.0),
            json!({"action":operation}),
            None,
            true,
        )
        .await;
        assert_eq!(status, StatusCode::OK);
        let queued: Value = serde_json::from_slice(&reply).unwrap();
        wait_job(&pool, queued["id"].as_str().unwrap(), "completed").await;
        let (retirement,): (sqlx::types::Json<Value>,) =
            sqlx::query_as("select probe_metadata from media_files where id=$1::uuid")
                .bind(&removed.0)
                .fetch_one(&pool)
                .await
                .unwrap();
        if operation == "trash" {
            assert_eq!(retirement.0["trash"]["missingVideo"], true);
            assert_eq!(retirement.0["trash"]["missingSidecars"], json!([1]));
            assert_eq!(retirement.0["trash"]["byteSize"], subtitle_bytes.len());
            assert!(!library.join(&kept_subtitle).exists());
        } else if operation == "restore" {
            assert_eq!(
                std::fs::read(library.join(&kept_subtitle)).unwrap(),
                subtitle_bytes
            );
            let job = queued["id"].as_str().unwrap();
            execute(&pool, &format!("update background_jobs set status='queued',finished_at=null,run_after=now() where id='{job}'")).await;
            wait_job(&pool, job, "completed").await;
            let receipts: i64 = sqlx::query_scalar("select count(*) from audit_logs where action='media.file.restore' and target_id=$1 and changes->>'jobId'=$2").bind(&removed.0).bind(job).fetch_one(&pool).await.unwrap();
            assert_eq!(
                receipts, 1,
                "replaying after the restore commit neither fails nor repeats the mutation"
            );
        } else {
            assert!(retirement.0["purgedAt"].is_string());
            assert!(!retired_subtitle.exists());
            assert!(!library.join(&kept_subtitle).exists());
        }
        let (_, _, inventory) = request(
            &api,
            "GET",
            "/api/v1/admin/media?mediaState=trash",
            Value::Null,
            None,
            true,
        )
        .await;
        assert_eq!(
            serde_json::from_slice::<Value>(&inventory).unwrap()["trashBytes"],
            baseline_bytes
                + if operation == "trash" {
                    subtitle_bytes.len() as u64
                } else {
                    0
                },
            "trash counts retained bytes, not a missing video's historical size"
        );
        let unit = unit_statuses(&api, WORK, first_part, "none").await;
        assert_eq!(
            unit[0]["availableFiles"], 0,
            "restoration cannot invent missing video bytes"
        );
        assert_eq!(
            unit[0]["missingFiles"],
            if operation == "restore" { 1 } else { 0 }
        );
        assert_eq!(
            unit[0]["trashedFiles"],
            if operation == "trash" { 1 } else { 0 }
        );
    }
    let catalog_after: Value = sqlx::query_scalar("select jsonb_build_object('work',to_jsonb(t),'parts',(select jsonb_agg(to_jsonb(i) order by id) from installments i where title_id=t.id),'episodes',(select jsonb_agg(to_jsonb(e) order by e.id) from episodes e join installments i on i.id=e.installment_id where i.title_id=t.id)) from titles t where t.id=$1::uuid").bind(WORK).fetch_one(&pool).await.unwrap();
    assert_eq!(
        catalog_before, catalog_after,
        "cleanup preserves catalog identity and editorial data"
    );
    let tracking_after: Value = sqlx::query_scalar(
        "select jsonb_agg(to_jsonb(p) order by id) from account_playback_states p",
    )
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(
        tracking_before, tracking_after,
        "cleanup preserves progress and explicit watched state"
    );
    worker.abort();
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
    assert_eq!(
        request(
            &api,
            "GET",
            &format!(
                "/api/v1/admin/media/units?workId={WORK}&installmentId={PART}&episodeIds=none"
            ),
            Value::Null,
            None,
            true
        )
        .await
        .0,
        StatusCode::FORBIDDEN
    );
    pool.close().await;
}

async fn verify_episode_file_views(api: &Router, pool: &PgPool) {
    let part = "a2000000-0000-4000-8000-000000000010";
    let first = "a6000000-0000-4000-8000-000000000001";
    let second = "a6000000-0000-4000-8000-000000000002";
    let third = "a6000000-0000-4000-8000-000000000003";
    execute(pool,&format!("insert into installments(id,title_id,title,kind,position) values('{part}','{WORK}','Mixed-source season','season',10);insert into episodes(id,installment_id,number,title,position) values('{first}','{part}',1,'No file',0),('{second}','{part}',2,'Multiple copies',1),('{third}','{part}',3,'Import in progress',2);insert into media_files(episode_id,path,availability,probe_metadata) values('{second}','copy-one.mp4','present','{{}}'),('{second}','copy-two.mp4','present','{{}}'),('{second}','missing.mp4','missing','{{}}'),('{second}','trash.mp4','missing','{{\"trash\":{{\"expiresAt\":\"2099-01-01\"}}}}');insert into background_jobs(type,status,created_by_account_id,payload,result,lease_owner,lease_expires_at) values('media.import','running','{ACTOR}','{{\"workId\":\"{WORK}\",\"items\":[{{\"installmentId\":\"{part}\",\"episodeId\":\"{second}\"}},{{\"installmentId\":\"{part}\",\"episodeId\":\"{third}\"}}]}}','{{\"items\":[{{\"status\":\"completed\"}}]}}','fixture-worker',now()+interval '1 hour')")).await;
    let values = unit_statuses(api, WORK, part, &format!("{first},{second},{third}")).await;
    let rows = values.as_array().unwrap();
    assert_eq!(rows.len(), 3);
    let no_file = rows.iter().find(|row| row["episodeId"] == first).unwrap();
    assert_eq!(no_file["totalFiles"], 0);
    assert_eq!(no_file["activeImports"], 0);
    let copies = rows.iter().find(|row| row["episodeId"] == second).unwrap();
    assert_eq!(copies["totalFiles"], 4);
    assert_eq!(copies["availableFiles"], 2);
    assert_eq!(copies["missingFiles"], 1);
    assert_eq!(copies["trashedFiles"], 1);
    assert_eq!(
        copies["activeImports"], 0,
        "completed items in an active job are not importing"
    );
    assert_eq!(
        rows.iter().find(|row| row["episodeId"] == third).unwrap()["activeImports"],
        1
    );
    let (_, _, body) = request(
        api,
        "GET",
        &format!(
            "/api/v1/admin/media?workId={WORK}&installmentId={part}&episodeIds={second}&pageSize=2"
        ),
        Value::Null,
        None,
        true,
    )
    .await;
    let files: Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(files["total"], 4);
    assert_eq!(files["items"].as_array().unwrap().len(), 2);
    assert!(
        files["items"]
            .as_array()
            .unwrap()
            .iter()
            .all(|row| row["episodeId"] == second)
    );
    assert!(
        unit_statuses(api, WORK, PART, first)
            .await
            .as_array()
            .unwrap()
            .is_empty()
    );
    assert_eq!(
        request(
            api,
            "GET",
            &format!("/api/v1/admin/media/units?workId={WORK}&installmentId={part}&episodeIds=bad"),
            Value::Null,
            None,
            true
        )
        .await
        .0,
        StatusCode::BAD_REQUEST
    );
    assert_eq!(
        request(
            api,
            "GET",
            &format!(
                "/api/v1/admin/media/units?workId={WORK}&installmentId={part}&episodeIds={first}"
            ),
            Value::Null,
            None,
            false
        )
        .await
        .0,
        StatusCode::UNAUTHORIZED
    );
}
