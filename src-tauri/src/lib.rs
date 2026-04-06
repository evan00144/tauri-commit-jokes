mod ai;
mod commands;
mod git;
mod models;
mod secure_store;

use commands::LaunchContext;
use tauri::Manager;

fn parse_launch_cwd() -> Option<String> {
    let mut args = std::env::args().skip(1);

    while let Some(arg) = args.next() {
        if arg == "--cwd" {
            return args.next();
        }
    }

    None
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let launch_cwd = parse_launch_cwd();
    let launch_cwd_for_setup = launch_cwd.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(LaunchContext { cwd: launch_cwd })
        .setup(move |app| {
            if let Some(window) = app.get_webview_window("main") {
                let script = format!(
                    "window.__GITROAST_CWD__ = {};",
                    serde_json::to_string(&launch_cwd_for_setup).unwrap_or_else(|_| "null".into())
                );

                let _ = window.eval(&script);
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::init_context,
            commands::choose_repo_root,
            commands::get_repo_status,
            commands::get_api_key_status,
            commands::set_model_preference,
            commands::generate_commit_message
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
