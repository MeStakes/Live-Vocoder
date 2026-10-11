// Aggiornamenti dentro l'app (spec §10, provati in #12): tauri-plugin-updater legge latest.json dal repo pubblico
// delle versioni. Il file scaricato dall'app non ha quarantena: niente "Apri comunque" e i permessi restano.
use tauri_plugin_updater::UpdaterExt;

fn e(e: tauri_plugin_updater::Error) -> String {
    e.to_string()
}

#[tauri::command]
pub async fn controlla_aggiornamento(app: tauri::AppHandle) -> Result<Option<String>, String> {
    Ok(app.updater().map_err(e)?.check().await.map_err(e)?.map(|u| u.version))
}

#[tauri::command]
pub async fn aggiorna(app: tauri::AppHandle) -> Result<(), String> {
    let Some(u) = app.updater().map_err(e)?.check().await.map_err(e)? else { return Ok(()) };
    u.download_and_install(|_, _| {}, || {}).await.map_err(e)?;
    app.restart()
}
