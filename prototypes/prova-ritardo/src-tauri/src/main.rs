// PROTOTIPO usa e getta, ticket "Prova del Ritardo e della camera" (#6).
// Microfono -> anello -> cuffie con cpal, misura del Ritardo, PCM al webview per la registrazione.
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use ringbuf::{traits::*, HeapRb};
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering::Relaxed};
use std::sync::{mpsc, Arc, Mutex};
use std::time::Duration;
use tauri::ipc::{Channel, InvokeBody, InvokeResponseBody, Request};
use tauri::State;

const SR: u32 = 48_000;
const CLICK: usize = 24; // 0,5 ms di impulso

#[derive(Default)]
struct Shared {
    vocoder: AtomicBool,
    measure: AtomicBool,
    underruns: AtomicU32,
}

enum Cmd {
    Stop,
    Measure(mpsc::Sender<String>),
}

#[derive(Default)]
struct App {
    tx: Mutex<Option<mpsc::Sender<Cmd>>>,
    shared: Arc<Shared>,
}

fn out_dir() -> std::path::PathBuf {
    let d = std::path::PathBuf::from(std::env::var("HOME").unwrap()).join("Downloads/prova-ritardo");
    std::fs::create_dir_all(&d).unwrap();
    d
}

fn name(d: &cpal::Device) -> String {
    d.description().map(|x| x.name().to_string()).unwrap_or_default()
}

#[tauri::command]
fn devices() -> Result<(Vec<String>, Vec<String>), String> {
    let host = cpal::default_host();
    let i = host.input_devices().map_err(|e| e.to_string())?.map(|d| name(&d)).collect();
    let o = host.output_devices().map_err(|e| e.to_string())?.map(|d| name(&d)).collect();
    Ok((i, o))
}

#[tauri::command]
fn start(app: State<App>, input: String, output: String, buffer: u32, pcm: Channel<InvokeResponseBody>) -> Result<String, String> {
    stop(app.clone());
    let (tx, rx) = mpsc::channel();
    let (ready_tx, ready_rx) = mpsc::channel();
    let sh = app.shared.clone();
    std::thread::spawn(move || run(input, output, buffer, sh, pcm, rx, ready_tx));
    let info = ready_rx.recv().map_err(|e| e.to_string())??;
    *app.tx.lock().unwrap() = Some(tx);
    Ok(info)
}

#[tauri::command]
fn stop(app: State<App>) {
    if let Some(tx) = app.tx.lock().unwrap().take() {
        let _ = tx.send(Cmd::Stop);
    }
}

#[tauri::command]
fn set_vocoder(app: State<App>, on: bool) {
    app.shared.vocoder.store(on, Relaxed);
}

#[tauri::command]
async fn measure(app: State<'_, App>) -> Result<String, String> {
    let (tx, rx) = mpsc::channel();
    app.tx.lock().unwrap().as_ref().ok_or("audio spento")?.send(Cmd::Measure(tx)).map_err(|e| e.to_string())?;
    rx.recv().map_err(|e| e.to_string())
}

#[tauri::command]
fn save(request: Request) -> Result<String, String> {
    let InvokeBody::Raw(bytes) = request.body() else { return Err("corpo non binario".into()) };
    let file = request.headers().get("x-name").and_then(|v| v.to_str().ok()).unwrap_or("file.bin");
    let path = out_dir().join(file);
    std::fs::write(&path, bytes).map_err(|e| e.to_string())?;
    Ok(path.display().to_string())
}

#[tauri::command]
fn log(line: String) {
    use std::io::Write;
    let mut f = std::fs::OpenOptions::new().create(true).append(true).open(out_dir().join("risultati.txt")).unwrap();
    let _ = writeln!(f, "{line}");
}

