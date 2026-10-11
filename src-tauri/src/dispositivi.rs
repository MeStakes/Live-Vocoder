// Dispositivi audio da CoreAudio: nome (lo stesso che usa cpal), ingresso/uscita, predefiniti di macOS, tipo d'uscita.
use objc2::rc::Retained;
use objc2_foundation::NSString;
use serde::Serialize;
use std::ffi::c_void;

#[repr(C)]
struct Addr {
    sel: u32,
    scope: u32,
    elem: u32,
}

#[link(name = "CoreAudio", kind = "framework")]
unsafe extern "C" {
    fn AudioObjectGetPropertyDataSize(id: u32, a: *const Addr, ql: u32, q: *const c_void, size: *mut u32) -> i32;
    fn AudioObjectGetPropertyData(id: u32, a: *const Addr, ql: u32, q: *const c_void, size: *mut u32, out: *mut c_void) -> i32;
}

const fn cc(s: &[u8; 4]) -> u32 {
    u32::from_be_bytes(*s)
}
const SISTEMA: u32 = 1; // kAudioObjectSystemObject
const GLOB: u32 = cc(b"glob");

fn dimensione(id: u32, sel: u32, scope: u32) -> u32 {
    let mut s = 0;
    unsafe { AudioObjectGetPropertyDataSize(id, &Addr { sel, scope, elem: 0 }, 0, std::ptr::null(), &mut s) };
    s
}
fn numero(id: u32, sel: u32) -> u32 {
    let (mut v, mut s) = (0u32, 4u32);
    unsafe { AudioObjectGetPropertyData(id, &Addr { sel, scope: GLOB, elem: 0 }, 0, std::ptr::null(), &mut s, &mut v as *mut u32 as *mut c_void) };
    v
}
fn testo(id: u32, sel: u32) -> String {
    let mut p: *mut NSString = std::ptr::null_mut();
    let mut s = std::mem::size_of::<*mut NSString>() as u32;
    unsafe {
        AudioObjectGetPropertyData(id, &Addr { sel, scope: GLOB, elem: 0 }, 0, std::ptr::null(), &mut s, &mut p as *mut _ as *mut c_void);
        // CoreAudio restituisce la CFString già trattenuta: Retained la rilascia (CFString e NSString sono la stessa cosa)
        Retained::from_raw(p).map(|t| t.to_string()).unwrap_or_default()
    }
}

#[derive(Serialize, PartialEq, Debug, Clone, Copy)]
#[serde(rename_all = "lowercase")]
pub enum Tipo {
    Cuffie,
    Altoparlanti,
    Bluetooth,
}

// Altoparlanti (anche schermi e AirPlay) = Ascolto spento, perché fischierebbe. Bluetooth = avviso di ritardo.
// Tutto il resto (jack, USB) conta come cuffie.
fn tipo(trasporto: u32, uid: &str) -> Tipo {
    match &trasporto.to_be_bytes() {
        b"blue" | b"blea" => Tipo::Bluetooth,
        b"bltn" if uid.contains("Speaker") => Tipo::Altoparlanti,
        b"hdmi" | b"dprt" | b"airp" => Tipo::Altoparlanti,
        _ => Tipo::Cuffie,
    }
}

#[derive(Serialize, Debug)]
pub struct Dispositivo {
    nome: String,
    ingresso: bool,
    uscita: bool,
    tipo: Tipo,
    predefinito_ingresso: bool,
    predefinito_uscita: bool,
}

#[tauri::command]
pub fn dispositivi() -> Vec<Dispositivo> {
    let n = dimensione(SISTEMA, cc(b"dev#"), GLOB) as usize / 4;
    let mut ids = vec![0u32; n];
    let mut s = (n * 4) as u32;
    unsafe { AudioObjectGetPropertyData(SISTEMA, &Addr { sel: cc(b"dev#"), scope: GLOB, elem: 0 }, 0, std::ptr::null(), &mut s, ids.as_mut_ptr() as *mut c_void) };
    ids.truncate(s as usize / 4);
    let (din, dout) = (numero(SISTEMA, cc(b"dIn ")), numero(SISTEMA, cc(b"dOut")));
    ids.into_iter()
        .map(|id| Dispositivo {
            nome: testo(id, cc(b"lnam")),
            ingresso: dimensione(id, cc(b"stm#"), cc(b"inpt")) > 0,
            uscita: dimensione(id, cc(b"stm#"), cc(b"outp")) > 0,
            tipo: tipo(numero(id, cc(b"tran")), &testo(id, cc(b"uid "))),
            predefinito_ingresso: id == din,
            predefinito_uscita: id == dout,
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tipi_di_uscita() {
        assert_eq!(tipo(cc(b"bltn"), "BuiltInSpeakerDevice"), Tipo::Altoparlanti);
        assert_eq!(tipo(cc(b"bltn"), "BuiltInHeadphoneOutputDevice"), Tipo::Cuffie);
        assert_eq!(tipo(cc(b"blue"), "AA-BB-CC"), Tipo::Bluetooth);
        assert_eq!(tipo(cc(b"blea"), "x"), Tipo::Bluetooth);
        assert_eq!(tipo(cc(b"usb "), "AppleUSBAudioEngine:x"), Tipo::Cuffie);
        assert_eq!(tipo(cc(b"hdmi"), "x"), Tipo::Altoparlanti);
    }

    // A mano, per vedere i Dispositivi veri: cargo test --release elenca -- --ignored --nocapture
    #[test]
    #[ignore]
    fn elenca() {
        for d in dispositivi() {
            println!("{d:?}");
        }
    }
}
