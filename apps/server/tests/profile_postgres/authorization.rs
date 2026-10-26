//! Deterministic races: hold a row, wait for the request to reach its write guard, revoke, release.
use axum::{
    Router,
    body::{Body, to_bytes},
    http::{Request, StatusCode},
};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use sqlx::{AssertSqlSafe, PgConnection, PgPool};
use std::time::Duration;
use tower::ServiceExt;
const USER: &str = "authorization-fixture";
const OWNER: &str = "97000000-0000-4000-8000-000000000001";
const WORK: &str = "97000000-0000-4000-8000-000000000002";
const MOVIE: &str = "97000000-0000-4000-8000-000000000003";
const DEVICE: &str = "97000000-0000-4000-8000-000000000004";
const INSTALL: &str = "97000000-0000-4000-8000-000000000005";
const HASH: &str = "00112233445566778899aabbccddeeff:0f41509d7afa42f50405a64fee8db01ba40f9016a7f011477989a0af876e15d9745b07f4499f1b8e12e40de191be30daba9c2289b89ddff8e79a40f86304bc14";
fn token() -> String {
    format!("nh1_{}", "c3".repeat(32))
}
fn key() -> String {
    format!("nh1:{}", hex::encode(Sha256::digest(token().as_bytes())))
}
async fn sql(tx: &mut PgConnection, query: &str) {
    sqlx::query(AssertSqlSafe(query.to_owned()))
        .execute(tx)
        .await
        .unwrap();
}
async fn reset(pool: &PgPool) {
    let mut tx = pool.begin().await.unwrap();
    sql(&mut tx, "set transaction read write").await;
    sqlx::query("insert into auth_users(id,name,email,role) values($1,'Authorization fixture','authorization@example.invalid','member') on conflict(id) do update set role='member',banned=false,ban_expires=null").bind(USER).execute(&mut *tx).await.unwrap();
    sqlx::query("insert into accounts(id,auth_user_id,kind,status,display_name) values($1::uuid,$2,'family','active','Authorization fixture') on conflict(id) do update set kind='family',status='active'").bind(OWNER).bind(USER).execute(&mut *tx).await.unwrap();
    sqlx::query("insert into auth_accounts(id,account_id,provider_id,user_id,password) values('authorization-credential',$1,'credential',$1,$2) on conflict(id) do update set password=$2").bind(USER).bind(HASH).execute(&mut *tx).await.unwrap();
    sqlx::query("insert into devices(id,installation_id,name) values($1::uuid,$2,'Original installation') on conflict(id) do update set revoked_at=null").bind(DEVICE).bind(INSTALL).execute(&mut *tx).await.unwrap();
    sqlx::query("insert into auth_sessions(id,token,user_id,device_id,expires_at) values('authorization-session',$1,$2,$3::uuid,now()+interval '1 day') on conflict(id) do update set token=$1,user_id=$2,device_id=$3::uuid,expires_at=now()+interval '1 day'").bind(key()).bind(USER).bind(DEVICE).execute(&mut *tx).await.unwrap();
    sqlx::query("insert into account_content_policies(account_id,audience,age,sexuality_risk,behavioral_risk,theology_risk) values($1::uuid,'adult','18+','high','high','high') on conflict(account_id) do update set audience='adult',age='18+',sexuality_risk='high',behavioral_risk='high',theology_risk='high',inclusion_filter=null").bind(OWNER).execute(&mut *tx).await.unwrap();
    sqlx::query("insert into titles(id,canonical_title,sort_title,workflow_status,is_private) values($1::uuid,'Authorization film','Authorization film','published',false) on conflict(id) do update set is_private=false,workflow_status='published'").bind(WORK).execute(&mut *tx).await.unwrap();
    sqlx::query("insert into installments(id,title_id,kind,position,title,status) values($1::uuid,$2::uuid,'movie',1,'Film','completed') on conflict(id) do nothing").bind(MOVIE).bind(WORK).execute(&mut *tx).await.unwrap();
    tx.commit().await.unwrap();
}
async fn fingerprint(tx: &mut PgConnection) -> String {
    let mut hash = Sha256::new();
    for table in [
        "accounts",
        "auth_users",
        "auth_accounts",
        "auth_sessions",
        "devices",
        "titles",
        "account_content_policies",
        "account_title_states",
        "account_playback_states",
        "title_comments",
        "audit_logs",
    ] {
        let body:String=sqlx::query_scalar(AssertSqlSafe(format!("select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb)::text from {table} t"))).fetch_one(&mut *tx).await.unwrap();
        hash.update(table);
        hash.update(body);
    }
    hex::encode(hash.finalize())
}
async fn call(api: Router, method: &str, path: String, body: Value) -> (StatusCode, Value) {
    let response = api
        .oneshot(
            Request::builder()
                .method(method)
                .uri(path)
                .header("authorization", format!("Bearer {}", token()))
                .header("content-type", "application/json")
                .body(Body::from(body.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    let status = response.status();
    let bytes = to_bytes(response.into_body(), 1024 * 1024).await.unwrap();
    (
        status,
        serde_json::from_slice(&bytes).unwrap_or(Value::Null),
    )
}
async fn request_input(pool: &PgPool, operation: &str) -> (&'static str, String, Value) {
    match operation {
        "favorite" => (
            "PUT",
            format!("/api/v1/works/{WORK}/favorite"),
            json!({"isFavorite":true}),
        ),
        "watched" => (
            "PATCH",
            format!("/api/v1/works/{WORK}/watched"),
            json!({"isPlayed":true}),
        ),
        "tracking" => (
            "PATCH",
            format!("/api/v1/works/{WORK}/tracking"),
            json!({"installmentId":MOVIE,"expectedRevision":0,"positionSeconds":10,"durationSeconds":100}),
        ),
        "comment" => (
            "POST",
            format!("/api/v1/works/{WORK}/comments"),
            json!({"action":"create","body":"Mutation must not survive revocation"}),
        ),
        "profile" => {
            let revision:String=sqlx::query_scalar("select to_char(updated_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') from accounts where id=$1::uuid").bind(OWNER).fetch_one(pool).await.unwrap();
            (
                "PATCH",
                "/api/v1/me".into(),
                json!({"name":"Changed fixture","bio":"","avatarKey":"cars-1.png","updatedAt":revision}),
            )
        }
        "password" => (
            "POST",
            "/api/v1/me/password".into(),
            json!({"currentPassword":"fixture-password","newPassword":"replacement-password"}),
        ),
        "login" => (
            "POST",
            "/api/v1/auth/login".into(),
            json!({"email":"authorization@example.invalid","password":"fixture-password"}),
        ),
        "device" => (
            "POST",
            "/api/v1/me/device".into(),
            json!({"installationId":INSTALL,"name":"Changed installation","platform":"linux"}),
        ),
        _ => unreachable!(),
    }
}
async fn race(api: &Router, pool: &PgPool, operation: &str, change: &str) {
    reset(pool).await;
    if change == "demoted" {
        let mut tx = pool.begin().await.unwrap();
        sql(&mut tx, "set transaction read write").await;
        sqlx::query("update auth_users set role='owner' where id=$1")
            .bind(USER)
            .execute(&mut *tx)
            .await
            .unwrap();
        sqlx::query("update accounts set kind='admin' where id=$1::uuid")
            .bind(OWNER)
            .execute(&mut *tx)
            .await
            .unwrap();
        sqlx::query("update titles set is_private=true where id=$1::uuid")
            .bind(WORK)
            .execute(&mut *tx)
            .await
            .unwrap();
        tx.commit().await.unwrap();
    }
    let (method, path, body) = request_input(pool, operation).await;
    let mut blocker = pool.begin().await.unwrap();
    sql(&mut blocker, "set transaction read write").await;
    let pid: i32 = sqlx::query_scalar("select pg_backend_pid()")
        .fetch_one(&mut *blocker)
        .await
        .unwrap();
    if matches!(change, "private" | "archived") {
        sqlx::query("select id from titles where id=$1::uuid for update")
            .bind(WORK)
            .execute(&mut *blocker)
            .await
            .unwrap();
    } else {
        sqlx::query("select id from auth_users where id=$1 for update")
            .bind(USER)
            .execute(&mut *blocker)
            .await
            .unwrap();
    }
    let task = tokio::spawn(call(api.clone(), method, path, body));
    // Password/login paths deliberately run the real bounded scrypt work before locking.
    tokio::time::timeout(Duration::from_secs(15), async {
        loop {
            let waiting: bool = sqlx::query_scalar(
                "select exists(select 1 from pg_stat_activity where $1=any(pg_blocking_pids(pid)))",
            )
            .bind(pid)
            .fetch_one(pool)
            .await
            .unwrap();
            if waiting {
                break;
            }
            assert!(
                !task.is_finished(),
                "{operation}/{change}: request did not reach authorization lock"
            );
            tokio::time::sleep(Duration::from_millis(10)).await;
        }
    })
    .await
    .unwrap_or_else(|_| {
        panic!("{operation}/{change}: request must reach deterministic race barrier")
    });
    match change {
  "logout"=>sql(&mut blocker,"delete from auth_sessions where user_id='authorization-fixture'").await,
  "rotation"=>{sql(&mut blocker,"update auth_accounts set password='rotated-by-another-session' where user_id='authorization-fixture'").await;sql(&mut blocker,"delete from auth_sessions where user_id='authorization-fixture'").await;},
  "expired"=>sql(&mut blocker,"update auth_sessions set expires_at=clock_timestamp()-interval '1 second' where user_id='authorization-fixture'").await,
  "revoked"=>sqlx::query("update devices set revoked_at=now() where id=$1::uuid").bind(DEVICE).execute(&mut *blocker).await.map(|_|()).unwrap(),
  "disabled"=>sqlx::query("update accounts set status='suspended' where id=$1::uuid").bind(OWNER).execute(&mut *blocker).await.map(|_|()).unwrap(),
  "demoted"=>sql(&mut blocker,"update auth_users set role='member' where id='authorization-fixture'").await,
  "policy"=>sqlx::query("delete from account_content_policies where account_id=$1::uuid").bind(OWNER).execute(&mut *blocker).await.map(|_|()).unwrap(),
  "private"=>sqlx::query("update titles set is_private=true where id=$1::uuid").bind(WORK).execute(&mut *blocker).await.map(|_|()).unwrap(),
  "archived"=>sqlx::query("update titles set workflow_status='archived' where id=$1::uuid").bind(WORK).execute(&mut *blocker).await.map(|_|()).unwrap(),
  _=>unreachable!()
 }
    let expected = fingerprint(&mut blocker).await;
    blocker.commit().await.unwrap();
    let (status, _) = task.await.unwrap();
    let wanted = match change {
        "private" | "archived" | "demoted" => StatusCode::NOT_FOUND,
        "policy" => StatusCode::FORBIDDEN,
        _ => StatusCode::UNAUTHORIZED,
    };
    assert_eq!(status, wanted, "{operation}/{change}");
    let actual = fingerprint(&mut pool.acquire().await.unwrap()).await;
    assert_eq!(
        expected, actual,
        "{operation}/{change}: rejected mutation changed persistent state"
    );
}
pub(super) async fn acceptance(api: &Router, pool: &PgPool) {
    studio_grouping(api, pool).await;
    draft_visibility(api, pool).await;
    for operation in [
        "favorite", "watched", "tracking", "comment", "profile", "password", "device",
    ] {
        for change in ["logout", "rotation", "expired", "revoked", "disabled"] {
            race(api, pool, operation, change).await;
        }
    }
    for operation in ["favorite", "watched", "tracking", "comment"] {
        for change in ["policy", "private", "archived"] {
            race(api, pool, operation, change).await;
        }
    }
    for operation in ["favorite", "watched", "tracking", "comment"] {
        race(api, pool, operation, "demoted").await;
    }
    for change in ["rotation", "disabled"] {
        race(api, pool, "login", change).await;
    }
    reset(pool).await;
    // A valid session cannot be silently moved to another installation.
    let before = fingerprint(&mut pool.acquire().await.unwrap()).await;
    let (status,_)=call(api.clone(),"POST","/api/v1/me/device".into(),json!({"installationId":"97000000-0000-4000-8000-000000000099","name":"Other installation","platform":"linux"})).await;
    assert_eq!(status, StatusCode::FORBIDDEN);
    assert_eq!(
        before,
        fingerprint(&mut pool.acquire().await.unwrap()).await
    );
    // Positive control: every protected flow still works for a current authorized session.
    for operation in [
        "favorite", "tracking", "watched", "comment", "profile", "device", "password",
    ] {
        reset(pool).await;
        let (method, path, body) = request_input(pool, operation).await;
        assert_eq!(
            call(api.clone(), method, path, body).await.0,
            StatusCode::OK,
            "authorized {operation}"
        );
    }
    eprintln!(
        "53 deterministic session/policy/visibility races rejected without state changes; valid writes preserved"
    );
}

async fn studio_grouping(api: &Router, pool: &PgPool) {
    reset(pool).await;
    let main = "98000000-0000-4000-8000-000000000011";
    let supporting = "98000000-0000-4000-8000-000000000012";
    let distributor = "98000000-0000-4000-8000-000000000013";
    let mut tx = pool.begin().await.unwrap();
    sql(&mut tx, "set transaction read write").await;
    for (id, name, role, primary, position) in [
        (main, "Main animation studio", "animation_studio", true, 2),
        (
            supporting,
            "Supporting animation studio",
            "animation_studio",
            false,
            0,
        ),
        (distributor, "Primary distributor", "distributor", true, 1),
    ] {
        sqlx::query(
            "insert into entities(id,name,sort_name,kind) values($1::uuid,$2,$2,'organization')",
        )
        .bind(id)
        .bind(name)
        .execute(&mut *tx)
        .await
        .unwrap();
        sqlx::query("insert into contributions(title_id,entity_id,role_id,is_primary,position) select $1::uuid,$2::uuid,id,$4,$5 from roles where slug=$3")
            .bind(WORK).bind(id).bind(role).bind(primary).bind(position).execute(&mut *tx).await.unwrap();
    }
    tx.commit().await.unwrap();
    for expected in [main, "__none__", main] {
        for view in ["works", "installments"] {
            let (status, body) = call(api.clone(), "GET", format!("/api/v1/catalog/browse?privacy=public&group=studio&view={view}&q=Authorization%20film"), Value::Null).await;
            assert_eq!(status, StatusCode::OK, "{body}");
            assert_eq!(body["total"], 1);
            assert_eq!(body["groups"].as_array().unwrap().len(), 1);
            assert_eq!(body["groups"][0]["key"], expected);
            assert_eq!(body["items"][0]["groupKey"], expected);
        }
        let mut tx = pool.begin().await.unwrap();
        sql(&mut tx, "set transaction read write").await;
        if expected == main {
            sqlx::query("update contributions set is_primary=false where title_id=$1::uuid and entity_id=$2::uuid")
                .bind(WORK).bind(main).execute(&mut *tx).await.unwrap();
        } else {
            sqlx::query("update contributions set is_primary=true,role_id=(select id from roles where slug='production_company') where title_id=$1::uuid and entity_id=$2::uuid")
                .bind(WORK).bind(main).execute(&mut *tx).await.unwrap();
        }
        tx.commit().await.unwrap();
    }
}

async fn draft_visibility(api: &Router, pool: &PgPool) {
    reset(pool).await;
    let artwork = "97000000-0000-4000-8000-000000000006";
    let root = std::path::PathBuf::from(std::env::var_os("NAHHASIO_MEDIA_ROOT").unwrap());
    assert!(root.starts_with("/tmp"));
    std::fs::create_dir_all(root.join("posters")).unwrap();
    let bytes = hex::decode("89504e470d0a1a0a0000000d4948445200000001000000010804000000b51c0c020000000b4944415478da6364f80f00010501012718e3660000000049454e44ae426082").unwrap();
    std::fs::write(root.join("posters/draft-fixture.png"), &bytes).unwrap();
    let mut tx = pool.begin().await.unwrap();
    sql(&mut tx, "set transaction read write").await;
    sqlx::query("insert into media_assets(id,path,sha256,mime_type,byte_size,width,height,original_filename) values($1::uuid,'/media/uploads/posters/draft-fixture.png',$2,'image/png',$3,1,1,'draft-fixture.png')")
        .bind(artwork).bind(hex::encode(Sha256::digest(&bytes))).bind(i32::try_from(bytes.len()).unwrap()).execute(&mut *tx).await.unwrap();
    sqlx::query("insert into media_asset_assignments(asset_id,title_id,role,is_primary) values($1::uuid,$2::uuid,'poster',true)")
        .bind(artwork).bind(WORK).execute(&mut *tx).await.unwrap();
    tx.commit().await.unwrap();
    for (workflow, private, visible) in [
        ("draft", false, true),
        ("published", false, true),
        ("draft", true, false),
        ("archived", false, false),
        ("in_review", false, false),
        ("approved", false, false),
    ] {
        let mut tx = pool.begin().await.unwrap();
        sql(&mut tx, "set transaction read write").await;
        sqlx::query(
            "update titles set workflow_status=$2::workflow_status,is_private=$3 where id=$1::uuid",
        )
        .bind(WORK)
        .bind(workflow)
        .bind(private)
        .execute(&mut *tx)
        .await
        .unwrap();
        tx.commit().await.unwrap();
        for view in ["works", "installments"] {
            let (status, body) = call(
                api.clone(),
                "GET",
                format!("/api/v1/catalog/browse?privacy=public&view={view}&q=Authorization%20film"),
                Value::Null,
            )
            .await;
            assert_eq!(status, StatusCode::OK);
            assert_eq!(
                body["total"].as_u64().unwrap() > 0,
                visible,
                "{workflow}/{private}/{view}"
            );
        }
        let wanted = if visible {
            StatusCode::OK
        } else {
            StatusCode::NOT_FOUND
        };
        assert_eq!(
            call(
                api.clone(),
                "GET",
                format!("/api/v1/works/{WORK}"),
                Value::Null
            )
            .await
            .0,
            wanted
        );
        let response = api
            .clone()
            .oneshot(
                Request::builder()
                    .uri(format!("/api/v1/artwork/{artwork}"))
                    .header("authorization", format!("Bearer {}", token()))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), wanted, "{workflow}/{private}/artwork");
        if visible {
            assert_eq!(
                &to_bytes(response.into_body(), 1024).await.unwrap()[..],
                &bytes
            );
        }
        if workflow == "draft" && !private {
            assert_eq!(
                call(
                    api.clone(),
                    "PUT",
                    format!("/api/v1/works/{WORK}/favorite"),
                    json!({"isFavorite":true})
                )
                .await
                .0,
                StatusCode::OK
            );
        }
    }
}
