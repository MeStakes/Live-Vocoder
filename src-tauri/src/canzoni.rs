// Canzoni salvate (spec §8): un solo file, ~/Library/Application Support/com.keopees.live-vocoder/canzoni.json.
// Il JSON lo decide la pagina (canzoni.js); qui si legge e si scrive senza mai lasciarlo a metà.
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};

fn file(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app.path().app_data_dir().map_err(|e| e.to_string())?.join("canzoni.json"))
}

// Scrive accanto e poi rinomina: un crash a metà lascia il file buono di prima.
fn scrivi_atomico(p: &Path, testo: &str) -> std::io::Result<()> {
    std::fs::create_dir_all(p.parent().unwrap())?;
    let tmp = p.with_extension("json.tmp");
    std::fs::write(&tmp, testo)?;
    std::fs::rename(tmp, p)
}

// Un file che non si legge non si butta: si sposta accanto con la data, e si riparte.
fn metti_da_parte(p: &Path) -> std::io::Result<PathBuf> {
    let secs = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
    let dest = p.with_file_name(format!("canzoni-rotto-{secs}.json"));
    std::fs::rename(p, &dest)?;
    Ok(dest)
}

#[tauri::command]
pub fn leggi_canzoni(app: AppHandle) -> Result<Option<String>, String> {
    let p = file(&app)?;
    if !p.exists() {
        return Ok(None);
    }
    std::fs::read_to_string(p).map(Some).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn scrivi_canzoni(app: AppHandle, json: String) -> Result<(), String> {
    scrivi_atomico(&file(&app)?, &json).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn metti_da_parte_canzoni(app: AppHandle) -> Result<(), String> {
    metti_da_parte(&file(&app)?).map(|_| ()).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn scrive_e_mette_da_parte() {
        let d = std::env::temp_dir().join(format!("lv-canzoni-{}", std::process::id()));
        let p = d.join("canzoni.json");
        scrivi_atomico(&p, "{\"a\":1}").unwrap();
        scrivi_atomico(&p, "{\"a\":2}").unwrap();
        assert_eq!(std::fs::read_to_string(&p).unwrap(), "{\"a\":2}");
        assert!(!p.with_extension("json.tmp").exists());
        let messo = metti_da_parte(&p).unwrap();
        assert!(!p.exists() && messo.exists());
        assert_eq!(std::fs::read_to_string(&messo).unwrap(), "{\"a\":2}");
        std::fs::remove_dir_all(d).unwrap();
    }
}
