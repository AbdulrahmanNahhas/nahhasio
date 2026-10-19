use super::*;
use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
use hmac::{Hmac, KeyInit, Mac};
use std::time::{SystemTime, UNIX_EPOCH};

type Signature = Hmac<Sha256>;
fn now() -> Result<u64> {
    Ok(SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|_| invalid("Clock unavailable"))?
        .as_secs())
}
pub(super) fn sign(mut plan: Value, actor: &str, secret: &[u8]) -> Result<(String, u64)> {
    if secret.len() != 32 {
        return Err(invalid("Editor signing is not configured"));
    }
    let expires = now()? + 15 * 60;
    plan["accountId"] = json!(actor);
    plan["expiresAt"] = json!(expires);
    let payload = URL_SAFE_NO_PAD.encode(serde_json::to_vec(&plan)?);
    let mut mac = Signature::new_from_slice(secret).map_err(|_| invalid("Invalid signing key"))?;
    mac.update(payload.as_bytes());
    Ok((
        format!(
            "{payload}.{}",
            URL_SAFE_NO_PAD.encode(mac.finalize().into_bytes())
        ),
        expires * 1000,
    ))
}
pub(super) fn read(ticket: &str, purpose: &str, actor: &str, secret: &[u8]) -> Result<Value> {
    if secret.len() != 32 || ticket.len() > 8 * 1024 * 1024 {
        return Err(invalid("المراجعة غير صالحة؛ أعد إعدادها."));
    }
    let (payload, signature) = ticket
        .split_once('.')
        .ok_or_else(|| invalid("المراجعة غير صالحة؛ أعد إعدادها."))?;
    let mut mac = Signature::new_from_slice(secret).map_err(|_| invalid("Invalid signing key"))?;
    mac.update(payload.as_bytes());
    mac.verify_slice(
        &URL_SAFE_NO_PAD
            .decode(signature)
            .map_err(|_| invalid("Invalid review signature"))?,
    )
    .map_err(|_| invalid("تغيّرت المراجعة؛ أعد إعدادها."))?;
    let plan: Value = serde_json::from_slice(
        &URL_SAFE_NO_PAD
            .decode(payload)
            .map_err(|_| invalid("Invalid review payload"))?,
    )?;
    if plan["accountId"] != actor
        || plan["purpose"] != purpose
        || plan["expiresAt"]
            .as_u64()
            .is_none_or(|expires| expires < now().unwrap_or(u64::MAX))
    {
        return Err(invalid("انتهت صلاحية المراجعة أو تغيّر الحساب."));
    }
    Ok(plan)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn tickets_are_bound_to_actor_purpose_and_signature() {
        let (ticket, _) = sign(json!({"purpose":"test"}), "actor", &[7; 32]).unwrap();
        assert!(read(&ticket, "test", "actor", &[7; 32]).is_ok());
        assert!(read(&ticket, "test", "other", &[7; 32]).is_err());
        assert!(read(&ticket, "other", "actor", &[7; 32]).is_err());
        assert!(read(&ticket, "test", "actor", &[8; 32]).is_err());
        assert!(read(&(ticket + "x"), "test", "actor", &[7; 32]).is_err());
    }
}
