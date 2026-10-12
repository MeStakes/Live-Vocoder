import { test } from 'node:test';
import assert from 'node:assert/strict';
import { noteDellAccordo, nomeAccordo, percentuale } from '../src/accordo.js';

const vicine = (a, b) => assert.ok(a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) < 0.01), `${a} invece di ${b}`);
const N = (r, t, o = 0) => ({ r, t, o });

test('accordi: 3 note, la 7ª al posto della 5ª', () => {
  vicine(noteDellAccordo(N(0, 'M'), 'accordi', 3).hz, [261.63, 329.63, 392.0]);
  vicine(noteDellAccordo(N(0, 's7'), 'accordi', 3).hz, [261.63, 329.63, 466.17]);
  vicine(noteDellAccordo(N(0, 'maj7'), 'accordi', 3).hz, [261.63, 329.63, 493.89]);
  vicine(noteDellAccordo(N(0, 'sus'), 'accordi', 3).hz, [261.63, 349.23, 392.0]);
  assert.equal(noteDellAccordo(N(0, 'm'), 'accordi', 3).k, 3);
});

test('Pienezza 4 aggiunge il basso, 5 anche la Base sopra', () => {
  vicine(noteDellAccordo(N(0, 'M'), 'accordi', 4).hz, [261.63, 329.63, 392.0, 130.81]);
  vicine(noteDellAccordo(N(0, 'M'), 'accordi', 5).hz, [261.63, 329.63, 392.0, 130.81, 523.25]);
});

test('Nota singola: solo la Base, più le ottave della Pienezza', () => {
  vicine(noteDellAccordo(N(9, 'm', -1), 'nota', 3).hz, [220.0]);
  vicine(noteDellAccordo(N(9, 'm', -1), 'nota', 5).hz, [220.0, 110.0, 440.0]);
  assert.equal(noteDellAccordo(N(9, 'm', -1), 'nota', 5).k, 1);
});

test('nome nel video', () => {
  assert.equal(nomeAccordo(N(9, 'm'), 'accordi'), 'Lam');
  assert.equal(nomeAccordo(N(10, 'maj7'), 'accordi'), 'Si♭maj7');
  assert.equal(nomeAccordo(N(9, 'm'), 'nota'), 'La');
});

test('Intensità lineare tra 1 e 5 dita', () => {
  assert.deepEqual([1, 2, 3, 4, 5].map((n) => percentuale(n, 60, 90)), [60, 68, 75, 83, 90]);
});
