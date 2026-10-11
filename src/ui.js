// Schermata di Live Vocoder: lo script del prototipo pannello-suono (a0270c0), con dati e logica nei moduli.
import { NOTE, TIPI, OCT, noteDellAccordo, nomeAccordo, percentuale } from './accordo.js';
import { EFF, EKEYS, KN, KM, GROUPS, DEVS, DM } from './manopole.js';
import { DEF_SONG, SONG_KEYS, controllaNome, datiIniziali, carica, salva } from './canzoni.js';
import { disegna, misura } from './video.js';
import * as motore from './motore.js';
import { avviso, stato } from './avvisi.js';
import { parametriRust, scegli } from './manopole.js';
import { apriCamera } from './camera.js';
import { avviaMani } from './mani.js';
import { avviaRegistrazione } from './registra.js';
import { guida } from './guida.js';
const invoke = (...a) => window.__TAURI__.core.invoke(...a);

let dati = datiIniziali(), songs = dati.canzoni;
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc = s => String(s).replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`);
const st = {i:0, edit:-1, lv:3, song:0, ...structuredClone(songs[0].data),
            dev:{}, att:{}, liste:{in:[], out:[], cam:[]}, fermi:false, mani:{accordi:null, seconda:null}, muto:false,
            ui:{panel:null, desk:true, menu:false, form:null, draft:'', err:''}};
const snapshot = () => structuredClone(Object.fromEntries(SONG_KEYS.map(k => [k, st[k]])));
// Apri una Canzone: la seconda mano riparte da Intensità 3 (deciso in "Funzionalità must-have v1").
function openSong(i, save = true) {
  if (save) songs[st.song].data = snapshot();
  st.song = i; Object.assign(st, structuredClone(songs[i].data), {i:0, edit:-1, lv:3});
}

const idx = k => KM[k].vals.indexOf(st.snd[k]);
const setIdx = (k, i) => { const v = KM[k].vals; st.snd[k] = v[Math.max(0, Math.min(v.length - 1, i))]; };
const isDef = () => KN.every(K => st.snd[K.k] === K.def);
const applies = K => K.for.includes(st.eff);
const onlyLabel = K => 'solo ' + K.for.map(e => EFF[e].name).join(' e ');
const lvPct = n => percentuale(n, st.snd.i1, st.snd.i5);

const sw = (k, label) => `<button class="switch" role="switch" data-act="sw" data-val="${k}"><span class="track"></span>${label}</button>`;
const videoSet = () => `<div class="vset">
  <div class="vrow">${sw('titolo', 'Titolo nel video')}<b>il nome della Canzone</b></div>
  ${sw('filtro', 'Filtro rosa')}${sw('specchio', 'Specchio')}${sw('conto', 'Conto alla rovescia 3 s')}
  <div class="vrow">Accordi con la mano <span class="seg" role="group" aria-label="Mano degli accordi"><button data-act="mano" data-val="sinistra">Sinistra</button><button data-act="mano" data-val="destra">Destra</button></span></div>
  <div class="vrow">Cartella delle Registrazioni <button class="pill small" data-act="cartella">${esc(nomeCartella())}</button></div>
