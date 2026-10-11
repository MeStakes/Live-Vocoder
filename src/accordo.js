// Note e accordi: da una Nota (Base r, Tipo t, ottava o) alle frequenze che suonano e al nome nel video (spec §3).
export const NOTE = ['Do', 'Do♯', 'Re', 'Mi♭', 'Mi', 'Fa', 'Fa♯', 'Sol', 'La♭', 'La', 'Si♭', 'Si'];
// Nella Settima e nella Maj7 la 7ª prende il posto della 5ª: le note sono sempre 3, così il numero della Pienezza resta vero.
export const TIPI = {
  M: { label: 'Maggiore', suf: '', iv: [0, 4, 7] },
  m: { label: 'Minore', suf: 'm', iv: [0, 3, 7] },
  s7: { label: 'Settima', suf: '7', iv: [0, 4, 10] },
  maj7: { label: 'Maj7', suf: 'maj7', iv: [0, 4, 11] },
  sus: { label: 'Sus4', suf: 'sus4', iv: [0, 5, 7] },
};
export const OCT = [[-1, 'Bassa'], [0, 'Media'], [1, 'Alta']];
const DO4 = 261.63; // ottava Media = ottava 4, il registro della voce di Keopees

// hz: le note che suonano. k: quante sono "accordo"; le altre sono basso e ottava sopra, che nel Coro seguono la Base.
export function noteDellAccordo(nota, modalita, pienezza) {
  const base = DO4 * 2 ** (nota.r / 12 + nota.o);
  const iv = modalita === 'accordi' ? TIPI[nota.t].iv : [0];
  const hz = iv.map((s) => base * 2 ** (s / 12));
  if (pienezza >= 4) hz.push(base / 2);
  if (pienezza >= 5) hz.push(base * 2);
  return { hz, k: iv.length };
}

export const nomeAccordo = (nota, modalita) => NOTE[nota.r] + (modalita === 'accordi' ? TIPI[nota.t].suf : '');

// Intensità 2, 3 e 4: lineare tra "con 1 dito" e "con 5 dita" (#13).
export const percentuale = (livello, i1, i5) => Math.round(i1 + ((i5 - i1) * (livello - 1)) / 4);