fn run(
    input: String,
    output: String,
    buffer: u32,
    sh: Arc<Shared>,
    pcm: Channel<InvokeResponseBody>,
    rx: mpsc::Receiver<Cmd>,
    ready: mpsc::Sender<Result<String, String>>,
) {
    let e = |e: cpal::Error| e.to_string();
    let host = cpal::default_host();
    let built = (|| -> Result<_, String> {
        let idev = host.input_devices().map_err(e)?.find(|d| name(d) == input).ok_or(format!("manca {input}"))?;
        let odev = host.output_devices().map_err(e)?.find(|d| name(d) == output).ok_or(format!("manca {output}"))?;
        let ich = idev.default_input_config().map_err(e)?.channels() as usize;
        let och = odev.default_output_config().map_err(e)?.channels() as usize;
        let cfg = |ch: usize| cpal::StreamConfig { channels: ch as u16, sample_rate: SR, buffer_size: cpal::BufferSize::Fixed(buffer) };

        let (mut thru_p, mut thru_c) = HeapRb::<f32>::new(8192).split();
        let (mut cap_p, cap_c) = HeapRb::<f32>::new(SR as usize).split();
        let (mut tap_p, tap_c) = HeapRb::<f32>::new(SR as usize).split();

        // Misura: all'inizio di un blocco l'ingresso mette un impulso al posto della voce (frame F0)
        // e registra il microfono da F0 per mezzo secondo. L'impulso esce in cuffia, il microfono lo
        // risente al frame F1: F1 - F0 è il Ritardo voce -> cuffie, tutto sullo stesso orologio.
        let s = sh.clone();
        let mut left = 0usize;
        let istream = idev
            .build_input_stream(
                cfg(ich),
                move |data: &[f32], _: &cpal::InputCallbackInfo| {
                    let click = left == 0 && s.measure.swap(false, Relaxed);
                    if click {
                        left = SR as usize / 2;
                    }
                    for (i, f) in data.chunks(ich).enumerate() {
                        let y = if click && i < CLICK { 0.9 } else if left > 0 { 0.0 } else { f[0] };
                        if left > 0 {
                            let _ = cap_p.try_push(f[0]);
                            left -= 1;
                        }
                        let _ = thru_p.try_push(y);
                    }
                },
                |err| eprintln!("ingresso: {err}"),
                None,
            )
            .map_err(e)?;

        let s = sh.clone();
        let mut voc = Vocoder::new();
        let ostream = odev
            .build_output_stream(
                cfg(och),
                move |out: &mut [f32], _: &cpal::OutputCallbackInfo| {
                    let frames = out.len() / och;
                    // ponytail: i due dispositivi hanno orologi diversi; si butta l'arretrato oltre 2 buffer
                    // invece di ricampionare. Basta per misurare, non per il prodotto.
                    let extra = thru_c.occupied_len().saturating_sub(frames * 2);
                    thru_c.skip(extra);
                    if thru_c.occupied_len() < frames {
                        s.underruns.fetch_add(1, Relaxed);
                    }
                    let vocoder = s.vocoder.load(Relaxed);
                    for f in out.chunks_mut(och) {
                        let x = thru_c.try_pop().unwrap_or(0.0);
                        let y = if vocoder { voc.process(x) } else { x };
                        f.fill(y);
                        let _ = tap_p.try_push(y);
                    }
                },
                |err| eprintln!("uscita: {err}"),
                None,
            )
            .map_err(e)?;
        ostream.play().map_err(e)?;
        istream.play().map_err(e)?;
        let info = format!("ingresso {input} ({ich} canali), uscita {output} ({och} canali), buffer {buffer} campioni = {:.2} ms a 48 kHz", buffer as f32 / 48.0);
        Ok((istream, ostream, cap_c, tap_c, info))
    })();
    let (_istream, _ostream, mut cap_c, mut tap_c, info) = match built {
        Ok(b) => b,
        Err(err) => return drop(ready.send(Err(err))),
    };
    let _ = ready.send(Ok(info));

    loop {
        match rx.recv_timeout(Duration::from_millis(10)) {
            Ok(Cmd::Stop) | Err(mpsc::RecvTimeoutError::Disconnected) => break,
            Ok(Cmd::Measure(reply)) => {
                let _ = reply.send(measure_loop(&sh, &mut cap_c, buffer));
            }
            Err(mpsc::RecvTimeoutError::Timeout) => {
                let n = tap_c.occupied_len();
                if n > 0 {
                    let mut v = vec![0f32; n];
                    tap_c.pop_slice(&mut v);
                    let bytes = v.iter().flat_map(|x| x.to_le_bytes()).collect();
                    let _ = pcm.send(InvokeResponseBody::Raw(bytes));
                }
            }
        }
    }
}