</div>`;
const guideSheet = () => guida(onlyLabel);
const knob = K => `<div class="knob${applies(K) ? '' : ' off'}" data-knob="${K.k}" data-help="${K.k}" role="slider" tabindex="0" aria-label="${K.name}" aria-valuemin="0" aria-valuemax="${K.vals.length - 1}">
  <div class="dial"></div><b>${K.cname || K.name}</b><output data-show="${K.k}"></output></div>`;
const desk = () => `<div class="desk-head"><h3>Suono</h3><p class="lcd" data-lcd></p>
    <button class="pill dark" data-act="reset" title="L'Effetto resta quello scelto">Di partenza</button>
    <button class="pill dark" data-act="desk">${st.ui.desk ? 'Nascondi' : 'Mostra'}</button>
    <button class="guide" data-act="panel" data-val="guida" aria-label="Guida">?</button></div>
  ${st.ui.desk ? `<div class="desk-body">
    <div class="grp"><span>Effetto</span><div class="effknob"><button class="dial" data-act="effcycle" aria-label="Cambia Effetto"></button>
      <div class="effnames">${EKEYS.map(e => `<button data-act="eff" data-val="${e}" data-help="eff:${e}">${EFF[e].name}</button>`).join('')}</div></div></div>
    ${GROUPS.map(([g, ks]) => `<div class="grp"><span>${g}</span><div>${ks.map(k => knob(KM[k])).join('')}</div></div>`).join('')}
    <div class="grp"><span>Dispositivi</span><div class="devs">${DEVS.map(d => `<label class="dev" data-help="dev:${d.k}">${d.name}
      <select id="dev-${d.k}" data-dev="${d.k}">${st.liste[d.k].map(o => `<option${o === st.att[d.k] ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select></label>`).join('')}</div></div>
  </div>` : ''}`;
const songMenu = () => {
  const u = st.ui, f = u.form, cur = esc(songs[st.song].name);
  const row = (s, i) => { const d = i === st.song ? st : s.data;
    return `<li><button class="songrow" data-act="song" data-val="${i}"${i === st.song ? ' aria-current="true"' : ''}><b>${esc(s.name)}</b><small>${EFF[d.eff].name} · ${d.format === 'verticale' ? 'Verticale' : 'Orizzontale'}</small></button></li>`; };
  const nameForm = (label, ok, okLabel, extra = '') => `<div class="sform"><label class="lbl" for="song-name">${label}</label>
    <input id="song-name" type="text" maxlength="40" value="${esc(u.draft)}" placeholder="Es. Cuore di vetro">${extra}
    ${u.err ? `<p class="err">${u.err}</p>` : ''}
    <div class="sbtns"><button class="pill danger" data-act="${ok}">${okLabel}</button><button class="pill" data-act="cancel">Annulla</button></div></div>`;
  const foot =
    f?.kind === 'new' ? nameForm('Nome della nuova Canzone', 'create', 'Crea',
      `<span class="lbl">Parti da</span><div class="chips"><button data-act="from" data-val="vuota">Note e Suono di partenza</button><button data-act="from" data-val="copia">Copia di «${cur}»</button></div>`)
    : f?.kind === 'rename' ? nameForm(`Nuovo nome per «${cur}»`, 'dorename', 'Salva')
    : f?.kind === 'del' ? `<div class="sform"><p class="ctx">Eliminare «${cur}»? Note e Suono si perdono. Le Registrazioni restano nella cartella.</p>
        <div class="sbtns"><button class="pill danger" data-act="dodel">Elimina</button><button class="pill" data-act="cancel">Annulla</button></div></div>`
    : `<button class="newsong" data-act="new">+ Nuova Canzone</button>
       <div class="sbtns"><button class="pill small" data-act="rename">Rinomina «${cur}»</button>
         <button class="pill small" data-act="del"${songs.length < 2 ? ' disabled title="Serve almeno una Canzone"' : ''}>Elimina</button></div>`;
  return `<div class="songmenu" role="dialog" aria-label="Canzoni"><p class="lbl">LE TUE CANZONI</p><ul>${songs.map(row).join('')}</ul>${foot}</div>`;
};
const LCD = 'Passa sopra una manopola per sapere cosa fa. Trascina in su o in giù per girarla, doppio clic per il valore di partenza.';

$('#wheel').insertAdjacentHTML('beforeend', st.beads.map((_, i) =>
  `<button data-act="bead" data-val="${i}" style="--a:${i * 72}deg"><b></b><small></small></button>`).join(''));
$('#chips-root').innerHTML = NOTE.map((n, r) => `<button data-act="root" data-val="${r}">${n}</button>`).join('');
$('#chips-type').innerHTML = Object.entries(TIPI).map(([k, t]) => `<button data-act="type" data-val="${k}">${t.label}</button>`).join('');
$('#chips-oct').innerHTML = OCT.map(([o, l]) => `<button data-act="oct" data-val="${o}">${l}</button>`).join('');

const name = b => nomeAccordo(b, st.mode);
const freqs = b => noteDellAccordo(b, st.mode, st.snd.voci).hz;
const dita = i => `${i + 1} ${i ? 'dita' : 'dito'}`;
const octMark = o => o < 0 ? ' ↓' : o > 0 ? ' ↑' : '';

// Ricostruisce banco e pannello laterale, poi aggiorna il resto.
function build() {
  const u = st.ui;
  $('#desk').innerHTML = desk();
  $('#slot-sheet').innerHTML = u.panel ? `<div class="scrim" data-act="close"></div><aside class="sheet" role="dialog" aria-label="${u.panel === 'guida' ? 'Guida' : 'Impostazioni'}">
    <button class="x" data-act="close" aria-label="Chiudi">×</button>${u.panel === 'guida' ? guideSheet() : `<h2>Impostazioni</h2>${videoSet()}`}</aside>` : '';
  $('#slot-menu').innerHTML = u.menu ? songMenu() : '';
  $('#song-name')?.focus();
  setLcd();
  paint();
}

// Ruota, editor della Nota e interruttori: cambiano anche da soli (Note simulate), senza ricostruire il banco.
function paint() {
  document.documentElement.dataset.format = st.format;
  const ed = st.beads[st.edit], chord = name(st.beads[st.i]);
  const bind = {chord, song: songs[st.song].name, edDita: ed ? dita(st.edit) : '', edName: ed ? NOTE[ed.r] + TIPI[ed.t].suf + octMark(ed.o) : ''};
  for (const [k, val] of Object.entries(bind)) $$(`[data-bind="${k}"]`).forEach(el => el.textContent = val);
  $('.core').classList.toggle('long', chord.length > 5);
  $$('[data-act="bead"]').forEach((b, i) => {
    const n = name(st.beads[i]);
    b.querySelector('b').textContent = n;
    b.querySelector('small').textContent = dita(i) + octMark(st.beads[i].o);
    b.classList.toggle('long', n.length > 5);
    b.classList.toggle('on', i === st.i);
    b.classList.toggle('editing', i === st.edit);
  });
  $('#editor').hidden = !ed;
  const pressed = (act, val) => $$(`[data-act="${act}"]`).forEach(b => b.setAttribute('aria-pressed', b.dataset.val === String(val)));
  pressed('mode', st.mode); pressed('format', st.format); pressed('mano', st.mano); pressed('from', st.ui.form?.from);
  if (ed) { pressed('root', ed.r); pressed('type', ed.t); pressed('oct', ed.o); }
  $$('[data-act="sw"]').forEach(b => b.setAttribute('aria-checked', st[b.dataset.val]));
  $('.app').classList.toggle('registrando', !!st.ui.rec);
  $('.rec').textContent = !st.ui.rec ? 'Registra 00:00' : st.ui.conto ? `Stop · ${st.ui.conto}` : `Stop ${mmss(performance.now() - inizio)}`;
  sync();
}

// Aggiorna le manopole senza ricostruire (così una manopola trascinata non perde la presa).
function sync() {
  $$('[data-show]').forEach(o => { const K = KM[o.dataset.show]; o.textContent = (K.short || K.fmt)(st.snd[K.k]); });
  $$('.knob[data-knob]').forEach(kn => {
    const K = KM[kn.dataset.knob], i = idx(K.k);
    kn.querySelector('.dial').style.setProperty('--p', i / (K.vals.length - 1));
    kn.setAttribute('aria-valuenow', i); kn.setAttribute('aria-valuetext', K.fmt(st.snd[K.k]));
  });
  $$('[data-act="eff"]').forEach(b => b.setAttribute('aria-pressed', b.dataset.val === st.eff));
  const ek = $('.effknob .dial'); if (ek) ek.style.setProperty('--p', [.278, .5, .722][EKEYS.indexOf(st.eff)]);
  $$('[data-act="reset"]').forEach(b => b.disabled = isDef());
  invia();
  ricorda();
}
// Il display spiega la manopola sotto il mouse; "solo Vocoder" sta qui invece che sotto la manopola.
function setLcd(k) {
  const el = $('[data-lcd]');
  if (!el) return;
  if (!k) return void (el.textContent = LCD);
  if (k.startsWith('dev:')) { const D = DM[k.slice(4)]; return void (el.textContent = `${D.name}: ${D.help}`); }
  if (k.startsWith('eff:')) { const E = EFF[k.slice(4)]; return void (el.textContent = `${E.name}: ${E.sub}`); }
  const K = KM[k];
  el.textContent = `${K.name}: ${K.help}${K.for.length < 3 ? ` Vale ${onlyLabel(K)}.` : ''}`;
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'), u = st.ui;
  const outside = u.menu && !e.target.closest('.songmenu,[data-act="songmenu"]');
  if (outside) { u.menu = false; u.form = null; }
  if (!b) { if (outside) build(); return; }
  const a = b.dataset.act, v = b.dataset.val, ed = st.beads[st.edit];
  if (a === 'rec') return void (st.ui.rec ? fermaRegistrazione() : registra());
  if (st.ui.rec) return; // durante la Registrazione è tutto bloccato tranne Stop
  if (a === 'cartella') return void scegliCartella();
  if (a === 'songmenu') { u.menu = !u.menu; u.form = null; u.err = ''; }
  if (a === 'song') { if (+v !== st.song) openSong(+v); u.menu = false; }
  if (a === 'new') { u.form = {kind:'new', from:'copia'}; u.draft = ''; u.err = ''; }
  if (a === 'from') u.form.from = v;
  if (a === 'rename') { u.form = {kind:'rename'}; u.draft = songs[st.song].name; u.err = ''; }
  if (a === 'del') u.form = {kind:'del'};
  if (a === 'cancel') { u.form = null; u.err = ''; }
  if (a === 'create' && !(u.err = controllaNome(u.draft, songs, -1))) {
    songs[st.song].data = snapshot();
    songs.push({name:u.draft.trim(), data:u.form.from === 'copia' ? snapshot() : structuredClone(DEF_SONG)});
    openSong(songs.length - 1, false); u.menu = false; u.form = null;
  }
  if (a === 'dorename' && !(u.err = controllaNome(u.draft, songs, st.song))) { songs[st.song].name = u.draft.trim(); u.form = null; }
  if (a === 'dodel') { songs.splice(st.song, 1); st.song = 0; openSong(0, false); u.form = null; }
  if (a === 'mode') st.mode = v;
  if (a === 'format') { st.format = v; controllaDispositivi(); }
  if (a === 'mano') st.mano = v;
  if (a === 'sw') st[v] = !st[v];
  if (a === 'bead') { st.edit = st.edit === +v ? -1 : +v; if (st.edit >= 0) { st.i = st.edit; st.fermi = false; } }
  if (a === 'done') st.edit = -1;
  if (ed && a === 'root') ed.r = +v;
  if (ed && a === 'type') ed.t = v;
  if (ed && a === 'oct') ed.o = +v;
  if (a === 'eff') st.eff = v;
  if (a === 'effcycle') st.eff = EKEYS[(EKEYS.indexOf(st.eff) + 1) % EKEYS.length];
  if (a === 'reset') KN.forEach(K => st.snd[K.k] = K.def);
  if (a === 'panel') u.panel = v;
  if (a === 'close') u.panel = null;
  if (a === 'desk') u.desk = !u.desk;
  build();
});
document.addEventListener('input', e => { if (e.target.id === 'song-name') st.ui.draft = e.target.value; });
document.addEventListener('change', e => { const k = e.target.dataset?.dev; if (k && !st.ui.rec) { st.dev[k] = e.target.value; setLcd('dev:' + k); controllaDispositivi(); } });

