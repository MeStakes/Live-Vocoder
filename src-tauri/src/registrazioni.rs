// Registrazioni (spec §6): Cartella/<Canzone>/<Canzone> vN.mp4, mai sovrascritte.
// I pezzi MP4 arrivano dal webview ogni secondo e si aggiungono al file: la memoria non cresce e un crash lascia un file valido.
use std::fs::{self, File};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Mutex;
use tauri::ipc::{InvokeBody, Request};
use tauri::State;

// Una Registrazione alla volta: il file aperto e il suo percorso.
#[derive(Default)]
pub struct Reg(Mutex<Option<(File, PathBuf)>>);

impl Reg {
    fn apri(&self, cartella: &Path, canzone: &str) -> Result<PathBuf, String> {
        // Il nome diventa una cartella: stesse regole di controllaNome (canzoni.js), qui come ultima difesa
        let n = canzone.trim();
        if n.is_empty() || n != canzone || n.starts_with('.') || n.contains(['/', ':', '\0']) {
            return Err(format!("nome di Canzone non valido: {canzone:?}"));
        }
        let mut aperta = self.0.lock().unwrap();
        if aperta.is_some() {
            return Err("c'è già una Registrazione aperta".into());
        }
        let dir = cartella.join(n);
        fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        let p = prossimo_nome(&dir, n);
        // create_new: se per qualunque motivo il file c'è già, errore invece di sovrascriverlo
        let f = File::options().write(true).create_new(true).open(&p).map_err(|e| e.to_string())?;
        *aperta = Some((f, p.clone()));
        Ok(p)
    }

    // Chiude solo la Registrazione di quel percorso: uno Stop in ritardo non chiude quella dopo.
    fn chiudi(&self, path: &str) -> Result<(), String> {
        let mut aperta = self.0.lock().unwrap();
        if aperta.as_ref().is_some_and(|(_, p)| p.as_os_str() == path) {
            let (f, _) = aperta.take().unwrap();
            f.sync_all().map_err(|e| e.to_string())?;
        }
        Ok(())
    }
}

// Il numero più alto già presente + 1. Il confronto ignora le maiuscole, perché il disco del Mac non le distingue.
fn prossimo_nome(dir: &Path, canzone: &str) -> PathBuf {
    let pre = format!("{} v", canzone.to_lowercase());
    let n = fs::read_dir(dir)
        .into_iter()
        .flatten()
        .flatten()
        .filter_map(|e| e.file_name().to_str()?.to_lowercase().strip_prefix(&pre)?.strip_suffix(".mp4")?.parse::<u32>().ok())
        .max()
        .unwrap_or(0);
    dir.join(format!("{canzone} v{}.mp4", n + 1))
}

#[tauri::command]
pub fn apri_registrazione(reg: State<Reg>, cartella: String, canzone: String) -> Result<String, String> {
    reg.apri(Path::new(&cartella), &canzone).map(|p| p.display().to_string())
}

