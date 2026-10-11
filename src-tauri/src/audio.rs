// Audio in tempo reale (spec §3): microfono -> Suono -> cuffie con cpal; il mix va anche al webview per la Registrazione.
// Struttura dei prototipi prova-ritardo (9adddb1) e suono-vocoder (6006148).
use crate::suono::{Motore, Parametri, SR};
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use ringbuf::{traits::*, HeapRb};
use std::sync::atomic::{AtomicU32, Ordering::Relaxed};
use std::sync::{mpsc, Arc, Mutex};
use std::time::Duration;
use tauri::ipc::{Channel, InvokeResponseBody};
use tauri::State;

// Manopole: la pagina le manda per nome (manopole.js, parametriRust), l'audio le legge una volta per blocco.
const NOMI: [&str; 10] = ["effetto", "wet", "timbro", "bande", "cons", "morb", "scivola", "gate", "vol", "muto"];

#[derive(Default)]
pub struct Audio {
    tx: Mutex<Option<mpsc::Sender<()>>>,
    p: Arc<[AtomicU32; 10]>,
    // ponytail: 5 frequenze + quante + k in atomici separati; un blocco (1,3 ms) può leggere un accordo a metà.
    // Non si sente, purché le frequenze lette siano sempre valide: Motore::note scarta quelle a zero.
    note: Arc<[AtomicU32; 7]>,
}

fn nome(d: &cpal::Device) -> String {
    d.description().map(|x| x.name().to_string()).unwrap_or_default()
}

#[tauri::command]
pub fn avvia_audio(a: State<Audio>, ingresso: String, uscita: String, pcm: Channel<InvokeResponseBody>) -> Result<String, String> {
    ferma_audio(a.clone());
    let (tx, rx) = mpsc::channel();
    let (pronto_tx, pronto_rx) = mpsc::channel();
    let (p, n) = (a.p.clone(), a.note.clone());
    std::thread::spawn(move || gira(ingresso, uscita, p, n, pcm, rx, pronto_tx));
    let info = pronto_rx.recv().map_err(|e| e.to_string())??;
    *a.tx.lock().unwrap() = Some(tx);
    Ok(info)
}

#[tauri::command]
pub fn ferma_audio(a: State<Audio>) {
    if let Some(tx) = a.tx.lock().unwrap().take() {
        let _ = tx.send(());
    }
}

#[tauri::command]
pub fn set(a: State<Audio>, nome: String, valore: f32) -> Result<(), String> {
    let i = NOMI.iter().position(|n| *n == nome).ok_or(format!("manopola sconosciuta {nome}"))?;
    a.p[i].store(valore.to_bits(), Relaxed);
    Ok(())
}

// Le note che suonano (accordo.js, noteDellAccordo); lista vuota = accordi fermi.
#[tauri::command]
pub fn set_note(a: State<Audio>, hz: Vec<f32>, k: u32) {
    if hz.is_empty() {
        // accordi fermi: basta il conteggio, le frequenze vecchie restano valide per chi legge a metà
        return a.note[5].store(0, Relaxed);
    }
    for (i, slot) in a.note[..5].iter().enumerate() {
        slot.store(hz.get(i).copied().unwrap_or(0.0).to_bits(), Relaxed);
    }
    a.note[6].store(k, Relaxed);
    a.note[5].store(hz.len().min(5) as u32, Relaxed);
}

