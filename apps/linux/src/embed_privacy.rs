//! Small built-in WebKit blocker. No remote lists, browser extensions or catalog credentials.
use gtk::glib;
use std::{cell::RefCell, path::PathBuf, rc::Rc};

const TRACKERS: &[&str] = &[
    "doubleclick.net",
    "googlesyndication.com",
    "google-analytics.com",
    "googletagmanager.com",
    "mc.yandex.ru",
    "popads.net",
    "popcash.net",
    "adsterra.com",
    "adsterra.net",
    "propellerads.com",
    "onclicka.com",
    "adnxs.com",
];
const PRIVATE_URLS: &[&str] = &[
    "^http://",
    "^https://localhost[:/]",
    "^https://127\\.",
    "^https://0\\.",
    "^https://10\\.",
    "^https://169\\.254\\.",
    "^https://192\\.168\\.",
    "^https://172\\.1[6-9]\\.",
    "^https://172\\.2[0-9]\\.",
    "^https://172\\.3[01]\\.",
    "^https://\\[::1\\]",
    "^https://\\[f[cd]",
    "^https://\\[fe80:",
    "^https://[^/]+\\.local[:/]",
];

pub struct Protection {
    store: webkit6::UserContentFilterStore,
    directory: PathBuf,
    filter: RefCell<Option<webkit6::UserContentFilter>>,
}
impl Protection {
    pub fn new() -> Result<Rc<Self>, &'static str> {
        let directory =
            glib::mkdtemp_full(std::env::temp_dir().join("nahhasio-embed-XXXXXX"), 0o700)
                .ok_or("Cannot prepare private content filter")?;
        let path = directory.to_str().ok_or("Invalid content filter path")?;
        Ok(Rc::new(Self {
            store: webkit6::UserContentFilterStore::new(path),
            directory,
            filter: RefCell::new(None),
        }))
    }
    pub async fn install(&self, manager: &webkit6::UserContentManager) -> Result<(), glib::Error> {
        let cached = self.filter.borrow().clone();
        let filter = if let Some(filter) = cached {
            filter
        } else {
            let bytes = glib::Bytes::from_owned(rules().to_string().into_bytes());
            let filter = self.store.save_future("nahhasio-embed-v1", &bytes).await?;
            *self.filter.borrow_mut() = Some(filter.clone());
            filter
        };
        manager.add_filter(&filter);
        Ok(())
    }
}
impl Drop for Protection {
    fn drop(&mut self) {
        // Only the private directory returned by mkdtemp is owned by this object.
        let _ = std::fs::remove_dir_all(&self.directory);
    }
}
fn rules() -> serde_json::Value {
    let mut filters: Vec<_> = TRACKERS
        .iter()
        .map(|domain| format!("^https?://([^/]+\\.)?{}[:/]", domain.replace('.', "\\.")))
        .collect();
    filters.extend(PRIVATE_URLS.iter().map(|pattern| (*pattern).to_owned()));
    serde_json::Value::Array(
        filters
            .into_iter()
            .map(|pattern| {
                serde_json::json!({
                    "trigger": {"url-filter":pattern}, "action":{"type":"block"}
                })
            })
            .collect(),
    )
}

#[cfg(feature = "native-diagnostics")]
pub fn smoke() -> glib::ExitCode {
    if gtk::init().is_err() {
        return glib::ExitCode::FAILURE;
    }
    let context = glib::MainContext::default();
    let Ok(protection) = Protection::new() else {
        return glib::ExitCode::FAILURE;
    };
    let manager = webkit6::UserContentManager::new();
    let result = context.block_on(protection.install(&manager));
    println!(
        "embed-filter compile={} ephemeral=true network=false",
        result.is_ok()
    );
    if result.is_ok() {
        glib::ExitCode::SUCCESS
    } else {
        glib::ExitCode::FAILURE
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn blocks_trackers_and_literal_private_hosts_without_blocking_verification() {
        let rules = rules();
        let rules = rules.as_array().unwrap();
        let expressions: Vec<_> = rules
            .iter()
            .map(|rule| regex::Regex::new(rule["trigger"]["url-filter"].as_str().unwrap()).unwrap())
            .collect();
        for url in [
            "https://127.0.0.1:23103/api",
            "https://192.168.1.2/",
            "https://[::1]/",
            "http://provider.invalid/",
            "https://ad.doubleclick.net/banner",
        ] {
            assert!(expressions.iter().any(|rule| rule.is_match(url)), "{url}");
        }
        for url in [
            "https://challenges.cloudflare.com/turnstile/",
            "https://vidnest.fun/anime/1/1/dub",
            "https://cdn.example/video.m3u8",
        ] {
            assert!(!expressions.iter().any(|rule| rule.is_match(url)), "{url}");
        }
    }
}
