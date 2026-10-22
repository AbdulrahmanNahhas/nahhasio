//! Self-service profile fields never grant roles, capabilities or change identity ownership.
use super::*;
use axum::{body::Body, extract::Path};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct Update {
    name: String,
    bio: String,
    avatar_key: String,
    updated_at: String,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct Password {
    current_password: String,
    new_password: String,
}

pub(super) async fn get(
    State(state): State<AuthState>,
    headers: HeaderMap,
) -> Result<Json<User>, AuthError> {
    Ok(Json(lookup(&state.pool, &headers).await?.user))
}
/// Public means other authenticated library members, never anonymous Internet access.
/// Respect existing discoverability; do not project email, permissions or viewing history.
pub(super) async fn public(
    State(state): State<AuthState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, AuthError> {
    let viewer = lookup(&state.pool, &headers).await?.user;
    if id.len() != 36
        || !id.bytes().enumerate().all(|(i, c)| {
            if [8, 13, 18, 23].contains(&i) {
                c == b'-'
            } else {
                c.is_ascii_hexdigit()
            }
        })
    {
        return Err(AuthError(
            StatusCode::BAD_REQUEST,
            "Invalid profile identifier",
        ));
    }
    let row = sqlx::query("SELECT id::text, display_name, bio, avatar_key, to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS joined_at FROM accounts WHERE id=$1::uuid AND status='active' AND (is_discoverable OR id=$2::uuid)")
        .bind(&id).bind(&viewer.account_id).fetch_optional(&state.pool).await.map_err(unavailable)?
        .ok_or(AuthError(StatusCode::NOT_FOUND, "Profile not available"))?;
    Ok(Json(
        serde_json::json!({"id": row.get::<String,_>("id"), "name": row.get::<String,_>("display_name"), "bio": row.get::<String,_>("bio"), "avatarKey": row.get::<String,_>("avatar_key"), "joinedAt": row.get::<String,_>("joined_at")}),
    ))
}

pub(super) async fn admin_access(
    State(state): State<AuthState>,
    headers: HeaderMap,
) -> Result<Json<User>, AuthError> {
    let current = lookup(&state.pool, &headers).await?.user;
    if !current.is_admin {
        return Err(AuthError(
            StatusCode::FORBIDDEN,
            "Administrator permission required",
        ));
    }
    Ok(Json(current))
}
fn valid_avatar(key: &str) -> bool {
    matches!(key, "nahhasio-library.svg" | "nahhasio-orbit.svg")
        || super::avatar_catalog::AVATARS
            .iter()
            .any(|(name, _)| *name == key)
}

pub(super) async fn avatar(
    State(state): State<AuthState>,
    headers: HeaderMap,
    Path(key): Path<String>,
) -> Result<Response, AuthError> {
    lookup(&state.pool, &headers).await?;
    let (body, mime): (&[u8], &str) = match key.as_str() {
        "nahhasio-library.svg" => (include_bytes!("avatars/library.svg"), "image/svg+xml"),
        "nahhasio-orbit.svg" => (include_bytes!("avatars/orbit.svg"), "image/svg+xml"),
        _ => (
            super::avatar_catalog::AVATARS
                .iter()
                .find(|(name, _)| *name == key)
                .map(|(_, bytes)| *bytes)
                .ok_or(AuthError(StatusCode::NOT_FOUND, "Avatar not found"))?,
            "image/png",
        ),
    };
    Response::builder()
        .header(header::CONTENT_TYPE, mime)
        .header("x-content-type-options", "nosniff")
        .header("content-security-policy", "default-src 'none'; sandbox")
        .header(header::CACHE_CONTROL, "private, max-age=3600")
        .body(Body::from(body))
        .map_err(|_| AuthError(StatusCode::INTERNAL_SERVER_ERROR, "Avatar unavailable"))
}

pub(super) async fn update(
    State(state): State<AuthState>,
    headers: HeaderMap,
    Json(input): Json<Update>,
) -> Result<Json<User>, AuthError> {
    let current = lookup(&state.pool, &headers).await?.user;
    let name = input.name.trim();
    if name.is_empty()
        || name.chars().count() > 80
        || input.bio.chars().count() > 500
        || input.updated_at.len() > 40
        || !valid_avatar(&input.avatar_key)
    {
        return Err(AuthError(StatusCode::BAD_REQUEST, "Invalid profile fields"));
    }
    let mut tx = state.pool.begin().await.map_err(unavailable)?;
    sqlx::query("SET TRANSACTION READ WRITE")
        .execute(&mut *tx)
        .await
        .map_err(unavailable)?;
    lock_session(&mut tx, &headers, Some(&current)).await?;
    let updated=sqlx::query("UPDATE accounts SET display_name=$2,bio=$3,avatar_key=$4,updated_at=now() WHERE auth_user_id=$1 AND to_char(updated_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"')=$5")
        .bind(&current.id).bind(name).bind(input.bio.trim()).bind(&input.avatar_key).bind(input.updated_at).execute(&mut *tx).await.map_err(unavailable)?;
    if updated.rows_affected() != 1 {
        return Err(AuthError(
            StatusCode::CONFLICT,
            "Profile changed; reload before saving",
        ));
    }
    sqlx::query("UPDATE auth_users SET name=$2,image=$3,updated_at=now() WHERE id=$1")
        .bind(&current.id)
        .bind(name)
        .bind(&input.avatar_key)
        .execute(&mut *tx)
        .await
        .map_err(unavailable)?;
    tx.commit().await.map_err(unavailable)?;
    Ok(Json(lookup(&state.pool, &headers).await?.user))
}

fn hash_password(password: &str) -> Option<String> {
    let mut salt = [0u8; 16];
    getrandom::fill(&mut salt).ok()?;
    let salt = hex::encode(salt);
    let normalized: String = password.nfkc().collect();
    let mut key = [0u8; 64];
    let params = scrypt::Params::new(14, 16, 1, 64).ok()?;
    scrypt::scrypt(normalized.as_bytes(), salt.as_bytes(), &params, &mut key).ok()?;
    Some(format!("{salt}:{}", hex::encode(key)))
}
pub(super) async fn password(
    State(state): State<AuthState>,
    headers: HeaderMap,
    Json(input): Json<Password>,
) -> Result<Json<serde_json::Value>, AuthError> {
    let current = lookup(&state.pool, &headers).await?.user;
    if input.current_password.chars().count() > 128
        || !(6..=128).contains(&input.new_password.chars().count())
    {
        return Err(AuthError(
            StatusCode::BAD_REQUEST,
            "Password must contain 6–128 characters",
        ));
    }
    let old: String = sqlx::query_scalar(
        "SELECT password FROM auth_accounts WHERE user_id=$1 AND provider_id='credential'",
    )
    .bind(&current.id)
    .fetch_one(&state.pool)
    .await
    .map_err(unavailable)?;
    let expected = old.clone();
    let permit = state
        .hashing
        .clone()
        .try_acquire_owned()
        .map_err(|_| AuthError(StatusCode::TOO_MANY_REQUESTS, "Try again later"))?;
    let hashed = tokio::task::spawn_blocking(move || {
        let _permit = permit;
        if !verify_password(&expected, &input.current_password) {
            return None;
        }
        hash_password(&input.new_password)
    })
    .await
    .map_err(|_| {
        AuthError(
            StatusCode::SERVICE_UNAVAILABLE,
            "Password update unavailable",
        )
    })?
    .ok_or(AuthError(
        StatusCode::BAD_REQUEST,
        "Current password is incorrect",
    ))?;
    let key = bearer(&headers)?;
    let mut tx = state.pool.begin().await.map_err(unavailable)?;
    sqlx::query("SET TRANSACTION READ WRITE")
        .execute(&mut *tx)
        .await
        .map_err(unavailable)?;
    lock_session(&mut tx, &headers, Some(&current)).await?;
    let changed=sqlx::query("UPDATE auth_accounts SET password=$2,updated_at=now() WHERE user_id=$1 AND provider_id='credential' AND password=$3").bind(&current.id).bind(hashed).bind(old).execute(&mut *tx).await.map_err(unavailable)?;
    if changed.rows_affected() != 1 {
        return Err(AuthError(
            StatusCode::CONFLICT,
            "Credentials changed; try again",
        ));
    }
    sqlx::query("DELETE FROM auth_sessions WHERE user_id=$1 AND token<>$2")
        .bind(&current.id)
        .bind(key)
        .execute(&mut *tx)
        .await
        .map_err(unavailable)?;
    tx.commit().await.map_err(unavailable)?;
    Ok(Json(
        serde_json::json!({"message":"Password updated; other sessions revoked"}),
    ))
}
