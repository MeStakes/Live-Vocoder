import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEF_SND, parametriRust, scegli } from '../src/manopole.js';

test('predefiniti del Suono (#13)', () => {
  assert.deepEqual(DEF_SND, { i1: 60, i5: 90, voci: 4, scivola: 0, timbro: 'supersaw', bande: 24, morb: 0, cons: 15, gate: -75, vol: 2 });
});

test('valori che capisce Rust', () => {
  assert.deepEqual(parametriRust({ eff: 'coro', snd: DEF_SND, lv: 3 }),
    { effetto: 2, wet: 0.75, timbro: 1, bande: 24, cons: 0.15, morb: 0, scivola: 0, gate: -75, vol: 2 });
  assert.equal(parametriRust({ eff: 'spento', snd: { ...DEF_SND, scivola: 120 }, lv: 1 }).scivola, 0.12);
});

test('Dispositivo che sparisce e ricompare: la scelta di Keopees torna', () => {
  const cuffie = 'Cuffie esterne', casse = 'Altoparlanti MacBook Air';
  assert.equal(scegli([casse], cuffie, casse), casse);
  assert.equal(scegli([casse, cuffie], cuffie, casse), cuffie);
  assert.equal(scegli(['A', 'B'], undefined, 'B'), 'B');
  assert.equal(scegli(['A'], 'X', 'Y'), 'A');
});
