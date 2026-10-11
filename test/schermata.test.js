// La schermata è il prototipo pannello-suono rifatto identico: qui si controlla solo che i file stiano in piedi.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test("niente font da internet: l'app funziona offline", () => {
  assert.doesNotMatch(readFileSync('src/index.html', 'utf8'), /fonts\.googleapis|fonts\.gstatic/);
});
