// Il Suono del banco: Effetti, manopole e Dispositivi, con nomi e testi del prototipo pannello-suono (a0270c0).
import { percentuale } from './accordo.js';

export const EFF = {
  coro: { name: 'Coro', sub: "La tua voce copiata sull'accordo della Nota, come un coro." },
  vocoder: { name: 'Vocoder', sub: 'La tua voce fa cantare le parole a un synth.' },
  spento: { name: 'Spento', sub: 'Voce pulita, e sopra gli accordi come una tastiera.' },
};
export const EKEYS = Object.keys(EFF), ALL = EKEYS;
const steps = (a, b, s) => Array.from({ length: Math.round((b - a) / s) + 1 }, (_, i) => +(a + i * s).toFixed(2));
const it = (v) => v.toLocaleString('it-IT');
const pct = (v) => v + '%';
export const KN = [
  { k: 'i1', name: 'Intensità con 1 dito', cname: 'Con 1 dito', vals: steps(0, 100, 5), def: 60, fmt: pct, for: ALL,
    help: 'Quanto Effetto senti, rispetto alla tua voce pulita, quando alzi 1 dito della seconda mano. Con Spento è quanto forte suonano gli accordi.' },
  { k: 'i5', name: 'Intensità con 5 dita', cname: 'Con 5 dita', vals: steps(0, 100, 5), def: 90, fmt: pct, for: ALL,
    help: "Come sopra, ma con 5 dita alzate. Tra 1 e 5 dita l'Effetto cresce un po' alla volta." },
  { k: 'voci', name: 'Pienezza', vals: [3, 4, 5], def: 4,
    fmt: (v) => ({ 3: '3 · leggero', 4: '4 · col basso', 5: '5 · pieno' })[v], for: ALL,
    help: 'Quante note suonano insieme in ogni accordo. 3 = leggero, 4 aggiunge il basso, 5 aggiunge anche una nota in alto.' },
  { k: 'scivola', name: 'Scivolata', vals: steps(0, 400, 20), def: 0, fmt: (v) => (v ? it(v / 1000) + ' s' : 'niente'), for: ALL,
    help: 'Quando cambi Nota le note scivolano verso il nuovo accordo invece di saltare. Niente = salto netto.' },
  { k: 'timbro', name: 'Timbro', vals: ['sega', 'supersaw', 'quadra'], def: 'supersaw',
    fmt: (v) => ({ sega: 'Sega', supersaw: 'Supersaw', quadra: 'Quadra' })[v], for: ['vocoder', 'spento'],
    help: 'Il colore del synth. Sega graffia, Supersaw è largo e pieno (il suono pop), Quadra è più vuoto, da videogioco.' },
  { k: 'bande', name: 'Dettaglio', vals: [8, 12, 16, 24, 32], def: 24, short: (v) => v + ' fette',
    fmt: (v) => `${v} fette, ${({ 8: 'tanto robot', 12: 'robot', 16: 'a metà', 24: 'parole chiare', 32: 'chiarissime' })[v]}`, for: ['vocoder'],
    help: 'In quante fette il Vocoder taglia la tua voce. Poche fette = più robot, tante = le parole si capiscono meglio.' },
  { k: 'morb', name: 'Morbidezza', vals: steps(0, 100, 5), def: 0, fmt: pct, for: ['vocoder', 'spento'],
    help: "Rende il synth più scuro e più dolce, e un po' più lento a seguire la voce." },
  { k: 'cons', name: 'Consonanti chiare', cname: 'Consonanti', vals: steps(0, 100, 5), def: 15, fmt: pct, for: ['coro', 'vocoder'],
    help: "Fa passare le S, le T e il fiato della tua voce vera, così le parole si capiscono anche con tanto Effetto." },
  { k: 'gate', name: 'Anti-fruscio', vals: steps(-75, -30, 5), def: -75, short: (v) => (v <= -75 ? 'spento' : it(v) + ' dB'),
    fmt: (v) => (v <= -75 ? 'spento' : `${v <= -60 ? 'leggero' : v <= -45 ? 'medio' : 'forte'} (${it(v)} dB)`), for: ALL,
    help: 'Chiude il microfono quando non canti, così non si sentono fruscii e rumori di casa. Più forte taglia di più, ma può mangiare i finali delle frasi.' },
  { k: 'vol', name: 'Volume in cuffia', cname: 'Volume', vals: steps(0.25, 6, 0.25), def: 2, fmt: (v) => '×' + it(v), for: ALL,
    help: 'Quanto forte ti senti in cuffia mentre canti. Non cambia il volume della Registrazione.' },
];
export const KM = Object.fromEntries(KN.map((K) => [K.k, K]));
export const GROUPS = [['Mano', ['i1', 'i5']], ['Accordo', ['voci', 'scivola']], ['Synth', ['timbro', 'bande', 'morb']], ['Voce', ['cons', 'gate']], ['Cuffia', ['vol']]];
// Dispositivi: valgono per tutte le Canzoni, come la cartella delle Registrazioni. Gli elenchi veri arrivano da Rust.
export const DEVS = [
  { k: 'in', name: 'Ingresso audio', help: 'Il microfono in cui canti. Quello del Mac va bene, un microfono USB suona meglio.' },
  { k: 'out', name: 'Uscita audio', help: "Dove senti l'Ascolto. Servono cuffie a filo: con gli altoparlanti l'Ascolto resta spento perché fischierebbe, con le cuffie Bluetooth arriva in ritardo." },
  { k: 'cam', name: 'Camera', help: "La camera del video. L'iPhone dà il video verticale migliore; se non c'è, si usa quella del Mac." },
];
export const DM = Object.fromEntries(DEVS.map((d) => [d.k, d]));
export const DEF_SND = Object.fromEntries(KN.map((K) => [K.k, K.def]));

const EFFETTO = { spento: 0, vocoder: 1, coro: 2 }, TIMBRO = { sega: 0, supersaw: 1, quadra: 2 };
// Valori nelle unità di audio.rs (NOMI): quota d'Effetto 0..1, scivolata in secondi, Anti-fruscio in dB.
export function parametriRust({ eff, snd, lv }) {
  return {
    effetto: EFFETTO[eff], wet: percentuale(lv, snd.i1, snd.i5) / 100, timbro: TIMBRO[snd.timbro], bande: snd.bande,
    cons: snd.cons / 100, morb: snd.morb / 100, scivola: snd.scivola / 1000, gate: snd.gate, vol: snd.vol,
  };
}

// Ingressi usabili: mai un microfono Bluetooth. Quello delle AirPods va solo a 24 kHz e porta anche l'uscita
// in vivavoce, peggiorando l'Ascolto. Se il predefinito di macOS è Bluetooth, si ripiega sul microfono del Mac.
export function ingressi(audio) {
  const ok = audio.filter((d) => d.ingresso && d.tipo !== 'bluetooth');
  const pre = ok.find((d) => d.predefinito_ingresso) ?? ok.find((d) => d.integrato) ?? ok[0];
  return { lista: ok.map((d) => d.nome), predefinito: pre?.nome };
}

// Il Dispositivo scelto da Keopees se c'è; altrimenti quello predefinito di macOS. La scelta resta salvata e torna quando ricompare.
export const scegli = (lista, voluto, predefinito) => (lista.includes(voluto) ? voluto : lista.includes(predefinito) ? predefinito : lista[0]);
