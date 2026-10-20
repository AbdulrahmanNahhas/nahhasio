//! Disposable synthetic accounts only; run with bin/test-account-profile.
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
const ACTOR: &str = "91000000-0000-4000-8000-000000000001";
fn token(admin: bool) -> String {
    format!("nh1_{}", if admin { "a1" } else { "b2" }.repeat(32))
}
async fn setup(pool: &PgPool) {
    let mut tx = pool.begin().await.unwrap();
    sqlx::query("set transaction read write")
        .execute(&mut *tx)
        .await
        .unwrap();
    sqlx::query("insert into auth_users(id,name,email,role) values('rust-editor-admin','Fixture admin','rust-editor-admin@example.invalid','owner'),('rust-editor-member','Fixture member','rust-editor-member@example.invalid','member')").execute(&mut *tx).await.unwrap();
    sqlx::query("insert into accounts(id,auth_user_id,kind,status,display_name) values($1::uuid,'rust-editor-admin','admin','active','Rust editor fixture'),('91000000-0000-4000-8000-000000000002','rust-editor-member','family','active','Rust editor member')").bind(ACTOR).execute(&mut *tx).await.unwrap();
    for (admin, user) in [(true, "rust-editor-admin"), (false, "rust-editor-member")] {
        let key = format!(
            "nh1:{}",
            hex::encode(Sha256::digest(token(admin).as_bytes()))
        );
        sqlx::query("insert into auth_sessions(id,token,user_id,expires_at) values($1,$2,$3,now()+interval '1 day')").bind(format!("rust-editor-{user}")).bind(key).bind(user).execute(&mut *tx).await.unwrap();
    }
    tx.commit().await.unwrap();
}

