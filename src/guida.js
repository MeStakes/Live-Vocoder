// Guida "?" (spec §7): prima come si suona, poi il Suono (stessi testi del display), poi la parte tecnica.
import { EFF, EKEYS, KN } from './manopole.js';

const voce = ([t, d]) => `<dt>${t}</dt><dd>${d}</dd>`;
const COME = [
  ['La Canzone', 'In alto scegli la Canzone: ognuna ricorda le sue 5 Note, il Suono e le Impostazioni. Con «+ Nuova Canzone» ne crei un\'altra.'],
  ['Le 5 Note', 'Sul braccialetto ci sono le tue 5 Note. Tocca una Nota per cambiarla: Base, Tipo e Ottava.'],
  ['La mano degli accordi', 'Alza 1, 2, 3, 4 o 5 dita: suona la Nota con quel numero. Pugno o mano giù: gli accordi si fermano e resta la tua voce pulita.'],
  ["L'altra mano: l'Intensità", "Con l'altra mano alza da 1 a 5 dita: più dita, più Effetto. Se la abbassi, resta l'ultimo livello. Ogni Canzone parte da 3."],
  ['Registrare', 'Premi Registra: dopo il 3, 2, 1 parte il video, con tutto quello che vedi nella polaroid. Premi Stop quando hai finito.'],
  ['Trovare i video', 'Finiscono in Filmati/Live Vocoder, in una cartella per ogni Canzone: «Ma Lei v1», «Ma Lei v2»… Dopo ogni Registrazione puoi guardarla, aprirla nel Finder o buttarla.'],
];
const TECNICA = [
  ['Cuffie a filo', "Servono cuffie col filo. Con gli altoparlanti l'Ascolto resta spento (fischierebbe), con le cuffie Bluetooth arriva in ritardo."],
  ["L'iPhone come camera", "Metti l'iPhone sull'asta vicino al Mac, con Wi-Fi e Bluetooth accesi. In verticale per il video Verticale, girato per l'Orizzontale."],
  ['I permessi', 'La prima volta il Mac chiede Microfono e Camera: rispondi Consenti. Se hai detto no, l\'avviso rosa ti porta al posto giusto.'],
  ['Spegni le Reazioni', 'Certi gesti fanno partire fuochi d\'artificio e palloncini nel video. Con l\'app aperta: Centro di Controllo → Effetti video → spegni Reazioni.'],
  ['La cartella', 'Puoi cambiare la cartella delle Registrazioni in Impostazioni.'],
  ['Tieni il Mac aperto', 'Con il coperchio chiuso il microfono del Mac si spegne.'],
];

export const guida = onlyLabel => `<h2>Guida</h2>
  <p class="lbl">COME SI SUONA</p><dl class="gl">${COME.map(voce).join('')}</dl>
  <p class="lbl">IL SUONO</p>
  <p class="ctx">L'Effetto è cosa succede alla tua voce. Le manopole lo regolano e si salvano nella Canzone.</p>
  <dl class="gl">${EKEYS.map(e => voce([EFF[e].name, EFF[e].sub])).join('')}
  ${KN.map(K => `<dt>${K.name}</dt><dd>${K.help}${K.for.length < 3 ? ` <span class="only">${onlyLabel(K)}</span>` : ''}</dd>`).join('')}</dl>
  <p class="lbl">LA PARTE TECNICA</p><dl class="gl">${TECNICA.map(voce).join('')}</dl>`;
