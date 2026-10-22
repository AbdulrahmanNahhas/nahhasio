//! Transaction-level mutation authorization. Lock order: identity, account, session, device.
use super::*;

pub(crate) struct WriteSession {
    pub account_id: String,
    pub session_id: String,
    pub device_id: Option<String>,
    pub is_admin: bool,
}
/// Call before locking catalog rows. READ COMMITTED observes revocation committed while waiting.
/// Future account/policy administration must take the same identity/account locks first.
pub(crate) async fn lock_session(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    headers: &HeaderMap,
    expected: Option<&User>,
) -> Result<WriteSession, AuthError> {
    let key = bearer(headers)?;
    let user_id: String = sqlx::query_scalar("select user_id from auth_sessions where token=$1")
        .bind(&key)
        .fetch_optional(&mut **tx)
        .await
        .map_err(unavailable)?
        .ok_or_else(unauthorized)?;
    let identity = lock_identity(tx, &user_id).await?;
    let account_id = identity.account_id;
    if expected.is_some_and(|user| user.id != user_id || user.account_id != account_id) {
        return Err(unauthorized());
    }
    let session = sqlx::query("select id,device_id::text from auth_sessions where token=$1 and user_id=$2 and expires_at>clock_timestamp() for update")
        .bind(&key).bind(&user_id).fetch_optional(&mut **tx).await.map_err(unavailable)?.ok_or_else(unauthorized)?;
    let device_id: Option<String> = session.get("device_id");
    if let Some(device) = &device_id {
        let active: bool = sqlx::query_scalar(
            "select revoked_at is null from devices where id=$1::uuid for update",
        )
        .bind(device)
        .fetch_optional(&mut **tx)
        .await
        .map_err(unavailable)?
        .unwrap_or(false);
        if !active {
            return Err(unauthorized());
        }
    }
    Ok(WriteSession {
        account_id,
        session_id: session.get("id"),
        device_id,
        is_admin: identity.is_admin,
    })
}

pub(super) struct Identity {
    account_id: String,
    is_admin: bool,
}
/// Also serializes login issuance with password rotation, suspension and role changes.
pub(super) async fn lock_identity(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    user_id: &str,
) -> Result<Identity, AuthError> {
    let role: String = sqlx::query_scalar("select role from auth_users where id=$1 and role in ('owner','admin','member') and (not banned or ban_expires<=clock_timestamp()) for update")
        .bind(user_id).fetch_optional(&mut **tx).await.map_err(unavailable)?.ok_or_else(unauthorized)?;
    let account = sqlx::query("select id::text,kind::text from accounts where auth_user_id=$1 and status='active' for update")
        .bind(user_id).fetch_optional(&mut **tx).await.map_err(unavailable)?.ok_or_else(unauthorized)?;
    let account_id: String = account.get("id");
    Ok(Identity {
        account_id,
        is_admin: matches!(role.as_str(), "owner" | "admin")
            && account.get::<String, _>("kind") == "admin",
    })
}

pub(crate) async fn lock_viewer_session(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    headers: &HeaderMap,
    expected: &User,
) -> Result<WriteSession, AuthError> {
    let session = lock_session(tx, headers, Some(expected)).await?;
    if !session.is_admin {
        // Lock the actual grant as well, so editing/deleting it cannot race the mutation.
        let policy: Option<String> = sqlx::query_scalar("select account_id::text from account_content_policies where account_id=$1::uuid and audience='adult' and age='18+' and sexuality_risk='high' and behavioral_risk='high' and theology_risk='high' and inclusion_filter is null for share")
            .bind(&session.account_id).fetch_optional(&mut **tx).await.map_err(unavailable)?;
        if policy.is_none() {
            return Err(AuthError(
                StatusCode::FORBIDDEN,
                "This account's content policy requires a restricted catalog",
            ));
        }
    }
    Ok(session)
}
