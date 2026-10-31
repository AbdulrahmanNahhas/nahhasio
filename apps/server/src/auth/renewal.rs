//! Rotating renewal credentials inherit session deletion, identity and device revocation.
use super::*;
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct Renewal {
    renewal_token: String,
    access_token: String,
    installation_id: String,
}
pub(super) fn valid_installation(id: &str) -> bool {
    id.len() == 36
        && id.bytes().enumerate().all(|(i, b)| {
            if [8, 13, 18, 23].contains(&i) {
                b == b'-'
            } else {
                b.is_ascii_hexdigit()
            }
        })
}
pub(super) fn new_token() -> Result<String, AuthError> {
    let mut bytes = [0; 32];
    getrandom::fill(&mut bytes).map_err(|_| {
        AuthError(
            StatusCode::SERVICE_UNAVAILABLE,
            "Authentication temporarily unavailable",
        )
    })?;
    Ok(format!("nhr1_{}", hex::encode(bytes)))
}
pub(super) fn hash(token: &str) -> String {
    hex::encode(Sha256::digest(token.as_bytes()))
}
pub(super) async fn renew(
    State(state): State<AuthState>,
    Json(input): Json<Renewal>,
) -> Result<Json<LoginResponse>, AuthError> {
    if !valid_installation(&input.installation_id)
        || input.renewal_token.len() != 69
        || !input.renewal_token.starts_with("nhr1_")
        || !input.renewal_token[5..]
            .bytes()
            .all(|b| b.is_ascii_hexdigit())
    {
        return Err(unauthorized());
    }
    let access_key = session_key(&input.access_token).ok_or_else(unauthorized)?;
    let old_hash = hash(&input.renewal_token);
    let user_id: String =
        sqlx::query_scalar("select user_id from auth_sessions where renewal_hash=$1")
            .bind(&old_hash)
            .fetch_optional(&state.pool)
            .await
            .map_err(unavailable)?
            .ok_or_else(unauthorized)?;
    let mut tx = state.pool.begin().await.map_err(unavailable)?;
    sqlx::query("SET TRANSACTION READ WRITE")
        .execute(&mut *tx)
        .await
        .map_err(unavailable)?;
    write::lock_identity(&mut tx, &user_id).await?;
    let row = sqlx::query("select id,device_id::text from auth_sessions where renewal_hash=$1 and user_id=$2 and renewal_installation_id=$3 and renewal_used_at>clock_timestamp()-interval '30 days' and renewal_expires_at>clock_timestamp() and token=$4 for update")
        .bind(&old_hash).bind(&user_id).bind(&input.installation_id).bind(&access_key).fetch_optional(&mut *tx).await.map_err(unavailable)?.ok_or_else(unauthorized)?;
    let device: Option<String> = row.get("device_id");
    let valid: bool = sqlx::query_scalar("select revoked_at is null and installation_id=$2 from devices where id=$1::uuid for update")
        .bind(device.ok_or_else(unauthorized)?).bind(&input.installation_id).fetch_optional(&mut *tx).await.map_err(unavailable)?.unwrap_or(false);
    if !valid {
        return Err(unauthorized());
    }
    let renewal = new_token()?;
    // Keep already dispatched requests valid; the renewal credential rotates atomically.
    let token = input.access_token;
    let expires: String = sqlx::query_scalar("update auth_sessions set token=$1,renewal_hash=$2,renewal_used_at=clock_timestamp(),expires_at=least(clock_timestamp()+interval '7 days',renewal_expires_at),updated_at=clock_timestamp() where id=$3 returning to_char(expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"')")
        .bind(session_key(&token).ok_or_else(unauthorized)?).bind(hash(&renewal)).bind(row.get::<String,_>("id")).fetch_one(&mut *tx).await.map_err(unavailable)?;
    tx.commit().await.map_err(unavailable)?;
    let mut headers = HeaderMap::new();
    headers.insert(
        header::AUTHORIZATION,
        HeaderValue::from_str(&format!("Bearer {token}")).map_err(|_| unauthorized())?,
    );
    let current = lookup(&state.pool, &headers).await?;
    Ok(Json(LoginResponse {
        token,
        renewal_token: Some(renewal),
        user: current.user,
        expires_at: expires,
    }))
}