// Manopole: trascina su/giù, rotellina, frecce, doppio clic = valore di partenza.
let drag = null, wheelAcc = 0;
document.addEventListener('pointerdown', e => {
  const kn = e.target.closest('.knob[data-knob]');
  if (!kn || st.ui.rec) return;
  drag = {k: kn.dataset.knob, y: e.clientY, i: idx(kn.dataset.knob)};
  kn.setPointerCapture(e.pointerId); kn.focus();
});
document.addEventListener('pointermove', e => {
  if (!drag) return;
  const n = KM[drag.k].vals.length;
  setIdx(drag.k, drag.i + Math.round((drag.y - e.clientY) / 160 * (n - 1))); sync();
});
document.addEventListener('pointerup', () => drag = null);
document.addEventListener('dblclick', e => {
  const kn = e.target.closest('.knob[data-knob]');
  if (kn && !st.ui.rec) { const K = KM[kn.dataset.knob]; st.snd[K.k] = K.def; sync(); }
});
document.addEventListener('wheel', e => {
  const kn = e.target.closest('.knob[data-knob]');
  if (!kn || st.ui.rec) return;
  e.preventDefault(); wheelAcc += e.deltaY;
  if (Math.abs(wheelAcc) < 30) return;
  setIdx(kn.dataset.knob, idx(kn.dataset.knob) + (wheelAcc < 0 ? 1 : -1)); wheelAcc = 0; sync();
}, {passive: false});
const showHelp = e => { const h = e.target.closest?.('[data-help]'); if (h) setLcd(h.dataset.help); };
document.addEventListener('mouseover', showHelp);
document.addEventListener('focusin', showHelp);
document.addEventListener('keydown', e => {
  const kn = e.target.closest?.('.knob[data-knob]');
  const KEYS = {ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, Home: -99, End: 99};
  if (kn && e.key in KEYS && !st.ui.rec) { e.preventDefault(); setIdx(kn.dataset.knob, idx(kn.dataset.knob) + KEYS[e.key]); sync(); return; }
  if (e.key === 'Enter' && e.target.id === 'song-name') $('[data-act="create"],[data-act="dorename"]')?.click();
  if (e.key === 'Escape' && (st.ui.panel || st.ui.menu)) { st.ui.panel = null; st.ui.menu = false; st.ui.form = null; build(); }
});

