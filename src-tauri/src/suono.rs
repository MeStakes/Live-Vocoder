// Il Suono (spec §3): Anti-fruscio, Coro / Vocoder / tastiera, pareggio del volume, Intensità, limitatore.
// Bq, blep e Synth vengono dal prototipo suono-vocoder (6006148), decisi a orecchio in #13.
// Gira nel callback d'uscita di cpal: niente allocazioni.
use std::f32::consts::{FRAC_PI_2, TAU};

pub const SR: u32 = 48_000;
pub const SRF: f32 = SR as f32;
const MAXB: usize = 32; // Dettaglio massimo: set_bands non alloca mai oltre

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
    // Alloca subito per MAXB bande: set_bands cambia il Dettaglio senza allocare nel thread audio.
    fn new(n: usize) -> Self {
        let mut s = Synth {
            n: 0,
            m: Vec::with_capacity(MAXB),
            c: Vec::with_capacity(MAXB),
            env: Vec::with_capacity(MAXB),
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
        s.set_bands(n);
        s
    }

    // n bande a passo logaritmico 120 Hz – 8 kHz, ognuna larga quanto il passo. Riusa la memoria di new().
    fn set_bands(&mut self, n: usize) {
        let n = n.clamp(4, MAXB);
        if n == self.n {
            return;
        }
        let step = (8000f32 / 120.0).log2() / (n - 1) as f32;
        let q = 2f32.powf(step).sqrt() / (2f32.powf(step) - 1.0);
        let f = |i: usize| 120.0 * 2f32.powf(step * i as f32);
        self.m.clear();
        self.m.extend((0..n).map(|i| Bq::new('b', f(i), q)));
        self.c.clear();
        self.c.extend((0..n).map(|i| Bq::new('b', f(i), q)));
        self.env.clear();
        self.env.resize(n, 0.0);
        self.n = n;
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
// Coro: le prime k note (l'accordo, o la sola Base) vanno nell'ottava più vicina a quella cantata;
// basso e ottava sopra seguono la Base, tenendo il loro salto d'ottava.
fn near(f: &mut [f32], k: usize, sung: f32) {
    let root = f[0];
    let r = root * 2f32.powf((sung / root).log2().round());
    for (i, v) in f.iter_mut().enumerate() {
        *v = if i < k { *v * 2f32.powf((sung / *v).log2().round()) } else { r * *v / root };
    }
}

// ponytail: limitatore di picco senza lookahead (attacco istantaneo, rilascio ~100 ms). Limite: sui colpi
// fortissimi, come un battito di mani, schiaccia un po' l'attacco. Se si sente, si passa a un lookahead di 5 ms.
const TETTO: f32 = 0.9;
struct Limiter {
    g: f32,
}
impl Limiter {
    fn new() -> Self {
        Limiter { g: 1.0 }
    }
    fn run(&mut self, x: f32) -> f32 {
        let serve = if x.abs() > TETTO { TETTO / x.abs() } else { 1.0 };
        self.g = (self.g + (1.0 - self.g) / (0.1 * SRF)).min(serve);
        x * self.g
    }
}

pub struct Parametri {
    pub effetto: usize, // 0 Spento (tastiera), 1 Vocoder, 2 Coro
    pub wet: f32,       // quota d'Effetto 0..1 (con Spento: volume degli accordi)
    pub timbro: usize,
    pub bande: usize,
    pub cons: f32,
    pub morb: f32,
    pub scivola: f32, // secondi
    pub gate_db: f32, // -75 = Anti-fruscio spento
}

// ponytail: costante di tempo unica per smussare l'Intensità e per fermare gli accordi (60–120 ms, spec §4); si regola a orecchio.
const WET_TC: f32 = 0.08;

pub struct Motore {
    syn: Synth,
    lim: Limiter,
    wet: f32,
    hz: [f32; 5],
    nv: usize,
    k: usize,
    suona: bool,
}

impl Motore {
    pub fn new() -> Self {
        Motore { syn: Synth::new(24), lim: Limiter::new(), wet: 0.0, hz: [0.0; 5], nv: 0, k: 0, suona: false }
    }

    // Lista vuota = accordi fermi: si tengono le ultime note mentre la quota d'Effetto scende a zero, così niente clic.
    pub fn note(&mut self, hz: &[f32], k: usize) {
        self.suona = !hz.is_empty();
        if self.suona {
            self.nv = hz.len().min(5);
            self.hz[..self.nv].copy_from_slice(&hz[..self.nv]);
            self.k = k.min(self.nv);
        }
    }

    pub fn blocco(&mut self, inp: &[f32], out: &mut [f32], p: &Parametri) {
        let s = &mut self.syn;
        s.set_bands(p.bande);
        s.soften(p.morb);
        s.gate = if p.gate_db <= -75.0 { 0.0 } else { 10f32.powf(p.gate_db / 20.0) };
        let (mut notes, nv) = (self.hz, self.nv);
        if p.effetto == 2 && s.voiced && nv > 0 {
            near(&mut notes[..nv], self.k, SRF / s.period);
        }
        let glide = if p.scivola < 0.001 { 1.0 } else { 1.0 - (-1.0 / (p.scivola * SRF)).exp() };
        let target = if self.suona { p.wet } else { 0.0 };
        let kw = 1.0 - (-1.0 / (WET_TC * SRF)).exp();
        for (o, &x) in out.iter_mut().zip(inp) {
            self.wet += (target - self.wet) * kw;
            let y = if nv == 0 { s.gate(x) } else { s.process(x, &notes[..nv], glide, p.timbro, p.effetto, self.wet, p.cons) };
            *o = self.lim.run(y);
        }
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
    const LAM: [f32; 5] = [440.0, 523.25, 659.26, 220.0, 880.0]; // La minore, Pienezza 5
    fn midi(f: &[f32]) -> Vec<i32> {
        f.iter().map(|f| (69.0 + 12.0 * (f / 440.0).log2()).round() as i32).collect()
    }
    fn par(effetto: usize, wet: f32) -> Parametri {
        Parametri { effetto, wet, timbro: 1, bande: 24, cons: 0.15, morb: 0.0, scivola: 0.0, gate_db: -75.0 }
    }

    #[test]
    fn vocoder_pareggia_e_tace() {
        for bande in [8, 16, 32] {
            for timbre in 0..3 {
                for morb in [0.0, 1.0] {
                    let mut s = Synth::new(bande);
                    s.soften(morb);
                    let x = voice();
                    let y: Vec<f32> = x.iter().map(|&x| s.process(x, &LAM, 1.0, timbre, 1, 1.0, 0.0)).collect();
                    let (rx, ry) = (rms(&x[SR as usize..]), rms(&y[SR as usize..]));
                    assert!(y.iter().all(|v| v.is_finite()));
                    assert!((ry / rx - 1.0).abs() < 0.3, "bande {bande} timbro {timbre} morb {morb}: rms voce {rx} vocoder {ry}");
                    let quiet: Vec<f32> = (0..SR as usize).map(|_| s.process(0.0, &LAM, 1.0, timbre, 1, 1.0, 0.0)).collect();
                    assert!(rms(&quiet[SR as usize / 2..]) < 1e-3, "voce zitta ma il vocoder suona");
                }
            }
        }
    }

    #[test]
    fn coro_sente_la_nota_e_la_sposta() {
        let mut s = Synth::new(16);
        let x = voice();
        let y: Vec<f32> = x.iter().map(|&x| s.process(x, &[330.0], 1.0, 0, 2, 1.0, 0.0)).collect();
        assert!(s.voiced && (SRF / s.period - 220.0).abs() < 2.0, "sente {} Hz invece di 220", SRF / s.period);
        assert!(y.iter().all(|v| v.is_finite()) && rms(&y[SR as usize..]) > 0.03);
        let tail = &y[SR as usize..SR as usize + 4800];
        let ac = |t: usize| tail[..4000].iter().zip(&tail[t..]).map(|(a, b)| a * b).sum::<f32>();
        let (a0, a330, a220) = (ac(0), ac(145), ac(218));
        assert!(a330 > 0.8 * a0 && a220 < 0.5 * a0, "periodicità 0:{a0} 330Hz:{a330} 220Hz:{a220}");
        let quiet: Vec<f32> = (0..SR as usize).map(|_| s.process(0.0, &[330.0], 1.0, 0, 2, 1.0, 0.0)).collect();
        assert!(rms(&quiet[SR as usize / 2..]) < 1e-3, "voce zitta ma il coro suona");
    }

    #[test]
    fn gate_taglia_il_fruscio() {
        let mut s = Synth::new(16);
        s.gate = 10f32.powf(-50.0 / 20.0);
        let hiss = |i: usize| 0.0003 * ((i as f32 * 12.9898).sin() * 43758.547).fract();
        let quiet: Vec<f32> = (0..SR as usize).map(|i| s.gate(hiss(i))).collect();
        assert!(rms(&quiet[SR as usize / 2..]) < 1e-5);
        let sing: Vec<f32> = voice().iter().map(|&x| s.gate(x)).collect();
        assert!(rms(&sing[SR as usize..]) > 0.05);
    }

    #[test]
    fn coro_ottava_vicina() {
        // canta La4 (440): Do maggiore ottava 3 va su Do5, Mi4, Sol4; basso Do4, sopra Do6
        let mut f = [130.81, 164.81, 196.0, 65.41, 261.63];
        near(&mut f, 3, 440.0);
        assert_eq!(midi(&f), [72, 64, 67, 60, 84]);
    }

    #[test]
    fn nota_singola_ottava_vicina() {
        let mut f = [130.81, 65.41, 261.63]; // Base, basso, sopra
        near(&mut f, 1, 440.0);
        assert_eq!(midi(&f), [72, 60, 84]);
    }

    #[test]
    fn bande_senza_allocare() {
        let mut s = Synth::new(24);
        let cap = (s.m.capacity(), s.c.capacity(), s.env.capacity());
        for n in [8, 12, 16, 24, 32] {
            s.set_bands(n);
            assert_eq!((s.m.len(), s.c.len(), s.env.len()), (n, n, n));
            assert_eq!((s.m.capacity(), s.c.capacity(), s.env.capacity()), cap);
        }
    }

    #[test]
    fn accordi_fermi_voce_pulita() {
        for effetto in [0, 1, 2] {
            let mut m = Motore::new();
            let x = voice();
            let mut y = vec![0.0; x.len()];
            m.note(&LAM, 3);
            m.blocco(&x, &mut y, &par(effetto, 0.9));
            m.note(&[], 0);
            m.blocco(&x, &mut y, &par(effetto, 0.9));
            // dopo la rampa (~80 ms) passa solo la Voce pulita: mai silenzio, mai accordi
            for (a, b) in x[SR as usize..].iter().zip(&y[SR as usize..]) {
                assert!((a - b).abs() < 1e-3, "effetto {effetto}: voce {a} uscita {b}");
            }
        }
    }

    #[test]
    fn limitatore_tetto() {
        let mut l = Limiter::new();
        for i in 0..SR as usize {
            let y = l.run(6.0 * (i as f32 * 0.05).sin());
            assert!(y.abs() <= TETTO + 1e-6, "{y}");
        }
        let mut l = Limiter::new();
        assert_eq!(l.run(0.5), 0.5); // sotto il tetto non tocca niente
    }
}
