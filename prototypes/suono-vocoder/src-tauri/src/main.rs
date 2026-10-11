// PROTOTIPO usa e getta, ticket "Suono del vocoder" (#13).
// Microfono (o file voce in loop) -> Vocoder o Coro (harmonizer) -> cuffie, con tutte le manopole dal vivo.
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use ringbuf::{traits::*, HeapRb};
use std::collections::VecDeque;
use std::f32::consts::{FRAC_PI_2, TAU};
use std::sync::atomic::{AtomicU32, Ordering::Relaxed};
use std::sync::{mpsc, Arc, Mutex};
use std::time::Duration;
use tauri::ipc::{InvokeBody, Request};
use tauri::State;

const SR: u32 = 48_000;
const SRF: f32 = SR as f32;
const KEEP: usize = 15 * SR as usize; // secondi tenuti per "Salva"

// Manopole: la pagina le manda per nome, l'audio le legge una volta per blocco.
// effetto: 0 = spento (accordi come tastiera), 1 = vocoder, 2 = coro (harmonizer)
const NAMES: [&str; 15] = [
    "effetto", "perlina", "intensita", "voci", "ottava", "timbro", "bande", "sibilanti", "int1", "int5", "volume", "fonte", "morbidezza", "scivolata", "gate",
];
type Params = [AtomicU32; 15];

// Le 5 Perline finte: Do, Sol, Lam, Fa, Rem (semitono della fondamentale, minore?)
const PERLINE: [(i32, bool); 5] = [(0, false), (7, false), (9, true), (5, false), (2, true)];

enum Cmd {
    Stop,
    Save(String, mpsc::Sender<Result<String, String>>),
}

#[derive(Default)]
struct App {
    tx: Mutex<Option<mpsc::Sender<Cmd>>>,
    params: Arc<Params>,
    heard: Arc<AtomicU32>, // nota che il Coro sente cantare, Hz (0 = nessuna)
    file: Mutex<Arc<Vec<f32>>>,
}