// --- video: il canvas che si vede nella polaroid e che si registra (video.js), ~30 fotogrammi al secondo come captureStream(30)
const camVideo = $('#cam'), cv = $('canvas');
let ultimoDisegno = 0;
function frame(now) {
  if (now - ultimoDisegno >= 30) {
    ultimoDisegno = now;
    const [W, H] = misura(st.format);
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    const b = st.beads[st.i];
    disegna(cv, {
      video: camVideo, mani: st.mani, specchio: st.specchio, filtro: st.filtro, mano: st.mano, lv: st.lv, lvl: lvPct(st.lv) / 100,
      eff: st.eff, hz: freqs(b), fermi: st.fermi, accordo: name(b), titolo: st.titolo ? songs[st.song].name.trim() : '',
      conto: st.ui.conto, livello: motore.livello(),
    }, reduce ? 1.3 : now / 1000);
  }
  requestAnimationFrame(frame);
}

// Manda a Rust manopole, quota d'Effetto e note che suonano (motore.js manda solo quello che è cambiato).
// Ogni modifica si salva da sola: non c'è un tasto Salva (spec §8).
let pronto = false; // niente salvataggi prima che le Canzoni salvate siano lette: sovrascriverebbero il file
function ricorda() {
  if (!pronto) return;
  songs[st.song].data = snapshot();
  dati.aperta = songs[st.song].name;
  dati.dispositivi = st.dev;
  salva(dati);
}

