//! Dashboard adapter for the shared read-only installation diagnostics.
use super::*;

pub(super) async fn inspect(pool: &PgPool, config: Option<PathBuf>) -> Result<Value, Error> {
    let mut connection = pool.acquire().await?;
    let checks = nahhasio_catalog::deployment::inspect(
        &mut connection,
        nahhasio_catalog::storage::ArtworkRoots::configured(),
        config,
    )
    .await
    .map_err(|_| Error(StatusCode::SERVICE_UNAVAILABLE, "تعذّر فحص تجهيز الخادم."))?;
    Ok(json!(checks))
}
