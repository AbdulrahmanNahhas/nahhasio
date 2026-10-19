//! Shared database operations for the server and trusted, local operator CLI.
//! No network listener, GUI, environment defaults, migration-on-startup or secret logging.
pub mod migrations;
pub mod planets;
pub mod records;
pub mod redaction;
pub mod schema;

use sqlx::{PgPool, postgres::PgPoolOptions};
use std::time::Duration;

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("{0}")]
    Invalid(String),
    #[error("{0}")]
    Conflict(String),
    // PostgreSQL diagnostics can contain record values and credentials. Callers only receive
    // the SQLSTATE; retain the source for classification without displaying its message.
    #[error("database operation failed (SQLSTATE {})", .0.as_database_error().and_then(|e| e.code()).as_deref().unwrap_or("unavailable"))]
    Database(#[from] sqlx::Error),
    #[error("could not access the requested file")]
    Io(#[from] std::io::Error),
    #[error("invalid JSON document")]
    Json(#[from] serde_json::Error),
}
pub type Result<T> = std::result::Result<T, Error>;

/// Connections are bounded and default to read-only, including after a pooled transaction.
/// Network services must authorize a caller before opening a read-write transaction.
pub fn database_pool(
    database_url: &str,
    connections: u32,
) -> std::result::Result<PgPool, sqlx::Error> {
    PgPoolOptions::new()
        .max_connections(connections.clamp(1, 16))
        .acquire_timeout(Duration::from_secs(2))
        .after_connect(|connection, _| {
            Box::pin(async move {
                for statement in [
                    "SET default_transaction_read_only = on",
                    "SET statement_timeout = '30s'",
                    "SET lock_timeout = '5s'",
                ] {
                    sqlx::query(statement).execute(&mut *connection).await?;
                }
                Ok(())
            })
        })
        .connect_lazy(database_url)
}

pub(crate) fn invalid(message: impl Into<String>) -> Error {
    Error::Invalid(message.into())
}