function invia() {
  motore.parametri({ ...parametriRust(st), muto: st.muto ? 1 : 0 });
  const { hz, k } = noteDellAccordo(st.beads[st.i], st.mode, st.snd.voci);
  st.fermi ? motore.note([], 0) : motore.note(hz, k);
}

// Ogni 2 s e a ogni scelta: i Dispositivi veri. Si usa la scelta di Keopees se c'è, altrimenti quello di macOS (la scelta resta salvata).
let giroDisp = null;
function controllaDispositivi() {
  return (giroDisp ??= (async () => {
    const [audio, camere] = await Promise.all([invoke('dispositivi'), invoke('camere')]);
    const ins = audio.filter(d => d.ingresso), outs = audio.filter(d => d.uscita);
    const prima = JSON.stringify(st.liste);
    st.liste = { in: ins.map(d => d.nome), out: outs.map(d => d.nome), cam: camere.map(c => c.nome) };
    const inn = scegli(st.liste.in, st.dev.in, ins.find(d => d.predefinito_ingresso)?.nome);
    const out = scegli(st.liste.out, st.dev.out, outs.find(d => d.predefinito_uscita)?.nome);
    const cam = scegli(st.liste.cam, st.dev.cam, camere.find(c => c.iphone)?.nome);
    const tipo = outs.find(d => d.nome === out)?.tipo;
    st.muto = tipo === 'altoparlanti';
    if (reg && inn !== st.att.in) fermaRegistrazione("Il microfono si è staccato: ho fermato la Registrazione e l'ho salvata.");
    if (inn !== st.att.in || out !== st.att.out) {
      st.att.in = inn; st.att.out = out;
      await motore.avvia(inn, out).catch(e => avviso('audio', `Non riesco ad accendere l'audio: ${e}`));
    }
    if (cam !== st.att.cam || st.format !== st.camFormato) {
      st.att.cam = cam; st.camFormato = st.format;
      await apriCamera(camVideo, cam, misura(st.format)).catch(e => avviso('camera', `Non riesco ad aprire la camera: ${e}`));
    }
    stato('cuffie', st.muto, "Servono le cuffie a filo: con gli altoparlanti l'Ascolto resta spento, perché fischierebbe.");
    stato('bluetooth', tipo === 'bluetooth', "Con le cuffie Bluetooth l'Ascolto arriva in ritardo: meglio quelle a filo.");
    // la scelta di Keopees resta salvata: quando il Dispositivo ricompare, si torna a quello
    stato('manca-in', !!st.dev.in && inn !== st.dev.in, `«${st.dev.in}» non c'è: uso «${inn}».`);
    stato('manca-out', !!st.dev.out && out !== st.dev.out, `«${st.dev.out}» non c'è: uso «${out}».`);
    stato('manca-cam', !!st.dev.cam && cam !== st.dev.cam, `«${st.dev.cam}» non c'è: uso «${cam}».`);
    stato('iphone', !st.dev.cam && !camere.some(c => c.iphone), "iPhone non trovato: uso la camera del Mac. Avvicinalo, con Wi-Fi e Bluetooth accesi.");
    const [mic, vid] = await invoke('permessi');
    stato('perm-mic', mic === 1 || mic === 2, 'Live Vocoder non può usare il microfono.', [['Apri Impostazioni', () => invoke('apri_privacy', { che: 'microfono' })]]);
    stato('perm-cam', vid === 1 || vid === 2, 'Live Vocoder non può usare la camera.', [['Apri Impostazioni', () => invoke('apri_privacy', { che: 'camera' })]]);
    if (JSON.stringify(st.liste) !== prima) build(); else invia();
  })().finally(() => (giroDisp = null)));
}

