// La schermata è il prototipo pannello-suono rifatto identico: qui si controlla solo che i file stiano in piedi.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test("niente font da internet: l'app funziona offline", () => {
  assert.doesNotMatch(readFileSync('src/index.html', 'utf8'), /fonts\.googleapis|fonts\.gstatic/);
});
import { execFileSync } from 'node:child_process';

for (const f of ['ui.js', 'video.js', 'motore.js', 'avvisi.js', 'camera.js', 'mani.js', 'registra.js', 'worklet.js'])
  test(`${f} si legge (sintassi)`, () => execFileSync(process.execPath, ['--check', `src/${f}`]));

test('lo script della schermata sta in ui.js', () => {
  const h = readFileSync('src/index.html', 'utf8');
  assert.match(h, /<script type="module" src="ui\.js"><\/script>/);
  assert.doesNotMatch(h, /<script>/);
});

test("le classi messe su .app non sono anche classi di elementi (se no $('.x') trova .app)", () => {
  const ui = readFileSync('src/ui.js', 'utf8'), html = readFileSync('src/index.html', 'utf8');
  const sulApp = [...ui.matchAll(/\$\('\.app'\)\.classList\.toggle\('([\w-]+)'/g)].map(m => m[1]);
  assert.ok(sulApp.length > 0);
  const classi = new Set([...html.matchAll(/class="([^"]+)"/g), ...ui.matchAll(/class="([^"$]+)"/g)].flatMap(m => m[1].split(/\s+/)));
  for (const c of sulApp) assert.ok(!classi.has(c), `.${c} è anche la classe di un elemento`);
});
test('la guida ha i tre capitoli, in ordine', async () => {
  const { guida } = await import('../src/guida.js');
  const h = guida(K => 'solo ' + K.for.join(' e '));
  const i = ['COME SI SUONA', 'IL SUONO', 'LA PARTE TECNICA'].map(t => h.indexOf(t));
  assert.ok(i.every(x => x >= 0) && i[0] < i[1] && i[1] < i[2], String(i));
  for (const t of ['Anti-fruscio', 'Cuffie a filo', 'Reazioni', 'Mac aperto']) assert.ok(h.includes(t), t);
});
