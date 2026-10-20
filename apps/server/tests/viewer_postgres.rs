//! Opt-in integration tests against a NEW, schema-only restored database.
//! Run: NAHHASIO_RUN_VIEWER_DB_TEST=1 PGUSER=aqua devenv shell -- cargo test
//!      -p nahhasio-server --test viewer_postgres --locked -- --ignored --nocapture
//! DATABASE_URL is used only by pg_dump (schema-only/read-only) and to locate the maintenance
//! database. It is never used as a write target or printed. Only our randomly named *_test DB
//! is populated and removed, including after a test panic. Default cargo tests skip this suite.
use std::{env, error::Error, path::PathBuf, process::Command, str::FromStr, time::Duration};

use axum::{
    Router,
    body::{Body, to_bytes},
    http::{Method, Request, StatusCode},
};
use nahhasio_server::router;
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use sqlx::{
    AssertSqlSafe, PgPool,
    postgres::{PgConnectOptions, PgPoolOptions},
    types::Json as SqlJson,
};
use tower::ServiceExt;

type TestResult<T = ()> = Result<T, Box<dyn Error + Send + Sync>>;
const WORK: &str = "10000000-0000-4000-8000-000000000001";
const EMPTY: &str = "10000000-0000-4000-8000-000000000003";
const FUTURE: &str = "10000000-0000-4000-8000-000000000004";
const UNKNOWN: &str = "10000000-0000-4000-8000-000000000005";
const ACCOUNT: &str = "20000000-0000-4000-8000-000000000001";
const OTHER: &str = "20000000-0000-4000-8000-000000000002";
const SEASON: &str = "40000000-0000-4000-8000-000000000001";
const MOVIE: &str = "40000000-0000-4000-8000-000000000004";
const EPISODE: &str = "50000000-0000-4000-8000-000000000001";
const HALF_EPISODE: &str = "50000000-0000-4000-8000-000000000002";
const FUTURE_EPISODE: &str = "50000000-0000-4000-8000-000000000003";

// Include the production detail SQL to measure the real serializer payload without a live
// authentication session. Actual live reads still go through arcadia's enforced READ ONLY CLI.
mod detail_sql {
    include!("../src/catalog/queries.rs");
}

fn valid_database_name(name: &str) -> bool {
    name.starts_with("nahhasio_viewer_")
        && name.ends_with("_test")
        && name
            .bytes()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == b'_')
}

