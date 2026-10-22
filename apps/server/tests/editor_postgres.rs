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
        sqlx::query("insert into titles(id,canonical_title,sort_title) values($1::uuid,$2,$2)")
            .bind(id)
            .bind(if id == WORK_ONE {
                "Rust planet fixture"
            } else {
                "Rust planet fixture two"
            })
            .execute(&mut *tx)
            .await
            .unwrap();
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
    entity_acceptance(&api, &pool).await;
    work_acceptance(&api, &pool).await;
    awards_acceptance(&api, &pool).await;
    artwork_acceptance(&api).await;
    let facets = inspection(&api, "/api/v1/catalog/facets?view=works&privacy=all").await;
    let genres = facets["groups"]
        .as_array()
        .unwrap()
        .iter()
        .find(|group| group["key"] == "genres")
        .unwrap();
    let genre = genres["options"]
        .as_array()
        .unwrap()
        .iter()
        .find(|option| option["value"] == "rust_fixture_genre")
        .unwrap();
    assert!(
        genre["searchTerms"]
            .to_string()
            .contains("Rust fixture genre")
    );
    assert!(genre["searchTerms"].to_string().contains("تصنيف اختباري"));
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
        sqlx::query_scalar("select count(*) from audit_logs where actor_account_id=$1::uuid and action like 'admin.planet.%'")
            .bind(ACTOR)
            .fetch_one(&pool)
            .await
            .unwrap();
    let revisions: i64 = sqlx::query_scalar(
        "select count(*) from editorial_revisions where actor_account_id=$1::uuid and summary='Planet editor'",
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

async fn entity_acceptance(api: &Router, pool: &PgPool) {
    assert_eq!(
        call(api, "entityList", json!({"kind":"person"}), None)
            .await
            .0,
        StatusCode::UNAUTHORIZED
    );
    assert_eq!(
        call(api, "entityList", json!({"kind":"person"}), Some(false))
            .await
            .0,
        StatusCode::FORBIDDEN
    );
    let role=ok(api,"entityRoleCreate",json!({"kind":"person","slug":"rust_fixture_credit","name":"Rust fixture credit","label":"دور اختباري"})).await;
    let draft = json!({"name":"Rust fixture person","sortName":"Rust fixture person","description":"محفوظ","aliases":[],"credits":[{"workId":WORK_ONE,"workTitle":"Rust planet fixture","roleId":role["id"],"roleName":"Rust fixture credit","roleLabel":"دور اختباري","position":0,"isPrimary":true,"languages":["ar"]}],"profileAssetId":null,"urls":[{"label":"Reference","url":"https://example.invalid/reference"}],"relations":[]});
    let created = ok(
        api,
        "entitySave",
        json!({"id":null,"revision":null,"kind":"person","draft":draft}),
    )
    .await;
    let id = created["id"].clone();
    let before = ok(api, "entityDetail", json!({"id":id,"kind":"person"})).await;
    assert_eq!(before["draft"]["credits"][0]["languages"], json!(["ar"]));
    let exported = ok(api, "entityJsonRead", json!({"ids":[id],"kind":"person"})).await;
    let mut document = exported["document"].clone();
    document["records"][0]["description"] = json!("Updated fixture");
    let review = ok(
        api,
        "entityJsonReview",
        json!({"json":document.to_string(),"originals":exported["originals"]}),
    )
    .await;
    assert_eq!(review["records"][0]["changes"][0]["path"], "description");
    let unchanged = ok(api, "entityDetail", json!({"id":id,"kind":"person"})).await;
    assert_eq!(unchanged["revision"], before["revision"]);
    let mut bad = review["ticket"].as_str().unwrap().to_owned();
    bad.push('x');
    assert_eq!(
        call(api, "entityJsonSave", json!({"ticket":bad}), Some(true))
            .await
            .0,
        StatusCode::BAD_REQUEST
    );
    assert_eq!(
        ok(api, "entityJsonSave", json!({"ticket":review["ticket"]})).await["saved"],
        1
    );
    assert_eq!(
        call(
            api,
            "entityJsonSave",
            json!({"ticket":review["ticket"]}),
            Some(true)
        )
        .await
        .0,
        StatusCode::CONFLICT
    );
    let after = ok(api, "entityDetail", json!({"id":id,"kind":"person"})).await;
    assert_eq!(after["draft"]["description"], "Updated fixture");
    let originals = json!([{"id":id,"revision":after["revision"]}]);
    assert_eq!(
        call(
            api,
            "entityBulkDelete",
            json!({"kind":"person","records":originals,"removeCredits":false}),
            Some(true)
        )
        .await
        .0,
        StatusCode::BAD_REQUEST
    );
    let deleted = ok(
        api,
        "entityBulkDelete",
        json!({"kind":"person","records":originals,"removeCredits":true}),
    )
    .await;
    assert_eq!(deleted, json!({"deleted":1,"removedCredits":1}));
    let count: i64 = sqlx::query_scalar("select count(*) from titles where id=$1::uuid")
        .bind(WORK_ONE)
        .fetch_one(pool)
        .await
        .unwrap();
    assert_eq!(count, 1);
    let org=ok(api,"entitySave",json!({"id":null,"revision":null,"kind":"organization","draft":{"name":"Rust fixture studio","sortName":"Rust fixture studio","description":"","aliases":[],"credits":[],"profileAssetId":null}})).await;
    let detail = ok(
        api,
        "entityDetail",
        json!({"id":org["id"],"kind":"organization"}),
    )
    .await;
    assert_eq!(detail["draft"]["name"], "Rust fixture studio");
}

async fn work_acceptance(api: &Router, pool: &PgPool) {
    ok(api,"entityRoleCreate",json!({"kind":"organization","slug":"rust_fixture_production","name":"Rust fixture production","label":"دور استوديو اختباري"})).await;
    let mut setup = pool.begin().await.unwrap();
    sqlx::query("set transaction read write")
        .execute(&mut *setup)
        .await
        .unwrap();
    sqlx::query("insert into genres(slug,label_en,label_ar) values('rust_fixture_genre','Rust fixture genre','تصنيف اختباري')").execute(&mut *setup).await.unwrap();
    sqlx::query("insert into award_organizations(slug,name_ar) values('rust_fixture_award','جائزة اختبارية')").execute(&mut *setup).await.unwrap();
    sqlx::query("insert into award_categories(organization_id,slug,name_ar) select id,'rust_fixture_category','فئة اختبارية' from award_organizations where slug='rust_fixture_award'").execute(&mut *setup).await.unwrap();
    setup.commit().await.unwrap();

    let source = json!({"canonicalTitle":"Rust whole-work fixture","titleAr":"عمل اختباري","summary":"قبل","genres":["rust_fixture_genre"],"credits":[{"entity":"Rust fixture studio","role":"rust_fixture_production","languages":["ar"]}],"relations":[{"target":"Rust planet fixture two","kind":"related","notes":"علاقة اختبارية"}],"awards":[{"organization":"rust_fixture_award","category":"فئة اختبارية","year":2026,"result":"winner","installment":1}],"trailers":[{"youtubeVideoId":"abcdefghijk","title":"إعلان اختباري","isPrimary":true}],"aliases":["Fixture alias"],"trivia":["Fact one","Fact two"],"playbackPolicy":"files-only","dubLanguages":["ar"],"installments":[{"kind":"season","position":1,"title":"الجزء الأول","score":{"story":8,"characters":7},"episodes":[{"number":1,"title":"الأولى"},{"number":2,"title":"الثانية"}]}],"externalIds":[{"provider":"fixture","externalId":"fixture-work","url":null}]});
    let review = ok(api, "create", json!({"json":source.to_string()})).await;
    let count: i64 = sqlx::query_scalar(
        "select count(*) from titles where canonical_title='Rust whole-work fixture'",
    )
    .fetch_one(pool)
    .await
    .unwrap();
    assert_eq!(count, 0, "review must roll back");
    let saved = ok(api, "save", json!({"ticket":review["ticket"]})).await;
    let id = saved["createdId"].clone();
    assert!(id.is_string());
    let snapshot = ok(api, "read", json!({"ids":[id]})).await[0].clone();
    assert_eq!(snapshot["document"]["dubLanguages"], json!(["ar"]));
    assert_eq!(
        snapshot["document"]["installments"][0]["score"]["story"].as_f64(),
        Some(8.0)
    );
    let mut parts = snapshot["document"]["installments"].clone();
    let episode_ids = parts[0]["episodes"].clone();
    parts[0]["episodes"][0]["number"] = json!(2);
    parts[0]["episodes"][1]["number"] = json!(1);
    let projected = json!({"schemaVersion":1,"fields":["summary","installments","externalIds"],"records":[{"id":id,"summary":"بعد","installments":parts,"externalIds":[{"provider":"fixture","externalId":"fixture-work","url":"https://example.invalid/new"}]}]});
    let originals = json!([{"id":id,"revision":snapshot["revision"]}]);
    let review = ok(
        api,
        "review",
        json!({"json":projected.to_string(),"originals":originals}),
    )
    .await;
    let unchanged = ok(api, "read", json!({"ids":[id]})).await;
    assert_eq!(unchanged[0]["revision"], snapshot["revision"]);
    assert_eq!(
        ok(api, "save", json!({"ticket":review["ticket"]})).await["saved"],
        1
    );
    assert_eq!(
        call(api, "save", json!({"ticket":review["ticket"]}), Some(true))
            .await
            .0,
        StatusCode::CONFLICT
    );
    let after = ok(api, "read", json!({"ids":[id]})).await[0].clone();
    assert_eq!(after["document"]["summary"], "بعد");
    assert_eq!(after["document"]["trivia"], source["trivia"]);
    assert_eq!(
        after["document"]["installments"][0]["episodes"][0]["id"],
        episode_ids[0]["id"]
    );
    let mut removed = after["document"]["installments"].clone();
    removed.as_array_mut().unwrap().clear();
    let invalid = json!({"schemaVersion":1,"fields":["installments"],"records":[{"id":id,"installments":removed}]});
    assert_eq!(call(api,"review",json!({"json":invalid.to_string(),"originals":[{"id":id,"revision":after["revision"]}]}),Some(true)).await.0,StatusCode::BAD_REQUEST);
    let mut tx = pool.begin().await.unwrap();
    sqlx::query("set transaction read write")
        .execute(&mut *tx)
        .await
        .unwrap();
    sqlx::query("create table rust_editor_episode_links(episode_id uuid not null,installment_id uuid not null,foreign key(episode_id,installment_id) references episodes(id,installment_id) on delete cascade)").execute(&mut *tx).await.unwrap();
    sqlx::query("insert into rust_editor_episode_links(episode_id,installment_id) values($1::uuid,$2::uuid)").bind(after["document"]["installments"][0]["episodes"][0]["id"].as_str().unwrap()).bind(after["document"]["installments"][0]["id"].as_str().unwrap()).execute(&mut *tx).await.unwrap();
    tx.commit().await.unwrap();
    let linked = ok(
        api,
        "links",
        json!({"workId":id,"episodeId":after["document"]["installments"][0]["episodes"][0]["id"]}),
    )
    .await;
    assert!(
        linked
            .as_array()
            .unwrap()
            .iter()
            .any(|r| r["table"] == "rust_editor_episode_links" && r["count"] == 1)
    );
    let mut removed = after["document"]["installments"].clone();
    removed[0]["episodes"].as_array_mut().unwrap().remove(0);
    let invalid = json!({"schemaVersion":1,"fields":["installments"],"records":[{"id":id,"installments":removed}]});
    assert_eq!(call(api,"review",json!({"json":invalid.to_string(),"originals":[{"id":id,"revision":after["revision"]}]}),Some(true)).await.0,StatusCode::BAD_REQUEST);
    let count: i64 = sqlx::query_scalar("select count(*) from rust_editor_episode_links")
        .fetch_one(pool)
        .await
        .unwrap();
    assert_eq!(count, 1);
    let refs = ok(
        api,
        "refs",
        json!({"table":"titles","search":"Rust whole-work"}),
    )
    .await;
    assert_eq!(refs["total"], 1);
}

async fn artwork_acceptance(api: &Router) {
    let root = std::env::var("NAHHASIO_MEDIA_ROOT").unwrap();
    assert!(root.starts_with("/tmp/nahhasio-catalog."));
    let input = json!({"dataUrl":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==","fileName":"fixture.png","role":"poster","ownerName":"Rust image fixture"});
    let uploaded = ok(api, "upload", input.clone()).await;
    let id = uploaded["id"].clone();
    let old = uploaded["path"].as_str().unwrap();
    assert_eq!(
        ok(api, "upload", input).await["id"],
        id,
        "same hash must reuse identity"
    );
    let detail = ok(api, "assetDetail", json!({"id":id})).await;
    assert_eq!(detail["asset"]["health"], "healthy");
    assert_eq!(detail["asset"]["width"], 1);
    let assigned=ok(api,"assetAssign",json!({"assetId":id,"ownerKind":"title","ownerId":WORK_ONE,"role":"poster","expectedPrimaryId":null,"expectedPrimaryAssetId":null})).await;
    assert_eq!(call(api,"assetAssign",json!({"assetId":id,"ownerKind":"title","ownerId":WORK_ONE,"role":"poster","expectedPrimaryId":null,"expectedPrimaryAssetId":null}),Some(true)).await.0,StatusCode::CONFLICT);
    assert_eq!(
        call(
            api,
            "assetDelete",
            json!({"id":id,"expectedSha256":detail["asset"]["sha256"]}),
            Some(true)
        )
        .await
        .0,
        StatusCode::BAD_REQUEST
    );
    let proposals = ok(api, "assetRenamePreview", json!({"ids":[id]})).await;
    let mut proposal = proposals[0].clone();
    proposal.as_object_mut().unwrap().remove("oldFileName");
    proposal.as_object_mut().unwrap().remove("reason");
    assert_eq!(
        ok(api, "assetRename", json!({"items":[proposal]})).await["renamed"],
        1
    );
    assert_eq!(
        ok(api, "media", json!({"path":old})).await["id"],
        id,
        "old paths remain resolvable"
    );
    let retained = std::path::Path::new(&root).join(old.strip_prefix("/media/uploads/").unwrap());
    assert!(retained.is_file());
    assert_eq!(
        ok(
            api,
            "assetUnlink",
            json!({"assetId":id,"assignmentId":assigned["assignmentId"],"expectedPrimary":true})
        )
        .await["removed"],
        true
    );
    let deleted = ok(
        api,
        "assetDelete",
        json!({"id":id,"expectedSha256":detail["asset"]["sha256"]}),
    )
    .await;
    assert_eq!(deleted["fileRetained"], true);
    assert!(retained.is_file());
    assert_eq!(
        call(
            api,
            "preview",
            json!({"url":"http://127.0.0.1/private"}),
            Some(true)
        )
        .await
        .0,
        StatusCode::BAD_REQUEST
    );
    assert_eq!(
        call(
            api,
            "preview",
            json!({"url":"https://example.invalid/file.png"}),
            Some(true)
        )
        .await
        .0,
        StatusCode::BAD_REQUEST
    );
}

async fn awards_acceptance(api: &Router, pool: &PgPool) {
    let draft = json!({"slug":"fixture-award-editor","name_ar":"جائزة المحرر","name_en":null,"description":"Fixture award organization","website_url":null,"logo_path":null,"is_active":true});
    let input = json!({"table":"award_organizations","id":null,"revision":null,"draft":draft});
    for identity in [None, Some(false)] {
        assert_ne!(
            call(api, "awardSave", input.clone(), identity).await.0,
            StatusCode::OK
        );
    }
    let organization = ok(api, "awardSave", input.clone()).await;
    let id = organization["id"].clone();
    let detail_input = json!({"table":"award_organizations","id":id});
    let before = ok(api, "awardDetail", detail_input.clone()).await;
    let mut changed = draft.clone();
    changed["description"] = json!("Updated fixture");
    let update = json!({"table":"award_organizations","id":id,"revision":before["revision"],"draft":changed});
    ok(api, "awardSave", update.clone()).await;
    assert_eq!(
        call(api, "awardSave", update, Some(true)).await.0,
        StatusCode::CONFLICT
    );
    let mut invalid = draft.clone();
    invalid["id"] = id.clone();
    assert_eq!(
        call(
            api,
            "awardSave",
            json!({"table":"award_organizations","id":null,"revision":null,"draft":invalid}),
            Some(true)
        )
        .await
        .0,
        StatusCode::BAD_REQUEST
    );
    let category=ok(api,"awardSave",json!({"table":"award_categories","id":null,"revision":null,"draft":{"organization_id":id,"slug":"fixture-category","name_ar":"الفئة الاختبارية","name_en":null,"description":"","is_active":true}})).await;
    let ceremony=ok(api,"awardSave",json!({"table":"award_ceremonies","id":null,"revision":null,"draft":{"organization_id":id,"year":2026,"edition":1,"label":"الدورة الأولى","held_on":"2026-10-22","source_url":"https://example.invalid/awards"}})).await;
    let detail = ok(api, "awardDetail", detail_input.clone()).await;
    assert_eq!(detail["links"].as_array().unwrap().len(), 2);
    assert_eq!(call(api,"awardDelete",json!({"table":"award_organizations","id":id,"revision":detail["revision"],"confirmation":"fixture-award-editor"}),Some(true)).await.0,StatusCode::BAD_REQUEST);
    let list = ok(
        api,
        "awardList",
        json!({"table":"award_ceremonies","organization":id,"q":"2026","page":1,"result":"all"}),
    )
    .await;
    let refs=ok(api,"refs",json!({"table":"award_ceremonies","search":"","offset":0,"filters":{"organization_id":id,"year":2026},"sort":"default"})).await;
    assert_eq!(refs["rows"][0]["id"], ceremony["id"]);
    assert_eq!(list["total"], 1);
    assert_eq!(list["rows"][0]["id"], ceremony["id"]);
    let results=ok(api,"awardList",json!({"table":"award_recognitions","organization":null,"q":"عمل اختباري","page":1,"result":"winner"})).await;
    assert!(results["total"].as_i64().unwrap() > 0);
    assert_eq!(results["rows"][0]["work_name"], "عمل اختباري");
    assert!(results["rows"][0].get("poster_id").is_some());
    assert_eq!(
        results["rows"][0]["work_english_name"],
        "Rust whole-work fixture"
    );
    let base = json!({"table":"award_recognitions","organization":null,"q":"عمل اختباري","page":1,"result":"winner"});
    for patch in [
        json!({"year":1900}),
        json!({"category":category["id"]}),
        json!({"ceremony":ceremony["id"]}),
        json!({"featured":true}),
        json!({"source":"documented"}),
    ] {
        let mut filtered = base.clone();
        filtered
            .as_object_mut()
            .unwrap()
            .extend(patch.as_object().unwrap().clone());
        let empty = ok(api, "awardList", filtered).await;
        assert_eq!(empty["total"], 0, "filter {patch}");
    }
    let mut filtered = base.clone();
    filtered["category"] = results["rows"][0]["category_id"].clone();
    filtered["year"] = json!(2026);
    filtered["source"] = json!("missing");
    let matched = ok(api, "awardList", filtered).await;
    assert_eq!(matched["total"], results["total"]);
    let mut invalid_year = base;
    invalid_year["year"] = json!(1899);
    assert_eq!(
        call(api, "awardList", invalid_year, Some(true)).await.0,
        StatusCode::BAD_REQUEST
    );
    for (table, record, confirmation) in [
        ("award_categories", category, "fixture-category"),
        ("award_ceremonies", ceremony, "2026"),
    ] {
        let detail = ok(api, "awardDetail", json!({"table":table,"id":record["id"]})).await;
        ok(api,"awardDelete",json!({"table":table,"id":record["id"],"revision":detail["revision"],"confirmation":confirmation})).await;
    }
    let final_detail = ok(api, "awardDetail", detail_input).await;
    ok(api,"awardDelete",json!({"table":"award_organizations","id":id,"revision":final_detail["revision"],"confirmation":"fixture-award-editor"})).await;
    let audits: i64 =
        sqlx::query_scalar("select count(*) from audit_logs where action like 'admin.awards.%'")
            .fetch_one(pool)
            .await
            .unwrap();
    let revisions: i64 =
        sqlx::query_scalar("select count(*) from editorial_revisions where summary='Award editor'")
            .fetch_one(pool)
            .await
            .unwrap();
    assert_eq!(audits, 7);
    assert_eq!(audits, revisions);
}
