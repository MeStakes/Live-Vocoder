// Il lato JS dell'audio Rust (audio.rs): avvio sui Dispositivi, manopole, note; il PCM torna qui per l'onda e la Registrazione.
const core = () => window.__TAURI__.core;
let inviati = {}, noteInviate = '';
const livelli = [], chi = new Set();

function suPcm(buf) {
  const f = new Float32Array(buf);
  let s = 0;
  for (const v of f) s += v * v;
  livelli.push([performance.now(), Math.sqrt(s / (f.length || 1))]);
  if (livelli.length > 100) livelli.shift();
  for (const fn of chi) fn(f);
}

// Un Channel nuovo a ogni avvio: riusato, si blocca (#6).
export const avvia = (ingresso, uscita) =>
  core().invoke('avvia_audio', { ingresso, uscita, pcm: Object.assign(new (core().Channel)(), { onmessage: suPcm }) });

// Solo i valori cambiati: le manopole restano in Rust anche quando l'audio riparte su altri Dispositivi.
export function parametri(p) {
  for (const [nome, valore] of Object.entries(p))
    if (inviati[nome] !== valore) { inviati[nome] = valore; core().invoke('set', { nome, valore }); }
}

export function note(hz, k) {
  const c = `${hz.join()}/${k}`;
  if (c !== noteInviate) { noteInviate = c; core().invoke('set_note', { hz, k }); }
}

// Livello (RMS) della voce trattata di ~80 ms fa: così l'onda sopra il video sta con le mani (#6).
export function livello(ritardo = 80) {
  const t = performance.now() - ritardo;
  let v = 0;
  for (const [ti, r] of livelli) { if (ti > t) break; v = r; }
  return v;
}

// La Registrazione si attacca qui al PCM; restituisce la funzione per staccarsi.
export function ascolta(fn) { chi.add(fn); return () => chi.delete(fn); }