// Gesti: si cambia solo quando cambiano le dita, così un clic su una Nota resta finché la mano non fa altro.
// Mano degli accordi: 1–5 = Nota, 0 = accordi fermi. Seconda mano: 1–5 = Intensità; pugno o fuori campo tengono l'ultima.
const ultima = { nota: null, dita2: null };
function suMani({ mani, nota, dita2 }) {
  st.mani = mani;
  let cambia = false;
  if (nota !== ultima.nota) { ultima.nota = nota; st.fermi = nota === 0; if (nota) st.i = nota - 1; cambia = true; }
  if (dita2 !== ultima.dita2) { ultima.dita2 = dita2; if (dita2) { st.lv = dita2; cambia = true; } }
  if (cambia) paint();
}

// --- Registrazione (spec §6)
let reg = null, inizio = 0, orologi = [], predefinita = '', tentativo = 0, fermando = false;
const pausa = ms => new Promise(r => setTimeout(r, ms));
const mmss = ms => { const s = Math.floor(ms / 1000); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
const nomeCartella = () => dati.cartella === predefinita ? 'Filmati/Live Vocoder' : dati.cartella.replace(/^\/Users\/[^/]+/, '~');

async function scegliCartella() {
  const c = await invoke('scegli_cartella');
  if (c) { dati.cartella = c; salva(dati); build(); }
}

async function registra() {
  if (fermando) return; // uno Stop sta ancora chiudendo il file di prima
  // Ogni avvio ha il suo numero: uno Stop (o un altro Registra) lo rende vecchio, e dopo ogni attesa si controlla.
  const mio = ++tentativo, vivo = () => mio === tentativo && st.ui.rec;
  const actx = new AudioContext({ sampleRate: 48000 }); // subito, dentro il clic
  const cartella = dati.cartella;
  st.ui.rec = true; st.ui.conto = st.conto ? 3 : 0; inizio = performance.now(); build();
  if (await invoke('spazio_libero', { cartella }) < 2e9) avviso('disco', 'Restano meno di 2 GB sul disco: circa 20 minuti di video.');
  for (let n = st.conto ? 3 : 0; n > 0; n--) {
    if (!vivo()) { actx.close(); return; } // Stop durante il conto: nessun file
    st.ui.conto = n; paint();
    await pausa(1000);
  }
  if (!vivo()) { actx.close(); return; }
  st.ui.conto = 0;
  let r;
  try {
    r = await avviaRegistrazione({ actx, canvas: cv, cartella, canzone: songs[st.song].name,
      onErrore: e => fermaRegistrazione(`La Registrazione si è fermata: ${e}`) });
  } catch (e) {
    if (mio === tentativo) { st.ui.rec = false; build(); }
    return avviso('rec', `Non riesco a registrare: ${e}`);
  }
  if (!vivo()) { // Stop premuto mentre partiva: il file appena aperto va nel Cestino, niente "Salvato"
    fermando = true;
    try { invoke('butta', { path: await r.ferma() }).catch(() => {}); } finally { fermando = false; }
    return build();
  }
  reg = r;
  inizio = performance.now();
  orologi = [
    setInterval(paint, 500),
    setInterval(async () => {
      if (await invoke('spazio_libero', { cartella }) < 5e8) fermaRegistrazione("Disco quasi pieno: ho fermato la Registrazione e l'ho salvata.");
    }, 5000),
  ];
  paint();
}

async function fermaRegistrazione(motivo) {
  tentativo++; // un avvio ancora in corso diventa vecchio e si ferma da solo
  if (!reg) { st.ui.rec = false; st.ui.conto = 0; return build(); } // durante il conto alla rovescia o mentre partiva
  const r = reg; reg = null;
  orologi.forEach(clearInterval);
  fermando = true;
  let path;
  try { path = await r.ferma(); } finally { fermando = false; }
  st.ui.rec = false; build();
  if (motivo) avviso('rec', motivo);
  const nome = path.split('/').pop().replace(/\.mp4$/, '');
  avviso('salvato', `Salvato: ${nome}`, [
    ['Guarda', () => invoke('guarda', { path })],
    ['Mostra nel Finder', () => invoke('mostra', { path })],
    ['Butta', () => invoke('butta', { path }).catch(e => avviso('rec', String(e)))],
  ]);
}

// Aggiornamento (spec §10): solo su richiesta, mai durante una Registrazione.
async function aggiorna() {
  if (st.ui.rec) return avviso('aggiorna', "Finisci la Registrazione, poi premi di nuovo Aggiorna.", [['Aggiorna', aggiorna]]);
  avviso('aggiorna', 'Sto aggiornando Live Vocoder… si riapre da sola.');
  await invoke('aggiorna').catch(() => avviso('aggiorna', "L'aggiornamento non è andato: riprova più tardi.", [['Riprova', aggiorna]]));
}

async function avvio() {
  const c = await carica();
  dati = c.dati; songs = dati.canzoni; st.dev = dati.dispositivi; pronto = true;
  predefinita = await invoke('cartella_predefinita');
  dati.cartella ??= predefinita;
  openSong(Math.max(0, songs.findIndex(s => s.name === dati.aperta)), false);
  if (c.rotto) avviso('canzoni', 'Non riuscivo a leggere le Canzoni salvate: le ho messe da parte e si riparte da «Ma Lei».');
  if (!dati.guidaVista) { st.ui.panel = 'guida'; dati.guidaVista = true; } // la guida si apre da sola al primo avvio
  build();
  await controllaDispositivi();
  setInterval(controllaDispositivi, 2000);
  requestAnimationFrame(frame);
  avviaMani(camVideo, () => st.mano, suMani).catch(e => avviso('mani', `Non riesco a leggere le mani: ${e}`));
  // senza rete non dice niente: si riprova al prossimo avvio
  invoke('controlla_aggiornamento').then(v => v && avviso('aggiorna', `C'è una versione nuova ✨ (${v})`, [['Aggiorna', aggiorna], ['Più tardi', () => {}]]), () => {});
}
avvio();
