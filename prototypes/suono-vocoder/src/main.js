// PROTOTIPO usa e getta, ticket "Suono del vocoder" (#13).
const { invoke } = window.__TAURI__.core;
const $ = (id) => document.getElementById(id);
const say = (line) => { $('out').textContent += line + '\n'; $('out').scrollTop = 1e9; };
const guard = (fn) => async () => { try { await fn(); } catch (e) { say('ERRORE ' + e); } };
// Sceglie il dispositivo che somiglia a re (cuffie, microfono del Mac), se no tiene la scelta di prima.
const fill = (sel, names, re) => {
  const keep = sel.value;
  sel.innerHTML = '';
  for (const n of names) sel.add(new Option(n, n));
  sel.value = names.find((n) => re.test(n)) ?? (names.includes(keep) ? keep : names[0]);
};

// Ogni manopola ha data-p = nome che capisce Rust. Gruppi di bottoni: vale quello acceso.
const knobs = [...document.querySelectorAll('[data-p]')];
const value = (el) => (el.classList.contains('seg') ? el.querySelector('.on').value : el.value);
const get = (p) => +value(document.querySelector(`[data-p=${p}]`));
const label = (p) => document.querySelector(`[data-p=${p}] .on`).textContent;
const send = (el) => invoke('set', { name: el.dataset.p, value: +value(el) }).then(render, (e) => say('ERRORE ' + e));
const pct = (v) => Math.round(v * 100) + '%';

for (const el of knobs) {
  if (el.classList.contains('seg')) {
    el.onclick = (e) => {
      if (e.target.tagName !== 'BUTTON') return;
      el.querySelector('.on').classList.remove('on');
      e.target.classList.add('on');
      send(el);
    };
  } else el.oninput = () => send(el);
}

function intensity() {
  const [a, b] = [get('int1'), get('int5')];
  return a + ((b - a) * (get('intensita') - 1)) / 4;
}
const NOTE = ['Do', 'Do#', 'Re', 'Re#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si'];
const noteName = (f) => { const m = Math.round(69 + 12 * Math.log2(f / 440)); return NOTE[m % 12] + (Math.floor(m / 12) - 1); };
let heardHz = 0;
function render() {
  const fx = get('effetto');
  const what = ['volume accordi', 'vocoder', 'coro'][fx];
  $('l1').textContent = `Intensità 1 (${what})`;
  $('l5').textContent = `Intensità 5 (${what})`;
  // Le manopole che non toccano l'effetto scelto si spengono (data-for = effetti in cui contano)
  for (const r of document.querySelectorAll('[data-for]')) r.classList.toggle('off', !r.dataset.for.split(' ').includes(String(fx)));
  const show = { volume: (v) => '×' + v, scivolata: (v) => Math.round(v * 1000) + ' ms', gate: (v) => (v ? Math.round(-70 + 40 * v) + ' dB' : 'spento') };
  for (const el of knobs) if (el.type === 'range') el.nextElementSibling.textContent = (show[el.dataset.p] ?? pct)(+el.value);
  const sound = fx === 2
    ? `${get('voci')} voci vicine alla tua nota · senti <b>${heardHz ? `${noteName(heardHz)} (${Math.round(heardHz)} Hz)` : '–'}</b>`
    : `${label('timbro')} · ${get('voci')} voci · ottava ${get('ottava')}${fx === 1 ? ` · ${get('bande')} bande` : ''} · morbidezza ${pct(get('morbidezza'))}`;
  $('stato').innerHTML = `Ora senti: <b>${label('effetto')}</b> · Perlina ${get('perlina')} = <b>${label('perlina')}</b> ·
    Intensità <b>${get('intensita')}</b> = ${pct(intensity())} ${what}<br>
    ${sound} · scivolata ${Math.round(get('scivolata') * 1000)} ms${fx ? ` · consonanti ${pct(get('sibilanti'))}` : ''}`;
}
// Nel Coro mostra la nota che l'harmonizer sente cantare: se è sbagliata, il coro stona.
setInterval(async () => {
  if (!running || get('effetto') !== 2) return;
  heardHz = await invoke('heard');
  render();
}, 150);
const pushAll = () => Promise.all(knobs.map(send));

// Tastiera = mani finte
const keys = { 1: ['perlina', 1], 2: ['perlina', 2], 3: ['perlina', 3], 4: ['perlina', 4], 5: ['perlina', 5], q: ['intensita', 1], w: ['intensita', 2], e: ['intensita', 3], r: ['intensita', 4], t: ['intensita', 5] };
document.onkeydown = (e) => {
  const k = keys[e.key.toLowerCase()];
  if (k && !e.metaKey) document.querySelector(`[data-p=${k[0]}] button[value="${k[1]}"]`).click();
};

let running = false;
const start = async () => { say(await invoke('start', { input: $('in').value, output: $('outdev').value, buffer: 64 })); running = true; };
$('start').onclick = guard(start);
$('stop').onclick = guard(async () => { await invoke('stop'); running = false; say('fermo'); });

// File voce: WebKit lo decodifica e lo porta a 48 kHz, qui diventa mono e va a Rust.
$('file').onchange = guard(async () => {
  const f = $('file').files[0];
  const buf = await new OfflineAudioContext(1, 1, 48000).decodeAudioData(await f.arrayBuffer());
  const mono = new Float32Array(buf.length);
  for (let c = 0; c < buf.numberOfChannels; c++) buf.getChannelData(c).forEach((v, i) => (mono[i] += v / buf.numberOfChannels));
  say(`file voce ${f.name}: ${await invoke('load_voice', new Uint8Array(mono.buffer))}`);
  document.querySelector('[data-p=fonte] button[value="1"]').click();
  if (running) await start(); // il file entra nell'audio al riavvio
});

$('save').onclick = guard(async () => {
  const name = [label('effetto').split(' ')[0], label('timbro').split(' ')[0], get('voci') + 'voci', 'ott' + get('ottava'), get('bande') + 'bande', 'morb' + pct(get('morbidezza')), 'int' + get('intensita'), Date.now()].join('-').replace(/%/g, '') + '.wav';
  say('salvato ' + (await invoke('save_wav', { name })));
});

// Sui Mac M1 le cuffie a filo esistono come uscita solo da collegate: se le colleghi dopo, Aggiorna elenco.
const listDevices = async () => {
  const [ins, outs] = await invoke('devices');
  fill($('in'), ins, /MacBook/);
  fill($('outdev'), outs, /Cuffie|Headphones/);
};
$('refresh').onclick = guard(listDevices);
listDevices().then(pushAll).catch((e) => say('ERRORE ' + e));