#[tokio::test]
#[ignore = "requires explicit opt-in and creates only a guarded schema-only disposable database"]
async fn disposable_postgres_viewer_api() -> TestResult {
    if env::var("NAHHASIO_RUN_VIEWER_DB_TEST").as_deref() != Ok("1") {
        return Err("Set NAHHASIO_RUN_VIEWER_DB_TEST=1 to authorize disposable testing".into());
    }
    let source =
        env::var("DATABASE_URL").map_err(|_| "DATABASE_URL is required but never printed")?;
    let options =
        PgConnectOptions::from_str(&source).map_err(|_| "Invalid database configuration")?;
    let dump = Command::new("pg_dump")
        .args([
            "--schema-only",
            "--no-owner",
            "--no-privileges",
            "--dbname",
            &source,
        ])
        .env("PGOPTIONS", "-c default_transaction_read_only=on")
        .output()
        .map_err(|_| "pg_dump is required from devenv")?;
    if !dump.status.success() {
        return Err("Read-only schema dump failed; connection details withheld".into());
    }
    let schema = String::from_utf8(dump.stdout)?;
    // New pg_dump releases emit these psql-only safety directives. Nothing else is removed.
    let schema = schema
        .lines()
        .filter(|line| !line.starts_with("\\restrict ") && !line.starts_with("\\unrestrict "))
        .collect::<Vec<_>>()
        .join("\n");
    let maintenance = PgPoolOptions::new()
        .max_connections(1)
        .acquire_timeout(Duration::from_secs(3))
        .connect_with(options.clone().database("postgres"))
        .await
        .map_err(|_| "Maintenance connection unavailable")?;
    let mut random = [0; 8];
    getrandom::fill(&mut random)?;
    let name = format!("nahhasio_viewer_{}_test", hex::encode(random));
    assert!(valid_database_name(&name));
    sqlx::query(AssertSqlSafe(format!(
        "CREATE DATABASE \"{name}\" TEMPLATE template0"
    )))
    .execute(&maintenance)
    .await?;
    println!(
        "Created new disposable database {name}; schema-only restore, no catalog rows copied."
    );
    let created_name = name.clone();
    let task = tokio::spawn(async move {
        let fixture = PgPoolOptions::new()
            .max_connections(2)
            .acquire_timeout(Duration::from_secs(3))
            .connect_with(options.clone().database(&name))
            .await?;
        let connected: String = sqlx::query_scalar("select current_database()")
            .fetch_one(&fixture)
            .await?;
        if connected != name || !valid_database_name(&connected) {
            return Err("Write guard rejected database".into());
        }
        let mut restore = fixture.acquire().await?;
        sqlx::raw_sql(AssertSqlSafe(schema))
            .execute(&mut *restore)
            .await
            .map_err(|error| format!("Schema restore failed: {error}"))?;
        // pg_dump changes search_path and other session settings. Reset the same connection
        // before returning it to the fixture pool, rather than letting later SQL inherit them.
        sqlx::query("RESET ALL").execute(&mut *restore).await?;
        drop(restore);
        let rows: i64 = sqlx::query_scalar("select count(*) from titles")
            .fetch_one(&fixture)
            .await?;
        assert_eq!(
            rows, 0,
            "schema-only restore must not contain family catalog data"
        );
        sqlx::raw_sql(include_str!("fixtures/viewer_state.sql"))
            .execute(&fixture)
            .await
            .map_err(|error| format!("Synthetic fixture seed failed: {error}"))?;
        let api_pool = database_pool_from_options(options.database(&name)).await?;
        let result = run_api_suite(fixture.clone(), api_pool.clone()).await;
        api_pool.close().await;
        fixture.close().await;
        result
    })
    .await;
    // The successful CREATE above is the only ownership proof permitting teardown. A preexisting
    // test database is never reused or dropped. A spawned-task panic still reaches this cleanup.
    assert!(valid_database_name(&created_name));
    sqlx::query(AssertSqlSafe(format!(
        "DROP DATABASE \"{created_name}\" WITH (FORCE)"
    )))
    .execute(&maintenance)
    .await?;
    let remains: bool =
        sqlx::query_scalar("select exists(select 1 from pg_database where datname=$1)")
            .bind(&created_name)
            .fetch_one(&maintenance)
            .await?;
    assert!(!remains);
    println!("Removed only the database created by this test; teardown verified.");
    maintenance.close().await;
    task.map_err(|_| "Database test task failed; disposable database was removed")??;
    Ok(())
}

