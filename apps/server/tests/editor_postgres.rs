//! Explicit, socket-only fixtures owned by bin/test-rust-catalog. Never uses DATABASE_URL.
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
const WORK_ONE: &str = "92000000-0000-4000-8000-000000000001";
const WORK_TWO: &str = "92000000-0000-4000-8000-000000000002";
fn token(admin: bool) -> String {
    format!("nh1_{}", if admin { "a1" } else { "b2" }.repeat(32))
}
async fn call(
    api: &Router,
    operation: &str,
    data: Value,
    identity: Option<bool>,
) -> (StatusCode, Value) {
    let mut request =
        Request::post("/api/v1/admin/editor").header("content-type", "application/json");
    if let Some(admin) = identity {
        request = request.header("authorization", format!("Bearer {}", token(admin)));
    }
    let response = api
        .clone()
        .oneshot(
            request
                .body(Body::from(
                    json!({"operation":operation,"data":data}).to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    let status = response.status();
    let bytes = to_bytes(response.into_body(), 1024 * 1024).await.unwrap();
    (status, serde_json::from_slice(&bytes).unwrap())
}
async fn ok(api: &Router, operation: &str, data: Value) -> Value {
    let (status, value) = call(api, operation, data, Some(true)).await;
    assert_eq!(status, StatusCode::OK, "{operation}: {value}");
    value["result"].clone()
}
async fn inspection(api: &Router, path: &str) -> Value {
    let response = api
        .clone()
        .oneshot(
            Request::get(path)
                .header("authorization", format!("Bearer {}", token(true)))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    serde_json::from_slice(&to_bytes(response.into_body(), 1024 * 1024).await.unwrap()).unwrap()
}
fn draft(slug: &str) -> Value {
    json!({"slug":slug,"name":"كوكب اختباري","englishName":null,"icon":"🪐","description":"fixture","primaryColor":"#808080","secondaryColor":"#303030","displayOrder":1,"active":true})
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
    for id in [WORK_ONE, WORK_TWO] {
        sqlx::query("insert into titles(id,canonical_title,sort_title) values($1::uuid,'Rust planet fixture','Rust planet fixture')").bind(id).execute(&mut *tx).await.unwrap();
    }
    sqlx::query("insert into account_title_states(account_id,title_id,notes) values($1::uuid,$2::uuid,'ملاحظة محفوظة')").bind(ACTOR).bind(WORK_ONE).execute(&mut *tx).await.unwrap();
    tx.commit().await.unwrap();
}
async fn members(pool: &PgPool, planet: &str) -> i64 {
    sqlx::query_scalar("select count(*) from title_planets where planet_id=$1::uuid")
        .bind(planet)
        .fetch_one(pool)
        .await
        .unwrap()
}
fn originals(works: &Value) -> Value {
    json!(
        works["items"]
            .as_array()
            .unwrap()
            .iter()
            .map(|work| json!({"id":work["id"],"revision":work["revision"]}))
            .collect::<Vec<_>>()
    )
}

#[tokio::test]
#[ignore = "requires the private migrated database created by bin/test-rust-catalog"]
async fn rust_planet_api_preserves_authorization_revisions_and_atomicity() {
    let url =
        std::env::var("NAHHASIO_TEST_EDITOR_DATABASE_URL").expect("private editor fixture URL");
    let options: sqlx::postgres::PgConnectOptions = url.parse().unwrap();
    assert_eq!(
        options.get_database(),
        Some("nahhasio_test_rust_migrations")
    );
    assert!(options.get_socket().is_some());
    assert_eq!(
        std::env::var("NAHHASIO_EDITOR_ROOT").as_deref(),
        Ok("/nonexistent-rust-editor-fixture"),
        "Node fallback must be unusable for this test"
    );
    let pool = database_pool(&url).unwrap();
    setup(&pool).await;
    let api = router(pool.clone());
    let schema = inspection(&api, "/api/v1/admin/database/schema").await;
    let sessions = schema["tables"]
        .as_array()
        .unwrap()
        .iter()
        .find(|table| table["name"] == "auth_sessions")
        .unwrap();
    let token_column = sessions["columns"]
        .as_array()
        .unwrap()
        .iter()
        .find(|column| column["name"] == "token")
        .unwrap();
    assert_eq!(token_column["protected"], true);
    assert!(token_column["defaultValue"].is_null());
    let sessions = inspection(&api, "/api/v1/admin/database/auth_sessions").await;
    assert!(
        sessions["rows"]
            .as_array()
            .unwrap()
            .iter()
            .all(|row| row["token"] == "[protected]")
    );
    assert!(!sessions.to_string().contains("nh1:"));
    assert_eq!(
        call(&api, "planetOptions", json!({}), None).await.0,
        StatusCode::UNAUTHORIZED
    );
    assert_eq!(
        call(&api, "planetOptions", json!({}), Some(false)).await.0,
        StatusCode::FORBIDDEN
    );
    assert_eq!(
        call(
            &api,
            "planetOptions",
            json!({"unexpected":true}),
            Some(true)
        )
        .await
        .0,
        StatusCode::BAD_REQUEST
    );
    let a = ok(
        &api,
        "planetSave",
        json!({"id":null,"revision":null,"draft":draft("rust-fixture-one")}),
    )
    .await["id"]
        .as_str()
        .unwrap()
        .to_owned();
    let b = ok(
        &api,
        "planetSave",
        json!({"id":null,"revision":null,"draft":draft("rust-fixture-two")}),
    )
    .await["id"]
        .as_str()
        .unwrap()
        .to_owned();
    let detail = ok(&api, "planetDetail", json!({"id":a})).await;
    assert_eq!(detail["draft"]["slug"], "rust-fixture-one");
    assert_eq!(detail["revision"].as_str().unwrap().len(), 64);
    assert_eq!(
        call(
            &api,
            "planetSave",
            json!({"id":null,"revision":null,"draft":draft("rust-fixture-one")}),
            Some(true)
        )
        .await
        .0,
        StatusCode::CONFLICT
    );
    let mut edited = detail["draft"].clone();
    edited["description"] = json!("updated fixture");
    ok(
        &api,
        "planetSave",
        json!({"id":a,"revision":detail["revision"],"draft":edited}),
    )
    .await;
    assert_eq!(
        call(
            &api,
            "planetSave",
            json!({"id":a,"revision":detail["revision"],"draft":detail["draft"]}),
            Some(true)
        )
        .await
        .0,
        StatusCode::CONFLICT
    );
    let works = ok(
        &api,
        "planetWorks",
        json!({"source":null,"q":"Rust planet fixture","page":1}),
    )
    .await;
    assert_eq!(works["total"], 2);
    let move_request = json!({"source":null,"destination":a,"records":originals(&works)});
    assert_eq!(
        ok(&api, "planetMove", move_request.clone()).await["moved"],
        2
    );
    assert_eq!(members(&pool, &a).await, 2);
    assert_eq!(
        call(&api, "planetMove", move_request, Some(true)).await.0,
        StatusCode::CONFLICT
    );
    let current = ok(
        &api,
        "planetWorks",
        json!({"source":a,"q":"Rust planet fixture","page":1}),
    )
    .await;
    let mut records = originals(&current);
    records[1]["revision"] = json!("0".repeat(64));
    assert_eq!(
        call(
            &api,
            "planetMove",
            json!({"source":a,"destination":b,"records":records}),
            Some(true)
        )
        .await
        .0,
        StatusCode::CONFLICT
    );
    assert_eq!(
        members(&pool, &a).await,
        2,
        "a later stale record must roll back the earlier move"
    );
    assert_eq!(members(&pool, &b).await, 0);
    let detail = ok(&api, "planetDetail", json!({"id":a})).await;
    assert!(
        detail["links"]
            .as_array()
            .unwrap()
            .iter()
            .any(|link| link["table"] == "title_planets" && link["count"] == 2)
    );
    assert_eq!(
        call(
            &api,
            "planetDelete",
            json!({"id":a,"revision":detail["revision"],"confirmation":"rust-fixture-one"}),
            Some(true)
        )
        .await
        .0,
        StatusCode::CONFLICT
    );
    let current = ok(
        &api,
        "planetWorks",
        json!({"source":a,"q":"Rust planet fixture","page":1}),
    )
    .await;
    ok(
        &api,
        "planetMove",
        json!({"source":a,"destination":null,"records":originals(&current)}),
    )
    .await;
    assert_eq!(members(&pool, &a).await, 0);
    assert_eq!(
        call(
            &api,
            "planetDelete",
            json!({"id":a,"revision":detail["revision"],"confirmation":"wrong"}),
            Some(true)
        )
        .await
        .0,
        StatusCode::BAD_REQUEST
    );
    assert_eq!(
        ok(
            &api,
            "planetDelete",
            json!({"id":a,"revision":detail["revision"],"confirmation":"rust-fixture-one"})
        )
        .await["removed"],
        true
    );
    let options = ok(&api, "planetOptions", json!({})).await;
    assert!(
        options["planets"]
            .as_array()
            .unwrap()
            .iter()
            .any(|planet| planet["id"] == b)
    );
    let notes: String = sqlx::query_scalar(
        "select notes from account_title_states where account_id=$1::uuid and title_id=$2::uuid",
    )
    .bind(ACTOR)
    .bind(WORK_ONE)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(notes, "ملاحظة محفوظة");
    let audits: i64 =
        sqlx::query_scalar("select count(*) from audit_logs where actor_account_id=$1::uuid")
            .bind(ACTOR)
            .fetch_one(&pool)
            .await
            .unwrap();
    let revisions: i64 = sqlx::query_scalar(
        "select count(*) from editorial_revisions where actor_account_id=$1::uuid",
    )
    .bind(ACTOR)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(audits, revisions);
    assert!(audits >= 8);
    let mut tx = pool.begin().await.unwrap();
    sqlx::query("set transaction read write")
        .execute(&mut *tx)
        .await
        .unwrap();
    sqlx::query("update auth_users set role='member' where id='rust-editor-admin'")
        .execute(&mut *tx)
        .await
        .unwrap();
    tx.commit().await.unwrap();
    assert_eq!(
        call(
            &api,
            "planetSave",
            json!({"id":null,"revision":null,"draft":draft("rust-fixture-denied")}),
            Some(true)
        )
        .await
        .0,
        StatusCode::FORBIDDEN
    );
    pool.close().await;
}