#[tauri::command]
pub fn aggiungi_pezzo(reg: State<Reg>, request: Request) -> Result<(), String> {
    let InvokeBody::Raw(b) = request.body() else { return Err("pezzo non binario".into()) };
    let mut aperta = reg.0.lock().unwrap();
    let (f, _) = aperta.as_mut().ok_or("nessuna Registrazione aperta")?;
    f.write_all(b).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn chiudi_registrazione(reg: State<Reg>, path: String) -> Result<(), String> {
    reg.chiudi(&path)
}

// Byte liberi sul disco della cartella (o della prima cartella sopra che esiste già).
#[tauri::command]
pub fn spazio_libero(cartella: String) -> u64 {
    let p = Path::new(&cartella).ancestors().find(|a| a.exists()).unwrap_or(Path::new("/"));
    let Ok(c) = std::ffi::CString::new(p.as_os_str().as_encoded_bytes()) else { return u64::MAX };
    let mut s: libc::statvfs = unsafe { std::mem::zeroed() };
    if unsafe { libc::statvfs(c.as_ptr(), &mut s) } != 0 {
        return u64::MAX; // ponytail: se non si legge, niente falsi allarmi
    }
    s.f_bavail as u64 * s.f_frsize as u64
}

#[tauri::command]
pub fn guarda(path: String) {
    let _ = Command::new("open").arg(path).status();
}

#[tauri::command]
pub fn mostra(path: String) {
    let _ = Command::new("open").args(["-R", &path]).status();
}

// Nel Cestino, non cancellato: si può ancora recuperare.
#[tauri::command]
pub fn butta(path: String) -> Result<(), String> {
    use objc2::{class, msg_send, rc::Retained, runtime::{AnyObject, Bool}};
    use objc2_foundation::NSString;
    unsafe {
        let url: Retained<AnyObject> = msg_send![class!(NSURL), fileURLWithPath: &*NSString::from_str(&path)];
        let fm: Retained<AnyObject> = msg_send![class!(NSFileManager), defaultManager];
        let ok: Bool = msg_send![&*fm, trashItemAtURL: &*url, resultingItemURL: std::ptr::null_mut::<*mut AnyObject>(), error: std::ptr::null_mut::<*mut AnyObject>()];
        if ok.as_bool() { Ok(()) } else { Err("non riesco a spostarlo nel Cestino".into()) }
    }
}

#[tauri::command]
pub fn cartella_predefinita() -> String {
    format!("{}/Movies/Live Vocoder", std::env::var("HOME").unwrap_or_default())
}

#[tauri::command]
pub async fn scegli_cartella(app: tauri::AppHandle) -> Option<String> {
    use tauri_plugin_dialog::DialogExt;
    app.dialog().file().blocking_pick_folder().map(|p| p.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn numerazione_senza_mai_sovrascrivere() {
        let d = std::env::temp_dir().join(format!("lv-reg-{}", std::process::id()));
        fs::create_dir_all(&d).unwrap();
        assert_eq!(prossimo_nome(&d, "Ma Lei"), d.join("Ma Lei v1.mp4"));
        for f in ["Ma Lei v1.mp4", "Ma Lei v3.mp4", "Ma Lei v10.mp4.part", "Altra v7.mp4", "Ma Lei vX.mp4"] {
            fs::write(d.join(f), b"").unwrap();
        }
        // buco al 2: si va dopo il più alto; i file che non sono "<Canzone> vN.mp4" non contano
        assert_eq!(prossimo_nome(&d, "Ma Lei"), d.join("Ma Lei v4.mp4"));
        // Rinomina che cambia solo le maiuscole: il disco del Mac non le distingue, quindi si continua da v4
        assert_eq!(prossimo_nome(&d, "MA LEI"), d.join("MA LEI v4.mp4"));
        fs::remove_dir_all(d).unwrap();
    }

    #[test]
    fn una_registrazione_alla_volta() {
        let d = std::env::temp_dir().join(format!("lv-reg1-{}", std::process::id()));
        let reg = Reg::default();
        let a = reg.apri(&d, "Ma Lei").unwrap();
        assert!(reg.apri(&d, "Ma Lei").is_err(), "un secondo Registra non deve sostituire il file aperto");
        reg.chiudi("/un/altro/file.mp4").unwrap(); // uno Stop vecchio non chiude la Registrazione nuova
        assert!(reg.apri(&d, "Ma Lei").is_err());
        reg.chiudi(&a.display().to_string()).unwrap();
        assert_eq!(reg.apri(&d, "Ma Lei").unwrap(), d.join("Ma Lei/Ma Lei v2.mp4"));
        fs::remove_dir_all(d).unwrap();
    }

    #[test]
    fn nomi_che_escono_dalla_cartella() {
        let d = std::env::temp_dir().join(format!("lv-reg2-{}", std::process::id()));
        let reg = Reg::default();
        for n in ["", " ", ".", "..", ".nascosta", "/tmp/fuori", "a/b", "a:b", "a\0b"] {
            assert!(reg.apri(&d, n).is_err(), "{n:?} accettato");
        }
        assert!(!d.exists(), "non deve creare cartelle per nomi rifiutati");
    }
}