async fn database_pool_from_options(options: PgConnectOptions) -> TestResult<PgPool> {
    // Same defaults as production; no connection-string reconstruction or logging needed.
    Ok(PgPoolOptions::new()
        .max_connections(5)
        .acquire_timeout(Duration::from_secs(2))
        .after_connect(|connection, _| {
            Box::pin(async move {
                sqlx::query("SET default_transaction_read_only=on")
                    .execute(connection)
                    .await?;
                Ok(())
            })
        })
        .connect_with(options)
        .await?)
}
fn token(index: usize) -> String {
    format!("nh1_{index:064x}")
}
async fn sessions(pool: &PgPool) -> TestResult {
    for (index, user, expired) in [
        (1, "viewer_owner_one", false),
        (2, "viewer_owner_two", false),
        (3, "viewer_member", false),
        (4, "viewer_suspended", false),
        (5, "viewer_owner_one", true),
    ] {
        let key = format!(
            "nh1:{}",
            hex::encode(Sha256::digest(token(index).as_bytes()))
        );
        sqlx::query("insert into auth_sessions(id,token,user_id,expires_at) values($1,$2,$3,now()+case when $4 then interval '-1 day' else interval '1 day' end)")
            .bind(format!("fixture-session-{index}")).bind(key).bind(user).bind(expired).execute(pool).await?;
    }
    Ok(())
}
async fn request(
    api: &Router,
    identity: Option<usize>,
    method: Method,
    path: &str,
    body: Option<Value>,
) -> TestResult<(StatusCode, Value)> {
    let mut builder = Request::builder().method(method).uri(path);
    if let Some(identity) = identity {
        builder = builder.header("authorization", format!("Bearer {}", token(identity)));
    }
    let body = if let Some(body) = body {
        builder = builder.header("content-type", "application/json");
        Body::from(serde_json::to_vec(&body)?)
    } else {
        Body::empty()
    };
    let response = api.clone().oneshot(builder.body(body)?).await?;
    let status = response.status();
    let bytes = to_bytes(response.into_body(), 2 * 1024 * 1024).await?;
    Ok((status, serde_json::from_slice(&bytes)?))
}
async fn success(
    api: &Router,
    identity: usize,
    method: Method,
    path: &str,
    body: Option<Value>,
) -> TestResult<Value> {
    let (status, value) = request(api, Some(identity), method, path, body).await?;
    assert_eq!(
        status,
        StatusCode::OK,
        "API request failed: {path}; response={value}"
    );
    Ok(value)
}
async fn state(api: &Router, work: &str, owner: usize) -> TestResult<Value> {
    success(
        api,
        owner,
        Method::GET,
        &format!("/api/v1/works/{work}/state"),
        None,
    )
    .await
}
async fn played(api: &Router, work: &str, selection: Value) -> TestResult<Value> {
    success(
        api,
        1,
        Method::PATCH,
        &format!("/api/v1/works/{work}/watched"),
        Some(selection),
    )
    .await
}
fn unit<'a>(state: &'a Value, installment: &str, episode: Option<&str>) -> &'a Value {
    state["units"]
        .as_array()
        .unwrap()
        .iter()
        .find(|row| {
            row["installmentId"] == installment
                && episode.map_or(row["episodeId"].is_null(), |id| row["episodeId"] == id)
        })
        .expect("canonical unit exists")
}
async fn playback_rows(pool: &PgPool, account: &str) -> TestResult<Value> {
    Ok(sqlx::query_scalar::<_,SqlJson<Value>>("select coalesce(jsonb_agg(to_jsonb(s) order by id),'[]'::jsonb) from account_playback_states s where account_id=$1::uuid")
        .bind(account).fetch_one(pool).await?.0)
}
async fn parity(api: &Router, work: &str, owner: usize) -> TestResult {
    let state = state(api, work, owner).await?;
    let page = success(
        api,
        owner,
        Method::GET,
        "/api/v1/catalog/browse?view=works&pageSize=100&privacy=all",
        None,
    )
    .await?;
    let entry = page["items"]
        .as_array()
        .unwrap()
        .iter()
        .find(|row| row["work"]["id"] == work)
        .unwrap();
    assert_eq!(entry["watchState"], state["summary"]["watchState"]);
    let page = success(
        api,
        owner,
        Method::GET,
        "/api/v1/catalog/browse?view=installments&pageSize=100&privacy=all",
        None,
    )
    .await?;
    for expected in state["installments"].as_array().unwrap() {
        let entry = page["items"]
            .as_array()
            .unwrap()
            .iter()
            .find(|row| row["installment"]["id"] == expected["installmentId"])
            .unwrap();
        assert_eq!(entry["watchState"], expected["summary"]["watchState"]);
    }
    Ok(())
}

