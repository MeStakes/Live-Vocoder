// La schermata è il prototipo pannello-suono rifatto identico: qui si controlla solo che i file stiano in piedi.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test("niente font da internet: l'app funziona offline", () => {
  assert.doesNotMatch(readFileSync('src/index.html', 'utf8'), /fonts\.googleapis|fonts\.gstatic/);
});
import { execFileSync } from 'node:child_process';

for (const f of ['ui.js', 'video.js'])
  test(`${f} si legge (sintassi)`, () => execFileSync(process.execPath, ['--check', `src/${f}`]));

test('lo script della schermata sta in ui.js', () => {
  const h = readFileSync('src/index.html', 'utf8');
  assert.match(h, /<script type="module" src="ui\.js"><\/script>/);
  assert.doesNotMatch(h, /<script>/);
});
