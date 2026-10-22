//! Installation registration binds the current account session, never another account's session.
use super::*;
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct Registration {
    installation_id: String,
    name: String,
    platform: String,
}
pub(super) async fn register(
    State(state): State<AuthState>,
    headers: HeaderMap,
    Json(input): Json<Registration>,
) -> Result<Json<serde_json::Value>, AuthError> {
    let current = lookup(&state.pool, &headers).await?.user;
    if !(input.installation_id.len() == 36
        && input.installation_id.bytes().enumerate().all(|(i, b)| {
            if [8, 13, 18, 23].contains(&i) {
                b == b'-'
            } else {
                b.is_ascii_hexdigit()
            }
        }))
        || input.name.trim().is_empty()
        || input.name.chars().count() > 80
        || !["linux", "windows", "macos", "android"].contains(&input.platform.as_str())
    {
        return Err(AuthError(
            StatusCode::BAD_REQUEST,
            "Invalid device registration",
        ));
    }
    let mut tx = state.pool.begin().await.map_err(unavailable)?;
    sqlx::query("SET TRANSACTION READ WRITE")
        .execute(&mut *tx)
        .await
        .map_err(unavailable)?;
    let session = lock_session(&mut tx, &headers, Some(&current)).await?;
    if let Some(device) = &session.device_id {
        let installation: String =
            sqlx::query_scalar("select installation_id from devices where id=$1::uuid")
                .bind(device)
                .fetch_one(&mut *tx)
                .await
                .map_err(unavailable)?;
        if installation != input.installation_id {
            return Err(AuthError(
                StatusCode::FORBIDDEN,
                "A session cannot change its registered installation",
            ));
        }
    }
    let device:Option<String>=sqlx::query_scalar("insert into devices(installation_id,name,platform,last_seen_at) values($1,$2,$3,now()) on conflict(installation_id) do update set name=excluded.name,platform=excluded.platform,last_seen_at=now(),updated_at=now() where devices.revoked_at is null returning id::text").bind(input.installation_id).bind(input.name.trim()).bind(input.platform).fetch_optional(&mut *tx).await.map_err(unavailable)?;
    let device = device.ok_or(AuthError(
        StatusCode::FORBIDDEN,
        "This device has been revoked",
    ))?;
    sqlx::query("update auth_sessions set device_id=$1::uuid,updated_at=now() where id=$2")
        .bind(&device)
        .bind(session.session_id)
        .execute(&mut *tx)
        .await
        .map_err(unavailable)?;
    tx.commit().await.map_err(unavailable)?;
    Ok(Json(serde_json::json!({"deviceId":device})))
}
