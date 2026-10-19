mod admin;
mod auth;
mod catalog;
mod database;
use axum::{Json, Router, extract::State, http::StatusCode, routing::get};
use serde::Serialize;
use sqlx::PgPool;
use tower_http::trace::TraceLayer;

/// Sessions default to read-only. Authorized mutation transactions explicitly opt into writes.
pub fn database_pool(database_url: &str) -> Result<PgPool, sqlx::Error> {
    nahhasio_catalog::database_pool(database_url, 5)
}

pub fn router(pool: PgPool) -> Router {
    router_with_admin(pool, None)
}

pub fn router_with_admin(pool: PgPool, token: Option<String>) -> Router {
    let catalog = database::routes(pool.clone(), token);
    let client = catalog::routes(pool.clone()).route_layer(axum::middleware::from_fn_with_state(
        pool.clone(),
        auth::require_viewer,
    ));
    let admin = admin::routes(pool.clone());
    let auth = auth::routes(pool.clone());
    Router::new()
        .route("/api/v1/server/info", get(server_info))
        .route("/api/health/live", get(live))
        .route("/api/health/ready", get(ready))
        .layer(TraceLayer::new_for_http())
        .with_state(pool)
        .merge(catalog)
        .merge(client)
        .merge(auth)
        .merge(admin)
}

async fn server_info(State(pool): State<PgPool>) -> Result<Json<serde_json::Value>, StatusCode> {
    let (id, name): (String, String) =
        sqlx::query_as("select id::text,name from server_instance where singleton")
            .fetch_one(&pool)
            .await
            .map_err(|_| StatusCode::SERVICE_UNAVAILABLE)?;
    Ok(Json(
        serde_json::json!({"product":"nahhasio","serverId":id,"name":name,"version":env!("CARGO_PKG_VERSION"),"apiVersion":1}),
    ))
}

#[derive(Serialize)]
struct Health {
    status: &'static str,
}

async fn live() -> Json<Health> {
    Json(Health { status: "alive" })
}

async fn ready(State(pool): State<PgPool>) -> (StatusCode, Json<Health>) {
    match sqlx::query("SELECT 1").execute(&pool).await {
        Ok(_) => (StatusCode::OK, Json(Health { status: "ready" })),
        Err(error) => {
            if let sqlx::Error::Database(database_error) = &error {
                tracing::warn!(
                    code = database_error.code().as_deref().unwrap_or("unknown"),
                    message = database_error.message(),
                    "database readiness check failed"
                );
            } else {
                tracing::warn!(kind = ?std::mem::discriminant(&error), "database readiness check failed");
            }
            (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(Health {
                    status: "unavailable",
                }),
            )
        }
    }
}

#[cfg(test)]
mod tests {
    use axum::{body::Body, http::Request};
    use tower::ServiceExt;

    use super::*;

    fn unavailable_database() -> PgPool {
        database_pool("postgresql://127.0.0.1:1/nahhasio_test").expect("valid fixture URL")
    }

    #[tokio::test]
    async fn database_admin_requires_the_private_token() {
        for token in [None, Some("wrong")] {
            let mut request = Request::get("/api/database/schema");
            if let Some(value) = token {
                request = request.header("x-nahhasio-admin", value);
            }
            let response =
                router_with_admin(unavailable_database(), Some("fixture-private-token".into()))
                    .oneshot(request.body(Body::empty()).unwrap())
                    .await
                    .unwrap();
            assert_eq!(response.status(), StatusCode::FORBIDDEN);
        }
    }

    #[tokio::test]
    async fn liveness_does_not_depend_on_database_availability() {
        let response = router(unavailable_database())
            .oneshot(
                Request::get("/api/health/live")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn readiness_reports_unavailable_database() {
        let response = router(unavailable_database())
            .oneshot(
                Request::get("/api/health/ready")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::SERVICE_UNAVAILABLE);
    }

    #[tokio::test]
    async fn catalog_requires_authentication() {
        for path in [
            "/api/v1/works",
            "/api/v1/catalog/home",
            "/api/v1/works/00112233-4455-6677-8899-aabbccddeeff/state",
            "/api/v1/works/00112233-4455-6677-8899-aabbccddeeff/activity",
        ] {
            let response = router(unavailable_database())
                .oneshot(Request::get(path).body(Body::empty()).unwrap())
                .await
                .unwrap();
            assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
        }
        for (method, suffix) in [("PUT", "favorite"), ("PATCH", "watched")] {
            let response = router(unavailable_database())
                .oneshot(
                    Request::builder()
                        .method(method)
                        .uri(format!(
                            "/api/v1/works/00112233-4455-6677-8899-aabbccddeeff/{suffix}"
                        ))
                        .header("content-type", "application/json")
                        .body(Body::from("{}"))
                        .unwrap(),
                )
                .await
                .unwrap();
            assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
        }
    }
}