async fn request(
    api: &Router,
    method: &str,
    path: &str,
    auth: Option<bool>,
    body: Value,
) -> (StatusCode, Vec<u8>, String) {
    let mut request = Request::builder()
        .method(method)
        .uri(path)
        .header("content-type", "application/json");
    if let Some(admin) = auth {
        request = request.header("authorization", format!("Bearer {}", token(admin)));
    }
    let response = api
        .clone()
        .oneshot(
            request
                .body(if body.is_null() {
                    Body::empty()
                } else {
                    Body::from(body.to_string())
                })
                .unwrap(),
        )
        .await
        .unwrap();
    let status = response.status();
    let mime = response
        .headers()
        .get("content-type")
        .unwrap()
        .to_str()
        .unwrap()
        .to_owned();
    (
        status,
        to_bytes(response.into_body(), 1024 * 1024)
            .await
            .unwrap()
            .to_vec(),
        mime,
    )
}
#[tokio::test]
#[ignore = "requires bin/test-account-profile disposable socket database"]
async fn public_profiles_and_curated_avatars_preserve_privacy() {
    let url =
        std::env::var("NAHHASIO_TEST_PROFILE_DATABASE_URL").expect("private profile fixture URL");
    let options: sqlx::postgres::PgConnectOptions = url.parse().unwrap();
    assert_eq!(options.get_database(), Some("nahhasio_test_profiles"));
    assert!(options.get_socket().is_some());
    let pool = database_pool(&url).unwrap();
    let mut tx = pool.begin().await.unwrap();
    sqlx::query("set transaction read write")
        .execute(&mut *tx)
        .await
        .unwrap();
    nahhasio_catalog::migrations::apply(&mut tx, &nahhasio_catalog::migrations::bundled().unwrap())
        .await
        .unwrap();
    tx.commit().await.unwrap();
    setup(&pool).await;
    let api = router(pool.clone());
    activity_acceptance(&api, &pool).await;
    let path = format!("/api/v1/profiles/{ACTOR}");
    assert_eq!(
        request(&api, "GET", &path, None, Value::Null).await.0,
        StatusCode::UNAUTHORIZED
    );
    let (status, bytes, _) = request(&api, "GET", &path, Some(false), Value::Null).await;
    assert_eq!(status, StatusCode::OK);
    let profile: Value = serde_json::from_slice(&bytes).unwrap();
    let mut keys = profile
        .as_object()
        .unwrap()
        .keys()
        .map(String::as_str)
        .collect::<Vec<_>>();
    keys.sort();
    assert_eq!(keys, vec!["avatarKey", "bio", "id", "joinedAt", "name"]);
    assert_eq!(
        request(
            &api,
            "GET",
            "/api/v1/profiles/not-an-id",
            Some(false),
            Value::Null
        )
        .await
        .0,
        StatusCode::BAD_REQUEST
    );
    assert_eq!(
        request(
            &api,
            "GET",
            "/api/v1/profiles/91000000-0000-4000-8000-000000000099",
            Some(false),
            Value::Null
        )
        .await
        .0,
        StatusCode::NOT_FOUND
    );
    let (_, me, _) = request(&api, "GET", "/api/v1/me", Some(true), Value::Null).await;
    let me: Value = serde_json::from_slice(&me).unwrap();
    let update = json!({"name":"اسم محفوظ","bio":"نبذة ظاهرة","avatarKey":"square-aspect/trollhunter-3.png","updatedAt":me["updatedAt"]});
    let (status, bytes, _) = request(&api, "PATCH", "/api/v1/me", Some(true), update.clone()).await;
    assert_eq!(
        status,
        StatusCode::OK,
        "{}",
        String::from_utf8_lossy(&bytes)
    );
    assert_eq!(
        request(&api, "PATCH", "/api/v1/me", Some(true), update)
            .await
            .0,
        StatusCode::CONFLICT
    );
    let saved: Value = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(saved["avatarKey"], "square-aspect/trollhunter-3.png");
    let invalid = json!({"name":"اسم محفوظ","bio":"","avatarKey":"../outside.png","updatedAt":saved["updatedAt"]});
    assert_eq!(
        request(&api, "PATCH", "/api/v1/me", Some(true), invalid)
            .await
            .0,
        StatusCode::BAD_REQUEST
    );
    for asset in ["cars-1.png", "square-aspect/trollhunter-3.png"] {
        let (status, bytes, mime) = request(
            &api,
            "GET",
            &format!("/api/v1/auth/avatars/{asset}"),
            Some(false),
            Value::Null,
        )
        .await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(mime, "image/png");
        assert!(bytes.starts_with(b"\x89PNG\r\n\x1a\n"));
    }
    assert_eq!(
        request(
            &api,
            "GET",
            "/api/v1/auth/avatars/cars-1.png",
            None,
            Value::Null
        )
        .await
        .0,
        StatusCode::UNAUTHORIZED
    );
    let mut tx = pool.begin().await.unwrap();
    sqlx::query("set transaction read write")
        .execute(&mut *tx)
        .await
        .unwrap();
    sqlx::query("update accounts set is_discoverable=false where id=$1::uuid")
        .bind(ACTOR)
        .execute(&mut *tx)
        .await
        .unwrap();
    tx.commit().await.unwrap();
    assert_eq!(
        request(&api, "GET", &path, Some(false), Value::Null)
            .await
            .0,
        StatusCode::NOT_FOUND
    );
    assert_eq!(
        request(&api, "GET", &path, Some(true), Value::Null).await.0,
        StatusCode::OK
    );
    pool.close().await;
}

