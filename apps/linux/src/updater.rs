//! Installation status only. Flatpak and the host software manager own installed updates.
//! The sandbox never downloads executables, changes /app, or invokes host commands.
use crate::bridge::Error;
use gtk::glib;
use serde_json::{Value, json};
use std::{fs, io::Read};

const APPLICATION_ID: &str = "io.nahhasio.Linux";

fn is_flatpak() -> bool {
    let Ok(file) = fs::File::open("/.flatpak-info") else {
        return false;
    };
    let mut info = String::new();
    if file.take(65537).read_to_string(&mut info).is_err() || info.len() > 65536 {
        return false;
    }
    let key_file = glib::KeyFile::new();
    key_file
        .load_from_data(&info, glib::KeyFileFlags::NONE)
        .is_ok()
        && key_file
            .string("Application", "name")
            .is_ok_and(|name| name == APPLICATION_ID)
}

pub async fn status() -> Result<Value, Error> {
    let development = cfg!(debug_assertions) || std::env::var_os("NAHHASIO_UI_URL").is_some();
    let flatpak = !development && is_flatpak();
    let (manager, state, message) = if flatpak {
        (
            "flatpak",
            "external-managed",
            "تُدار تحديثات نحّاسيو عبر Flatpak وتطبيق «البرمجيات» في النظام. يعتمد التحديث التلقائي على إعدادات النظام، ويظهر الإصدار الجديد بعد إعادة تشغيل التطبيق.",
        )
    } else if development {
        (
            "development",
            "development",
            "هذه نسخة تطوير تُبنى محلياً. النسخة المثبّتة تُحدّث عبر Flatpak وتطبيق «البرمجيات» في النظام.",
        )
    } else {
        (
            "external",
            "external-managed",
            "هذه نسخة غير مُدارة عبر Flatpak. ثبّت إصدار Flatpak لتلقي تحديثات التطبيق عبر النظام.",
        )
    };
    Ok(json!({
        "available": false,
        "manager": manager,
        "currentVersion": env!("CARGO_PKG_VERSION"),
        "availableVersion": null,
        "pendingVersion": null,
        "state": state,
        "message": message,
        // Host update policy and remote availability cannot be inferred inside the sandbox.
        "automatic": null,
        "lastCheck": null,
    }))
}
