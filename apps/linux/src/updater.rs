//! Fixed managed-client update operations. The host helper owns release verification and staging.
//! Device sessions, caches and media storage are outside the installation directory.
use crate::bridge::Error;
use serde_json::{Value, json};
use std::{os::unix::fs::MetadataExt, path::PathBuf, time::Duration};

fn root() -> Result<Option<PathBuf>, Error> {
    if cfg!(debug_assertions) || std::env::var_os("NAHHASIO_UI_URL").is_some() {
        return Ok(None);
    }
    let Some(path) = std::env::var_os("NAHHASIO_CLIENT_INSTALL_ROOT") else {
        return Ok(None);
    };
    let path = PathBuf::from(path);
    let image = std::env::var_os("APPIMAGE").map(PathBuf::from);
    let unavailable = || Error::new("client_update", "تعذّر الوصول إلى تثبيت التطبيق الخاص.");
    let metadata = std::fs::symlink_metadata(&path).map_err(|_| unavailable())?;
    if !path.is_absolute() || !metadata.is_dir() || metadata.mode() & 0o077 != 0 {
        return Err(unavailable());
    }
    let canonical = path.canonicalize().map_err(|_| unavailable())?;
    let Some(image) = image else {
        return Ok(None);
    };
    let image = image.canonicalize().map_err(|_| unavailable())?;
    if image.parent() != Some(canonical.join("versions").as_path()) {
        return Ok(None);
    }
    for name in ["update-client.py", "installation.json", "release-key.pem"] {
        let file = std::fs::symlink_metadata(canonical.join(name)).map_err(|_| unavailable())?;
        if !file.is_file() || file.mode() & 0o077 != 0 || file.uid() != metadata.uid() {
            return Err(unavailable());
        }
    }
    Ok(Some(canonical))
}

async fn execute(action: &str) -> Result<Value, Error> {
    let Some(root) = root()? else {
        return Ok(json!({
            "available": false,
            "currentVersion": env!("CARGO_PKG_VERSION"),
            "availableVersion": null,
            "pendingVersion": null,
            "state": "unmanaged",
            "message": "تحديث التطبيق متاح للتثبيت المُدار فقط؛ نسخة التطوير تُبنى محلياً.",
            "automatic": false,
            "lastCheck": null,
        }));
    };
    let mut command = tokio::process::Command::new("python3");
    command
        .arg(root.join("update-client.py"))
        .arg("--root")
        .arg(&root)
        .arg(action)
        .kill_on_drop(true)
        .stdin(std::process::Stdio::null())
        .stderr(std::process::Stdio::null());
    let result = tokio::time::timeout(Duration::from_secs(900), command.output())
        .await
        .map_err(|_| {
            Error::new(
                "client_update",
                "انتهت مهلة تحديث التطبيق؛ أعد المحاولة لاحقاً.",
            )
        })?
        .map_err(|_| Error::new("client_update", "تعذّر تشغيل خدمة تحديث التطبيق."))?;
    if !result.status.success() || result.stdout.len() > 16384 {
        return Err(Error::new(
            "client_update",
            "تعذّر تحديث التطبيق. تحقق من الاتصال وصلاحيات التثبيت وتوقيع الإصدار، أو انتظر انتهاء العملية الحالية.",
        ));
    }
    serde_json::from_slice(&result.stdout)
        .map_err(|_| Error::new("client_update", "تعذّر قراءة حالة تحديث التطبيق."))
}

pub async fn status() -> Result<Value, Error> {
    execute("status").await
}

pub async fn check() -> Result<Value, Error> {
    execute("check").await
}

pub async fn stage() -> Result<Value, Error> {
    execute("stage").await
}