async fn run_api_suite(fixture: PgPool, api_pool: PgPool) -> TestResult {
    sessions(&fixture).await?;
    let api = router(api_pool.clone());
    let state_path = format!("/api/v1/works/{WORK}/state");
    for identity in [None, Some(3), Some(4), Some(5)] {
        let (status, _) = request(&api, identity, Method::GET, &state_path, None).await?;
        assert_eq!(status, StatusCode::UNAUTHORIZED);
        let (status, _) = request(
            &api,
            identity,
            Method::PATCH,
            &format!("/api/v1/works/{WORK}/watched"),
            Some(json!({"isPlayed":true})),
        )
        .await?;
        assert_eq!(status, StatusCode::UNAUTHORIZED);
    }
    let read_only: String = sqlx::query_scalar("show default_transaction_read_only")
        .fetch_one(&api_pool)
        .await?;
    assert_eq!(read_only, "on");
    let other_before = playback_rows(&fixture, OTHER).await?;
    let other_state_before = state(&api, WORK, 2).await?;
    let initial = state(&api, WORK, 1).await?;
    assert_eq!(
        initial["summary"],
        json!({"catalogUnits":10,"releasedUnits":4,"watchedReleasedUnits":1,"isFullyWatched":false,"watchState":"in-progress"})
    );
    assert_eq!(
        unit(&initial, MOVIE, None)["playedManually"],
        false,
        "existing automatic watched state remains automatic until an explicit toggle"
    );
    assert_eq!(
        unit(&initial, SEASON, Some(FUTURE_EPISODE))["isReleased"],
        false
    );
    assert_eq!(
        unit(&initial, SEASON, Some(HALF_EPISODE))["isReleased"],
        true
    );
    assert_eq!(
        initial["units"].as_array().unwrap().len(),
        10,
        "movie-attached episode must not double count"
    );
    parity(&api, WORK, 1).await?;
    println!(
        "PASS: real owner authorization, account isolation baseline, released eligibility and work/installment browse parity."
    );

    for is_favorite in [true, false, true] {
        let response = success(
            &api,
            1,
            Method::PUT,
            &format!("/api/v1/works/{WORK}/favorite"),
            Some(json!({"isFavorite":is_favorite})),
        )
        .await?;
        assert_eq!(response["isFavorite"], is_favorite);
        assert_eq!(
            response,
            state(&api, WORK, 1).await?,
            "write returns committed state"
        );
        let saved = sqlx::query_scalar::<_,SqlJson<Value>>("select to_jsonb(s) from account_title_states s where account_id=$1::uuid and title_id=$2::uuid").bind(ACCOUNT).bind(WORK).fetch_one(&fixture).await?.0;
        assert_eq!(saved["personal_rating"], 4);
        assert_eq!(saved["notes"], "ملاحظة شخصية محفوظة");
        assert_eq!(saved["saved_offline"], true);
    }
    let inserted = success(
        &api,
        1,
        Method::PUT,
        &format!("/api/v1/works/{EMPTY}/favorite"),
        Some(json!({"isFavorite":true})),
    )
    .await?;
    assert_eq!(inserted["isFavorite"], true);
    println!(
        "PASS: favorite insert/upsert commits and preserves rating, notes, offline state and other owner."
    );

    let watched = played(
        &api,
        WORK,
        json!({"installmentId":SEASON,"episodeId":EPISODE,"isPlayed":true}),
    )
    .await?;
    let saved = unit(&watched, SEASON, Some(EPISODE));
    assert_eq!(saved["stateId"], "30000000-0000-4000-8000-000000000001");
    assert_eq!(saved["positionSeconds"], 123);
    assert_eq!(saved["durationSeconds"], 1000);
    assert_eq!(saved["subtitleOffsetMs"], -750);
    assert_eq!(saved["playedManually"], true);
    assert_eq!(saved["isPlayed"], true);
    assert!(saved["playedAt"].is_string());
    let repeated = played(
        &api,
        WORK,
        json!({"installmentId":SEASON,"episodeId":EPISODE,"isPlayed":true}),
    )
    .await?;
    assert_eq!(
        unit(&repeated, SEASON, Some(EPISODE))["playedAt"],
        saved["playedAt"]
    );
    let unplayed = played(
        &api,
        WORK,
        json!({"installmentId":SEASON,"episodeId":EPISODE,"isPlayed":false}),
    )
    .await?;
    let saved = unit(&unplayed, SEASON, Some(EPISODE));
    assert_eq!(saved["isPlayed"], false);
    assert_eq!(saved["playedManually"], true);
    assert!(saved["playedAt"].is_null());
    assert_eq!(saved["positionSeconds"], 123);
    let bulk = played(&api, WORK, json!({"installmentId":SEASON,"isPlayed":true})).await?;
    assert!(unit(&bulk, SEASON, Some(HALF_EPISODE))["stateId"].is_string());
    let new_id = unit(&bulk, SEASON, Some(HALF_EPISODE))["stateId"].clone();
    assert_eq!(unit(&bulk, SEASON, Some(FUTURE_EPISODE))["isPlayed"], true);
    assert_eq!(
        unit(&bulk, SEASON, Some(FUTURE_EPISODE))["playedManually"],
        true
    );
    assert_eq!(
        unit(&bulk, SEASON, Some(FUTURE_EPISODE))["isReleased"],
        false
    );
    let bulk = played(&api, WORK, json!({"installmentId":SEASON,"isPlayed":true})).await?;
    assert_eq!(unit(&bulk, SEASON, Some(HALF_EPISODE))["stateId"], new_id);
    for is_played in [false, true, true] {
        let response = played(
            &api,
            WORK,
            json!({"installmentId":MOVIE,"isPlayed":is_played}),
        )
        .await?;
        let saved = unit(&response, MOVIE, None);
        assert_eq!(saved["stateId"], "30000000-0000-4000-8000-000000000002");
        assert_eq!(saved["positionSeconds"], 999);
        assert_eq!(saved["durationSeconds"], 1200);
        assert_eq!(saved["subtitleOffsetMs"], 250);
    }
    let whole = played(&api, WORK, json!({"isPlayed":true})).await?;
    assert_eq!(whole["summary"]["releasedUnits"], 4);
    assert_eq!(whole["summary"]["watchedReleasedUnits"], 4);
    assert_eq!(whole["summary"]["isFullyWatched"], true);
    assert!(
        whole["units"]
            .as_array()
            .unwrap()
            .iter()
            .all(|row| row["isPlayed"] == true && row["playedManually"] == true)
    );
    assert_eq!(whole, state(&api, WORK, 1).await?);
    parity(&api, WORK, 1).await?;
    println!(
        "PASS: actual episode/movie/season/work inserts and repeated upserts preserve UUID/progress/subtitle offset; manual future units are returned, not counted as released."
    );

    let before = playback_rows(&fixture, ACCOUNT).await?;
    for (input, expected) in [
        (
            json!({"installmentId":"40000000-0000-4000-8000-000000000009","isPlayed":false}),
            StatusCode::NOT_FOUND,
        ),
        (
            json!({"installmentId":SEASON,"episodeId":"50000000-0000-4000-8000-000000000008","isPlayed":false}),
            StatusCode::NOT_FOUND,
        ),
        (
            json!({"installmentId":SEASON,"episodeId":"50000000-0000-4000-8000-000000000004","isPlayed":false}),
            StatusCode::NOT_FOUND,
        ),
        (
            json!({"installmentId":MOVIE,"episodeId":"50000000-0000-4000-8000-000000000007","isPlayed":false}),
            StatusCode::BAD_REQUEST,
        ),
        (
            json!({"episodeId":EPISODE,"isPlayed":false}),
            StatusCode::BAD_REQUEST,
        ),
        (
            json!({"accountId":OTHER,"isPlayed":false}),
            StatusCode::BAD_REQUEST,
        ),
    ] {
        let (status, _) = request(
            &api,
            Some(1),
            Method::PATCH,
            &format!("/api/v1/works/{WORK}/watched"),
            Some(input),
        )
        .await?;
        assert_eq!(status, expected);
        assert_eq!(playback_rows(&fixture, ACCOUNT).await?, before);
    }
    // Fail AFTER a previous row has been updated in the same INSERT/UPSERT statement.
    sqlx::raw_sql("create function viewer_test_fail_second() returns trigger language plpgsql as $$ begin if NEW.episode_id='50000000-0000-4000-8000-000000000002'::uuid then raise exception 'disposable injected failure'; end if; return NEW; end $$; create trigger viewer_test_fail_second before insert or update on account_playback_states for each row execute function viewer_test_fail_second();").execute(&fixture).await?;
    let (status, _) = request(
        &api,
        Some(1),
        Method::PATCH,
        &format!("/api/v1/works/{WORK}/watched"),
        Some(json!({"isPlayed":false})),
    )
    .await?;
    assert_eq!(status, StatusCode::SERVICE_UNAVAILABLE);
    assert_eq!(
        playback_rows(&fixture, ACCOUNT).await?,
        before,
        "a mid-bulk SQL failure must roll back every touched row and timestamp"
    );
    sqlx::raw_sql("drop trigger viewer_test_fail_second on account_playback_states; drop function viewer_test_fail_second();").execute(&fixture).await?;
    // Also prove rollback when the mutation succeeds but reading its returned snapshot fails.
    sqlx::raw_sql("create function viewer_test_fail_snapshot() returns trigger language plpgsql as $$ begin execute 'alter table account_playback_states rename column subtitle_offset_ms to viewer_test_hidden_offset'; return NEW; end $$; create trigger viewer_test_fail_snapshot after insert or update on account_title_states for each row execute function viewer_test_fail_snapshot();").execute(&fixture).await?;
    let (status, _) = request(
        &api,
        Some(1),
        Method::PUT,
        &format!("/api/v1/works/{WORK}/favorite"),
        Some(json!({"isFavorite":false})),
    )
    .await?;
    assert_eq!(status, StatusCode::SERVICE_UNAVAILABLE);
    assert_eq!(
        state(&api, WORK, 1).await?["isFavorite"],
        true,
        "snapshot failure must roll back the favorite write and fixture DDL"
    );
    sqlx::raw_sql("drop trigger viewer_test_fail_snapshot on account_title_states; drop function viewer_test_fail_snapshot();").execute(&fixture).await?;
    assert_eq!(playback_rows(&fixture, OTHER).await?, other_before);
    assert_eq!(state(&api, WORK, 2).await?, other_state_before);
    println!(
        "PASS: ancestry/type/ownership rejection, mid-bulk and post-write snapshot atomic rollback; other owner remains byte-for-byte unchanged."
    );

    for (work, catalog_units) in [(EMPTY, 0), (FUTURE, 2), (UNKNOWN, 1)] {
        let response = played(&api, work, json!({"isPlayed":true})).await?;
        assert_eq!(response["summary"]["catalogUnits"], catalog_units);
        assert_eq!(response["summary"]["releasedUnits"], 0);
        assert_eq!(response["summary"]["watchedReleasedUnits"], 0);
        assert_eq!(response["summary"]["isFullyWatched"], false);
        parity(&api, work, 1).await?;
    }
    let empty_season = whole["installments"]
        .as_array()
        .unwrap()
        .iter()
        .find(|row| row["installmentId"] == "40000000-0000-4000-8000-000000000008")
        .unwrap();
    assert_eq!(empty_season["summary"]["catalogUnits"], 0);
    assert_eq!(empty_season["summary"]["isFullyWatched"], false);
    let final_state = played(&api, WORK, json!({"isPlayed":false})).await?;
    assert_eq!(final_state["summary"]["watchedReleasedUnits"], 0);
    assert!(
        final_state["units"]
            .as_array()
            .unwrap()
            .iter()
            .all(|row| row["isPlayed"] == false
                && row["playedManually"] == true
                && row["playedAt"].is_null())
    );
    parity(&api, WORK, 1).await?;
    let rows: i64 = sqlx::query_scalar("select count(*) from account_playback_states where account_id=$1::uuid and installment_id=$2::uuid and episode_id is null").bind(ACCOUNT).bind(MOVIE).fetch_one(&fixture).await?;
    assert_eq!(
        rows, 1,
        "null-safe movie uniqueness is enforced by restored production schema"
    );
    println!(
        "PASS: empty work/season, unknown/future eligibility, all-unwatched state and browse parity, null-safe uniqueness."
    );
    Ok(())
}

