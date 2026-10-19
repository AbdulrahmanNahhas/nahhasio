//! Explicit migration execution, compatible with the existing Drizzle ledger.
//! The single checked-in history is embedded in release binaries; SQLx's separate migrator
//! and `_sqlx_migrations` are deliberately not used.
use crate::{Result, invalid};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use sqlx::PgConnection;

const JOURNAL: &str = include_str!("../../../packages/database/drizzle/meta/_journal.json");
const SOURCES: &[(&str, &str)] = include!(concat!(env!("OUT_DIR"), "/migrations.rs"));

#[derive(Deserialize)]
struct Journal {
    dialect: String,
    entries: Vec<Entry>,
}
#[derive(Deserialize)]
struct Entry {
    idx: usize,
    when: i64,
    tag: String,
}

pub struct Migration {
    pub tag: String,
    pub when: i64,
    pub hash: String,
    sql: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Status {
    pub applied: usize,
    pub pending: Vec<String>,
}

pub fn bundled() -> Result<Vec<Migration>> {
    parse(JOURNAL, SOURCES)
}

fn parse(journal: &str, sources: &[(&str, &str)]) -> Result<Vec<Migration>> {
    let journal: Journal = serde_json::from_str(journal)?;
    if journal.dialect != "postgresql" {
        return Err(invalid("migration journal is not PostgreSQL"));
    }
    let mut output = Vec::<Migration>::new();
    for entry in journal.entries {
        if entry.idx != output.len()
            || entry.when <= 0
            || output
                .last()
                .is_some_and(|previous| previous.when >= entry.when)
            || !entry
                .tag
                .bytes()
                .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == b'_')
            || output.iter().any(|previous| previous.tag == entry.tag)
        {
            return Err(invalid("migration journal order or identity is invalid"));
        }
        let sql = sources
            .iter()
            .find(|(tag, _)| *tag == entry.tag)
            .map(|(_, sql)| *sql)
            .ok_or_else(|| invalid("migration source missing from artifact"))?;
        output.push(Migration {
            tag: entry.tag,
            when: entry.when,
            hash: hex::encode(Sha256::digest(sql.as_bytes())),
            sql: sql.into(),
        });
    }
    if output.is_empty() {
        return Err(invalid("migration journal is empty"));
    }
    Ok(output)
}

fn check(history: &[Migration], applied: &[(String, Option<i64>)]) -> Result<Status> {
    for (index, (hash, when)) in applied.iter().enumerate() {
        let migration = history
            .get(index)
            .ok_or_else(|| invalid("database is newer than this artifact"))?;
        if Some(migration.when) != *when || migration.hash != *hash {
            return Err(invalid(format!(
                "migration history mismatch at {}; inspect recovery records before proceeding",
                migration.tag
            )));
        }
    }
    Ok(Status {
        applied: applied.len(),
        pending: history
            .iter()
            .skip(applied.len())
            .map(|migration| migration.tag.clone())
            .collect(),
    })
}

pub async fn status(connection: &mut PgConnection, history: &[Migration]) -> Result<Status> {
    let exists = sqlx::query_scalar::<_, bool>(
        "select to_regclass('drizzle.__drizzle_migrations') is not null",
    )
    .fetch_one(&mut *connection)
    .await?;
    let applied = if exists {
        sqlx::query_as::<_, (String, Option<i64>)>(
            "select hash,created_at from drizzle.__drizzle_migrations order by created_at,id",
        )
        .fetch_all(&mut *connection)
        .await?
    } else {
        vec![]
    };
    if applied.is_empty() {
        let tables=sqlx::query_scalar::<_,i64>("select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE'").fetch_one(connection).await?;
        if tables > 0 {
            return Err(invalid(
                "database contains tables without a migration ledger; explicit baseline review is required",
            ));
        }
    }
    check(history, &applied)
}

/// Must run in a caller-owned READ WRITE transaction. The maintenance lock is shared with
/// the existing Node runner; a rollback removes all SQL and ledger inserts together.
pub async fn apply(connection: &mut PgConnection, history: &[Migration]) -> Result<Status> {
    let acquired = sqlx::query_scalar::<_, bool>("select pg_try_advisory_xact_lock(23103,1000)")
        .fetch_one(&mut *connection)
        .await?;
    if !acquired {
        return Err(invalid("another schema maintenance operation is running"));
    }
    let current = status(connection, history).await?;
    if current.pending.is_empty() {
        return Ok(current);
    }
    sqlx::query("SET LOCAL statement_timeout = '5min'")
        .execute(&mut *connection)
        .await?;
    sqlx::query("create schema if not exists drizzle")
        .execute(&mut *connection)
        .await?;
    sqlx::query("create table if not exists drizzle.__drizzle_migrations (id serial primary key, hash text not null, created_at bigint)").execute(&mut *connection).await?;
    for migration in history.iter().skip(current.applied) {
        // Execute the same breakpoints as Drizzle. Sources are trusted, compiled release
        // content, never text received over HTTP or arguments supplied by an app user.
        for statement in migration
            .sql
            .split("--> statement-breakpoint")
            .filter(|statement| !statement.trim().is_empty())
        {
            sqlx::raw_sql(sqlx::AssertSqlSafe(statement))
                .execute(&mut *connection)
                .await?;
        }
        sqlx::query("insert into drizzle.__drizzle_migrations(hash,created_at) values($1,$2)")
            .bind(&migration.hash)
            .bind(migration.when)
            .execute(&mut *connection)
            .await?;
    }
    // Output describes the post-migration state; the caller must still commit or roll back.
    Ok(Status {
        applied: history.len(),
        pending: vec![],
    })
}

/// Deployment tooling can compare this immutable artifact identity before an upgrade.
pub fn manifest(history: &[Migration]) -> serde_json::Value {
    serde_json::json!(history.iter().map(|migration|serde_json::json!({"tag":migration.tag,"when":migration.when,"hash":migration.hash})).collect::<Vec<_>>())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn bundles_exactly_the_existing_history() {
        let history = bundled().unwrap();
        assert_eq!(history.len(), SOURCES.len());
        assert!(history.iter().all(|entry| entry.hash.len() == 64));
    }
    #[test]
    fn rejects_changed_unknown_reordered_or_missing_applied_migrations() {
        let history = bundled().unwrap();
        let first = &history[0];
        assert!(check(&history, &[("bad".into(), Some(first.when))]).is_err());
        assert!(
            check(
                &history,
                &[(history[1].hash.clone(), Some(history[1].when))]
            )
            .is_err()
        );
        assert!(check(&history, &[(first.hash.clone(), None)]).is_err());
        assert_eq!(
            check(&history, &[(first.hash.clone(), Some(first.when))])
                .unwrap()
                .applied,
            1
        );
        assert!(
            parse(
                r#"{"dialect":"postgresql","entries":[{"idx":0,"when":1,"tag":"../escape"}]}"#,
                &[]
            )
            .is_err()
        );
    }
}
