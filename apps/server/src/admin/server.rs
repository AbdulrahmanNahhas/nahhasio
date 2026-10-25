//! Real server administration. Fixed operations, bounded queries, no arbitrary paths or secrets.
mod checks;
mod operations;
use super::{Error, no_store};
use axum::{
    Json, Router,
    extract::{DefaultBodyLimit, State},
    http::{HeaderMap, StatusCode},
    middleware,
    routing::get,
};
use nahhasio_catalog::{migrations, provider_config};
use serde::Deserialize;
use serde_json::{Value, json};
use sqlx::{PgPool, Row};
use std::{path::PathBuf, time::Instant};

#[derive(Clone)]
struct Services {
    pool: PgPool,
    started: Instant,
    config: Option<PathBuf>,
}
pub(super) fn routes(pool: PgPool) -> Router {
    Router::new()
        .route("/api/v1/admin/server/overview", get(overview))
        .route("/api/v1/admin/server/settings", get(settings).patch(rename))
        .route(
            "/api/v1/admin/server/providers",
            axum::routing::put(providers),
        )
        .route_layer(middleware::from_fn_with_state(
            pool.clone(),
            crate::auth::require_admin,
        ))
        .layer(DefaultBodyLimit::max(8192))
        .layer(middleware::from_fn(no_store))
        .with_state(Services {
            pool: pool.clone(),
            started: Instant::now(),
            config: provider_config::root(),
        })
        .merge(operations::routes(pool))
}
fn configuration_error(error: nahhasio_catalog::Error) -> Error {
    match error {
        nahhasio_catalog::Error::Conflict(_) => Error(
            StatusCode::CONFLICT,
            "تغيّرت الإعدادات؛ أعد تحميلها قبل الحفظ.",
        ),
        nahhasio_catalog::Error::Invalid(_) => Error(
            StatusCode::BAD_REQUEST,
            "تحقق من المفتاح وإعداد مجلد الخادم الخاص.",
        ),
        _ => Error(
            StatusCode::SERVICE_UNAVAILABLE,
            "تعذّر الوصول إلى إعدادات الخادم الخاصة.",
        ),
    }
}
async fn provider_status(root: Option<PathBuf>) -> Result<provider_config::Status, Error> {
    tokio::task::spawn_blocking(move || provider_config::status(root.as_deref()))
        .await
        .map_err(|_| {
            Error(
                StatusCode::SERVICE_UNAVAILABLE,
                "تعذّر قراءة إعدادات المصادر.",
            )
        })?
        .map_err(configuration_error)
}
async fn identity(pool: &PgPool) -> Result<Value, Error> {
    let row = sqlx::query("select id::text,name,to_char(updated_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') revision from server_instance where singleton").fetch_one(pool).await?;
    Ok(
        json!({"id":row.get::<String,_>("id"),"name":row.get::<String,_>("name"),"revision":row.get::<String,_>("revision")}),
    )
}
async fn settings(State(state): State<Services>) -> Result<Json<Value>, Error> {
    Ok(Json(
        json!({"server":identity(&state.pool).await?,"providers":provider_status(state.config).await?}),
    ))
}
async fn overview(State(state): State<Services>) -> Result<Json<Value>, Error> {
    let mut tx = state.pool.begin().await?;
    sqlx::query("set transaction isolation level repeatable read, read only")
        .execute(&mut *tx)
        .await?;
    sqlx::query("set local statement_timeout='5s'")
        .execute(&mut *tx)
        .await?;
    let row = sqlx::query("select (select count(*) from titles) works,(select count(*) from installments) installments,(select count(*) from episodes) episodes,(select count(*) from media_assets) artwork,(select coalesce(sum(byte_size),0)::bigint from media_assets) artwork_bytes,(select count(*) from accounts where status='active') accounts,(select count(*) from auth_sessions s join auth_users u on u.id=s.user_id join accounts a on a.auth_user_id=u.id where s.expires_at>now() and a.status='active' and u.role in ('owner','admin','member') and (not u.banned or u.ban_expires<=now()) and not exists(select 1 from devices d where d.id=s.device_id and d.revoked_at is not null)) sessions,pg_database_size(current_database()) database_bytes").fetch_one(&mut *tx).await?;
    let schema = match migrations::bundled() {
        Ok(history) => match migrations::status(&mut tx, &history).await {
            Ok(status) => {
                json!({"compatible":status.pending.is_empty(),"applied":status.applied,"pending":status.pending.len()})
            }
            Err(_) => json!({"compatible":false,"applied":null,"pending":null}),
        },
        Err(_) => json!({"compatible":false,"applied":null,"pending":null}),
    };
    let insight_sql = include_str!("server/insights.sql")
        .replace("$WORK_STATUS", crate::catalog::WORK_RELEASE_STATUS);
    let insights =
        sqlx::query_scalar::<_, sqlx::types::Json<Value>>(sqlx::AssertSqlSafe(insight_sql))
            .fetch_one(&mut *tx)
            .await?
            .0;
    // No jobs, recursive artwork scan, provider calls or migrations are started by this read.
    tx.rollback().await?;
    let mut counts = serde_json::Map::new();
    for (key, column) in [
        ("works", "works"),
        ("installments", "installments"),
        ("episodes", "episodes"),
        ("artwork", "artwork"),
        ("artworkBytes", "artwork_bytes"),
        ("accounts", "accounts"),
        ("sessions", "sessions"),
        ("databaseBytes", "database_bytes"),
    ] {
        counts.insert(key.into(), json!(row.get::<i64, _>(column)));
    }
    Ok(Json(
        json!({"server":identity(&state.pool).await?,"version":env!("CARGO_PKG_VERSION"),"apiVersion":1,"uptimeSeconds":state.started.elapsed().as_secs(),"database":"connected","schema":schema,"counts":counts,"insights":insights,"checks":checks::inspect(&state.pool,state.config).await?}),
    ))
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Rename {
    name: String,
    expected_revision: String,
}
async fn rename(
    State(state): State<Services>,
    headers: HeaderMap,
    Json(input): Json<Rename>,
) -> Result<Json<Value>, Error> {
    let name = input.name.trim();
    if name.is_empty()
        || name.chars().count() > 100
        || name.chars().any(char::is_control)
        || input.expected_revision.len() > 40
    {
        return Err(Error(
            StatusCode::BAD_REQUEST,
            "اختر اسماً للخادم من 1 إلى 100 حرف.",
        ));
    }
    let mut tx = state.pool.begin().await?;
    sqlx::query("set transaction read write")
        .execute(&mut *tx)
        .await?;
    let actor = crate::auth::lock_admin_session(&mut tx, &headers)
        .await
        .map_err(|_| {
            Error(
                StatusCode::FORBIDDEN,
                "Administrator session is no longer valid",
            )
        })?;
    let changed = sqlx::query("update server_instance set name=$1,updated_at=clock_timestamp() where singleton and to_char(updated_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"')=$2").bind(name).bind(&input.expected_revision).execute(&mut *tx).await?;
    if changed.rows_affected() != 1 {
        return Err(Error(
            StatusCode::CONFLICT,
            "تغيّر اسم الخادم؛ أعد تحميل الإعدادات.",
        ));
    }
    sqlx::query("insert into audit_logs(actor_account_id,action,target_type,summary) values($1::uuid,'server.rename','server','Changed server display name')").bind(actor).execute(&mut *tx).await?;
    tx.commit().await?;
    Ok(Json(identity(&state.pool).await?))
}
async fn providers(
    State(state): State<Services>,
    headers: HeaderMap,
    Json(input): Json<provider_config::Update>,
) -> Result<Json<provider_config::Status>, Error> {
    let root = state.config.ok_or(Error(
        StatusCode::CONFLICT,
        "يجب إعداد NAHHASIO_CONFIG_ROOT الخاص بالخادم أولاً.",
    ))?;
    // Own the authorization transaction through the atomic file commit, even if HTTP is cancelled.
    tokio::spawn(async move {
        let mut tx = state.pool.begin().await?;
        sqlx::query("set transaction read write")
            .execute(&mut *tx)
            .await?;
        let actor = crate::auth::lock_admin_session(&mut tx, &headers)
            .await
            .map_err(|_| {
                Error(
                    StatusCode::FORBIDDEN,
                    "Administrator session is no longer valid",
                )
            })?;
        let result =
            tokio::task::spawn_blocking(move || provider_config::update(&root, input, &actor))
                .await
                .map_err(|_| Error(StatusCode::SERVICE_UNAVAILABLE, "تعذّر حفظ إعدادات المصادر."))?
                .map_err(configuration_error);
        // This transaction only holds authorization locks. File replacement owns persistence.
        let _ = tx.rollback().await;
        result.map(Json)
    })
    .await
    .map_err(|_| Error(StatusCode::SERVICE_UNAVAILABLE, "تعذّر حفظ إعدادات المصادر."))?
}
