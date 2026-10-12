// Canzoni: cosa salva una Canzone, i valori di partenza, le regole del nome (spec §8).
import { DEF_SND, EKEYS, KN } from './manopole.js';
import { TIPI } from './accordo.js';

const B = (r, t, o = 0) => ({ r, t, o });
// "Note e Suono di partenza" di una Canzone nuova
export const DEF_SONG = {
  beads: [B(0, 'M'), B(7, 'M'), B(9, 'm'), B(5, 'M'), B(4, 'm')], mode: 'accordi', format: 'verticale', eff: 'coro', snd: DEF_SND,
  titolo: true, filtro: true, specchio: true, conto: true, mano: 'sinistra',
};
export const SONG_KEYS = Object.keys(DEF_SONG);
// Completa con i valori di partenza: una versione nuova dell'app può aggiungere campi.
export const canzone = (name, over = {}) => ({ name, data: structuredClone({ ...DEF_SONG, ...over, snd: { ...DEF_SND, ...over.snd } }) });

// Primo avvio: una sola Canzone, «Ma Lei», con Do, Lam, Fa, Sol, Mim.
export const datiIniziali = () => ({
  versione: 1, cartella: null, dispositivi: {}, aperta: 'Ma Lei', guidaVista: false,
  canzoni: [canzone('Ma Lei', { beads: [B(0, 'M'), B(9, 'm'), B(5, 'M'), B(7, 'M'), B(4, 'm')] })],
});

// Il nome diventa una cartella (Cartella/<Canzone>/): unico, senza / o :, non nascosta, non fuori dalla cartella.
export function controllaNome(n, songs, except) {
  n = n.trim();
  if (!n) return 'Scrivi un nome.';
  if (n.length > 40) return 'Il nome è troppo lungo.';
  if (/[\/:]/.test(n)) return 'Il nome non può contenere / o :';
  if (n.startsWith('.')) return 'Il nome non può iniziare con un punto.';
  if (songs.some((s, i) => i !== except && s.name.toLowerCase() === n.toLowerCase())) return "C'è già una Canzone con questo nome.";
  return '';
}

// Valori ammessi dei campi di una Canzone: quelli sbagliati tornano ai valori di partenza.
const AMMESSI = { mode: ['accordi', 'nota'], format: ['verticale', 'orizzontale'], eff: EKEYS, mano: ['sinistra', 'destra'] };
const notaValida = (b) => b && Number.isInteger(b.r) && b.r >= 0 && b.r <= 11 && Object.hasOwn(TIPI, b.t) && [-1, 0, 1].includes(b.o);
function ripara(data) {
  const d = canzone('', data && typeof data === 'object' ? data : {}).data;
  for (const [k, ok] of Object.entries(AMMESSI)) if (!ok.includes(d[k])) d[k] = DEF_SONG[k];
  for (const k of ['titolo', 'filtro', 'specchio', 'conto']) if (typeof d[k] !== 'boolean') d[k] = DEF_SONG[k];
  const beads = Array.isArray(d.beads) ? d.beads : [];
  d.beads = DEF_SONG.beads.map((b0, i) => (notaValida(beads[i]) ? { r: beads[i].r, t: beads[i].t, o: beads[i].o } : { ...b0 }));
  if (!d.snd || typeof d.snd !== 'object') d.snd = { ...DEF_SND };
  for (const K of KN) if (!K.vals.includes(d.snd[K.k])) d.snd[K.k] = K.def;
  return d;
}

// Dai dati salvati. null se non si leggono o se una Canzone non ha un nome valido: il file va messo da parte, non sovrascritto.
// I campi mancanti o sbagliati si riparano uno alla volta (una versione nuova può aggiungere campi).
export function interpreta(testo) {
  let d;
  try { d = JSON.parse(testo); } catch { return null; }
  if (!d || !Array.isArray(d.canzoni) || !d.canzoni.length) return null;
  const canzoni = [];
  for (const c of d.canzoni) {
    if (!c || typeof c.name !== 'string' || controllaNome(c.name, canzoni, -1)) return null;
    canzoni.push({ name: c.name.trim(), data: ripara(c.data) });
  }
  return {
    ...datiIniziali(), ...d, canzoni,
    cartella: typeof d.cartella === 'string' ? d.cartella : null,
    dispositivi: d.dispositivi && typeof d.dispositivi === 'object' ? d.dispositivi : {},
    guidaVista: d.guidaVista === true,
  };
}

const invoke = (...a) => window.__TAURI__.core.invoke(...a);

export async function carica() {
  let t;
  try { t = await invoke('leggi_canzoni'); } catch { t = ''; }
  if (t == null) return { dati: datiIniziali(), rotto: false };
  const dati = interpreta(t);
  if (dati) return { dati, rotto: false };
  await invoke('metti_da_parte_canzoni').catch(() => {});
  return { dati: datiIniziali(), rotto: true };
}

// Salvataggio automatico: dopo 300 ms senza modifiche.
let attesa;
export function salva(dati) {
  clearTimeout(attesa);
  attesa = setTimeout(() => invoke('scrivi_canzoni', { json: JSON.stringify(dati) }), 300);
}
