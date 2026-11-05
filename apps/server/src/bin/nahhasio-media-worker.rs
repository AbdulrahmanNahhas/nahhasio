#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt().init();
    let url = std::env::var("DATABASE_URL").map_err(|_| "DATABASE_URL is required")?;
    let pool =
        nahhasio_server::database_pool(&url).map_err(|_| "Invalid media database configuration")?;
    nahhasio_server::run_media_worker(pool).await
}
