import { test } from 'node:test';
import assert from 'node:assert/strict';
import { alzate, conta, Stabile, assegna, leggi } from '../src/mani.js';

// Mano aperta del prototipo pannello-suono (HAND) e la sua chiusura delle dita (handPoints), per avere mani finte credibili.
const HAND = [[.50,.95],[.38,.86],[.29,.75],[.23,.65],[.18,.56],[.40,.58],[.37,.42],[.35,.31],[.34,.21],[.50,.56],[.50,.38],[.50,.26],[.50,.15],[.59,.58],[.61,.42],[.62,.31],[.63,.22],[.67,.63],[.71,.51],[.73,.43],[.75,.35]];
const FINGERS = [[1,2,3,4],[5,6,7,8],[9,10,11,12],[13,14,15,16],[17,18,19,20]];
function handPoints(fd) {
  return HAND.map((p, j) => {
    const f = FINGERS.findIndex(fg => fg.includes(j));
    if (f < 0) return p;
    const k = fd[f], order = FINGERS[f].indexOf(j);
    if (f === 0) return [p[0] + (.46 - p[0]) * k * .7 * (order / 3), p[1] + (.72 - p[1]) * k * .7 * (order / 3)];
    if (order === 0) return p;
    const m = HAND[FINGERS[f][0]];
    const q = [m[0] + (p[0] - m[0]) * .25, m[1] + .05 * order];
    return [p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k];
  });
}
// n dita aperte nell'ordine del prototipo: indice, medio, anulare, mignolo, pollice
const mano = (n) => { const fd = [1, 1, 1, 1, 1]; [1, 2, 3, 4, 0].slice(0, n).forEach(f => (fd[f] = 0)); return handPoints(fd); };
const px = (pts, ang = 0) => pts.map(([x, y]) => {
  const dx = x - .5, dy = y - .95, c = Math.cos(ang), s = Math.sin(ang);
  return [1000 * (.5 + dx * c - dy * s), 1000 * (.95 + dx * s + dy * c), 0];
});

test('conta le dita alzate da 0 (pugno) a 5', () => {
  for (let n = 0; n <= 5; n++) assert.equal(conta(alzate(px(mano(n)))), n, `${n} dita`);
});

test('la mano ruotata conta le stesse dita', () => {
  for (const ang of [Math.PI / 2, -Math.PI / 3, Math.PI])
    for (const n of [0, 2, 5]) assert.equal(conta(alzate(px(mano(n), ang))), n, `${n} dita a ${ang}`);
});

test('debounce: un cambio vale solo se dura 90 ms (niente Note fantasma)', () => {
  const s = new Stabile(0);
  assert.equal(s.metti(3, 0), 0);
  assert.equal(s.metti(3, 60), 0);
  assert.equal(s.metti(0, 70), 0);   // sfarfallio: torna a 0 prima dei 90 ms
  assert.equal(s.metti(3, 100), 0);
  assert.equal(s.metti(3, 150), 0);
  assert.equal(s.metti(3, 191), 3);  // 91 ms stabile
});

test('due mani: decide la x del polso (nel fotogramma grezzo la destra di Keopees sta a sinistra)', () => {
  const a = { n: [[.2, .5, 0]], etichetta: 'Left' }, b = { n: [[.8, .5, 0]], etichetta: 'Left' };
  assert.deepEqual(assegna([a, b], {}, 0), { destra: a, sinistra: b });
  assert.deepEqual(assegna([b, a], {}, 0), { destra: a, sinistra: b });
});

test("una mano: l'etichetta di MediaPipe va girata, salvo continuità con l'altra traccia", () => {
  const h = { n: [[.3, .5, 0]], etichetta: 'Left' };
  assert.deepEqual(assegna([h], {}, 0), { destra: h, sinistra: null });
  const tracce = { sinistra: { polso: [.31, .5, 0], visto: 900 } };
  assert.deepEqual(assegna([h], tracce, 1000), { sinistra: h, destra: null });
  assert.deepEqual(assegna([h], tracce, 1500), { destra: h, sinistra: null }); // vista troppo tempo fa
});

test('mano persa da meno di 250 ms: ancora in campo; poi accordi fermi', () => {
  const tracce = { sinistra: { n: [], visto: 1000, alzate: [false, true, true, false, false] }, destra: { n: [], visto: 1000, alzate: [true, true, true, true, true] } };
  assert.deepEqual([leggi(tracce, 'sinistra', 1200).nota, leggi(tracce, 'sinistra', 1200).dita2], [2, 5]);
  assert.deepEqual([leggi(tracce, 'sinistra', 1300).nota, leggi(tracce, 'sinistra', 1300).dita2], [0, null]);
  assert.equal(leggi(tracce, 'destra', 1200).nota, 5);
});