#[allow(clippy::too_many_arguments)]
fn gira(
    ingresso: String,
    uscita: String,
    p: Arc<[AtomicU32; 10]>,
    n: Arc<[AtomicU32; 7]>,
    pcm: Channel<InvokeResponseBody>,
    rx: mpsc::Receiver<()>,
    pronto: mpsc::Sender<Result<String, String>>,
) {
    let e = |e: cpal::Error| e.to_string();
    let host = cpal::default_host();
    let fatto = (|| -> Result<_, String> {
        let idev = host.input_devices().map_err(e)?.find(|d| nome(d) == ingresso).ok_or(format!("manca {ingresso}"))?;
        let odev = host.output_devices().map_err(e)?.find(|d| nome(d) == uscita).ok_or(format!("manca {uscita}"))?;
        let ich = idev.default_input_config().map_err(e)?.channels() as usize;
        let och = odev.default_output_config().map_err(e)?.channels() as usize;
        let cfg = |ch: usize| cpal::StreamConfig { channels: ch as u16, sample_rate: SR, buffer_size: cpal::BufferSize::Fixed(64) };
        let (mut voce_p, mut voce_c) = HeapRb::<f32>::new(8192).split();
        let (mut mix_p, mix_c) = HeapRb::<f32>::new(SR as usize).split();
        let istream = idev
            .build_input_stream(
                cfg(ich),
                move |data: &[f32], _: &cpal::InputCallbackInfo| {
                    for f in data.chunks(ich) {
                        let _ = voce_p.try_push(f[0]);
                    }
                },
                |err| eprintln!("ingresso: {err}"),
                None,
            )
            .map_err(e)?;
        let mut motore = Motore::new();
        let (mut voce, mut mix) = (vec![0f32; 4096], vec![0f32; 4096]);
        let ostream = odev
            .build_output_stream(
                cfg(och),
                move |out: &mut [f32], _: &cpal::OutputCallbackInfo| {
                    out.fill(0.0);
                    let frames = (out.len() / och).min(voce.len());
                    // ponytail: microfono e cuffie hanno orologi separati; si butta l'arretrato oltre 2 buffer invece di
                    // ricampionare. Limite: se gli orologi vanno a velocità diverse può scappare un micro-clic.
                    // Il ricampionamento adattivo si aggiunge solo se Keopees lo sente (spec §2).
                    voce_c.skip(voce_c.occupied_len().saturating_sub(frames * 2));
                    let v = |i: usize| f32::from_bits(p[i].load(Relaxed));
                    let par = Parametri { effetto: v(0) as usize, wet: v(1), timbro: v(2) as usize, bande: v(3) as usize, cons: v(4), morb: v(5), scivola: v(6), gate_db: v(7) };
                    let (vol, muto) = (v(8), v(9) > 0.5);
                    let nv = (n[5].load(Relaxed) as usize).min(5);
                    let hz: [f32; 5] = std::array::from_fn(|i| f32::from_bits(n[i].load(Relaxed)));
                    motore.note(&hz[..nv], n[6].load(Relaxed) as usize);
                    for x in &mut voce[..frames] {
                        *x = voce_c.try_pop().unwrap_or(0.0);
                    }
                    motore.blocco(&voce[..frames], &mut mix[..frames], &par);
                    for (f, &y) in out.chunks_mut(och).zip(&mix[..frames]) {
                        // Con gli altoparlanti l'Ascolto tace, ma la Registrazione ha comunque l'audio
                        f.fill(if muto { 0.0 } else { (y * vol).tanh() });
                        let _ = mix_p.try_push(y);
                    }
                },
                |err| eprintln!("uscita: {err}"),
                None,
            )
            .map_err(e)?;
        ostream.play().map_err(e)?;
        istream.play().map_err(e)?;
        Ok((istream, ostream, mix_c, format!("ingresso {ingresso}, uscita {uscita}")))
    })();
    let (_i, _o, mut mix_c, info) = match fatto {
        Ok(f) => f,
        Err(err) => return drop(pronto.send(Err(err))),
    };
    let _ = pronto.send(Ok(info));
    loop {
        match rx.recv_timeout(Duration::from_millis(10)) {
            Ok(()) | Err(mpsc::RecvTimeoutError::Disconnected) => break,
            Err(mpsc::RecvTimeoutError::Timeout) => {
                let k = mix_c.occupied_len();
                if k > 0 {
                    let mut b = vec![0f32; k];
                    mix_c.pop_slice(&mut b);
                    let _ = pcm.send(InvokeResponseBody::Raw(b.iter().flat_map(|x| x.to_le_bytes()).collect()));
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // A mano: ogni nome di CoreAudio deve esistere anche in cpal (dispositivi.rs), se no avvia_audio dice «manca …».
    // cargo test --release nomi_uguali -- --ignored --nocapture
    #[test]
    #[ignore]
    fn nomi_uguali() {
        let host = cpal::default_host();
        let mut cpal: Vec<String> = host.devices().unwrap().map(|d| nome(&d)).collect();
        let mut ca: Vec<String> = crate::dispositivi::dispositivi().iter().filter(|d| d.ingresso || d.uscita).map(|d| d.nome.clone()).collect();
        cpal.sort();
        cpal.dedup();
        ca.sort();
        println!("cpal: {cpal:?}\ncoreaudio: {ca:?}");
        // cpal elenca anche i dispositivi combinati senza canali: basta che ogni nome di CoreAudio ci sia
        assert!(ca.iter().all(|n| cpal.contains(n)), "nomi diversi");
    }
}