fn out_dir() -> std::path::PathBuf {
    let d = std::path::PathBuf::from(std::env::var("HOME").unwrap()).join("Downloads/suono-vocoder");
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
fn start(app: State<App>, input: String, output: String, buffer: u32) -> Result<String, String> {
    stop(app.clone());
    let (tx, rx) = mpsc::channel();
    let (ready_tx, ready_rx) = mpsc::channel();
    let (p, heard, file) = (app.params.clone(), app.heard.clone(), app.file.lock().unwrap().clone());
    std::thread::spawn(move || run(input, output, buffer, p, heard, file, rx, ready_tx));
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
fn set(app: State<App>, name: String, value: f32) -> Result<(), String> {
    let i = NAMES.iter().position(|n| *n == name).ok_or(format!("manopola sconosciuta {name}"))?;
    app.params[i].store(value.to_bits(), Relaxed);
    Ok(())
}

#[tauri::command]
fn heard(app: State<App>) -> f32 {
    f32::from_bits(app.heard.load(Relaxed))
}

// Voce di prova: la pagina decodifica il file (m4a/mp3/wav) a 48 kHz mono e manda i float32 grezzi.
#[tauri::command]
fn load_voice(app: State<App>, request: Request) -> Result<String, String> {
    let InvokeBody::Raw(b) = request.body() else { return Err("corpo non binario".into()) };
    let v: Vec<f32> = b.chunks_exact(4).map(|c| f32::from_le_bytes(c.try_into().unwrap())).collect();
    let secs = v.len() as f32 / SRF;
    *app.file.lock().unwrap() = Arc::new(v);
    Ok(format!("{secs:.1} s"))
}

#[tauri::command]
async fn save_wav(app: State<'_, App>, name: String) -> Result<String, String> {
    let (tx, rx) = mpsc::channel();
    app.tx.lock().unwrap().as_ref().ok_or("audio spento")?.send(Cmd::Save(name, tx)).map_err(|e| e.to_string())?;
    rx.recv().map_err(|e| e.to_string())?
}

#[allow(clippy::too_many_arguments)]
fn run(
    input: String,
    output: String,
    buffer: u32,
    params: Arc<Params>,
    heard: Arc<AtomicU32>,
    file: Arc<Vec<f32>>,
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
        let (mut tap_p, tap_c) = HeapRb::<f32>::new(SR as usize).split();

        let istream = idev
            .build_input_stream(
                cfg(ich),
                move |data: &[f32], _: &cpal::InputCallbackInfo| {
                    for f in data.chunks(ich) {
                        let _ = thru_p.try_push(f[0]);
                    }
                },
                |err| eprintln!("ingresso: {err}"),
                None,
            )
            .map_err(e)?;

        let mut syn = Synth::new(16);
        let mut pos = 0usize;
        let ostream = odev
            .build_output_stream(
                cfg(och),
                move |out: &mut [f32], _: &cpal::OutputCallbackInfo| {
                    let frames = out.len() / och;
                    // ponytail: i due dispositivi hanno orologi diversi; si butta l'arretrato oltre 2 buffer
                    // invece di ricampionare. Basta per il prototipo, non per il prodotto.
                    thru_c.skip(thru_c.occupied_len().saturating_sub(frames * 2));
                    let [effetto, perlina, intensita, voci, ottava, timbro, bande, sib, int1, int5, volume, fonte, morb, scivolata, gate] =
                        std::array::from_fn::<f32, 15, _>(|i| f32::from_bits(params[i].load(Relaxed)));
                    if syn.n != bande as usize {
                        syn = Synth::new(bande as usize); // ponytail: alloca nel thread audio, un tic al cambio va bene qui
                    }
                    syn.soften(morb);
                    // Noise gate 0 = spento, poi soglia da -70 a -30 dB
                    syn.gate = if gate > 0.0 { 10f32.powf((-70.0 + 40.0 * gate) / 20.0) } else { 0.0 };
                    let effetto = effetto as usize;
                    let (mut notes, nv) = chord(perlina as usize, voci as usize, ottava as i32);
                    // Coro: ogni voce dell'accordo va nell'ottava più vicina alla nota cantata (salti piccoli = voce naturale)
                    if effetto == 2 && syn.voiced {
                        notes = near(notes, SRF / syn.period);
                    }
                    heard.store(if effetto == 2 && syn.voiced { SRF / syn.period } else { 0.0 }.to_bits(), Relaxed);
                    // Intensità 1..5 -> quota di effetto (vocoder/coro) o volume degli accordi (spento), lineare tra int1 e int5
                    let wet = int1 + (int5 - int1) * (intensita - 1.0) / 4.0;
                    let glide = if scivolata < 0.001 { 1.0 } else { 1.0 - (-1.0 / (scivolata * SRF)).exp() };
                    let use_file = fonte == 1.0 && !file.is_empty();
                    for f in out.chunks_mut(och) {
                        let mic = thru_c.try_pop().unwrap_or(0.0);
                        let x = if use_file {
                            pos = (pos + 1) % file.len();
                            file[pos]
                        } else {
                            mic
                        };
                        let y = (syn.process(x, &notes[..nv], glide, timbro as usize, effetto, wet, sib) * volume).tanh();
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
        let info = format!("ingresso {input}, uscita {output}, buffer {buffer} campioni = {:.2} ms", buffer as f32 / 48.0);
        Ok((istream, ostream, tap_c, info))
    })();
    let (_istream, _ostream, mut tap_c, info) = match built {
        Ok(b) => b,
        Err(err) => return drop(ready.send(Err(err))),
    };
    let _ = ready.send(Ok(info));

    let mut last: VecDeque<f32> = VecDeque::with_capacity(KEEP + SR as usize);
    loop {
        match rx.recv_timeout(Duration::from_millis(20)) {
            Ok(Cmd::Stop) | Err(mpsc::RecvTimeoutError::Disconnected) => break,
            Ok(Cmd::Save(file, reply)) => {
                let path = out_dir().join(file);
                let spec = hound::WavSpec { channels: 1, sample_rate: SR, bits_per_sample: 32, sample_format: hound::SampleFormat::Float };
                let r = hound::WavWriter::create(&path, spec).and_then(|mut w| {
                    last.iter().try_for_each(|v| w.write_sample(*v))?;
                    w.finalize()
                });
                let _ = reply.send(r.map(|_| path.display().to_string()).map_err(|e| e.to_string()));
            }
            Err(mpsc::RecvTimeoutError::Timeout) => {
                last.extend(tap_c.pop_iter());
                last.drain(..last.len().saturating_sub(KEEP));
            }
        }
    }
}

// Note dell'accordo: 3 voci = triade, 4 = + basso un'ottava sotto, 5 = + fondamentale un'ottava sopra.
fn chord(perlina: usize, voci: usize, ottava: i32) -> ([f32; 5], usize) {
    let (root, minor) = PERLINE[perlina.clamp(1, 5) - 1];
    let r = 12 * (ottava + 1) + root;
    let midi = [r, r + if minor { 3 } else { 4 }, r + 7, r - 12, r + 12];
    let voci = voci.clamp(3, 5);
    let mut f = [0f32; 5];
    for i in 0..voci {
        f[i] = 440.0 * 2f32.powf((midi[i] - 69) as f32 / 12.0);
    }
    (f, voci)
}

// Sposta le 3 note della triade nell'ottava più vicina a `sung`; basso e ottava sopra seguono la fondamentale.
fn near(mut f: [f32; 5], sung: f32) -> [f32; 5] {
    let root = f[0];
    for v in f.iter_mut().take(3) {
        *v *= 2f32.powf((sung / *v).log2().round());
    }
    let r = root * 2f32.powf((sung / root).log2().round());
    if f[3] > 0.0 {
        f[3] = r / 2.0;
    }
    if f[4] > 0.0 {
        f[4] = r * 2.0;
    }
    f
}

#[derive(Clone, Copy)]
struct Bq {
    b: [f32; 3],
    a: [f32; 2],
    x: [f32; 2],
    y: [f32; 2],
}

impl Bq {
    // Ricette RBJ (Audio EQ Cookbook)
    fn new(kind: char, f: f32, q: f32) -> Self {
        let w = TAU * f / SRF;
        let (s, c) = w.sin_cos();
        let al = s / (2.0 * q);
        let b = match kind {
            'b' => [al, 0.0, -al],
            'h' => [(1.0 + c) / 2.0, -(1.0 + c), (1.0 + c) / 2.0],
            _ => [(1.0 - c) / 2.0, 1.0 - c, (1.0 - c) / 2.0],
        };
        let a0 = 1.0 + al;
        Bq { b: b.map(|v| v / a0), a: [-2.0 * c / a0, (1.0 - al) / a0], x: [0.0; 2], y: [0.0; 2] }
    }
    fn run(&mut self, x: f32) -> f32 {
        let y = self.b[0] * x + self.b[1] * self.x[0] + self.b[2] * self.x[1] - self.a[0] * self.y[0] - self.a[1] * self.y[1];
        self.x = [x, self.x[0]];
        self.y = [y, self.y[0]];
        y
    }
}

// PolyBLEP: toglie l'aliasing dagli spigoli di sega e quadra, così il timbro si giudica pulito.
fn blep(t: f32, dt: f32) -> f32 {
    if t < dt {
        let t = t / dt;
        2.0 * t - t * t - 1.0
    } else if t > 1.0 - dt {
        let t = (t - 1.0) / dt;
        t * t + 2.0 * t + 1.0
    } else {
        0.0
    }
}

const ATT: f32 = 0.0104; // inviluppo delle bande: attacco ~2 ms
const SLOW: f32 = 0.00007; // livello medio ~300 ms, per pareggiare il volume effetto/Voce

// Coro (harmonizer): PSOLA nel tempo. Si misura il periodo della Voce (YIN) e se ne prendono grani lunghi
// due periodi, rimessi in fila al passo del periodo della nota voluta: cambia l'intonazione, il timbro
// della voce (formanti) resta il suo.
const HN: usize = 4096; // storia della Voce, potenza di 2
const HOP: usize = 256; // ogni quanti campioni si rimisura l'intonazione (~5 ms)
const TMIN: usize = 48; // periodo minimo: 1000 Hz
const TMAX: usize = 400; // periodo massimo: 120 Hz
const MAXG: usize = 256;

struct Grain {
    src: usize,
    len: usize,
    pos: usize,
    gain: f32,
}

struct Synth {
    n: usize,
    m: Vec<Bq>,
    c: Vec<Bq>,
    env: Vec<f32>,
    ph: [f32; 15],
    cur: [f32; 5], // note che suonano ora, scivolano verso quelle dell'accordo
    sib: Bq,
    keys: Bq,
    soft: [Bq; 2],
    morb: f32,
    rel: f32,
    gate: f32,
    genv: f32,
    ggain: f32,
    rx: f32,
    ry: f32,
    hist: Vec<f32>,
    now: usize,
    period: f32,
    voiced: bool,
    mark: f64,
    next: [f64; 5],
    grains: Vec<Grain>,
}

impl Synth {
    // n bande a passo logaritmico 120 Hz – 8 kHz, ognuna larga quanto il passo
    fn new(n: usize) -> Self {
        let n = n.clamp(4, 64);
        let step = (8000f32 / 120.0).log2() / (n - 1) as f32;
        let q = 2f32.powf(step).sqrt() / (2f32.powf(step) - 1.0);
        let f = |i: usize| 120.0 * 2f32.powf(step * i as f32);
        let mut s = Synth {
            n,
            m: (0..n).map(|i| Bq::new('b', f(i), q)).collect(),
            c: (0..n).map(|i| Bq::new('b', f(i), q)).collect(),
            env: vec![0.0; n],
            ph: std::array::from_fn(|i| (i as f32 * 0.377) % 1.0),
            cur: [0.0; 5],
            sib: Bq::new('h', 5000.0, 0.707),
            keys: Bq::new('l', 2500.0, 0.707),
            soft: [Bq::new('l', 12000.0, 0.707); 2],
            morb: -1.0,
            rel: 0.0,
            gate: 0.0,
            genv: 0.0,
            ggain: 0.0,
            rx: 0.0,
            ry: 0.0,
            hist: vec![0.0; HN],
            now: HN,
            period: 200.0,
            voiced: false,
            mark: 0.0,
            next: [0.0; 5],
            grains: Vec::with_capacity(MAXG),
        };
        s.soften(0.0);
        s
    }

    // Morbidezza 0..1: portante più scura (passa-basso 12 kHz -> 1,2 kHz) e bande che si spengono più piano (25 -> 80 ms)
    fn soften(&mut self, m: f32) {
        if (m - self.morb).abs() < 1e-4 {
            return;
        }
        self.morb = m;
        self.rel = 1.0 / (SRF * (0.025 + 0.055 * m));
        let lp = Bq::new('l', 12000.0 * 0.1f32.powf(m), 0.707);
        for f in &mut self.soft {
            (f.b, f.a) = (lp.b, lp.a);
        }
    }

    // Portante: 0 = sega, 1 = supersaw (3 seghe stonate di ±15 cent per nota), 2 = quadra
    fn carrier(&mut self, timbre: usize, nv: usize) -> f32 {
        let det: &[f32] = if timbre == 1 { &[0.99137, 1.0, 1.00870] } else { &[1.0] };
        let (mut c, mut k) = (0.0, 0);
        for &f in &self.cur[..nv] {
            for &d in det {
                let dt = f * d / SRF;
                let p = &mut self.ph[k];
                *p += dt;
                if *p >= 1.0 {
                    *p -= 1.0;
                }
                let p = *p;
                c += if timbre == 2 {
                    (if p < 0.5 { 1.0 } else { -1.0 }) + blep(p, dt) - blep((p + 0.5) % 1.0, dt)
                } else {
                    2.0 * p - 1.0 - blep(p, dt)
                };
                k += 1;
            }
        }
        c /= (k as f32).sqrt();
        if self.morb > 0.0 {
            let [a, b] = &mut self.soft;
            c = b.run(a.run(c));
        }
        c
    }

    // YIN: periodo della Voce negli ultimi ~17 ms, o "non intonata" (silenzio, consonanti, fiato)
    fn detect(&mut self) {
        let start = self.now - 2 * TMAX - 2; // l'ultimo campione scritto è now - 1
        let x = |j: usize| self.hist[(start + j) & (HN - 1)];
        let energy: f32 = (0..TMAX).map(|j| x(j) * x(j)).sum();
        let mut d = [1f32; TMAX + 2];
        let (mut run, mut best) = (0.0, None);
        if energy > 1e-5 {
            for tau in 1..=TMAX + 1 {
                let s: f32 = (0..TMAX).map(|j| (x(j) - x(j + tau)).powi(2)).sum();
                run += s;
                d[tau] = s * tau as f32 / run.max(1e-12);
                if tau > TMIN && d[tau - 1] < 0.15 && d[tau - 1] <= d[tau] {
                    best = Some(tau - 1);
                    break;
                }
            }
        }
        self.voiced = best.is_some();
        if let Some(t) = best {
            // interpolazione parabolica attorno al minimo
            let (a, b, c) = (d[t - 1], d[t], d[t + 1]);
            let den = a - 2.0 * b + c;
            self.period = t as f32 + if den.abs() > 1e-9 { 0.5 * (a - c) / den } else { 0.0 };
        }
    }

    fn coro(&mut self, x: f32, nv: usize) -> f32 {
        self.hist[self.now & (HN - 1)] = x;
        self.now += 1;
        if self.now % HOP == 0 {
            self.detect();
        }
        let (p, now) = (self.period as f64, self.now as f64);
        // segno di analisi: il più recente il cui grano (± un periodo) è tutto nel passato
        while self.mark + 2.0 * p <= now {
            self.mark += p;
        }
        if self.mark + p > now {
            self.mark = now - p;
        }
        let half = self.period as usize;
        for v in 0..nv {
            if now >= self.next[v] {
                // non intonata: grani al passo originale, la voce passa com'è (consonanti pulite)
                let tp = if self.voiced { (SRF / self.cur[v]) as f64 } else { p };
                if self.grains.len() < MAXG {
                    self.grains.push(Grain { src: self.mark as usize - half, len: 2 * half, pos: 0, gain: (tp / p) as f32 });
                }
                self.next[v] = (self.next[v] + tp).max(now);
            }
        }
        let mut y = 0.0;
        let hist = &self.hist;
        self.grains.retain_mut(|g| {
            let w = 0.5 - 0.5 * (TAU * g.pos as f32 / g.len as f32).cos();
            y += hist[(g.src + g.pos) & (HN - 1)] * w * g.gain;
            g.pos += 1;
            g.pos < g.len
        });
        y / (nv as f32).sqrt()
    }

    // Noise gate: sotto soglia il microfono tace. Apre in ~2 ms, chiude in ~40 ms; chiude solo sotto metà
    // soglia, così non sbatte quando la voce sta lì intorno.
    fn gate(&mut self, x: f32) -> f32 {
        if self.gate <= 0.0 {
            return x;
        }
        let a = x.abs();
        self.genv = if a > self.genv { a } else { self.genv * 0.9995 };
        let open = self.genv > self.gate || (self.ggain > 0.5 && self.genv > self.gate * 0.5);
        self.ggain += (if open { 1.0 } else { 0.0 } - self.ggain) * if open { 0.01 } else { 0.0005 };
        x * self.ggain
    }

    #[allow(clippy::too_many_arguments)]
    fn process(&mut self, x: f32, notes: &[f32], glide: f32, timbre: usize, effetto: usize, wet: f32, sib: f32) -> f32 {
        let x = self.gate(x);
        let nv = notes.len();
        for (c, &t) in self.cur.iter_mut().zip(notes) {
            *c = if *c == 0.0 { t } else { *c + (t - *c) * glide };
        }
        let w = match effetto {
            1 => {
                let car = self.carrier(timbre, nv);
                let mut v = 0.0;
                for i in 0..self.n {
                    let m = self.m[i].run(x).abs();
                    let e = &mut self.env[i];
                    *e += (m - *e) * if m > *e { ATT } else { self.rel };
                    v += self.c[i].run(car) * *e;
                }
                v
            }
            2 => self.coro(x, nv),
            _ => {
                // Tastiera: accordi sempre accesi, smussati, sopra la Voce pulita; Intensità = loro volume
                let car = self.carrier(timbre, nv);
                return x + self.keys.run(car) * 0.25 * wet;
            }
        };
        // Pareggia il volume medio dell'effetto a quello della Voce: si confronta il suono, non il volume.
        self.rx += (x * x - self.rx) * SLOW;
        self.ry += (w * w - self.ry) * SLOW;
        let g = (self.rx / self.ry.max(1e-12)).sqrt().min(30.0);
        // Consonanti chiare: la Voce sopra i 5 kHz passa dritta, così s, t, c si capiscono.
        let w = w * g + self.sib.run(x) * sib * 1.5;
        let a = wet.clamp(0.0, 1.0) * FRAC_PI_2;
        x * a.cos() + w * a.sin()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn rms(v: &[f32]) -> f32 {
        (v.iter().map(|x| x * x).sum::<f32>() / v.len() as f32).sqrt()
    }
    // "Voce" finta: sega a 220 Hz, 2 s
    fn voice() -> Vec<f32> {
        (0..2 * SR as usize).map(|i| 0.1 * (2.0 * (i as f32 * 220.0 / SRF % 1.0) - 1.0)).collect()
    }

    #[test]
    fn vocoder_pareggia_e_tace() {
        let (notes, nv) = chord(3, 5, 4);
        for bande in [8, 16, 32] {
            for timbre in 0..3 {
                for morb in [0.0, 1.0] {
                    let mut s = Synth::new(bande);
                    s.soften(morb);
                    let x = voice();
                    let y: Vec<f32> = x.iter().map(|&x| s.process(x, &notes[..nv], 1.0, timbre, 1, 1.0, 0.0)).collect();
                    let (rx, ry) = (rms(&x[SR as usize..]), rms(&y[SR as usize..]));
                    assert!(y.iter().all(|v| v.is_finite()));
                    assert!((ry / rx - 1.0).abs() < 0.3, "bande {bande} timbro {timbre} morb {morb}: rms voce {rx} vocoder {ry}");
                    let quiet: Vec<f32> = (0..SR as usize).map(|_| s.process(0.0, &notes[..nv], 1.0, timbre, 1, 1.0, 0.0)).collect();
                    assert!(rms(&quiet[SR as usize / 2..]) < 1e-3, "voce zitta ma il vocoder suona");
                }
            }
        }
    }

    #[test]
    fn coro_sente_la_nota_e_la_sposta() {
        let mut s = Synth::new(16);
        let x = voice();
        // una sola voce una quinta sopra: 330 Hz
        let y: Vec<f32> = x.iter().map(|&x| s.process(x, &[330.0], 1.0, 0, 2, 1.0, 0.0)).collect();
        assert!(s.voiced && (SRF / s.period - 220.0).abs() < 2.0, "sente {} Hz invece di 220", SRF / s.period);
        assert!(y.iter().all(|v| v.is_finite()) && rms(&y[SR as usize..]) > 0.03);
        // periodo dell'uscita: autocorrelazione, primo massimo tra 1000 e 120 Hz
        let tail = &y[SR as usize..SR as usize + 4800];
        let ac = |t: usize| tail[..4000].iter().zip(&tail[t..]).map(|(a, b)| a * b).sum::<f32>();
        let t = (TMIN..TMAX).max_by(|&a, &b| ac(a).total_cmp(&ac(b))).unwrap();
        let (a0, a330, a220) = (ac(0), ac(145), ac(218));
        assert!(a330 > 0.8 * a0 && a220 < 0.5 * a0, "periodicità 0:{a0} 330Hz:{a330} 220Hz:{a220} (max a {} Hz)", SRF / t as f32);
        let quiet: Vec<f32> = (0..SR as usize).map(|_| s.process(0.0, &[330.0], 1.0, 0, 2, 1.0, 0.0)).collect();
        assert!(rms(&quiet[SR as usize / 2..]) < 1e-3, "voce zitta ma il coro suona");
    }

    #[test]
    fn gate_taglia_il_fruscio() {
        let mut s = Synth::new(16);
        s.gate = 10f32.powf(-50.0 / 20.0);
        let hiss = |i: usize| 0.0003 * ((i as f32 * 12.9898).sin() * 43758.547).fract(); // ~-75 dB
        let quiet: Vec<f32> = (0..SR as usize).map(|i| s.gate(hiss(i))).collect();
        assert!(rms(&quiet[SR as usize / 2..]) < 1e-5);
        let sing: Vec<f32> = voice().iter().map(|&x| s.gate(x)).collect();
        assert!(rms(&sing[SR as usize..]) > 0.05);
    }

    #[test]
    fn coro_ottava_vicina() {
        // canta La4 (440): Do maggiore va su Do5, Mi4, Sol4; basso Do4, sopra Do6
        let (f, _) = chord(1, 5, 3);
        let g = near(f, 440.0);
        let midi = g.map(|f| (69.0 + 12.0 * (f / 440.0).log2()).round() as i32);
        assert_eq!(midi, [72, 64, 67, 60, 84]);
    }
}

fn main() {
    tauri::Builder::default()
        .manage(App::default())
        .invoke_handler(tauri::generate_handler![devices, start, stop, set, heard, load_voice, save_wav])
        .run(tauri::generate_context!())
        .unwrap();
}
