import { test } from 'node:test';
import assert from 'node:assert/strict';
import { controllaNome, datiIniziali, canzone, DEF_SONG } from '../src/canzoni.js';

test('primo avvio: solo «Ma Lei» con Do, Lam, Fa, Sol, Mim', () => {
  const d = datiIniziali();
  assert.equal(d.aperta, 'Ma Lei');
  assert.deepEqual(d.canzoni.map((c) => c.name), ['Ma Lei']);
  assert.deepEqual(d.canzoni[0].data.beads.map((b) => `${b.r}${b.t}${b.o}`), ['0M0', '9m0', '5M0', '7M0', '4m0']);
  assert.equal(d.canzoni[0].data.eff, 'coro');
});

test('Note e Suono di partenza: Do, Sol, Lam, Fa, Mim', () => {
  assert.deepEqual(DEF_SONG.beads.map((b) => `${b.r}${b.t}`), ['0M', '7M', '9m', '5M', '4m']);
});

test('canzone completa i campi mancanti', () => {
  const c = canzone('X', { eff: 'vocoder', snd: { bande: 16 } });
  assert.equal(c.data.eff, 'vocoder');
  assert.equal(c.data.snd.bande, 16);
  assert.equal(c.data.snd.vol, 2);
  assert.equal(c.data.mano, 'sinistra');
});

test('il nome diventa una cartella: mai fuori, mai nascosta, mai doppia', () => {
  const songs = [{ name: 'Ma Lei' }, { name: 'Notte' }];
  assert.equal(controllaNome('  ', songs, -1), 'Scrivi un nome.');
  assert.equal(controllaNome('a/b', songs, -1), 'Il nome non può contenere / o :');
  assert.equal(controllaNome('a:b', songs, -1), 'Il nome non può contenere / o :');
  for (const n of ['.', '..', '.segreta']) assert.equal(controllaNome(n, songs, -1), 'Il nome non può iniziare con un punto.');
  assert.equal(controllaNome('ma lei', songs, -1), "C'è già una Canzone con questo nome.");
  assert.equal(controllaNome('MA LEI', songs, 0), '');
  assert.equal(controllaNome('x'.repeat(41), songs, -1), 'Il nome è troppo lungo.');
  assert.equal(controllaNome('Cuore di vetro', songs, -1), '');
});
