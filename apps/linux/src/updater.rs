//! Flatpak owns installation and publisher trust; the app can request only its own update.
use crate::bridge::Error;
use ashpd::flatpak::{Flatpak, update_monitor::UpdateStatus};
use gtk::glib;
use serde_json::{Value, json};
use std::{fs, io::Read, time::Duration};
use tokio::{sync::Mutex, time::timeout};
use tokio_stream::StreamExt;

const APPLICATION_ID: &str = "io.nahhasio.Linux";
static STATE: Mutex<State> = Mutex::const_new(State::Unchecked);

#[derive(Clone, Copy)]
enum State {
    Unchecked,
    Running,
    Current,
    Staged,
    Failed,
}

impl State {
    fn label(self) -> (&'static str, &'static str) {
        match self {
            Self::Unchecked => (
                "unchecked",
                "افحص تحديثات التطبيق وثبّتها هنا. يدير Flatpak التحقق والتثبيت.",
            ),
            Self::Running => (
                "running",
                "يتحقق Flatpak من التحديث ويثبّته إن توفر. اترك التطبيق مفتوحاً.",
            ),
            Self::Current => ("up-to-date", "لم يجد Flatpak تحديثاً لتثبيته."),
            Self::Staged => ("staged", "أغلق التطبيق وأعد فتحه لبدء الإصدار المثبّت."),
            Self::Failed => (
                "failed",
                "تعذّر التحديث من داخل التطبيق. حاول مجدداً أو استخدم تطبيق البرمجيات في النظام.",
            ),
        }
    }
}

fn is_development() -> bool {
    cfg!(debug_assertions) || std::env::var_os("NAHHASIO_UI_URL").is_some()
}

pub async fn install() -> Result<Value, Error> {
    if is_development() || !is_flatpak() {
        return Err(Error::new(
            "update_manager",
            "ثبّت إصدار Flatpak لتحديث التطبيق من هنا.",
        ));
    }
    let mut state = STATE.lock().await;
    if !matches!(*state, State::Running | State::Staged) {
        *state = State::Running;
        tokio::spawn(async {
            let result = run_update().await;
            *STATE.lock().await = result;
        });
    }
    Ok(flatpak_status(*state))
}

async fn run_update() -> State {
    let monitor = timeout(Duration::from_secs(15), async {
        Flatpak::new()
            .await?
            .create_update_monitor(Default::default())
            .await
    })
    .await;
    let Ok(Ok(monitor)) = monitor else {
        return State::Failed;
    };
    let result = timeout(Duration::from_secs(1800), async {
        // Subscribe before requesting the update; an empty transaction can finish immediately.
        let Ok(signals) = monitor.receive_progress().await else {
            return State::Failed;
        };
        let mut signals = std::pin::pin!(signals);
        if monitor.update(None, Default::default()).await.is_err() {
            return State::Failed;
        }
        while let Some(progress) = signals.next().await {
            match progress.status() {
                Some(UpdateStatus::Done) => return State::Staged,
                Some(UpdateStatus::Empty) => return State::Current,
                Some(UpdateStatus::Failed) => return State::Failed,
                Some(UpdateStatus::Running) | None => (),
            }
        }
        State::Failed
    })
    .await
    .unwrap_or(State::Failed);
    let _ = timeout(Duration::from_secs(5), monitor.close()).await;
    result
}

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

pub async fn status() -> Value {
    let development = is_development();
    if !development && is_flatpak() {
        return flatpak_status(*STATE.lock().await);
    }
    let (manager, state, message) = if development {
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
    status_value(manager, state, message)
}

fn flatpak_status(update: State) -> Value {
    let (state, message) = update.label();
    status_value("flatpak", state, message)
}

fn status_value(manager: &str, state: &str, message: &str) -> Value {
    json!({
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
    })
}

/// Fixed application identity only; React cannot supply a URI or a host command.
pub fn manager_uri() -> Result<&'static str, Error> {
    if is_development() || !is_flatpak() {
        return Err(Error::new(
            "update_manager",
            "إدارة التحديث من النظام متاحة لنسخة Flatpak المثبّتة.",
        ));
    }
    Ok("appstream://io.nahhasio.Linux")
}