fn measure_loop(sh: &Shared, cap_c: &mut impl Consumer<Item = f32>, buffer: u32) -> String {
    let was_vocoder = sh.vocoder.swap(false, Relaxed);
    let under0 = sh.underruns.load(Relaxed);
    let mut ms = vec![];
    let mut all = vec![];
    let mut buf = vec![0f32; SR as usize / 2];
    for _ in 0..5 {
        cap_c.clear();
        sh.measure.store(true, Relaxed);
        std::thread::sleep(Duration::from_millis(700));
        let n = cap_c.pop_slice(&mut buf);
        let x = &buf[..n];
        all.extend_from_slice(x);
        let peak = x.iter().fold(0f32, |m, v| m.max(v.abs()));
        if peak < 0.01 {
            ms.push(f32::NAN);
            continue;
        }
        let idx = x.iter().position(|v| v.abs() > peak * 0.5).unwrap();
        ms.push(idx as f32 / 48.0);
    }
    sh.vocoder.store(was_vocoder, Relaxed);
    let wav = out_dir().join(format!("misura-buffer{buffer}.wav"));
    let mut w = hound::WavWriter::create(&wav, hound::WavSpec { channels: 1, sample_rate: SR, bits_per_sample: 32, sample_format: hound::SampleFormat::Float }).unwrap();
    all.iter().for_each(|v| w.write_sample(*v).unwrap());
    w.finalize().unwrap();
    let under = sh.underruns.load(Relaxed) - under0;
    let list: Vec<String> = ms.iter().map(|m| if m.is_nan() { "troppo debole".into() } else { format!("{m:.2}") }).collect();
    format!("buffer {buffer}: Ritardo ms [{}], vuoti d'uscita durante la misura: {under}", list.join(", "))
}

// ponytail: vocoder grezzo (16 bande, accordo di Do fisso) solo per sentire il Ritardo a orecchio.
// Il suono vero si decide in "Suono del vocoder".
struct Bp {
    b0: f32,
    a1: f32,
    a2: f32,
    x1: f32,
    x2: f32,
    y1: f32,
    y2: f32,
}

impl Bp {
    fn new(f: f32, q: f32) -> Self {
        let w = std::f32::consts::TAU * f / SR as f32;
        let alpha = w.sin() / (2.0 * q);
        let a0 = 1.0 + alpha;
        Bp { b0: alpha / a0, a1: -2.0 * w.cos() / a0, a2: (1.0 - alpha) / a0, x1: 0.0, x2: 0.0, y1: 0.0, y2: 0.0 }
    }
    fn run(&mut self, x: f32) -> f32 {
        let y = self.b0 * (x - self.x2) - self.a1 * self.y1 - self.a2 * self.y2;
        (self.x2, self.x1, self.y2, self.y1) = (self.x1, x, self.y1, y);
        y
    }
}

struct Vocoder {
    m: Vec<Bp>,
    c: Vec<Bp>,
    env: Vec<f32>,
    ph: [f32; 3],
}

impl Vocoder {
    fn new() -> Self {
        let f = |i: usize| 120.0 * (8000.0f32 / 120.0).powf(i as f32 / 15.0);
        Vocoder { m: (0..16).map(|i| Bp::new(f(i), 6.0)).collect(), c: (0..16).map(|i| Bp::new(f(i), 6.0)).collect(), env: vec![0.0; 16], ph: [0.0; 3] }
    }
    fn process(&mut self, x: f32) -> f32 {
        let mut car = 0.0;
        for (p, f) in self.ph.iter_mut().zip([130.81f32, 164.81, 196.0]) {
            *p = (*p + f / SR as f32) % 1.0;
            car += 2.0 * *p - 1.0;
        }
        let mut y = 0.0;
        for i in 0..16 {
            let m = self.m[i].run(x).abs();
            let k = if m > self.env[i] { 0.02 } else { 0.001 }; // attacco ~1 ms, rilascio ~20 ms
            self.env[i] += (m - self.env[i]) * k;
            y += self.c[i].run(car * 0.3) * self.env[i];
        }
        (y * 10.0).tanh() * 0.5
    }
}

fn main() {
    tauri::Builder::default()
        .manage(App::default())
        .invoke_handler(tauri::generate_handler![devices, start, stop, set_vocoder, measure, save, log])
        .run(tauri::generate_context!())
        .unwrap();
}