async fn activity_acceptance(api: &Router, pool: &PgPool) {
    let work = "93000000-0000-4000-8000-000000000001";
    let secret = "93000000-0000-4000-8000-000000000002";
    let installment = "94000000-0000-4000-8000-000000000001";
    let mut tx = pool.begin().await.unwrap();
    sqlx::query("set transaction read write")
        .execute(&mut *tx)
        .await
        .unwrap();
    sqlx::query("insert into titles(id,canonical_title,sort_title,workflow_status,is_private) values($1::uuid,'Visible film','Visible film','published',false),($2::uuid,'Secret film','Secret film','published',true)").bind(work).bind(secret).execute(&mut *tx).await.unwrap();
    sqlx::query("insert into installments(id,title_id,kind,position,title,status) values($1::uuid,$2::uuid,'movie',1,'Fixture movie','completed')").bind(installment).bind(work).execute(&mut *tx).await.unwrap();
    sqlx::query("insert into account_playback_states(account_id,installment_id,is_played,position_seconds,duration_seconds,played_at) values($1::uuid,$2::uuid,true,1200,1200,now())").bind(ACTOR).bind(installment).execute(&mut *tx).await.unwrap();
    sqlx::query("insert into account_title_states(account_id,title_id,is_favorite,personal_rating,notes,saved_offline) values($1::uuid,$2::uuid,true,4,'owner-only-note',true)").bind(ACTOR).bind(work).execute(&mut *tx).await.unwrap();
    sqlx::query("insert into account_preferences(account_id) values($1::uuid)")
        .bind(ACTOR)
        .execute(&mut *tx)
        .await
        .unwrap();
    sqlx::query("insert into account_content_policies(account_id,audience,age,sexuality_risk,behavioral_risk,theology_risk) values('91000000-0000-4000-8000-000000000002','adult','18+','high','high','high')").execute(&mut *tx).await.unwrap();
    for n in 0..24 {
        sqlx::query("insert into title_comments(account_id,title_id,body,moderation_status) values($1::uuid,$2::uuid,$3,'published')").bind(ACTOR).bind(work).bind(format!("Published fixture {n}")).execute(&mut *tx).await.unwrap();
    }
    sqlx::query("insert into title_comments(account_id,title_id,body,moderation_status) values($1::uuid,$2::uuid,'private-title-comment','published'),($1::uuid,$3::uuid,'hidden-comment','hidden')").bind(ACTOR).bind(secret).bind(work).execute(&mut *tx).await.unwrap();
    sqlx::query("insert into family_recommendations(sender_account_id,recipient_account_id,title_id,reason) values($1::uuid,'91000000-0000-4000-8000-000000000002',$2::uuid,'private recommendation')").bind(ACTOR).bind(secret).execute(&mut *tx).await.unwrap();
    // A completed episode with zero stored position still starts its parent series.
    sqlx::query("insert into titles(id,canonical_title,sort_title,workflow_status) values('93000000-0000-4000-8000-000000000003','Partial series','Partial series','published')").execute(&mut *tx).await.unwrap();
    sqlx::query("insert into installments(id,title_id,kind,position,title,status) values('94000000-0000-4000-8000-000000000003','93000000-0000-4000-8000-000000000003','season',1,'Season one','completed')").execute(&mut *tx).await.unwrap();
    sqlx::query("insert into episodes(id,installment_id,number,position) values('95000000-0000-4000-8000-000000000001','94000000-0000-4000-8000-000000000003',1,1),('95000000-0000-4000-8000-000000000002','94000000-0000-4000-8000-000000000003',2,2)").execute(&mut *tx).await.unwrap();
    sqlx::query("insert into account_playback_states(account_id,installment_id,episode_id,is_played,position_seconds) values($1::uuid,'94000000-0000-4000-8000-000000000003','95000000-0000-4000-8000-000000000001',true,0)").bind(ACTOR).execute(&mut *tx).await.unwrap();
    sqlx::query("insert into account_title_states(account_id,title_id,is_favorite,notes) values($1::uuid,$2::uuid,true,'private note')").bind(ACTOR).bind(secret).execute(&mut *tx).await.unwrap();
    tx.commit().await.unwrap();
    let base = format!("/api/v1/profiles/{ACTOR}");
    let (status, bytes, _) = request(
        api,
        "GET",
        &format!("{base}/entries?section=watching"),
        Some(true),
        Value::Null,
    )
    .await;
    assert_eq!(
        status,
        StatusCode::OK,
        "{}",
        String::from_utf8_lossy(&bytes)
    );
    let watching: Value = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(watching["total"], 1);
    assert_eq!(
        watching["items"][0]["workId"],
        "93000000-0000-4000-8000-000000000003"
    );
    let (status, bytes, _) = request(
        api,
        "GET",
        "/api/v1/catalog/browse?view=works&privacy=public&pageSize=100",
        Some(true),
        Value::Null,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let browse: Value = serde_json::from_slice(&bytes).unwrap();
    let mut expected = browse["items"]
        .as_array()
        .unwrap()
        .iter()
        .filter(|entry| entry["watchState"] == "in-progress")
        .map(|entry| entry["work"]["id"].as_str().unwrap())
        .collect::<Vec<_>>();
    let mut actual = watching["items"]
        .as_array()
        .unwrap()
        .iter()
        .map(|entry| entry["workId"].as_str().unwrap())
        .collect::<Vec<_>>();
    expected.sort();
    actual.sort();
    assert_eq!(actual, expected);
    let (status, bytes, _) = request(
        api,
        "GET",
        &format!("{base}/overview"),
        Some(true),
        Value::Null,
    )
    .await;
    assert_eq!(
        status,
        StatusCode::OK,
        "{}",
        String::from_utf8_lossy(&bytes)
    );
    let overview: Value = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(overview["owner"], true);
    assert_eq!(overview["viewing"]["works"], 1);
    assert_eq!(overview["viewing"]["episodes"], 1);
    assert_eq!(overview["viewing"]["movies"], 1);
    assert_eq!(overview["stats"].as_array().unwrap().len(), 20);
    for stat in overview["stats"].as_array().unwrap() {
        let section = stat["key"].as_str().unwrap();
        let path = format!("{base}/entries?section={section}&page=1");
        let (status, bytes, _) = request(api, "GET", &path, Some(true), Value::Null).await;
        assert_eq!(
            status,
            StatusCode::OK,
            "{section}: {}",
            String::from_utf8_lossy(&bytes)
        );
        let page: Value = serde_json::from_slice(&bytes).unwrap();
        assert!(page["items"].as_array().unwrap().len() <= 20);
        assert!(!String::from_utf8_lossy(&bytes).contains("Secret film"));
        assert!(!String::from_utf8_lossy(&bytes).contains("private-title-comment"));
        for item in page["items"].as_array().unwrap() {
            assert_eq!(item.as_object().unwrap().len(), 10);
            assert!(item.get("path").is_none());
        }
    }
    let (status, bytes, _) = request(
        api,
        "GET",
        &format!("{base}/overview"),
        Some(false),
        Value::Null,
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let public: Value = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(public["stats"].as_array().unwrap().len(), 3);
    assert_eq!(public["stats"][0]["value"], 24);
    for section in [
        "watched",
        "notes",
        "devices",
        "preferences",
        "notifications",
        "recommendations",
    ] {
        assert_eq!(
            request(
                api,
                "GET",
                &format!("{base}/entries?section={section}"),
                Some(false),
                Value::Null
            )
            .await
            .0,
            StatusCode::FORBIDDEN
        );
    }
    let (_, bytes, _) = request(
        api,
        "GET",
        &format!("{base}/entries?section=comments&page=2"),
        Some(false),
        Value::Null,
    )
    .await;
    let page: Value = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(page["total"], 24);
    assert_eq!(page["items"].as_array().unwrap().len(), 4);
    assert!(!String::from_utf8_lossy(&bytes).contains("private-title-comment"));
    assert!(!String::from_utf8_lossy(&bytes).contains("hidden-comment"));
    assert_eq!(
        request(
            api,
            "GET",
            &format!("{base}/entries?section=notes&page=0"),
            Some(true),
            Value::Null
        )
        .await
        .0,
        StatusCode::BAD_REQUEST
    );
    assert_eq!(
        request(api, "GET", &format!("{base}/overview"), None, Value::Null)
            .await
            .0,
        StatusCode::UNAUTHORIZED
    );
}
