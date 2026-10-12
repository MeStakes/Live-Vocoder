// Gesti (spec §4): MediaPipe Hand Landmarker -> dita alzate di ogni mano -> Nota (mano degli accordi) e Intensità (seconda mano).
// Test delle dita, assegnazione delle mani e debounce portati da Londopy/gesture-synth (MIT),
// crates/gsyn-core/src/gesture.rs al commit 3e6a40a (vedi THIRD_PARTY_NOTICES.md).
const DITA = [[5, 6, 8], [9, 10, 12], [13, 14, 16], [17, 18, 20]]; // mcp, pip, punta di indice, medio, anulare, mignolo
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
function angolo(a, b, c) {
  const u = [a[0] - b[0], a[1] - b[1], a[2] - b[2]], v = [c[0] - b[0], c[1] - b[1], c[2] - b[2]];
  const cos = (u[0] * v[0] + u[1] * v[1] + u[2] * v[2]) / (Math.hypot(...u) * Math.hypot(...v) || 1);
  return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
}

// p: i 21 punti di una mano in pixel [x, y, z]. Pollice, indice, medio, anulare, mignolo alzati?
// Distanze e angoli, mai "la punta è più in alto": così la mano ruotata conta le stesse dita.
export function alzate(p) {
  const palmo = Math.max(dist(p[0], p[9]), 1e-4);
  return [dist(p[4], p[17]) > 1.1 * palmo,
    ...DITA.map(([m, q, t]) => dist(p[t], p[0]) > dist(p[q], p[0]) * 1.25 && angolo(p[m], p[q], p[t]) > 150)];
}
export const conta = (a) => a.filter(Boolean).length;

// Un valore nuovo vale solo se resta uguale per `ms` (Londopy: Debounce, 90 ms).
export class Stabile {
  constructor(v, ms = 90) { this.v = v; this.cand = v; this.da = 0; this.ms = ms; }
  metti(v, ora) {
    if (v !== this.cand) { this.cand = v; this.da = ora; }
    else if (v !== this.v && ora - this.da >= this.ms) this.v = v;
    return this.v;
  }
}

// ponytail: se sulla camera vera le mani risultano scambiate, si mette true (taratura, come swap_hands di Londopy).
const SCAMBIA = false;
const TIENI = 250; // ms: una mano persa da meno di così è ancora in campo (Londopy: hold dopo 250 ms)

// mani: [{ n: 21 punti normalizzati [x,y,z], etichetta: 'Left'|'Right' }] dal fotogramma grezzo, non specchiato.
// tracce: { sinistra, destra } di Keopees, con { polso, visto }. Risultato: { sinistra, destra } (mano o null).
export function assegna(mani, tracce, ora) {
  if (mani.length >= 2) {
    // due mani: decide la x del polso; nel fotogramma grezzo la destra di Keopees sta a x più piccola
    const [a, b] = mani;
    return (a.n[0][0] < b.n[0][0]) !== SCAMBIA ? { destra: a, sinistra: b } : { destra: b, sinistra: a };
  }
  if (!mani.length) return { sinistra: null, destra: null };
  const h = mani[0];
  // MediaPipe etichetta le mani come se l'immagine fosse specchiata: sul fotogramma grezzo l'etichetta va girata
  let lato = (h.etichetta === 'Left') !== SCAMBIA ? 'destra' : 'sinistra';
  const altro = () => (lato === 'destra' ? 'sinistra' : 'destra');
  const vicino = (t) => t && ora - t.visto < 400 && (t.polso[0] - h.n[0][0]) ** 2 + (t.polso[1] - h.n[0][1]) ** 2 < 0.12;
  if (vicino(tracce[altro()]) && !vicino(tracce[lato])) lato = altro();
  return { [lato]: h, [altro()]: null };
}

// Nota: dita della mano degli accordi (0 = pugno o fuori campo = accordi fermi). dita2: seconda mano, null se non c'è.
export function leggi(tracce, manoAccordi, ora) {
  const vista = (t) => (t && ora - t.visto < TIENI ? t : null);
  const a = vista(tracce[manoAccordi]), s = vista(tracce[manoAccordi === 'sinistra' ? 'destra' : 'sinistra']);
  return {
    accordi: a && { punti: a.n, alzate: a.alzate }, seconda: s && { punti: s.n, alzate: s.alzate },
    nota: a ? conta(a.alzate) : 0, dita2: s ? conta(s.alzate) : null,
  };
}

export async function avviaMani(video, manoAccordi, quando) {
  const { FilesetResolver, HandLandmarker } = await import('./vendor/mediapipe/vision_bundle.js');
  const files = await FilesetResolver.forVisionTasks('vendor/mediapipe/wasm');
  const opz = (delegate) => ({
    baseOptions: { modelAssetPath: 'vendor/hand_landmarker.task', delegate }, runningMode: 'VIDEO', numHands: 2,
    minHandDetectionConfidence: 0.6, minHandPresenceConfidence: 0.6, minTrackingConfidence: 0.6,
  });
  const lm = await HandLandmarker.createFromOptions(files, opz('GPU')).catch(() => HandLandmarker.createFromOptions(files, opz('CPU')));
  const tracce = {}, nota = new Stabile(0), dita2 = new Stabile(null);
  const giro = () => {
    if (video.videoWidth) {
      const ora = performance.now(), vw = video.videoWidth, vh = video.videoHeight;
      const r = lm.detectForVideo(video, ora);
      const mani = r.landmarks.map((n, i) => ({ n: n.map(q => [q.x, q.y, q.z]), etichetta: r.handedness[i][0].categoryName }));
      const as = assegna(mani, tracce, ora);
      for (const lato of ['sinistra', 'destra']) {
        const h = as[lato];
        // in pixel per il test delle dita: le coordinate normalizzate stirano la mano col 9:16
        if (h) tracce[lato] = { polso: h.n[0], visto: ora, n: h.n, alzate: alzate(h.n.map(([x, y, z]) => [x * vw, y * vh, z * vw])) };
      }
      const s = leggi(tracce, manoAccordi(), ora);
      quando({ mani: { accordi: s.accordi, seconda: s.seconda }, nota: nota.metti(s.nota, ora), dita2: dita2.metti(s.dita2, ora) });
    }
    video.requestVideoFrameCallback(giro);
  };
  video.requestVideoFrameCallback(giro);
}
