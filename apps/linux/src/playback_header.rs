//! Solid shared chrome; fullscreen reveals it at the top edge or with F10.
use crate::{embed::Host, player::Player};
use adw::prelude::*;
use gtk::{gio, glib};
use std::{
    cell::{Cell, RefCell},
    rc::Rc,
    time::{Duration, Instant},
};
use webkit6::prelude::*;

pub fn install(
    window: &adw::ApplicationWindow,
    header: &adw::HeaderBar,
    toolbar: &adw::ToolbarView,
    catalog: &webkit6::WebView,
    player: &Rc<Player>,
    embed: &Rc<Host>,
    open_file: &gtk::Button,
) {
    let title = adw::WindowTitle::new("نحّاسيو", "");
    header.set_title_widget(Some(&title));
    let actions = gtk::Box::new(gtk::Orientation::Horizontal, 4);
    let back = button("go-previous-symbolic", "العودة");
    back.set_direction(gtk::TextDirection::Ltr);
    back.connect_clicked({
        let player = Rc::downgrade(player);
        let embed = Rc::downgrade(embed);
        let catalog = catalog.downgrade();
        move |_| {
            if let (Some(player), Some(embed)) = (player.upgrade(), embed.upgrade()) {
                if embed.is_active() {
                    embed.close();
                    if let Some(catalog) = catalog.upgrade() {
                        catalog.evaluate_javascript(
                            "window.dispatchEvent(new Event('nahhasio:embed-state'));",
                            None,
                            None,
                            None::<&gio::Cancellable>,
                            |_| {},
                        );
                    }
                } else {
                    player.close();
                }
            }
        }
    });
    let sidebar = button("sidebar-show-symbolic", "إظهار أو إخفاء الحلقات");
    sidebar.connect_clicked({
        let catalog = catalog.downgrade();
        move |_| {
            if let Some(catalog) = catalog.upgrade() {
                catalog.evaluate_javascript(
                    "window.dispatchEvent(new Event('nahhasio:toggle-episodes'));",
                    None,
                    None,
                    None::<&gio::Cancellable>,
                    |_| {},
                );
            }
        }
    });
    let reload = button("view-refresh-symbolic", "إعادة تحميل المشغّل");
    reload.connect_clicked({
        let embed = Rc::downgrade(embed);
        move |_| {
            if let Some(embed) = embed.upgrade() {
                embed.reload();
            }
        }
    });
    let expand = button("view-fullscreen-symbolic", "ملء الشاشة");
    expand.connect_clicked({
        let window = window.downgrade();
        move |_| {
            if let Some(window) = window.upgrade() {
                if window.is_fullscreen() {
                    window.unfullscreen();
                } else {
                    window.fullscreen();
                }
            }
        }
    });
    for action in [&back, &sidebar, &reload, &expand] {
        actions.append(action);
    }
    actions.set_visible(false);
    header.pack_start(&actions);
    let home = button("go-home-symbolic", "العودة إلى المكتبة");
    home.connect_clicked({
        let catalog = catalog.downgrade();
        move |_| {
            if let Some(catalog) = catalog.upgrade() {
                catalog.evaluate_javascript(
                    "window.dispatchEvent(new Event('nahhasio:home'));",
                    None,
                    None,
                    None::<&gio::Cancellable>,
                    |_| {},
                );
            }
        }
    });
    header.pack_start(&home);
    let search = button("system-search-symbolic", "البحث (Ctrl+K)");
    search.connect_clicked({
        let catalog = catalog.downgrade();
        move |_| {
            if let Some(catalog) = catalog.upgrade() {
                catalog.evaluate_javascript(
                    "window.dispatchEvent(new Event('nahhasio:search'));",
                    None,
                    None,
                    None::<&gio::Cancellable>,
                    |_| {},
                );
            }
        }
    });
    header.pack_end(&search);
    // Only the trusted catalog view supplies page context, never the remote player.
    let page_title = Rc::new(RefCell::new(String::from("نحّاسيو")));
    catalog.connect_title_notify({
        let page_title = page_title.clone();
        move |view| {
            let value = view.title().unwrap_or_else(|| "نحّاسيو".into());
            *page_title.borrow_mut() = value.chars().take(256).collect();
        }
    });
    let reveal_until = Rc::new(Cell::new(Instant::now()));
    let motion = gtk::EventControllerMotion::new();
    motion.set_propagation_phase(gtk::PropagationPhase::Capture);
    motion.connect_motion({
        let reveal = reveal_until.clone();
        let header = header.downgrade();
        move |_, _, y| {
            if let Some(header) = header.upgrade()
                && y <= f64::from(header.height().max(8))
            {
                reveal.set(Instant::now() + Duration::from_secs(2));
                header.set_visible(true);
            }
        }
    });
    window.add_controller(motion);
    let keys = gtk::EventControllerKey::new();
    keys.set_propagation_phase(gtk::PropagationPhase::Capture);
    keys.connect_key_pressed({
        let reveal = reveal_until.clone();
        let header = header.downgrade();
        move |_, key, _, _| {
            if key == gtk::gdk::Key::F10
                && let Some(header) = header.upgrade()
            {
                reveal.set(Instant::now() + Duration::from_secs(5));
                header.set_visible(true);
                header.child_focus(gtk::DirectionType::TabForward);
                return glib::Propagation::Stop;
            }
            glib::Propagation::Proceed
        }
    });
    window.add_controller(keys);
    let weak_window = window.downgrade();
    let weak_player = Rc::downgrade(player);
    let weak_embed = Rc::downgrade(embed);
    let weak_catalog = catalog.downgrade();
    let was_fullscreen = Cell::new(false);
    let header = header.downgrade();
    let toolbar = toolbar.downgrade();
    let open_file = open_file.downgrade();
    glib::timeout_add_local(Duration::from_millis(200), move || {
        let (
            Some(window),
            Some(player),
            Some(embed),
            Some(header),
            Some(toolbar),
            Some(open_file),
            Some(catalog),
        ) = (
            weak_window.upgrade(),
            weak_player.upgrade(),
            weak_embed.upgrade(),
            header.upgrade(),
            toolbar.upgrade(),
            open_file.upgrade(),
            weak_catalog.upgrade(),
        )
        else {
            return glib::ControlFlow::Break;
        };
        let snapshot = player.snapshot();
        let embedded = embed.is_active();
        let autohide = window.is_fullscreen();
        if autohide && !was_fullscreen.replace(autohide) {
            reveal_until.set(Instant::now());
            header.set_visible(false);
        } else if !autohide {
            was_fullscreen.set(false);
        }
        let focus_in_header = header.is_visible()
            && window.gets_focus_visible()
            && gtk::prelude::RootExt::focus(&window)
                .is_some_and(|focus| focus.is_ancestor(&header));
        // Revealed controls keep their solid background and reserve their own space.
        toolbar.set_extend_content_to_top_edge(false);
        header.set_visible(!autohide || Instant::now() < reveal_until.get() || focus_in_header);
        let page_title = page_title.borrow();
        title.set_title(if snapshot.active {
            &snapshot.title
        } else {
            &page_title
        });
        title.set_subtitle(embed.provider_name().unwrap_or(""));
        header.set_show_title(true);
        let admin = catalog.uri().is_some_and(|uri| uri.contains("#/admin"));
        home.set_visible(!snapshot.active && admin);
        search.set_visible(!snapshot.active);
        actions.set_visible(snapshot.active);
        sidebar.set_visible(snapshot.active && !embedded);
        reload.set_visible(embedded);
        open_file.set_visible(!snapshot.active);
        expand.set_icon_name(if window.is_fullscreen() {
            "view-restore-symbolic"
        } else {
            "view-fullscreen-symbolic"
        });
        expand.set_tooltip_text(Some(if window.is_fullscreen() {
            "الخروج من ملء الشاشة"
        } else {
            "ملء الشاشة"
        }));
        glib::ControlFlow::Continue
    });
}
fn button(icon: &str, label: &str) -> gtk::Button {
    let button = gtk::Button::from_icon_name(icon);
    button.set_tooltip_text(Some(label));
    button.add_css_class("flat");
    button
}
