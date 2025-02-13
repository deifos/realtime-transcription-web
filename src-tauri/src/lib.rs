use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{TrayIconBuilder, TrayIconEvent},
    image::Image,
    Manager,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Create menu items
            let tray_menu = MenuBuilder::new(app)
                .item(&MenuItemBuilder::with_id("show", "Show").build(app)?)
                .item(&MenuItemBuilder::with_id("hide", "Hide").build(app)?)
                .separator()
                .item(&MenuItemBuilder::with_id("quit", "Quit").build(app)?)
                .build()?;

            let app_handle = app.app_handle();
            let menu_handle = app_handle.clone();
            let tray_handle = app_handle.clone();

            // Load the icon
            let icon = include_bytes!("../icons/32x32.png");
            
            // Create tray icon
            let _tray = TrayIconBuilder::new()
                .icon(Image::from_bytes(icon)?)
                .menu(&tray_menu)
                .on_menu_event(move |_tray, event| {
                    match event.id().0.as_str() {
                        "quit" => {
                            std::process::exit(0);
                        }
                        "show" => {
                            if let Some(window) = menu_handle.get_webview_window("main") {
                                _ = window.show();
                                _ = window.set_focus();
                            }
                        }
                        "hide" => {
                            if let Some(window) = menu_handle.get_webview_window("main") {
                                _ = window.hide();
                            }
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(move |_tray, event| {
                    if let TrayIconEvent::DoubleClick { .. } = event {
                        if let Some(window) = tray_handle.get_webview_window("main") {
                            if window.is_visible().unwrap_or(false) {
                                _ = window.hide();
                            } else {
                                _ = window.show();
                                _ = window.set_focus();
                            }
                        }
                    }
                })
                .build(app);

            Ok(())
        })
        .on_window_event(|app, event| match event {
            tauri::WindowEvent::CloseRequested { api, .. } => {
                if let Some(window) = app.get_webview_window("main") {
                    _ = window.hide();
                    api.prevent_close();
                }
            }
            _ => {}
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