#[test]
#[ignore = "explicit opt-in; representative live catalog reads only through the native Nahhasio CLI"]
fn representative_live_work_payload_sizes() -> TestResult {
    if env::var("NAHHASIO_RUN_VIEWER_READONLY_REPORT").as_deref() != Ok("1") {
        return Err(
            "Set NAHHASIO_RUN_VIEWER_READONLY_REPORT=1 for read-only catalog reporting".into(),
        );
    }
    let workspace = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..");
    assert!(detail_sql::FILTER.contains("not t.is_private"));
    let summary = detail_sql::summary();
    let detail = detail_sql::DETAIL;
    let largest = format!(
        "select t.id,t.canonical_title,octet_length(convert_to(({summary} || ({detail}))::text,'UTF8')) as estimated_bytes from titles t order by estimated_bytes desc,t.id limit 1"
    );
    let output = Command::new(workspace.join("bin/nahhasio"))
        .current_dir(&workspace)
        .args(["sql", &largest, "--json"])
        .output()?;
    if !output.status.success() {
        return Err("Read-only largest-payload query failed; details withheld".into());
    }
    let rows: Vec<Value> = serde_json::from_slice(&output.stdout)?;
    let largest_id = rows[0]["id"].as_str().ok_or("Missing largest work ID")?;
    if !largest_id
        .bytes()
        .all(|c| c.is_ascii_hexdigit() || c == b'-')
    {
        return Err("Invalid report ID".into());
    }
    let query = format!(
        "select t.canonical_title,({summary} || ({detail})) as detail from titles t where t.id in ('4e0a92e1-ad91-461a-a6fc-8c6f8483d46c','98d9ce9c-c10b-413b-99f4-b0260191fa95','a5474669-5b6c-4c7f-af53-a83431e36fdf','{largest_id}') order by t.canonical_title"
    );
    let output = Command::new(workspace.join("bin/nahhasio"))
        .current_dir(&workspace)
        .args(["sql", &query, "--json"])
        .output()?;
    if !output.status.success() {
        return Err("Read-only detail report failed; details withheld".into());
    }
    let rows: Vec<Value> = serde_json::from_slice(&output.stdout)?;
    for row in rows {
        let bytes = serde_json::to_vec(&row["detail"])?.len();
        println!(
            "READ ONLY payload: {} | episodes={} | installments={} | compact UTF-8={} bytes | native 2MiB limit={} | exceeds={}",
            row["canonical_title"].as_str().unwrap_or("unnamed"),
            row["detail"]["episodeCount"],
            row["detail"]["installmentCount"],
            bytes,
            2 * 1024 * 1024,
            bytes > 2 * 1024 * 1024
        );
    }
    println!(
        "Largest catalog payload candidate scanned across all titles using production detail SQL; no live session or writes."
    );
    Ok(())
}
