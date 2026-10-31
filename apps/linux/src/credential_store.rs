//! Device-local encrypted credentials. Account labels are local; secrets never cross the bridge.
use crate::{bridge::Error, private_state};
use chacha20poly1305::{
    XChaCha20Poly1305, XNonce,
    aead::{Aead, KeyInit, Payload},
};
use serde::{Deserialize, Serialize, de::DeserializeOwned};
use sha2::{Digest, Sha256};
use std::path::Path;
use tokio::sync::OnceCell;

#[derive(Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Sealed {
    nonce: String,
    ciphertext: String,
}
#[derive(Default)]
pub struct Vault {
    key: OnceCell<[u8; 32]>,
}
fn unavailable() -> Error {
    Error::new(
        "secure_storage",
        "تعذّر فتح مخزن الأسرار الآمن. يمكنك الدخول مؤقتًا دون تذكّر الحساب.",
    )
}
impl Vault {
    #[cfg(test)]
    pub fn fixture(key: [u8; 32]) -> Self {
        Self {
            key: OnceCell::from(key),
        }
    }
    async fn key(&self) -> Result<&[u8; 32], Error> {
        self.key
            .get_or_try_init(|| async {
                // Never fall back to a key stored alongside the encrypted credentials.
                let secret = tokio::time::timeout(
                    std::time::Duration::from_secs(8),
                    ashpd::desktop::secret::retrieve(),
                )
                .await
                .map_err(|_| unavailable())?
                .map_err(|_| unavailable())?;
                if secret.len() < 16 {
                    return Err(unavailable());
                }
                let mut hash = Sha256::new();
                hash.update(b"nahhasio/device-vault/v1\0");
                hash.update(secret);
                Ok(hash.finalize().into())
            })
            .await
    }
    pub async fn available(&self) -> bool {
        self.key().await.is_ok()
    }
    pub async fn seal<T: Serialize>(&self, scope: &str, value: &T) -> Result<Sealed, Error> {
        encrypt(
            self.key().await?,
            scope,
            &serde_json::to_vec(value).map_err(|_| unavailable())?,
        )
    }
    pub async fn open<T: DeserializeOwned>(
        &self,
        scope: &str,
        sealed: &Sealed,
    ) -> Result<T, Error> {
        serde_json::from_slice(&decrypt(self.key().await?, scope, sealed)?)
            .map_err(|_| unavailable())
    }
}
fn encrypt(key: &[u8; 32], scope: &str, bytes: &[u8]) -> Result<Sealed, Error> {
    let mut nonce = [0; 24];
    getrandom::fill(&mut nonce).map_err(|_| unavailable())?;
    let ciphertext = XChaCha20Poly1305::new(key.into())
        .encrypt(
            XNonce::from_slice(&nonce),
            Payload {
                msg: bytes,
                aad: scope.as_bytes(),
            },
        )
        .map_err(|_| unavailable())?;
    Ok(Sealed {
        nonce: hex::encode(nonce),
        ciphertext: hex::encode(ciphertext),
    })
}
fn decrypt(key: &[u8; 32], scope: &str, sealed: &Sealed) -> Result<Vec<u8>, Error> {
    let nonce = hex::decode(&sealed.nonce).map_err(|_| unavailable())?;
    if nonce.len() != 24 || sealed.ciphertext.len() > 32768 {
        return Err(unavailable());
    }
    let bytes = hex::decode(&sealed.ciphertext).map_err(|_| unavailable())?;
    XChaCha20Poly1305::new(key.into())
        .decrypt(
            XNonce::from_slice(&nonce),
            Payload {
                msg: &bytes,
                aad: scope.as_bytes(),
            },
        )
        .map_err(|_| unavailable())
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Account {
    pub id: String,
    pub name: String,
    pub avatar_key: String,
    pub credentials: Option<Sealed>,
    #[serde(default)]
    pub signed_out: bool,
}
#[derive(Default, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Accounts {
    pub selected: Option<String>,
    pub accounts: Vec<Account>,
}
pub fn name(server: &str) -> String {
    format!(
        "accounts-{}.json",
        hex::encode(Sha256::digest(server.as_bytes()))
    )
}
pub fn read(root: &Path, server: &str) -> Result<Accounts, Error> {
    let accounts: Accounts =
        private_state::read_limit(root, &name(server), 512 * 1024)?.unwrap_or_default();
    if accounts.accounts.len() > 32
        || accounts.accounts.iter().any(|a| {
            !crate::bridge::valid_id(&a.id) || a.name.len() > 320 || a.avatar_key.len() > 200
        })
    {
        return Err(unavailable());
    }
    Ok(accounts)
}
pub fn write(root: &Path, server: &str, value: &Accounts) -> Result<(), Error> {
    private_state::write_limit(root, &name(server), value, 512 * 1024)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn ciphertext_is_authenticated_and_bound_to_server_and_account() {
        let key = [7; 32];
        let sealed = encrypt(&key, "server:a/account:1", b"private-token").unwrap();
        assert!(
            !serde_json::to_string(&sealed)
                .unwrap()
                .contains("private-token")
        );
        assert_eq!(
            decrypt(&key, "server:a/account:1", &sealed).unwrap(),
            b"private-token"
        );
        assert!(decrypt(&key, "server:a/account:2", &sealed).is_err());
        assert!(decrypt(&[8; 32], "server:a/account:1", &sealed).is_err());
        let mut corrupt = sealed;
        let replacement = if corrupt.ciphertext.starts_with("00") {
            "01"
        } else {
            "00"
        };
        corrupt.ciphertext.replace_range(0..2, replacement);
        assert!(decrypt(&key, "server:a/account:1", &corrupt).is_err());
    }
}
