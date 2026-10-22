//! Bounded, read-only installation diagnostics shared by the dashboard and operator CLI.
use crate::{Result, provider_config, storage::ArtworkRoots};
use serde::Serialize;
use sqlx::PgConnection;
use std::{fs, os::unix::fs::PermissionsExt, path::Path};

#[derive(Serialize)]
pub struct Check {
    pub key: &'static str,
    label: &'static str,
    pub ok: bool,
    detail: &'static str,
}
fn readable(root: &Path) -> bool {
    root.is_absolute() && fs::read_dir(root).is_ok()
}
fn private_config(config: Option<&Path>, roots: &ArtworkRoots) -> bool {
    let Some(config) = config else { return false };
    if !readable(config)
        || !fs::symlink_metadata(config)
            .is_ok_and(|m| m.is_dir() && m.permissions().mode() & 0o077 == 0)
    {
        return false;
    }
    let Ok(config) = fs::canonicalize(config) else {
        return false;
    };
    // Resolve aliases before comparing. Secrets may neither contain nor live under artwork.
    for root in [&roots.uploads, &roots.public] {
        let Ok(root) = fs::canonicalize(root) else {
            return false;
        };
        if config.starts_with(&root) || root.starts_with(&config) {
            return false;
        }
    }
    provider_config::status(Some(&config)).is_ok_and(|s| s.editable)
}
pub async fn inspect(
    connection: &mut PgConnection,
    roots: ArtworkRoots,
    config: Option<std::path::PathBuf>,
) -> Result<Vec<Check>> {
    let limited: bool = sqlx::query_scalar("select not (rolsuper or rolcreaterole or rolcreatedb or rolreplication or rolbypassrls) and not exists(select 1 from pg_namespace n where n.nspname in ('public','drizzle') and pg_has_role(current_user,n.nspowner,'USAGE')) and not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','drizzle') and pg_has_role(current_user,c.relowner,'USAGE')) from pg_roles where rolname=current_user")
        .fetch_one(connection).await?;
    let (artwork, private) = tokio::task::spawn_blocking(move || {
        (
            roots.explicit && readable(&roots.uploads) && readable(&roots.public),
            private_config(config.as_deref(), &roots),
        )
    })
    .await
    .map_err(|_| crate::invalid("Storage diagnostics unavailable"))?;
    Ok(vec![
        Check {
            key: "database-role",
            label: "صلاحيات قاعدة البيانات",
            ok: limited,
            detail: if limited {
                "الدور محدود ولا يرث ملكية مخطط التطبيق أو جداوله. يلزم فحص منح التشغيل عند التثبيت."
            } else {
                "الدور يملك صلاحيات عليا أو يرث ملكية مخطط التطبيق أو جداوله؛ استخدم دور تشغيل منفصلاً."
            },
        },
        Check {
            key: "artwork-roots",
            label: "مجلدات الصور",
            ok: artwork,
            detail: if artwork {
                "مجلدات صريحة ومطلقة ويمكن قراءتها. سلامة الملفات وإمكانية الكتابة تُختبران أثناء التثبيت."
            } else {
                "يلزم اختيار مجلدات صور دائمة وصريحة ومطلقة ويمكن للخادم قراءتها."
            },
        },
        Check {
            key: "private-config",
            label: "الإعدادات الخاصة",
            ok: private,
            detail: if private {
                "مجلد خاص موجود ويمكن قراءته، ومنفصل عن الصور. يُتحقق من الكتابة والنسخ أثناء التثبيت."
            } else {
                "يلزم مجلد إعدادات خاص موجود بصلاحيات 0700، خارج مجلدات الصور؛ تحقق من سلامة إعداداته."
            },
        },
    ])
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn configuration_must_exist_be_private_and_not_overlap_artwork() {
        let dir = tempfile::tempdir().unwrap();
        let public = dir.path().join("media");
        let uploads = public.join("uploads");
        fs::create_dir_all(&uploads).unwrap();
        let roots = ArtworkRoots {
            public: public.clone(),
            uploads,
            explicit: true,
        };
        let config = dir.path().join("config");
        assert!(!private_config(Some(&config), &roots));
        fs::create_dir(&config).unwrap();
        fs::set_permissions(&config, fs::Permissions::from_mode(0o700)).unwrap();
        assert!(private_config(Some(&config), &roots));
        fs::set_permissions(&config, fs::Permissions::from_mode(0o755)).unwrap();
        assert!(!private_config(Some(&config), &roots));
        fs::set_permissions(&config, fs::Permissions::from_mode(0o700)).unwrap();
        let inside = public.join("private");
        fs::create_dir(&inside).unwrap();
        fs::set_permissions(&inside, fs::Permissions::from_mode(0o700)).unwrap();
        assert!(!private_config(Some(&inside), &roots));
        assert!(!private_config(Some(dir.path()), &roots));
        let alias = dir.path().join("alias");
        std::os::unix::fs::symlink(&config, &alias).unwrap();
        assert!(!private_config(Some(&alias), &roots));
    }
}
