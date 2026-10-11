// Camere da AVFoundation (spec §5). WebKit mostra l'iPhone solo se è la camera preferita di sistema
// (AVCaptureDeviceManager.mm, setIsEphemeral; provato in #6): la scelta passa da qui prima di getUserMedia.
// Effetto collaterale noto: la camera preferita vale per tutto il Mac, anche per FaceTime.
use objc2::{class, msg_send, rc::Retained, runtime::{AnyObject, Bool}};
use objc2_foundation::{NSArray, NSString};
use serde::Serialize;

#[link(name = "AVFoundation", kind = "framework")]
unsafe extern "C" {}

fn nome_di(d: &AnyObject) -> String {
    unsafe {
        let s: Retained<NSString> = msg_send![d, localizedName];
        s.to_string()
    }
}

// iPhone (Continuity Camera) e camere USB sono "External", la webcam del Mac è "BuiltInWideAngleCamera".
// La Panoramica Scrivania (Desk View) è un altro tipo e così resta fuori.
fn tutte() -> Vec<Retained<AnyObject>> {
    unsafe {
        let tipi = NSArray::from_retained_slice(&[
            NSString::from_str("AVCaptureDeviceTypeExternal"),
            NSString::from_str("AVCaptureDeviceTypeBuiltInWideAngleCamera"),
        ]);
        let sess: Retained<AnyObject> = msg_send![class!(AVCaptureDeviceDiscoverySession), discoverySessionWithDeviceTypes: &*tipi, mediaType: &*NSString::from_str("vide"), position: 0isize];
        let d: Retained<NSArray<AnyObject>> = msg_send![&*sess, devices];
        d.iter().collect()
    }
}

#[derive(Serialize)]
pub struct Camera {
    nome: String,
    iphone: bool,
}

#[tauri::command]
pub fn camere() -> Vec<Camera> {
    tutte()
        .iter()
        .map(|d| Camera { nome: nome_di(d), iphone: unsafe { let b: Bool = msg_send![&**d, isContinuityCamera]; b.as_bool() } })
        .collect()
}

#[tauri::command]
pub fn prefer_camera(nome: String) -> Result<(), String> {
    let d = tutte().into_iter().find(|d| nome_di(d) == nome).ok_or(format!("manca la camera {nome}"))?;
    unsafe {
        let _: () = msg_send![class!(AVCaptureDevice), setUserPreferredCamera: &*d];
    }
    Ok(())
}

// AVAuthorizationStatus: 0 da chiedere, 1 limitato, 2 negato, 3 concesso. (Microfono, Camera)
#[tauri::command]
pub fn permessi() -> (isize, isize) {
    let s = |t: &str| -> isize { unsafe { msg_send![class!(AVCaptureDevice), authorizationStatusForMediaType: &*NSString::from_str(t)] } };
    (s("soun"), s("vide"))
}

// Apre Impostazioni di Sistema → Privacy e sicurezza → Microfono o Camera.
#[tauri::command]
pub fn apri_privacy(che: String) {
    let pannello = if che == "camera" { "Privacy_Camera" } else { "Privacy_Microphone" };
    let _ = std::process::Command::new("open").arg(format!("x-apple.systempreferences:com.apple.preference.security?{pannello}")).status();
}

#[cfg(test)]
mod tests {
    // A mano, per vedere le camere vere (elencarle non chiede permessi): cargo test --release elenca_camere -- --ignored --nocapture
    #[test]
    #[ignore]
    fn elenca_camere() {
        for c in super::camere() {
            println!("{} (iPhone: {})", c.nome, c.iphone);
        }
        println!("permessi (microfono, camera): {:?}", super::permessi());
    }
}
