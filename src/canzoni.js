// Canzoni: cosa salva una Canzone, i valori di partenza, le regole del nome (spec §8).
import { DEF_SND } from './manopole.js';

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
