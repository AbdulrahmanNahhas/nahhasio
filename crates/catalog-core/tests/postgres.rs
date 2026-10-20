//! Run only through bin/test-rust-catalog, which owns a private PostgreSQL cluster.
use nahhasio_catalog::{
    database_pool, migrations,
    records::{self, Mutation, Page, Selection},
    schema,
};
use serde_json::json;

#[tokio::test]
#[ignore = "requires the disposable cluster created by bin/test-rust-catalog"]
async fn postgres_transaction_and_migration_acceptance() {
    // Deliberately no DATABASE_URL fallback, even when the developer shell sets it.
    let url = std::env::var("NAHHASIO_TEST_DATABASE_URL").expect("isolated test URL");
    let options: sqlx::postgres::PgConnectOptions = url.parse().unwrap();
    assert_eq!(options.get_database(), Some("nahhasio_test_catalog"));
    assert!(
        options.get_socket().is_some(),
        "fixtures require a private Unix socket"
    );
    let pool = database_pool(&url, 2).unwrap();
    let mut connection = pool.acquire().await.unwrap();
    assert_eq!(
        sqlx::query_scalar::<_, String>("show default_transaction_read_only")
            .fetch_one(&mut *connection)
            .await
            .unwrap(),
        "on"
    );
    assert!(
        sqlx::query("create table must_not_exist(id int)")
            .execute(&mut *connection)
            .await
            .is_err()
    );
    assert!(
        !migrations::status(&mut connection, &migrations::bundled().unwrap())
            .await
            .unwrap()
            .pending
            .is_empty()
    );

    // Exercise the actual bundled history against a completely empty database. This records
    // any historical bootstrap limitation separately from the runner's ledger compatibility.
    let mut tx = pool.begin().await.unwrap();
    sqlx::query("set transaction read write")
        .execute(&mut *tx)
        .await
        .unwrap();
    migrations::apply(&mut tx, &migrations::bundled().unwrap())
        .await
        .expect("existing history must bootstrap an empty database");
    tx.rollback().await.unwrap();
    assert!(
        sqlx::query_scalar::<_, bool>("select to_regclass('drizzle.__drizzle_migrations') is null")
            .fetch_one(&mut *connection)
            .await
            .unwrap()
    );
    sqlx::query("select pg_advisory_lock(23103,1000)")
        .execute(&mut *connection)
        .await
        .unwrap();
    let mut tx = pool.begin().await.unwrap();
    sqlx::query("set transaction read write")
        .execute(&mut *tx)
        .await
        .unwrap();
    assert!(
        migrations::apply(&mut tx, &migrations::bundled().unwrap())
            .await
            .is_err(),
        "the shared maintenance lock excludes another runner"
    );
    tx.rollback().await.unwrap();
    sqlx::query("select pg_advisory_unlock(23103,1000)")
        .execute(&mut *connection)
        .await
        .unwrap();

    // Minimal fixtures exercise generic operations without changing the family catalog.
    let fixture = r#"
      create table accounts(id uuid primary key default gen_random_uuid(),slug text,display_name text);
      create table audit_logs(id uuid primary key default gen_random_uuid(),actor_account_id uuid references accounts,action text,target_type text,summary text,changes jsonb);
      create table entities(id uuid primary key default gen_random_uuid(),kind text not null,name text not null,api_key text);
      create table entity_aliases(entity_id uuid references entities,alias text);
      create table titles(id uuid primary key default gen_random_uuid(),canonical_title text not null,release_year int check(release_year>1800),updated_at timestamptz default now());
      create table title_aliases(title_id uuid references titles,title text);
      insert into entities(kind,name,api_key) values('person','Fixture Person','fixture-private'),('organization','Fixture Studio','fixture-private');
      insert into titles(canonical_title,release_year) values('Fixture One',2024),('Fixture Two',2025);
      insert into title_aliases select id,'الاسم البديل' from titles where canonical_title='Fixture One';
    "#;
    let mut tx = pool.begin().await.unwrap();
    sqlx::query("set transaction read write")
        .execute(&mut *tx)
        .await
        .unwrap();
    sqlx::raw_sql(sqlx::AssertSqlSafe(fixture))
        .execute(&mut *tx)
        .await
        .unwrap();
    tx.commit().await.unwrap();
    assert!(
        migrations::status(&mut connection, &migrations::bundled().unwrap())
            .await
            .is_err(),
        "never guess a baseline for unjournalled tables"
    );
    let tables = schema::load(&mut connection).await.unwrap();
    let titles = tables.iter().find(|table| table.name == "titles").unwrap();
    let entities = tables
        .iter()
        .find(|table| table.name == "entities")
        .unwrap();
    let one = records::resolve(&mut connection, titles, "الاسم البديل", None)
        .await
        .unwrap();
    assert!(
        records::resolve(&mut connection, titles, "Fixture", None)
            .await
            .is_err()
    );
    assert!(
        records::resolve(
            &mut connection,
            entities,
            "Fixture Studio",
            Some(("kind".into(), "person".into()))
        )
        .await
        .is_err()
    );
    let secret = records::list(
        &mut connection,
        entities,
        &Selection::default(),
        &Page::default(),
    )
    .await
    .unwrap();
    assert!(!secret.to_string().contains("fixture-private"));
    assert!(secret.to_string().contains("[protected]"));
    let selection = Selection {
        filters: vec![format!("id={one}")],
        ..Default::default()
    };
    let by_year = Selection {
        filters: vec!["release_year>=2025".into()],
        ..Default::default()
    };
    let list = records::list(&mut connection, titles, &by_year, &Page::default())
        .await
        .unwrap();
    assert_eq!(list.as_array().unwrap().len(), 1);
    let pattern = Selection {
        filters: vec!["canonical_title=');drop table titles;--".into()],
        ..Default::default()
    };
    assert_eq!(
        records::list(&mut connection, titles, &pattern, &Page::default())
            .await
            .unwrap(),
        json!([])
    );

    let mut tx = pool.begin().await.unwrap();
    sqlx::query("set transaction isolation level serializable, read write")
        .execute(&mut *tx)
        .await
        .unwrap();
    let private = json!({"api_key":"must-not-be-written"});
    assert!(
        records::mutate(
            &mut tx,
            entities,
            &Selection::default(),
            private.as_object().unwrap(),
            Mutation::Create,
            false,
            None
        )
        .await
        .is_err()
    );
    let new = json!({"canonical_title":"Created Fixture","release_year":2026});
    let created = records::mutate(
        &mut tx,
        titles,
        &Selection::default(),
        new.as_object().unwrap(),
        Mutation::Create,
        false,
        None,
    )
    .await
    .unwrap();
    assert_eq!(created["affected"], 1);
    let remove = Selection {
        filters: vec![format!("id={}", created["rows"][0]["id"].as_str().unwrap())],
        ..Default::default()
    };
    assert_eq!(
        records::mutate(
            &mut tx,
            titles,
            &remove,
            &serde_json::Map::new(),
            Mutation::Delete,
            false,
            None
        )
        .await
        .unwrap()["affected"],
        1
    );
    let all = Selection {
        filters: vec!["release_year>=2024".into()],
        ..Default::default()
    };
    assert!(
        records::mutate(
            &mut tx,
            titles,
            &all,
            &serde_json::Map::new(),
            Mutation::Delete,
            false,
            None
        )
        .await
        .is_err()
    );
    tx.rollback().await.unwrap();

    let mut tx = pool.begin().await.unwrap();
    sqlx::query("set transaction isolation level serializable, read write")
        .execute(&mut *tx)
        .await
        .unwrap();
    let patch = json!({"canonical_title":"Edited Fixture"});
    assert!(
        records::mutate(
            &mut tx,
            titles,
            &Selection::default(),
            patch.as_object().unwrap(),
            Mutation::Update,
            false,
            None
        )
        .await
        .is_err()
    );
    let result = records::mutate(
        &mut tx,
        titles,
        &selection,
        patch.as_object().unwrap(),
        Mutation::Update,
        false,
        None,
    )
    .await
    .unwrap();
    assert_eq!(result["affected"], 1);
    tx.rollback().await.unwrap();
    assert_eq!(
        records::resolve(&mut connection, titles, "Fixture One", None)
            .await
            .unwrap(),
        one
    );
    assert_eq!(
        sqlx::query_scalar::<_, i64>("select count(*) from audit_logs")
            .fetch_one(&mut *connection)
            .await
            .unwrap(),
        0
    );

    let mut tx = pool.begin().await.unwrap();
    sqlx::query("set transaction isolation level serializable, read write")
        .execute(&mut *tx)
        .await
        .unwrap();
    records::mutate(
        &mut tx,
        titles,
        &selection,
        patch.as_object().unwrap(),
        Mutation::Update,
        false,
        None,
    )
    .await
    .unwrap();
    tx.commit().await.unwrap();
    assert_eq!(
        records::resolve(&mut connection, titles, "Edited Fixture", None)
            .await
            .unwrap(),
        one
    );
    assert_eq!(
        sqlx::query_scalar::<_, i64>("select count(*) from audit_logs")
            .fetch_one(&mut *connection)
            .await
            .unwrap(),
        1
    );

    // A CTE cannot commit or issue a second statement to escape a dry run.
    for statement in [
        "COMMIT",
        "select 1); COMMIT; select 2",
        "update titles set canonical_title='Nope' returning *",
    ] {
        let mut tx = pool.begin().await.unwrap();
        assert!(records::sql(&mut tx, statement).await.is_err());
        tx.rollback().await.unwrap();
    }
    let mut tx = pool.begin().await.unwrap();
    sqlx::query("set transaction read write")
        .execute(&mut *tx)
        .await
        .unwrap();
    assert_eq!(
        records::sql(
            &mut tx,
            "update titles set release_year=2026 returning release_year"
        )
        .await
        .unwrap()
        .as_array()
        .unwrap()
        .len(),
        2
    );
    tx.rollback().await.unwrap();
    assert_eq!(
        sqlx::query_scalar::<_, i32>("select max(release_year) from titles")
            .fetch_one(&mut *connection)
            .await
            .unwrap(),
        2025
    );
    drop(connection);
    pool.close().await;
}
