//! Explicit, app-owned UI verification. Credentials arrive through bounded stdin only.
use adw::prelude::*;
use gtk::{gio, glib};
use serde::Deserialize;
use std::{
    cell::Cell,
    rc::Rc,
    time::{Duration, Instant},
};
use webkit6::prelude::*;

#[derive(Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Input {
    email: String,
    password: String,
}
impl Input {
    pub fn read() -> Result<Self, String> {
        use std::io::{BufRead, Read};
        let mut bytes = Vec::new();
        let mut reader = std::io::stdin().lock().take(2049);
        reader
            .read_until(b'\n', &mut bytes)
            .map_err(|_| "Cannot read UI smoke credentials")?;
        if bytes.len() > 2048 {
            return Err("UI smoke credentials exceed the input limit".into());
        }
        let input: Self =
            serde_json::from_slice(&bytes).map_err(|_| "Invalid UI smoke credential input")?;
        if input.email.len() > 254 || input.password.len() > 512 {
            return Err("Invalid UI smoke credential lengths".into());
        }
        Ok(input)
    }
}
pub fn install(
    app: &adw::Application,
    view: &webkit6::WebView,
    input: Input,
    passed: Rc<Cell<bool>>,
) {
    let home_only = std::env::var_os("NAHHASIO_SMOKE_HOME_ONLY").is_some();
    let app = app.clone();
    let weak = view.downgrade();
    let step = Rc::new(Cell::new(0u8));
    let started = Instant::now();
    let waiting = Rc::new(Cell::new(false));
    let credentials =
        serde_json::json!({"email":input.email,"password":input.password}).to_string();
    glib::timeout_add_local(Duration::from_millis(300), move || {
        if started.elapsed() > Duration::from_secs(90) {
            eprintln!("Native UI smoke timed out at step {}", step.get());
            app.quit();
            return glib::ControlFlow::Break;
        }
        let Some(view) = weak.upgrade() else {
            return glib::ControlFlow::Break;
        };
        if waiting.replace(true) {
            return glib::ControlFlow::Continue;
        }
        let app = app.clone();
        let step = step.clone();
        let waiting = waiting.clone();
        let passed = passed.clone();
        let weak = view.downgrade();
        let script=match step.get(){
            0=>"JSON.stringify({ready:!!document.querySelector('#login-heading') && !document.querySelector('[aria-busy=true]') && typeof window.__nahhasioReply === 'function'})".into(),
            1=>format!("(()=>{{if(!document.querySelector('#email')){{Array.from(document.querySelectorAll('button')).find(button=>button.textContent.trim()==='الدخول بالبريد الإلكتروني')?.click();return 'opening';}}const input={credentials}; for(const name of ['email','password']){{const element=document.getElementById(name);Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(element,input[name]);element.dispatchEvent(new Event('input',{{bubbles:true}}));}} return 'filled';}})()"),
            2=>"(()=>{document.querySelector('form').requestSubmit();return 'submitted';})()".into(),
            3=>"JSON.stringify({posters:document.querySelectorAll('.home-fitted-row article a').length,images:Array.from(document.querySelectorAll('.home-fitted-row article img')).filter(img=>img.complete&&img.naturalWidth>0).length,errors:document.querySelectorAll('[role=alert]').length,heroReady:Array.from(document.querySelectorAll('section[aria-label=\"أحدث الأعمال\"] img')).every(image=>image.tagName==='IMG'?image.complete&&image.naturalWidth>0:!image.textContent.includes('جارٍ تحميل الصورة'))})".into(),
            4=>"(()=>{document.querySelector('.home-fitted-row article a').click();return 'open';})()".into(),
            5=>"JSON.stringify({workReady:!!document.querySelector('article[aria-label=\"صفحة العمل\"] h1')&&Array.from(document.querySelectorAll('article[aria-label=\"صفحة العمل\"] header img')).every(image=>image.tagName==='IMG'?image.complete&&image.naturalWidth>0:!image.textContent.includes('جارٍ تحميل الصورة')),errors:document.querySelectorAll('[role=alert]').length})".into(),
            6=>"(()=>{document.querySelector('article[aria-label=\"صفحة العمل\"] button').click();return 'back';})()".into(),
            7=>"(()=>{document.querySelector('button[aria-label=\"الملف والحساب\"]').click();return 'account';})()".into(),
            8=>"(()=>{Array.from(document.querySelectorAll('[role=\"menuitem\"]')).find(item=>item.textContent.trim()==='تسجيل الخروج').click();return 'logout';})()".into(),
            _=>"JSON.stringify({signedOut:!!document.querySelector('#login-heading')})".into(),
        };
        view.evaluate_javascript(
            &script,
            None,
            None,
            None::<&gio::Cancellable>,
            move |result| {
                waiting.set(false);
                let Ok(value) = result else {
                    return;
                };
                let text = value.to_str();
                match step.get() {
                    0 => {
                        if serde_json::from_str::<serde_json::Value>(&text)
                            .ok()
                            .is_some_and(|value| value["ready"] == true)
                        {
                            if let Some(view) = weak.upgrade() {
                                snapshot(&view, "login");
                            }
                            step.set(1);
                        }
                    }
                    1 if text == "filled" => step.set(2),
                    1 => {}
                    2 => step.set(3),
                    3 => {
                        if let Ok(value) = serde_json::from_str::<serde_json::Value>(&text)
                            && value["posters"].as_u64().unwrap_or(0) > 0
                            && value["images"].as_u64().unwrap_or(0) > 0
                            && value["errors"] == 0
                            && value["heroReady"] == true
                        {
                            if let Some(view) = weak.upgrade() {
                                snapshot(&view, "home");
                            }
                            println!(
                                "Native WebKit login, catalog and artwork rendered successfully"
                            );
                            if home_only {
                                passed.set(true);
                                step.set(250);
                                let done = app.clone();
                                glib::timeout_add_local_once(
                                    Duration::from_millis(800),
                                    move || done.quit(),
                                );
                            } else {
                                step.set(4);
                            }
                        }
                    }
                    4 => step.set(5),
                    5 => {
                        if serde_json::from_str::<serde_json::Value>(&text)
                            .ok()
                            .is_some_and(|value| value["workReady"] == true && value["errors"] == 0)
                        {
                            if let Some(view) = weak.upgrade() {
                                snapshot(&view, "work");
                            }
                            println!("Native WebKit full work page rendered successfully");
                            step.set(6);
                        }
                    }
                    6 => step.set(7),
                    7 => step.set(8),
                    8 => step.set(9),
                    _ => {
                        if serde_json::from_str::<serde_json::Value>(&text)
                            .ok()
                            .is_some_and(|value| value["signedOut"] == true)
                        {
                            println!("Native WebKit logout succeeded");
                            passed.set(true);
                            app.quit();
                        }
                    }
                }
            },
        );
        glib::ControlFlow::Continue
    });
}
fn snapshot(view: &webkit6::WebView, name: &str) {
    let output = std::env::var_os("NAHHASIO_SMOKE_OUTPUT")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|| std::path::PathBuf::from("/tmp/nahhasio-gtk-smoke"));
    if std::fs::create_dir_all(&output).is_err() {
        return;
    }
    let path = output.join(format!("{name}.png"));
    view.snapshot(
        webkit6::SnapshotRegion::Visible,
        webkit6::SnapshotOptions::NONE,
        None::<&gio::Cancellable>,
        move |result| {
            if let Ok(texture) = result
                && texture.save_to_png(&path).is_ok()
            {
                println!("Native snapshot saved: {}", path.display());
            }
        },
    );
}
