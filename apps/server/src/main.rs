use std::{env, error::Error, net::SocketAddr, time::Duration};

use nahhasio_server::{database_pool, router_with_admin};
use tokio::net::TcpListener;
use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()))
        .init();

    let address: SocketAddr = env::var("NAHHASIO_BIND")
        .unwrap_or_else(|_| "127.0.0.1:23103".to_owned())
        .parse()?;
    let database_url = env::var("DATABASE_URL").map_err(|_| "DATABASE_URL is required")?;
    let pool = database_pool(&database_url).map_err(|_| "DATABASE_URL is invalid")?;
    let local_admin = env::var("NAHHASIO_LOCAL_ADMIN").as_deref() == Ok("true");
    if local_admin && (!cfg!(debug_assertions) || !address.ip().is_loopback()) {
        return Err("Local administration requires a debug build bound to loopback".into());
    }
    let token = if local_admin {
        Some(env::var("NAHHASIO_LOCAL_ADMIN_TOKEN").map_err(|_| "Local admin token is required")?)
    } else {
        None
    };
    if token.as_ref().is_some_and(|value| value.len() < 32) {
        return Err("Local admin token must contain at least 32 characters".into());
    }
    let app = router_with_admin(pool.clone(), token);
    match (
        env::var_os("NAHHASIO_TLS_CERT"),
        env::var_os("NAHHASIO_TLS_KEY"),
    ) {
        (Some(cert), Some(key)) => {
            // Other workspace HTTP clients enable ring as well; select one provider explicitly.
            rustls::crypto::aws_lc_rs::default_provider()
                .install_default()
                .map_err(|_| "Could not install the server TLS provider")?;
            let tls = axum_server::tls_rustls::RustlsConfig::from_pem_file(cert, key).await?;
            let handle = axum_server::Handle::new();
            let shutdown_handle = handle.clone();
            tokio::spawn(async move {
                shutdown().await;
                shutdown_handle.graceful_shutdown(Some(Duration::from_secs(20)));
            });
            tracing::info!(%address, "Nahhasio HTTPS server listening");
            axum_server::bind_rustls(address, tls)
                .handle(handle)
                .serve(app.into_make_service())
                .await?;
        }
        (None, None) if address.ip().is_loopback() => {
            let listener = TcpListener::bind(address).await?;
            tracing::info!(%address, "Nahhasio loopback development server listening");
            axum::serve(listener, app)
                .with_graceful_shutdown(shutdown())
                .await?;
        }
        (None, None) => {
            return Err(
                "Non-loopback listeners require NAHHASIO_TLS_CERT and NAHHASIO_TLS_KEY".into(),
            );
        }
        _ => {
            return Err(
                "NAHHASIO_TLS_CERT and NAHHASIO_TLS_KEY must be configured together".into(),
            );
        }
    }
    pool.close().await;
    Ok(())
}

async fn shutdown() {
    let interrupt = async {
        if let Err(error) = tokio::signal::ctrl_c().await {
            tracing::error!(%error, "failed to install interrupt handler");
        }
    };
    #[cfg(unix)]
    let terminate = async {
        match tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate()) {
            Ok(mut signal) => {
                signal.recv().await;
            }
            Err(error) => {
                tracing::error!(%error, "failed to install termination handler");
            }
        }
    };
    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        () = interrupt => {},
        () = terminate => {},
    }
}
