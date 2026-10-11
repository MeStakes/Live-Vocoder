// PROTOTIPO usa e getta, ticket "Prova dell'aggiornamento senza firma Apple" (#12).
use std::process::Command;
use tauri_plugin_updater::UpdaterExt;

fn run(cmd: &str, args: &[&str]) -> String {
    let o = Command::new(cmd).args(args).output().unwrap();
    format!("{}{}", String::from_utf8_lossy(&o.stdout), String::from_utf8_lossy(&o.stderr)).trim().to_string()
}

// Da dove gira l'app, se ha la quarantena, con che firma.
#[tauri::command]
fn stato() -> String {
    let exe = std::env::current_exe().unwrap();
    let app = exe.ancestors().nth(3).unwrap().to_string_lossy().to_string();
    format!(
        "app: {app}\nquarantena: {}\nfirma: {}",
        run("xattr", &["-p", "com.apple.quarantine", &app]),
        run("codesign", &["-d", "-r-", &app]).lines().last().unwrap_or("")
    )
}

#[tauri::command]
async fn aggiorna(app: tauri::AppHandle) -> Result<String, String> {
    let e = |e: tauri_plugin_updater::Error| e.to_string();
    let Some(u) = app.updater().map_err(e)?.check().await.map_err(e)? else {
        return Ok("nessuna versione nuova".into());
    };
    u.download_and_install(|_, _| {}, || {}).await.map_err(e)?;
    app.restart()
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![stato, aggiorna])
        .run(tauri::generate_context!())
        .expect("avvio");
}
