# Live Vocoder v1: piano di costruzione

> **Per chi esegue (agenti):** SUB-SKILL OBBLIGATORIA: usa superpowers:subagent-driven-development (consigliata) oppure superpowers:executing-plans per eseguire il piano un task alla volta. I passi usano le caselle (`- [ ]`) per tenere il conto.

**Obiettivo:** costruire l'app Mac Live Vocoder v1 descritta nella spec, pronta per la beta sul Mac di Keopees.

**Architettura:** una sola app Tauri 2 nuova che unisce i quattro prototipi già provati. Rust fa l'audio in tempo reale (cpal, DSP del Suono), i Dispositivi, la camera preferita, i file e gli aggiornamenti. Il webview in JS semplice fa la schermata del prototipo `pannello-suono`, i Gesti con MediaPipe, il canvas del video e la Registrazione MP4 con MediaRecorder.

**Tecnologie:** Tauri 2 (CLI 2.12.2), Rust (cpal 0.18, ringbuf 0.5, objc2 0.6, objc2-foundation 0.3, libc 0.2, serde 1, tauri-plugin-dialog 2, tauri-plugin-updater 2), JS moduli ES senza bundler, MediaPipe `@mediapipe/tasks-vision` 0.10.35, test con `node:test` e `cargo test`.

**Spec:** `docs/superpowers/specs/2026-10-11-live-vocoder-v1-design.md` (branch `spec/v1`). Va letta prima di ogni task.

**Dove si lavora:** branch nuovo `app/v1` aperto da `spec/v1`, in un worktree (superpowers:using-git-worktrees). L'app sta nella radice del repo: `package.json`, `src/`, `src-tauri/`, `scripts/`, `test/`.

## Vincoli globali

- Identificatore `com.keopees.live-vocoder`. Non va mai cambiato, perché i permessi Camera e Microfono dipendono da identificatore + certificato.
- Solo Apple Silicon (`aarch64-apple-darwin`), macOS Tahoe. Finestra minima 1280×720, titolo "Live Vocoder".
- Nei testi dell'app e nel codice si usano i termini di `CONTEXT.md`: Voce, Gesto, Modalità, Effetto, Coro, Vocoder, Ascolto, Ritardo, Registrazione, Formato, Nota, Base, Intensità, Suono, Pienezza, Canzone, Impostazioni, Dispositivi. Mai i sinonimi da evitare (perlina, preset, latenza, monitor, take, settings…).
- **Il prototipo `prototypes/pannello-suono.prototype.html` al commit `a0270c0` è il riferimento visivo vincolante**: schermata, CSS, testi e disegno del video si rifanno identici. Cambiano solo gli ingressi (camera, mani, audio, file).
- JS semplice in moduli ES: niente framework, niente bundler, niente dipendenze npm tranne `@tauri-apps/cli`.
- Sul Mac di Keopees non si scarica niente: MediaPipe 0.10.35, il modello `hand_landmarker.task` e i font Pacifico, Amatic SC e Nunito stanno dentro l'app (`src/vendor/`, riempita da `scripts/vendor.sh`).
- **Non** mettere `NSCameraUseContinuityCameraDeviceType` in Info.plist.
- `rec.start(1000)` è obbligatorio. Il `Channel` del PCM va creato nuovo a ogni avvio dell'audio.
- Il callback audio di cpal non alloca mai: buffer fisso di 64 campioni, 48 kHz, mono.
- Firma con il certificato self-signed "Live Vocoder" e `hardenedRuntime: false`. Certificato e chiave dell'updater stanno in `~/.live-vocoder/` e **mai nel repo**.
- Versioni e `latest.json` vanno nel repo pubblico `MeStakes/live-vocoder-releases`.
- Nei commit niente righe `Co-Authored-By` né "Generated with". Messaggi di commit in inglese, come nel resto del repo.
- Le azioni segnate **(Riccardo)** le fa Riccardo sul suo Mac, oppure chi esegue gliele chiede prima. Riguardano portachiavi, password, pubblicazione su GitHub e Mac di Keopees.

## Punti da guardare in revisione

1. **Nome di Canzone che diventa una cartella strana.** Con `.`, `..`, un nome che inizia con un punto o una Rinomina che cambia solo maiuscole e minuscole, una Registrazione non deve mai uscire dalla cartella, sparire tra i file nascosti o sovrascrivere un file. Test: `controllaNome` nel Task 2, `prossimo_nome` nel Task 10.
2. **`canzoni.json` illeggibile** (crash, modifica a mano, versione vecchia). L'app non deve sovrascriverlo con i dati iniziali: il file va messo da parte, con un avviso, e i campi mancanti si completano. Test: `interpreta` e `metti_da_parte` nel Task 7.
3. **Dispositivo scelto che sparisce e poi ricompare** (cuffie staccate, iPhone che si allontana). Si usa quello predefinito, ma la scelta di Keopees resta salvata e torna appena il dispositivo ricompare. Test: `scegli` nel Task 2.
4. **Mano che sfarfalla ai bordi dell'inquadratura.** Niente cambi di Nota fantasma: debounce di 90 ms e tenuta di 250 ms. Test: `Stabile` e `leggi` nel Task 9.
5. **Stop premuto durante il conto alla rovescia, o Registra premuto due volte.** Nessun file vuoto e interfaccia sbloccata. Controllo a mano nel Task 10, con le guardie nel codice.

## File

| File | Cosa fa | Task |
|---|---|---|
| `package.json`, `.gitignore`, `THIRD_PARTY_NOTICES.md` | radice del progetto | 1 |
| `scripts/vendor.sh` | scarica (versioni fissate) MediaPipe, modello e font in `src/vendor/` | 1 |
| `scripts/certificato.sh` | **(Riccardo)** una volta sola: certificato self-signed e chiave dell'updater | 1 |
| `scripts/app.sh` | costruisce l'app firmata e la apre | 1 |
| `scripts/rilascio.sh`, `docs/rilascio.md` | versione nuova su `live-vocoder-releases` | 12 |
| `src/index.html` | markup + CSS del prototipo, con i font locali | 1, 3, 6, 10 |
| `src/accordo.js` | Nota → frequenze, nome dell'accordo, percentuale d'Intensità | 2 |
| `src/manopole.js` | Effetti, manopole e Dispositivi (dati e testi del prototipo), valori per Rust, scelta del Dispositivo | 2 |
| `src/canzoni.js` | cosa salva una Canzone, valori di partenza, regole del nome, lettura e salvataggio | 2, 7 |
| `src/video.js` | il canvas della polaroid e della Registrazione (`draw()` del prototipo) | 3 |
| `src/ui.js` | schermata e collegamenti (script del prototipo) | 3 → 13 |
| `src/avvisi.js` | avvisi rosa | 6 |
| `src/motore.js` | lato JS dell'audio Rust: avvio, manopole, note, PCM | 6 |
| `src/camera.js` | apre la camera scelta | 8 |
| `src/mani.js` | Gesti: MediaPipe → dita → Nota e Intensità | 9 |
| `src/registra.js`, `src/worklet.js` | Registrazione MP4 | 10 |
| `src/guida.js` | testi della guida "?" | 13 |
| `test/*.test.js` | controlli della logica JS (`node --test`) | 1, 2, 3, 7, 9 |
| `src-tauri/Cargo.toml`, `build.rs`, `tauri.conf.json`, `Info.plist`, `capabilities/default.json`, `icons/` | app Tauri | 1, 12 |
| `src-tauri/src/main.rs` | moduli e comandi | 1 → 12 |
| `src-tauri/src/suono.rs` | DSP del Suono + test | 4 |
| `src-tauri/src/dispositivi.rs` | Dispositivi audio da CoreAudio + test | 5 |
| `src-tauri/src/audio.rs` | cpal duplex, manopole, note, PCM | 6 |
| `src-tauri/src/canzoni.rs` | `canzoni.json` atomico + test | 7 |
| `src-tauri/src/camera.rs` | camere AVFoundation, camera preferita, permessi | 8, 11 |
| `src-tauri/src/registrazioni.rs` | file `vN`, pezzi, disco, Guarda/Mostra/Butta, cartella + test | 10 |
| `src-tauri/src/aggiorna.rs` | aggiornamenti | 12 |

Comandi di controllo usati in tutto il piano:
- `npm test`: `node --test test/*.test.js` e poi `cargo test --release` in `src-tauri`.
- `npm run app`: costruisce `Live Vocoder.app` firmata e la apre.

Commit dei prototipi da cui si copia:

| Prototipo | Commit |
|---|---|
| `prova-ritardo` | `9adddb1ea6ac21ab33e063a4feaf9b428bf0963d` |
| `suono-vocoder` | `60061489c6c0892d42e0c5453ddd5192c73b3070` |
| `prova-aggiornamento` | `db7164b6722f81286341a1b4e8999e36648af1e5` |
| `pannello-suono` | `a0270c0921eb28d41097b60e8b80fc19deae7fac` |

---

### Task 1: Scheletro dell'app con il prototipo dentro Tauri

Alla fine si apre una finestra Tauri "Live Vocoder" che mostra il prototipo `pannello-suono` identico (ancora simulato), con i font presi dall'app e non da internet.

**File:**
- Crea: `package.json`, `.gitignore`, `THIRD_PARTY_NOTICES.md`, `scripts/vendor.sh`, `scripts/certificato.sh`, `scripts/app.sh`, `src/index.html`, `test/schermata.test.js`, `src-tauri/Cargo.toml`, `src-tauri/build.rs`, `src-tauri/tauri.conf.json`, `src-tauri/Info.plist`, `src-tauri/capabilities/default.json`, `src-tauri/icons/icon.icns`, `src-tauri/icons/icon.png`, `src-tauri/src/main.rs`

**Interfacce:**
- Produce: `src/vendor/` con `mediapipe/vision_bundle.js`, `mediapipe/wasm/*`, `hand_landmarker.task`, `fonts/{Pacifico-Regular,AmaticSC-Bold,Nunito}.ttf`; gli script `npm test` e `npm run app`.

- [ ] **Passo 1: scrivi il test che fallisce**

`test/schermata.test.js`:
```js
// La schermata è il prototipo pannello-suono rifatto identico: qui si controlla solo che i file stiano in piedi.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test("niente font da internet: l'app funziona offline", () => {
  assert.doesNotMatch(readFileSync('src/index.html', 'utf8'), /fonts\.googleapis|fonts\.gstatic/);
});
```

- [ ] **Passo 2: fallo girare e guarda che fallisce**

Esegui: `node --test test/*.test.js`
Atteso: FAIL con `ENOENT ... src/index.html`.

- [ ] **Passo 3: radice del progetto**

`package.json`:
```json
{
  "name": "live-vocoder",
  "private": true,
  "type": "module",
  "scripts": {
    "vendor": "sh scripts/vendor.sh",
    "app": "sh scripts/app.sh",
    "test": "node --test test/*.test.js && cd src-tauri && cargo test --release"
  },
  "devDependencies": { "@tauri-apps/cli": "2.12.2" }
}
```
Poi: `npm install`.

`.gitignore`:
```
node_modules/
src-tauri/target/
src-tauri/gen/
src/vendor/
dist/
```

`scripts/vendor.sh`:
```sh
#!/bin/sh
# Scarica una volta, a versioni fissate, quello che finisce dentro l'app: MediaPipe, il modello delle mani, i font.
# Sul Mac di Keopees non si scarica niente: va tutto nel .dmg (spec §10).
set -e
cd "$(dirname "$0")/.."
V=src/vendor
[ -f "$V/.fatto-0.10.35" ] && exit 0
rm -rf "$V" && mkdir -p "$V/mediapipe" "$V/fonts"
T=$(mktemp -d)
curl -fsSL https://registry.npmjs.org/@mediapipe/tasks-vision/-/tasks-vision-0.10.35.tgz | tar xz -C "$T"
cp "$T/package/vision_bundle.mjs" "$V/mediapipe/vision_bundle.js"
cp -R "$T/package/wasm" "$V/mediapipe/wasm"
curl -fsSL -o "$V/hand_landmarker.task" https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task
G=https://github.com/google/fonts/raw/main/ofl
curl -fsSL -o "$V/fonts/AmaticSC-Bold.ttf" "$G/amaticsc/AmaticSC-Bold.ttf"
curl -fsSL -o "$V/fonts/OFL-AmaticSC.txt" "$G/amaticsc/OFL.txt"
curl -fsSL -o "$V/fonts/Nunito.ttf" "$G/nunito/Nunito%5Bwght%5D.ttf"
curl -fsSL -o "$V/fonts/OFL-Nunito.txt" "$G/nunito/OFL.txt"
cp docs/brand/Pacifico-Regular.ttf docs/brand/OFL-Pacifico.txt "$V/fonts/"
rm -rf "$T"
touch "$V/.fatto-0.10.35"
```

`THIRD_PARTY_NOTICES.md`, scritto così:
```sh
{
  printf '# Avvisi di terze parti\n\n'
  printf -- '- **MediaPipe Tasks Vision** 0.10.35 (`src/vendor/mediapipe`, modello `hand_landmarker.task`): Apache-2.0.\n'
  printf -- '- **Pacifico**, **Amatic SC**, **Nunito** (`src/vendor/fonts`): SIL Open Font License 1.1, testi in `src/vendor/fonts/OFL-*.txt`.\n'
  printf -- '- **Londopy/gesture-synth** (commit 3e6a40a): test delle dita, assegnazione delle mani e debounce portati in `src/mani.js` da `crates/gsyn-core/src/gesture.rs`.\n\n'
  printf '## Londopy/gesture-synth\n\n```\n'
  gh api -H "Accept: application/vnd.github.raw" "repos/Londopy/gesture-synth/contents/LICENSE?ref=3e6a40ad5073b8c0afe92cd1fbd96af74c675335"
  printf '```\n'
} > THIRD_PARTY_NOTICES.md
```

- [ ] **Passo 4: firma e chiavi (Riccardo, una volta sola)**

`scripts/certificato.sh`:
```sh
#!/bin/sh
# Una volta sola, sul Mac di Riccardo: il certificato self-signed che firma Live Vocoder (#12) e la chiave degli aggiornamenti.
# Tutta la cartella ~/.live-vocoder e la password vanno nel backup (docs/rilascio.md). Mai nel repo.
set -e
cd "$(dirname "$0")/.."
D="$HOME/.live-vocoder"
mkdir -p "$D"
[ -f "$D/certificato.p12" ] && { echo "C'è già $D/certificato.p12: non lo rifaccio."; exit 1; }
printf "Password nuova per il certificato: "; stty -echo; read -r P; stty echo; echo
openssl req -x509 -newkey rsa:2048 -keyout "$D/k.pem" -out "$D/c.pem" -days 3650 -nodes -subj "/CN=Live Vocoder" \
  -addext "basicConstraints=critical,CA:false" -addext "keyUsage=critical,digitalSignature" -addext "extendedKeyUsage=critical,codeSigning"
openssl pkcs12 -export -legacy -inkey "$D/k.pem" -in "$D/c.pem" -out "$D/certificato.p12" -passout "pass:$P"
rm "$D/k.pem" "$D/c.pem"
security import "$D/certificato.p12" -k ~/Library/Keychains/login.keychain-db -P "$P" -T /usr/bin/codesign
[ -f "$D/chiave-updater.key" ] || npx tauri signer generate --ci -p "" -w "$D/chiave-updater.key"
echo "Fatto. Metti nel backup la cartella $D e la password del certificato."
```

`scripts/app.sh`:
```sh
#!/bin/sh
# Costruisce Live Vocoder.app firmata e la apre, per provare le modifiche sul Mac di Riccardo.
set -e
cd "$(dirname "$0")/.."
sh scripts/vendor.sh
K="$HOME/.live-vocoder/chiave-updater.key"
[ -f "$K" ] && export TAURI_SIGNING_PRIVATE_KEY="$(cat "$K")" TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""
npx tauri build --bundles app
open "src-tauri/target/release/bundle/macos/Live Vocoder.app"
```

**(Riccardo)** esegue: `sh scripts/certificato.sh`. Al primo `codesign` macOS chiede la password del portachiavi: rispondi "Consenti sempre".

- [ ] **Passo 5: app Tauri**

`src-tauri/Cargo.toml`:
```toml
[package]
name = "live-vocoder"
version = "0.1.0"
edition = "2021"

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = [] }
```

`src-tauri/build.rs`:
```rust
fn main() { tauri_build::build() }
```

`src-tauri/tauri.conf.json`:
```json
{
  "productName": "Live Vocoder",
  "version": "0.1.0",
  "identifier": "com.keopees.live-vocoder",
  "build": { "frontendDist": "../src" },
  "app": {
    "withGlobalTauri": true,
    "windows": [{ "title": "Live Vocoder", "width": 1440, "height": 820, "minWidth": 1280, "minHeight": 720, "maximized": true, "backgroundThrottling": "disabled" }],
    "security": { "csp": null }
  },
  "bundle": {
    "active": true,
    "targets": ["app", "dmg"],
    "icon": ["icons/icon.icns", "icons/icon.png"],
    "macOS": { "signingIdentity": "Live Vocoder", "hardenedRuntime": false }
  }
}
```

`src-tauri/Info.plist`:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>NSMicrophoneUsageDescription</key>
  <string>Live Vocoder sente la tua voce dal microfono e te la fa sentire in cuffia con l'Effetto.</string>
  <key>NSCameraUsageDescription</key>
  <string>Live Vocoder legge le tue mani dalla camera e gira il video.</string>
</dict>
</plist>
```

`src-tauri/capabilities/default.json`:
```json
{ "identifier": "default", "windows": ["main"], "permissions": ["core:default"] }
```

Icone: `mkdir -p src-tauri/icons && cp docs/brand/AppIcon.icns src-tauri/icons/icon.icns && cp docs/brand/icon-1024.png src-tauri/icons/icon.png`

`src-tauri/src/main.rs`:
```rust
// Live Vocoder: app Mac per Keopees (spec docs/superpowers/specs/2026-10-11-live-vocoder-v1-design.md).
fn main() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("avvio di Live Vocoder");
}
```

- [ ] **Passo 6: la schermata del prototipo con i font locali**

```sh
mkdir -p src
git show a0270c0921eb28d41097b60e8b80fc19deae7fac:prototypes/pannello-suono.prototype.html > src/index.html
```
In `src/index.html` fai tre modifiche.

1. Sostituisci queste due righe:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Amatic+SC:wght@700&family=Nunito:wght@400;700;800&family=Pacifico&display=swap">
```
con:
```html
<style>
@font-face{font-family:"Pacifico";src:url("vendor/fonts/Pacifico-Regular.ttf")}
@font-face{font-family:"Amatic SC";font-weight:700;src:url("vendor/fonts/AmaticSC-Bold.ttf")}
@font-face{font-family:"Nunito";font-weight:200 1000;src:url("vendor/fonts/Nunito.ttf")}
</style>
```
2. `<title>Pannello del Suono</title>` diventa `<title>Live Vocoder</title>`.
3. Il commento in cima al CSS (`/* PROTOTIPO usa-e-getta, ... Camera e suono simulati: nessun audio. */`, 4 righe) diventa:
```css
/* Schermata di Live Vocoder: il prototipo pannello-suono (a0270c0) rifatto identico (spec §7).
   Tutta la schermata sta nella finestra, senza scroll verticale: ruota e video si rimpiccioliscono con l'altezza. */
```

- [ ] **Passo 7: fai girare test e app**

Esegui: `npm run vendor && npm test`
Atteso: PASS sul test dei font, poi `cargo test` compila con `0 passed`.

Esegui: `npm run app`
Atteso: si apre "Live Vocoder" a finestra grande, uguale al prototipo, con titolo e ruota in Pacifico. Le Note girano da sole e il video è simulato. Ridotta a 1280×720, la finestra non mostra scroll.

- [ ] **Passo 8: commit**

```bash
git add package.json package-lock.json .gitignore THIRD_PARTY_NOTICES.md scripts src/index.html test src-tauri
git commit -m "App: Tauri skeleton showing the Sound desk prototype with bundled fonts"
```

---

### Task 2: Logica pura (Note, manopole, Canzoni)

Moduli senza DOM, provati con `node --test`. Contengono i dati e i testi del prototipo e le regole nuove della spec.

**File:**
- Crea: `src/accordo.js`, `src/manopole.js`, `src/canzoni.js`, `test/accordo.test.js`, `test/manopole.test.js`, `test/canzoni.test.js`

**Interfacce:**
- Produce:
  - `accordo.js`:
    - `NOTE: string[12]`, `TIPI: {M,m,s7,maj7,sus: {label, suf, iv}}`, `OCT: [o, label][]`;
    - `noteDellAccordo(nota:{r,t,o}, modalita:'accordi'|'nota', pienezza:3|4|5) -> {hz:number[], k:number}`;
    - `nomeAccordo(nota, modalita) -> string`;
    - `percentuale(livello:1..5, i1, i5) -> number`.
  - `manopole.js`:
    - `EFF`, `EKEYS`, `ALL`, `KN`, `KM`, `GROUPS`, `DEVS` (`{k, name, help}`, senza `opts`), `DM`, `DEF_SND`;
    - `parametriRust({eff, snd, lv}) -> {effetto, wet, timbro, bande, cons, morb, scivola, gate, vol}`;
    - `scegli(lista:string[], voluto, predefinito) -> string|undefined`.
  - `canzoni.js`:
    - `DEF_SONG`, `SONG_KEYS`;
    - `canzone(name, over) -> {name, data}`;
    - `datiIniziali() -> {versione, cartella, dispositivi, aperta, guidaVista, canzoni}`;
    - `controllaNome(n, songs, except) -> string` (`''` se il nome va bene).

- [ ] **Passo 1: scrivi i test che falliscono**

`test/accordo.test.js`:
```js
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
```

`test/manopole.test.js`:
```js
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
```

`test/canzoni.test.js`:
```js
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
```

- [ ] **Passo 2: fallo girare e guarda che fallisce**

Esegui: `node --test test/*.test.js`
Atteso: FAIL con `Cannot find module '.../src/accordo.js'` (e lo stesso per manopole e canzoni).

- [ ] **Passo 3: `src/accordo.js`**

```js
// Note e accordi: da una Nota (Base r, Tipo t, ottava o) alle frequenze che suonano e al nome nel video (spec §3).
export const NOTE = ['Do', 'Do♯', 'Re', 'Mi♭', 'Mi', 'Fa', 'Fa♯', 'Sol', 'La♭', 'La', 'Si♭', 'Si'];
// Nella Settima e nella Maj7 la 7ª prende il posto della 5ª: le note sono sempre 3, così il numero della Pienezza resta vero.
export const TIPI = {
  M: { label: 'Maggiore', suf: '', iv: [0, 4, 7] },
  m: { label: 'Minore', suf: 'm', iv: [0, 3, 7] },
  s7: { label: 'Settima', suf: '7', iv: [0, 4, 10] },
  maj7: { label: 'Maj7', suf: 'maj7', iv: [0, 4, 11] },
  sus: { label: 'Sus4', suf: 'sus4', iv: [0, 5, 7] },
};
export const OCT = [[-1, 'Bassa'], [0, 'Media'], [1, 'Alta']];
const DO4 = 261.63; // ottava Media = ottava 4, il registro della voce di Keopees

// hz: le note che suonano. k: quante sono "accordo"; le altre sono basso e ottava sopra, che nel Coro seguono la Base.
export function noteDellAccordo(nota, modalita, pienezza) {
  const base = DO4 * 2 ** (nota.r / 12 + nota.o);
  const iv = modalita === 'accordi' ? TIPI[nota.t].iv : [0];
  const hz = iv.map((s) => base * 2 ** (s / 12));
  if (pienezza >= 4) hz.push(base / 2);
  if (pienezza >= 5) hz.push(base * 2);
  return { hz, k: iv.length };
}

export const nomeAccordo = (nota, modalita) => NOTE[nota.r] + (modalita === 'accordi' ? TIPI[nota.t].suf : '');

// Intensità 2, 3 e 4: lineare tra "con 1 dito" e "con 5 dita" (#13).
export const percentuale = (livello, i1, i5) => Math.round(i1 + ((i5 - i1) * (livello - 1)) / 4);
```

- [ ] **Passo 4: `src/manopole.js`**

```js
// Il Suono del banco: Effetti, manopole e Dispositivi, con nomi e testi del prototipo pannello-suono (a0270c0).
import { percentuale } from './accordo.js';

export const EFF = {
  coro: { name: 'Coro', sub: "La tua voce copiata sull'accordo della Nota, come un coro." },
  vocoder: { name: 'Vocoder', sub: 'La tua voce fa cantare le parole a un synth.' },
  spento: { name: 'Spento', sub: 'Voce pulita, e sopra gli accordi come una tastiera.' },
};
export const EKEYS = Object.keys(EFF), ALL = EKEYS;
const steps = (a, b, s) => Array.from({ length: Math.round((b - a) / s) + 1 }, (_, i) => +(a + i * s).toFixed(2));
const it = (v) => v.toLocaleString('it-IT');
const pct = (v) => v + '%';
export const KN = [
  { k: 'i1', name: 'Intensità con 1 dito', cname: 'Con 1 dito', vals: steps(0, 100, 5), def: 60, fmt: pct, for: ALL,
    help: 'Quanto Effetto senti, rispetto alla tua voce pulita, quando alzi 1 dito della seconda mano. Con Spento è quanto forte suonano gli accordi.' },
  { k: 'i5', name: 'Intensità con 5 dita', cname: 'Con 5 dita', vals: steps(0, 100, 5), def: 90, fmt: pct, for: ALL,
    help: "Come sopra, ma con 5 dita alzate. Tra 1 e 5 dita l'Effetto cresce un po' alla volta." },
  { k: 'voci', name: 'Pienezza', vals: [3, 4, 5], def: 4,
    fmt: (v) => ({ 3: '3 · leggero', 4: '4 · col basso', 5: '5 · pieno' })[v], for: ALL,
    help: 'Quante note suonano insieme in ogni accordo. 3 = leggero, 4 aggiunge il basso, 5 aggiunge anche una nota in alto.' },
  { k: 'scivola', name: 'Scivolata', vals: steps(0, 400, 20), def: 0, fmt: (v) => (v ? it(v / 1000) + ' s' : 'niente'), for: ALL,
    help: 'Quando cambi Nota le note scivolano verso il nuovo accordo invece di saltare. Niente = salto netto.' },
  { k: 'timbro', name: 'Timbro', vals: ['sega', 'supersaw', 'quadra'], def: 'supersaw',
    fmt: (v) => ({ sega: 'Sega', supersaw: 'Supersaw', quadra: 'Quadra' })[v], for: ['vocoder', 'spento'],
    help: 'Il colore del synth. Sega graffia, Supersaw è largo e pieno (il suono pop), Quadra è più vuoto, da videogioco.' },
  { k: 'bande', name: 'Dettaglio', vals: [8, 12, 16, 24, 32], def: 24, short: (v) => v + ' fette',
    fmt: (v) => `${v} fette, ${({ 8: 'tanto robot', 12: 'robot', 16: 'a metà', 24: 'parole chiare', 32: 'chiarissime' })[v]}`, for: ['vocoder'],
    help: 'In quante fette il Vocoder taglia la tua voce. Poche fette = più robot, tante = le parole si capiscono meglio.' },
  { k: 'morb', name: 'Morbidezza', vals: steps(0, 100, 5), def: 0, fmt: pct, for: ['vocoder', 'spento'],
    help: "Rende il synth più scuro e più dolce, e un po' più lento a seguire la voce." },
  { k: 'cons', name: 'Consonanti chiare', cname: 'Consonanti', vals: steps(0, 100, 5), def: 15, fmt: pct, for: ['coro', 'vocoder'],
    help: "Fa passare le S, le T e il fiato della tua voce vera, così le parole si capiscono anche con tanto Effetto." },
  { k: 'gate', name: 'Anti-fruscio', vals: steps(-75, -30, 5), def: -75, short: (v) => (v <= -75 ? 'spento' : it(v) + ' dB'),
    fmt: (v) => (v <= -75 ? 'spento' : `${v <= -60 ? 'leggero' : v <= -45 ? 'medio' : 'forte'} (${it(v)} dB)`), for: ALL,
    help: 'Chiude il microfono quando non canti, così non si sentono fruscii e rumori di casa. Più forte taglia di più, ma può mangiare i finali delle frasi.' },
  { k: 'vol', name: 'Volume in cuffia', cname: 'Volume', vals: steps(0.25, 6, 0.25), def: 2, fmt: (v) => '×' + it(v), for: ALL,
    help: 'Quanto forte ti senti in cuffia mentre canti. Non cambia il volume della Registrazione.' },
];
export const KM = Object.fromEntries(KN.map((K) => [K.k, K]));
export const GROUPS = [['Mano', ['i1', 'i5']], ['Accordo', ['voci', 'scivola']], ['Synth', ['timbro', 'bande', 'morb']], ['Voce', ['cons', 'gate']], ['Cuffia', ['vol']]];
// Dispositivi: valgono per tutte le Canzoni, come la cartella delle Registrazioni. Gli elenchi veri arrivano da Rust.
export const DEVS = [
  { k: 'in', name: 'Ingresso audio', help: 'Il microfono in cui canti. Quello del Mac va bene, un microfono USB suona meglio.' },
  { k: 'out', name: 'Uscita audio', help: "Dove senti l'Ascolto. Servono cuffie a filo: con gli altoparlanti l'Ascolto resta spento perché fischierebbe, con le cuffie Bluetooth arriva in ritardo." },
  { k: 'cam', name: 'Camera', help: "La camera del video. L'iPhone dà il video verticale migliore; se non c'è, si usa quella del Mac." },
];
export const DM = Object.fromEntries(DEVS.map((d) => [d.k, d]));
export const DEF_SND = Object.fromEntries(KN.map((K) => [K.k, K.def]));

const EFFETTO = { spento: 0, vocoder: 1, coro: 2 }, TIMBRO = { sega: 0, supersaw: 1, quadra: 2 };
// Valori nelle unità di audio.rs (NOMI): quota d'Effetto 0..1, scivolata in secondi, Anti-fruscio in dB.
export function parametriRust({ eff, snd, lv }) {
  return {
    effetto: EFFETTO[eff], wet: percentuale(lv, snd.i1, snd.i5) / 100, timbro: TIMBRO[snd.timbro], bande: snd.bande,
    cons: snd.cons / 100, morb: snd.morb / 100, scivola: snd.scivola / 1000, gate: snd.gate, vol: snd.vol,
  };
}

// Il Dispositivo scelto da Keopees se c'è; altrimenti quello predefinito di macOS. La scelta resta salvata e torna quando ricompare.
export const scegli = (lista, voluto, predefinito) => (lista.includes(voluto) ? voluto : lista.includes(predefinito) ? predefinito : lista[0]);
```

- [ ] **Passo 5: `src/canzoni.js`**

```js
// Canzoni: cosa salva una Canzone, i valori di partenza, le regole del nome (spec §8).
import { DEF_SND } from './manopole.js';

const B = (r, t, o = 0) => ({ r, t, o });
// "Note e Suono di partenza" di una Canzone nuova
export const DEF_SONG = {
  beads: [B(0, 'M'), B(7, 'M'), B(9, 'm'), B(5, 'M'), B(4, 'm')], mode: 'accordi', format: 'verticale', eff: 'coro', snd: DEF_SND,
  titolo: true, filtro: true, specchio: true, conto: true, mano: 'sinistra',
};
export const SONG_KEYS = Object.keys(DEF_SONG);
// Completa con i valori di partenza: una versione nuova dell'app può aggiungere campi.
export const canzone = (name, over = {}) => ({ name, data: structuredClone({ ...DEF_SONG, ...over, snd: { ...DEF_SND, ...over.snd } }) });

// Primo avvio: una sola Canzone, «Ma Lei», con Do, Lam, Fa, Sol, Mim.
export const datiIniziali = () => ({
  versione: 1, cartella: null, dispositivi: {}, aperta: 'Ma Lei', guidaVista: false,
  canzoni: [canzone('Ma Lei', { beads: [B(0, 'M'), B(9, 'm'), B(5, 'M'), B(7, 'M'), B(4, 'm')] })],
});

// Il nome diventa una cartella (Cartella/<Canzone>/): unico, senza / o :, non nascosta, non fuori dalla cartella.
export function controllaNome(n, songs, except) {
  n = n.trim();
  if (!n) return 'Scrivi un nome.';
  if (n.length > 40) return 'Il nome è troppo lungo.';
  if (/[\/:]/.test(n)) return 'Il nome non può contenere / o :';
  if (n.startsWith('.')) return 'Il nome non può iniziare con un punto.';
  if (songs.some((s, i) => i !== except && s.name.toLowerCase() === n.toLowerCase())) return "C'è già una Canzone con questo nome.";
  return '';
}
```

- [ ] **Passo 6: fai girare i test e guarda che passano**

Esegui: `node --test test/*.test.js`
Atteso: PASS, 0 fallimenti.

- [ ] **Passo 7: commit**

```bash
git add src/accordo.js src/manopole.js src/canzoni.js test
git commit -m "App: pure logic for notes, sound knobs and songs, with tests"
```

---

### Task 3: La schermata in moduli e il canvas vero

Lo script del prototipo esce da `index.html` ed entra in `src/ui.js`, che usa i moduli del Task 2. Il disegno del video diventa `src/video.js`: è `draw()` del prototipo, pronto per camera, mani e voce veri. Finché non arrivano, la polaroid mostra lo sfondo prugna con glitter, colonna, onda e accordo, e Nota e Intensità girano ancora da sole.

**File:**
- Crea: `src/video.js`, `src/ui.js`
- Modifica: `src/index.html` (lo script inline diventa `<script type="module" src="ui.js">` e si aggiunge `<video id="cam">`), `test/schermata.test.js`

**Interfacce:**
- Consuma: tutto il Task 2.
- Produce:
  - `video.js`: `misura(formato) -> [W, H]`; `disegna(cv, s, t)` con `s = {video, mani:{accordi, seconda}, specchio, filtro, mano, lv, lvl, eff, hz, fermi, accordo, titolo, conto, livello}`, dove `accordi`/`seconda` sono `{punti: [x,y,z][21] normalizzati, alzate: bool[5]}` oppure `null`;
  - in `ui.js`: lo stato `st` con i campi nuovi `att`, `liste`, `fermi`, `mani`, `muto`; le funzioni `build()`, `paint()`, `sync()`, `openSong(i, save)` e `avvio()` (le sostituiscono i task successivi).

- [ ] **Passo 1: test che fallisce**

Aggiungi in fondo a `test/schermata.test.js`:
```js
import { execFileSync } from 'node:child_process';

for (const f of ['ui.js', 'video.js'])
  test(`${f} si legge (sintassi)`, () => execFileSync(process.execPath, ['--check', `src/${f}`]));

test('lo script della schermata sta in ui.js', () => {
  const h = readFileSync('src/index.html', 'utf8');
  assert.match(h, /<script type="module" src="ui\.js"><\/script>/);
  assert.doesNotMatch(h, /<script>/);
});
```

Esegui: `node --test test/*.test.js`
Atteso: FAIL su `ui.js si legge` (file mancante) e su `lo script della schermata sta in ui.js`.

- [ ] **Passo 2: `src/video.js`**

```js
// Il canvas della polaroid, che è anche il video della Registrazione: draw() del prototipo pannello-suono (a0270c0)
// identico, con camera, mani e livello della voce veri al posto di quelli simulati (spec §5).
const BONES = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[0,17],[17,18],[18,19],[19,20]];
const css = getComputedStyle(document.documentElement);
const C = Object.fromEntries(['rosa','rosa-chiaro','viola','viola-luce','prugna','prugna-2','crema','lilla'].map(k => [k, css.getPropertyValue('--' + k).trim()]));
const rgba = (hex, a) => `rgba(${[1,3,5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(',')},${a})`;
const rnd = i => { const v = Math.sin(i * 127.1) * 43758.5453; return v - Math.floor(v); };
const GLITTER = Array.from({length: 36}, (_, i) => ({x: rnd(i), y: rnd(i + 99) * .8, s: .4 + rnd(i + 7) * .8, p: rnd(i + 3) * 6.28, v: 1 + rnd(i + 11) * 2}));
// ponytail: quanto copre il velo del Filtro rosa sopra la camera vera; si regola a occhio sul video di Keopees.
const VELO = .45;
// ponytail: RMS della voce che dà all'onda il respiro pieno; si regola a occhio cantando.
const RMS_PIENO = .15;

function star(x, cx, cy, r) {
  x.beginPath(); x.moveTo(cx, cy - r);
  x.quadraticCurveTo(cx, cy, cx + r, cy); x.quadraticCurveTo(cx, cy, cx, cy + r);
  x.quadraticCurveTo(cx, cy, cx - r, cy); x.quadraticCurveTo(cx, cy, cx, cy - r); x.fill();
}
function heart(x, cx, cy, r) {
  x.beginPath(); x.moveTo(cx, cy + r * .9);
  x.bezierCurveTo(cx - r * 1.6, cy - r * .2, cx - r * .6, cy - r * 1.3, cx, cy - r * .45);
  x.bezierCurveTo(cx + r * .6, cy - r * 1.3, cx + r * 1.6, cy - r * .2, cx, cy + r * .9);
  x.fill(); x.stroke();
}
function drawHand(x, P, m, t, glow, raised) {
  x.lineCap = 'round'; x.strokeStyle = C.crema; x.lineWidth = m * .011;
  x.shadowColor = glow; x.shadowBlur = m * .035;
  x.beginPath(); BONES.forEach(([a, b]) => { x.moveTo(...P[a]); x.lineTo(...P[b]); }); x.stroke();
  x.shadowBlur = 0; x.lineWidth = m * .004;
  const BEAD = [C.rosa, C.lilla, C.crema, C['viola-luce']];
  P.forEach((p, j) => {
    const f = [4, 8, 12, 16, 20].indexOf(j);
    if (f >= 0 && raised(f)) {
      x.strokeStyle = C.crema; x.fillStyle = glow; heart(x, p[0], p[1], m * .028);
      x.fillStyle = C.crema;
      for (const k of [0, 2.1, 4.2]) star(x, p[0] + Math.cos(t * 2 + k) * m * .05, p[1] + Math.sin(t * 2 + k) * m * .05, m * .011);
      return;
    }
    x.strokeStyle = C.prugna; x.fillStyle = BEAD[j % 4];
    x.beginPath(); x.arc(p[0], p[1], m * .016, 0, 7); x.fill(); x.stroke();
  });
}
// scritta in Pacifico rosa con estrusione crema e ombra prugna, come l'accordo del prototipo
function scritta(x, testo, tx, ty, fz) {
  const d = Math.max(2, Math.round(fz * .07));
  x.font = `${fz}px Pacifico, cursive`;
  x.fillStyle = rgba(C.prugna, .55); x.fillText(testo, tx + d * 1.8, ty + d * 1.8);
  x.fillStyle = C.crema; for (let i = d; i > 0; i--) x.fillText(testo, tx + i, ty + i);
  x.fillStyle = C.rosa; x.fillText(testo, tx, ty);
}

export const misura = formato => formato === 'verticale' ? [1080, 1920] : [1920, 1080];

export function disegna(cv, s, t) {
  const W = cv.width, H = cv.height, x = cv.getContext('2d'), m = Math.min(W, H);
  const v = s.video, vw = v.videoWidth, vh = v.videoHeight;
  // la camera riempie il riquadro tagliando i bordi; i punti delle mani passano dalla stessa trasformazione
  const sc = vw ? Math.max(W / vw, H / vh) : 1, ox = (W - vw * sc) / 2, oy = (H - vh * sc) / 2;
  const px = ([nx, ny]) => [ox + nx * vw * sc, oy + ny * vh * sc];
  x.save();
  if (s.specchio) { x.translate(W, 0); x.scale(-1, 1); }
  x.fillStyle = C.prugna; x.fillRect(0, 0, W, H);
  if (vw) x.drawImage(v, ox, oy, vw * sc, vh * sc);
  if (s.filtro) {
    let g = x.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, C['prugna-2']); g.addColorStop(1, C.prugna);
    x.globalAlpha = VELO; x.fillStyle = g; x.fillRect(0, 0, W, H); x.globalAlpha = 1;
    g = x.createRadialGradient(W * .4, H * .42, 0, W * .4, H * .42, m * .9);
    g.addColorStop(0, rgba(C.rosa, .38)); g.addColorStop(1, rgba(C.rosa, 0));
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    GLITTER.forEach(q => { x.fillStyle = rgba(C.crema, .2 + .8 * Math.max(0, Math.sin(t * q.v + q.p))); star(x, q.x * W, q.y * H, m * .014 * q.s); });
  }
  const { accordi, seconda } = s.mani;
  if (accordi) drawHand(x, accordi.punti.map(px), m, t, C.rosa, f => accordi.alzate[f]);
  if (seconda) drawHand(x, seconda.punti.map(px), m, t, C['viola-luce'], f => seconda.alzate[f]);
  const L = s.mano === 'sinistra', bx = W * (L ? .05 : .95), r5 = m * .02;
  x.lineWidth = m * .004; x.strokeStyle = C.crema;
  for (let k = 0; k < 5; k++) {
    x.beginPath(); x.arc(bx, H * .62 - k * r5 * 2.6, r5, 0, 7);
    x.fillStyle = k >= s.lv ? rgba(C.crema, .2) : k === s.lv - 1 ? C.rosa : C['viola-luce'];
    x.fill(); if (k < s.lv) x.stroke();
  }
  x.restore();
  // onda: somma dei seni delle note che suonano; con gli accordi fermi è piatta
  const fs = s.fermi ? [] : s.hz, y0 = H * .86, amp = Math.min(H * .06, m * .09) * (.25 + .75 * s.lvl);
  // Coro e Vocoder: l'onda respira con la voce vera; Spento: accordi fissi come una tastiera
  const env = s.eff !== 'spento' ? .55 + .45 * Math.min(1, s.livello / RMS_PIENO) : .85;
  const wave = (scale, alpha) => {
    x.beginPath();
    for (let i = 0; i <= 220; i++) {
      const u = i / 220;
      const y = fs.length ? fs.reduce((a, f) => a + Math.sin(2 * Math.PI * u * f / 55 - t * f / 60), 0) / fs.length : 0;
      x[i ? 'lineTo' : 'moveTo'](u * W, y0 + y * amp * env * scale);
    }
    const lg = x.createLinearGradient(0, 0, W, 0);
    lg.addColorStop(0, rgba(C.rosa, alpha)); lg.addColorStop(1, rgba(C['viola-luce'], alpha));
    x.strokeStyle = lg; x.stroke();
  };
  x.shadowColor = C.rosa; x.shadowBlur = m * .03;
  x.lineWidth = m * .004; wave(-.6, .35);
  x.lineWidth = m * .008; wave(1, 1);
  x.shadowBlur = 0;
  const fz = m * .11, tx = m * .06, ty = m * .05 + fz * 1.05;
  scritta(x, s.accordo, tx, ty, fz);
  if (s.titolo) {
    x.font = `${fz}px Pacifico, cursive`;
    const sx = tx + x.measureText(s.accordo).width + fz * .2, text = '– ' + s.titolo;
    let ts = fz * .5;
    x.font = `${ts}px Pacifico, cursive`;
    const room = W - m * .05 - sx, w = x.measureText(text).width;
    if (w > room) { ts *= room / w; x.font = `${ts}px Pacifico, cursive`; }
    x.fillStyle = rgba(C.prugna, .6); x.fillText(text, sx + 2, ty + 2);
    x.fillStyle = C.crema; x.fillText(text, sx, ty);
  }
  if (s.conto) {
    const cz = m * .45;
    x.textAlign = 'center'; scritta(x, String(s.conto), W / 2, H / 2 + cz * .35, cz); x.textAlign = 'left';
  }
}
```

- [ ] **Passo 3: `src/ui.js` dallo script del prototipo**

```sh
P=a0270c0921eb28d41097b60e8b80fc19deae7fac:prototypes/pannello-suono.prototype.html
{
  cat <<'FINE'
// Schermata di Live Vocoder: lo script del prototipo pannello-suono (a0270c0), con dati e logica nei moduli.
import { NOTE, TIPI, OCT, noteDellAccordo, nomeAccordo, percentuale } from './accordo.js';
import { EFF, EKEYS, KN, KM, GROUPS, DEVS, DM } from './manopole.js';
import { DEF_SONG, SONG_KEYS, controllaNome, datiIniziali } from './canzoni.js';
import { disegna, misura } from './video.js';

let dati = datiIniziali(), songs = dati.canzoni;
FINE
  git show "$P" | sed -n '270,488p'
} > src/ui.js
sed -i '' 's/TYPES/TIPI/g; s/checkName(u\.draft, /controllaNome(u.draft, songs, /g' src/ui.js
```
Le righe 270–488 vanno dalla riga `const $ = s => …` fino al gestore `keydown` compreso. Il video simulato (righe 489 e seguenti) non si copia.

Poi in `src/ui.js` fai queste modifiche.

1. Sostituisci:
```js
            dev:Object.fromEntries(DEVS.map(d => [d.k, d.opts[0]])),
```
con:
```js
            dev:{}, att:{}, liste:{in:[], out:[], cam:[]}, fermi:false, mani:{accordi:null, seconda:null}, muto:false,
```
2. Cancella la funzione del nome (si usa `controllaNome` di `canzoni.js`):
```js
// Il nome diventa una cartella (Cartella/<Canzone>/): unico e senza / o :
function checkName(n, except) {
  n = n.trim();
  if (!n) return 'Scrivi un nome.';
  if (/[\/:]/.test(n)) return 'Il nome non può contenere / o :';
  if (songs.some((s, i) => i !== except && s.name.toLowerCase() === n.toLowerCase())) return 'C\'è già una Canzone con questo nome.';
  return '';
}
```
3. Sostituisci `const lvPct = n => Math.round(st.snd.i1 + (st.snd.i5 - st.snd.i1) * (n - 1) / 4);` con:
```js
const lvPct = n => percentuale(n, st.snd.i1, st.snd.i5);
```
4. Nei selettori dei Dispositivi sostituisci `${d.opts.map(o => `<option${o === st.dev[d.k] ? ' selected' : ''}>` con:
```js
${st.liste[d.k].map(o => `<option${o === st.att[d.k] ? ' selected' : ''}>
```
5. Sostituisci le due righe:
```js
const name = b => NOTE[b.r] + (st.mode === 'accordi' ? TIPI[b.t].suf : '');
const freqs = b => (st.mode === 'accordi' ? TIPI[b.t].iv : [0]).map(iv => 261.63 * 2 ** ((b.r + iv) / 12 + b.o));
```
con:
```js
const name = b => nomeAccordo(b, st.mode);
const freqs = b => noteDellAccordo(b, st.mode, st.snd.voci).hz;
```
6. In fondo al file aggiungi:
```js
// --- video: il canvas che si vede nella polaroid e che si registra (video.js), ~30 fotogrammi al secondo come captureStream(30)
const camVideo = $('#cam'), cv = $('canvas');
let lastCycle = performance.now(), lastLv = performance.now(), ultimoDisegno = 0;
function frame(now) {
  if (st.edit < 0 && now - lastCycle > 2600) { st.i = (st.i + 1) % st.beads.length; lastCycle = now; paint(); } // simulazione: via con i Gesti
  if (now - lastLv > 3700) { st.lv = st.lv % 5 + 1; lastLv = now; paint(); } // simulazione: via con i Gesti
  if (now - ultimoDisegno >= 30) {
    ultimoDisegno = now;
    const [W, H] = misura(st.format);
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    const b = st.beads[st.i];
    disegna(cv, {
      video: camVideo, mani: st.mani, specchio: st.specchio, filtro: st.filtro, mano: st.mano, lv: st.lv, lvl: lvPct(st.lv) / 100,
      eff: st.eff, hz: freqs(b), fermi: st.fermi, accordo: name(b), titolo: st.titolo ? songs[st.song].name.trim() : '',
      conto: st.ui.conto, livello: 0,
    }, reduce ? 1.3 : now / 1000);
  }
  requestAnimationFrame(frame);
}

async function avvio() {
  build();
  requestAnimationFrame(frame);
}
avvio();
```

- [ ] **Passo 4: `src/index.html` usa `ui.js`**

```sh
sed -i '' '/^<script>$/,/^<\/script>$/d' src/index.html
echo '<script type="module" src="ui.js"></script>' >> src/index.html
```
Poi sostituisci `  <div id="slot-sheet"></div>` con:
```html
  <div id="slot-sheet"></div>
  <video id="cam" playsinline muted hidden></video>
```

- [ ] **Passo 5: test e prova**

Esegui: `node --test test/*.test.js`
Atteso: PASS.

Esegui: `npm run app`
Atteso: schermata identica. Il menu Canzone (crea, rinomina, elimina, con gli errori sul nome), l'editor della Nota, le manopole, "Di partenza", Impostazioni e Guida funzionano come nel prototipo. La polaroid mostra lo sfondo prugna con glitter, colonna dell'Intensità, onda, accordo e "– Ma Lei", e cambiando Formato il riquadro passa a 16:9. I selettori dei Dispositivi sono ancora vuoti. Controlla la console del webview (Safari → Sviluppo → Live Vocoder): non ci devono essere errori.

- [ ] **Passo 6: commit**

```bash
git add src/ui.js src/video.js src/index.html test/schermata.test.js
git commit -m "App: screen script split into modules, video canvas ready for real inputs"
```

---
### Task 4: Il DSP del Suono in Rust

Il DSP del prototipo `suono-vocoder` diventa `src-tauri/src/suono.rs`. Rispetto al prototipo cambiano quattro cose:
- le bande si cambiano senza allocare;
- `near` gestisce anche la Nota singola;
- c'è un limitatore;
- `Motore` smussa l'Intensità e ferma gli accordi con una rampa che lascia passare la Voce pulita.

**File:**
- Crea: `src-tauri/src/suono.rs`
- Modifica: `src-tauri/src/main.rs`

**Interfacce:**
- Produce:
  - `pub const SR: u32 = 48_000`, `pub const SRF: f32`;
  - `pub struct Parametri { pub effetto: usize /*0 spento,1 vocoder,2 coro*/, pub wet: f32, pub timbro: usize, pub bande: usize, pub cons: f32, pub morb: f32, pub scivola: f32 /*s*/, pub gate_db: f32 }`;
  - `pub struct Motore` con `new()`, `note(&mut self, hz: &[f32], k: usize)` (lista vuota = accordi fermi) e `blocco(&mut self, inp: &[f32], out: &mut [f32], p: &Parametri)`. `out` è il mix già limitato, prima del Volume in cuffia.

- [ ] **Passo 1: il codice del prototipo**

```sh
P=60061489c6c0892d42e0c5453ddd5192c73b3070:prototypes/suono-vocoder/src-tauri/src/main.rs
{
  cat <<'FINE'
// Il Suono (spec §3): Anti-fruscio, Coro / Vocoder / tastiera, pareggio del volume, Intensità, limitatore.
// Bq, blep e Synth vengono dal prototipo suono-vocoder (6006148), decisi a orecchio in #13.
// Gira nel callback d'uscita di cpal: niente allocazioni.
use std::f32::consts::{FRAC_PI_2, TAU};

pub const SR: u32 = 48_000;
pub const SRF: f32 = SR as f32;
const MAXB: usize = 32; // Dettaglio massimo: set_bands non alloca mai oltre

FINE
  git show "$P" | sed -n '249,526p'
} > src-tauri/src/suono.rs
```
Le righe 249–526 contengono `Bq`, `blep`, le costanti del Coro, `Grain` e `Synth` con il suo `impl`.

- [ ] **Passo 2: scrivi i test che falliscono**

In fondo a `src-tauri/src/suono.rs`:
```rust
#[cfg(test)]
mod tests {
    use super::*;
    fn rms(v: &[f32]) -> f32 {
        (v.iter().map(|x| x * x).sum::<f32>() / v.len() as f32).sqrt()
    }
    // "Voce" finta: sega a 220 Hz, 2 s
    fn voice() -> Vec<f32> {
        (0..2 * SR as usize).map(|i| 0.1 * (2.0 * (i as f32 * 220.0 / SRF % 1.0) - 1.0)).collect()
    }
    const LAM: [f32; 5] = [440.0, 523.25, 659.26, 220.0, 880.0]; // La minore, Pienezza 5
    fn midi(f: &[f32]) -> Vec<i32> {
        f.iter().map(|f| (69.0 + 12.0 * (f / 440.0).log2()).round() as i32).collect()
    }
    fn par(effetto: usize, wet: f32) -> Parametri {
        Parametri { effetto, wet, timbro: 1, bande: 24, cons: 0.15, morb: 0.0, scivola: 0.0, gate_db: -75.0 }
    }

    #[test]
    fn vocoder_pareggia_e_tace() {
        for bande in [8, 16, 32] {
            for timbre in 0..3 {
                for morb in [0.0, 1.0] {
                    let mut s = Synth::new(bande);
                    s.soften(morb);
                    let x = voice();
                    let y: Vec<f32> = x.iter().map(|&x| s.process(x, &LAM, 1.0, timbre, 1, 1.0, 0.0)).collect();
                    let (rx, ry) = (rms(&x[SR as usize..]), rms(&y[SR as usize..]));
                    assert!(y.iter().all(|v| v.is_finite()));
                    assert!((ry / rx - 1.0).abs() < 0.3, "bande {bande} timbro {timbre} morb {morb}: rms voce {rx} vocoder {ry}");
                    let quiet: Vec<f32> = (0..SR as usize).map(|_| s.process(0.0, &LAM, 1.0, timbre, 1, 1.0, 0.0)).collect();
                    assert!(rms(&quiet[SR as usize / 2..]) < 1e-3, "voce zitta ma il vocoder suona");
                }
            }
        }
    }

    #[test]
    fn coro_sente_la_nota_e_la_sposta() {
        let mut s = Synth::new(16);
        let x = voice();
        let y: Vec<f32> = x.iter().map(|&x| s.process(x, &[330.0], 1.0, 0, 2, 1.0, 0.0)).collect();
        assert!(s.voiced && (SRF / s.period - 220.0).abs() < 2.0, "sente {} Hz invece di 220", SRF / s.period);
        assert!(y.iter().all(|v| v.is_finite()) && rms(&y[SR as usize..]) > 0.03);
        let tail = &y[SR as usize..SR as usize + 4800];
        let ac = |t: usize| tail[..4000].iter().zip(&tail[t..]).map(|(a, b)| a * b).sum::<f32>();
        let (a0, a330, a220) = (ac(0), ac(145), ac(218));
        assert!(a330 > 0.8 * a0 && a220 < 0.5 * a0, "periodicità 0:{a0} 330Hz:{a330} 220Hz:{a220}");
        let quiet: Vec<f32> = (0..SR as usize).map(|_| s.process(0.0, &[330.0], 1.0, 0, 2, 1.0, 0.0)).collect();
        assert!(rms(&quiet[SR as usize / 2..]) < 1e-3, "voce zitta ma il coro suona");
    }

    #[test]
    fn gate_taglia_il_fruscio() {
        let mut s = Synth::new(16);
        s.gate = 10f32.powf(-50.0 / 20.0);
        let hiss = |i: usize| 0.0003 * ((i as f32 * 12.9898).sin() * 43758.547).fract();
        let quiet: Vec<f32> = (0..SR as usize).map(|i| s.gate(hiss(i))).collect();
        assert!(rms(&quiet[SR as usize / 2..]) < 1e-5);
        let sing: Vec<f32> = voice().iter().map(|&x| s.gate(x)).collect();
        assert!(rms(&sing[SR as usize..]) > 0.05);
    }

    #[test]
    fn coro_ottava_vicina() {
        // canta La4 (440): Do maggiore ottava 3 va su Do5, Mi4, Sol4; basso Do4, sopra Do6
        let mut f = [130.81, 164.81, 196.0, 65.41, 261.63];
        near(&mut f, 3, 440.0);
        assert_eq!(midi(&f), [72, 64, 67, 60, 84]);
    }

    #[test]
    fn nota_singola_ottava_vicina() {
        let mut f = [130.81, 65.41, 261.63]; // Base, basso, sopra
        near(&mut f, 1, 440.0);
        assert_eq!(midi(&f), [72, 60, 84]);
    }

    #[test]
    fn bande_senza_allocare() {
        let mut s = Synth::new(24);
        let cap = (s.m.capacity(), s.c.capacity(), s.env.capacity());
        for n in [8, 12, 16, 24, 32] {
            s.set_bands(n);
            assert_eq!((s.m.len(), s.c.len(), s.env.len()), (n, n, n));
            assert_eq!((s.m.capacity(), s.c.capacity(), s.env.capacity()), cap);
        }
    }

    #[test]
    fn accordi_fermi_voce_pulita() {
        for effetto in [0, 1, 2] {
            let mut m = Motore::new();
            let x = voice();
            let mut y = vec![0.0; x.len()];
            m.note(&LAM, 3);
            m.blocco(&x, &mut y, &par(effetto, 0.9));
            m.note(&[], 0);
            m.blocco(&x, &mut y, &par(effetto, 0.9));
            // dopo la rampa (~80 ms) passa solo la Voce pulita: mai silenzio, mai accordi
            for (a, b) in x[SR as usize..].iter().zip(&y[SR as usize..]) {
                assert!((a - b).abs() < 1e-3, "effetto {effetto}: voce {a} uscita {b}");
            }
        }
    }

    #[test]
    fn limitatore_tetto() {
        let mut l = Limiter::new();
        for i in 0..SR as usize {
            let y = l.run(6.0 * (i as f32 * 0.05).sin());
            assert!(y.abs() <= TETTO + 1e-6, "{y}");
        }
        let mut l = Limiter::new();
        assert_eq!(l.run(0.5), 0.5); // sotto il tetto non tocca niente
    }
}
```
In `src-tauri/src/main.rs` aggiungi `mod suono;` sopra `fn main()`.

- [ ] **Passo 3: fallo girare e guarda che fallisce**

Esegui: `cd src-tauri && cargo test --release suono`
Atteso: FAIL in compilazione, con `cannot find function near`, `Motore`, `Limiter`, `Parametri`, `TETTO` e il metodo `set_bands`.

- [ ] **Passo 4: bande senza allocare**

In `src-tauri/src/suono.rs` sostituisci:
```rust
    // n bande a passo logaritmico 120 Hz – 8 kHz, ognuna larga quanto il passo
    fn new(n: usize) -> Self {
        let n = n.clamp(4, 64);
        let step = (8000f32 / 120.0).log2() / (n - 1) as f32;
        let q = 2f32.powf(step).sqrt() / (2f32.powf(step) - 1.0);
        let f = |i: usize| 120.0 * 2f32.powf(step * i as f32);
        let mut s = Synth {
            n,
            m: (0..n).map(|i| Bq::new('b', f(i), q)).collect(),
            c: (0..n).map(|i| Bq::new('b', f(i), q)).collect(),
            env: vec![0.0; n],
```
con:
```rust
    // Alloca subito per MAXB bande: set_bands cambia il Dettaglio senza allocare nel thread audio.
    fn new(n: usize) -> Self {
        let mut s = Synth {
            n: 0,
            m: Vec::with_capacity(MAXB),
            c: Vec::with_capacity(MAXB),
            env: Vec::with_capacity(MAXB),
```
e sostituisci:
```rust
        s.soften(0.0);
        s
    }
```
con:
```rust
        s.soften(0.0);
        s.set_bands(n);
        s
    }

    // n bande a passo logaritmico 120 Hz – 8 kHz, ognuna larga quanto il passo. Riusa la memoria di new().
    fn set_bands(&mut self, n: usize) {
        let n = n.clamp(4, MAXB);
        if n == self.n {
            return;
        }
        let step = (8000f32 / 120.0).log2() / (n - 1) as f32;
        let q = 2f32.powf(step).sqrt() / (2f32.powf(step) - 1.0);
        let f = |i: usize| 120.0 * 2f32.powf(step * i as f32);
        self.m.clear();
        self.m.extend((0..n).map(|i| Bq::new('b', f(i), q)));
        self.c.clear();
        self.c.extend((0..n).map(|i| Bq::new('b', f(i), q)));
        self.env.clear();
        self.env.resize(n, 0.0);
        self.n = n;
    }
```

- [ ] **Passo 5: `near`, limitatore e `Motore`**

Sopra `#[cfg(test)]` aggiungi:
```rust
// Coro: le prime k note (l'accordo, o la sola Base) vanno nell'ottava più vicina a quella cantata;
// basso e ottava sopra seguono la Base, tenendo il loro salto d'ottava.
fn near(f: &mut [f32], k: usize, sung: f32) {
    let root = f[0];
    let r = root * 2f32.powf((sung / root).log2().round());
    for (i, v) in f.iter_mut().enumerate() {
        *v = if i < k { *v * 2f32.powf((sung / *v).log2().round()) } else { r * *v / root };
    }
}

// ponytail: limitatore di picco senza lookahead (attacco istantaneo, rilascio ~100 ms). Limite: sui colpi
// fortissimi, come un battito di mani, schiaccia un po' l'attacco. Se si sente, si passa a un lookahead di 5 ms.
const TETTO: f32 = 0.9;
struct Limiter {
    g: f32,
}
impl Limiter {
    fn new() -> Self {
        Limiter { g: 1.0 }
    }
    fn run(&mut self, x: f32) -> f32 {
        let serve = if x.abs() > TETTO { TETTO / x.abs() } else { 1.0 };
        self.g = (self.g + (1.0 - self.g) / (0.1 * SRF)).min(serve);
        x * self.g
    }
}

pub struct Parametri {
    pub effetto: usize, // 0 Spento (tastiera), 1 Vocoder, 2 Coro
    pub wet: f32,       // quota d'Effetto 0..1 (con Spento: volume degli accordi)
    pub timbro: usize,
    pub bande: usize,
    pub cons: f32,
    pub morb: f32,
    pub scivola: f32, // secondi
    pub gate_db: f32, // -75 = Anti-fruscio spento
}

// ponytail: costante di tempo unica per smussare l'Intensità e per fermare gli accordi (60–120 ms, spec §4); si regola a orecchio.
const WET_TC: f32 = 0.08;

pub struct Motore {
    syn: Synth,
    lim: Limiter,
    wet: f32,
    hz: [f32; 5],
    nv: usize,
    k: usize,
    suona: bool,
}

impl Motore {
    pub fn new() -> Self {
        Motore { syn: Synth::new(24), lim: Limiter::new(), wet: 0.0, hz: [0.0; 5], nv: 0, k: 0, suona: false }
    }

    // Lista vuota = accordi fermi: si tengono le ultime note mentre la quota d'Effetto scende a zero, così niente clic.
    pub fn note(&mut self, hz: &[f32], k: usize) {
        self.suona = !hz.is_empty();
        if self.suona {
            self.nv = hz.len().min(5);
            self.hz[..self.nv].copy_from_slice(&hz[..self.nv]);
            self.k = k.min(self.nv);
        }
    }

    pub fn blocco(&mut self, inp: &[f32], out: &mut [f32], p: &Parametri) {
        let s = &mut self.syn;
        s.set_bands(p.bande);
        s.soften(p.morb);
        s.gate = if p.gate_db <= -75.0 { 0.0 } else { 10f32.powf(p.gate_db / 20.0) };
        let (mut notes, nv) = (self.hz, self.nv);
        if p.effetto == 2 && s.voiced && nv > 0 {
            near(&mut notes[..nv], self.k, SRF / s.period);
        }
        let glide = if p.scivola < 0.001 { 1.0 } else { 1.0 - (-1.0 / (p.scivola * SRF)).exp() };
        let target = if self.suona { p.wet } else { 0.0 };
        let kw = 1.0 - (-1.0 / (WET_TC * SRF)).exp();
        for (o, &x) in out.iter_mut().zip(inp) {
            self.wet += (target - self.wet) * kw;
            let y = if nv == 0 { s.gate(x) } else { s.process(x, &notes[..nv], glide, p.timbro, p.effetto, self.wet, p.cons) };
            *o = self.lim.run(y);
        }
    }
}
```

- [ ] **Passo 6: fai girare i test e guarda che passano**

Esegui: `cd src-tauri && cargo test --release suono`
Atteso: PASS, 8 test.

- [ ] **Passo 7: commit**

```bash
git add src-tauri/src/suono.rs src-tauri/src/main.rs
git commit -m "Sound: DSP from the vocoder prototype, no allocation on band change, limiter, chord stop ramp"
```

---

### Task 5: Dispositivi audio da CoreAudio

Elenco di ingressi e uscite con il nome che usa cpal, i predefiniti di macOS e il tipo di uscita: cuffie, altoparlanti o Bluetooth.

**File:**
- Crea: `src-tauri/src/dispositivi.rs`
- Modifica: `src-tauri/Cargo.toml`, `src-tauri/src/main.rs`

**Interfacce:**
- Produce: il comando `dispositivi() -> Vec<Dispositivo>`. In JSON ogni elemento è `{nome, ingresso, uscita, tipo: 'cuffie'|'altoparlanti'|'bluetooth', predefinito_ingresso, predefinito_uscita}`.

- [ ] **Passo 1: dipendenze**

Esegui: `cd src-tauri && cargo add objc2@0.6 objc2-foundation@0.3 && cargo add serde@1 --features derive`

- [ ] **Passo 2: scrivi il test che fallisce**

`src-tauri/src/dispositivi.rs`, per ora solo il test:
```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tipi_di_uscita() {
        assert_eq!(tipo(cc(b"bltn"), "BuiltInSpeakerDevice"), Tipo::Altoparlanti);
        assert_eq!(tipo(cc(b"bltn"), "BuiltInHeadphoneOutputDevice"), Tipo::Cuffie);
        assert_eq!(tipo(cc(b"blue"), "AA-BB-CC"), Tipo::Bluetooth);
        assert_eq!(tipo(cc(b"blea"), "x"), Tipo::Bluetooth);
        assert_eq!(tipo(cc(b"usb "), "AppleUSBAudioEngine:x"), Tipo::Cuffie);
        assert_eq!(tipo(cc(b"hdmi"), "x"), Tipo::Altoparlanti);
    }

    // A mano, per vedere i Dispositivi veri: cargo test --release elenca -- --ignored --nocapture
    #[test]
    #[ignore]
    fn elenca() {
        for d in dispositivi() {
            println!("{d:?}");
        }
    }
}
```
In `main.rs` aggiungi `mod dispositivi;`.

Esegui: `cd src-tauri && cargo test --release dispositivi`
Atteso: FAIL in compilazione (`cannot find function tipo`).

- [ ] **Passo 3: il codice**

In cima a `src-tauri/src/dispositivi.rs`:
```rust
// Dispositivi audio da CoreAudio: nome (lo stesso che usa cpal), ingresso/uscita, predefiniti di macOS, tipo d'uscita.
use objc2::rc::Retained;
use objc2_foundation::NSString;
use serde::Serialize;
use std::ffi::c_void;

#[repr(C)]
struct Addr {
    sel: u32,
    scope: u32,
    elem: u32,
}

#[link(name = "CoreAudio", kind = "framework")]
unsafe extern "C" {
    fn AudioObjectGetPropertyDataSize(id: u32, a: *const Addr, ql: u32, q: *const c_void, size: *mut u32) -> i32;
    fn AudioObjectGetPropertyData(id: u32, a: *const Addr, ql: u32, q: *const c_void, size: *mut u32, out: *mut c_void) -> i32;
}

const fn cc(s: &[u8; 4]) -> u32 {
    u32::from_be_bytes(*s)
}
const SISTEMA: u32 = 1; // kAudioObjectSystemObject
const GLOB: u32 = cc(b"glob");

fn dimensione(id: u32, sel: u32, scope: u32) -> u32 {
    let mut s = 0;
    unsafe { AudioObjectGetPropertyDataSize(id, &Addr { sel, scope, elem: 0 }, 0, std::ptr::null(), &mut s) };
    s
}
fn numero(id: u32, sel: u32) -> u32 {
    let (mut v, mut s) = (0u32, 4u32);
    unsafe { AudioObjectGetPropertyData(id, &Addr { sel, scope: GLOB, elem: 0 }, 0, std::ptr::null(), &mut s, &mut v as *mut u32 as *mut c_void) };
    v
}
fn testo(id: u32, sel: u32) -> String {
    let mut p: *mut NSString = std::ptr::null_mut();
    let mut s = std::mem::size_of::<*mut NSString>() as u32;
    unsafe {
        AudioObjectGetPropertyData(id, &Addr { sel, scope: GLOB, elem: 0 }, 0, std::ptr::null(), &mut s, &mut p as *mut _ as *mut c_void);
        // CoreAudio restituisce la CFString già trattenuta: Retained la rilascia (CFString e NSString sono la stessa cosa)
        Retained::from_raw(p).map(|t| t.to_string()).unwrap_or_default()
    }
}

#[derive(Serialize, PartialEq, Debug, Clone, Copy)]
#[serde(rename_all = "lowercase")]
pub enum Tipo {
    Cuffie,
    Altoparlanti,
    Bluetooth,
}

// Altoparlanti (anche schermi e AirPlay) = Ascolto spento, perché fischierebbe. Bluetooth = avviso di ritardo.
// Tutto il resto (jack, USB) conta come cuffie.
fn tipo(trasporto: u32, uid: &str) -> Tipo {
    match &trasporto.to_be_bytes() {
        b"blue" | b"blea" => Tipo::Bluetooth,
        b"bltn" if uid.contains("Speaker") => Tipo::Altoparlanti,
        b"hdmi" | b"dprt" | b"airp" => Tipo::Altoparlanti,
        _ => Tipo::Cuffie,
    }
}

#[derive(Serialize, Debug)]
pub struct Dispositivo {
    nome: String,
    ingresso: bool,
    uscita: bool,
    tipo: Tipo,
    predefinito_ingresso: bool,
    predefinito_uscita: bool,
}

#[tauri::command]
pub fn dispositivi() -> Vec<Dispositivo> {
    let n = dimensione(SISTEMA, cc(b"dev#"), GLOB) as usize / 4;
    let mut ids = vec![0u32; n];
    let mut s = (n * 4) as u32;
    unsafe { AudioObjectGetPropertyData(SISTEMA, &Addr { sel: cc(b"dev#"), scope: GLOB, elem: 0 }, 0, std::ptr::null(), &mut s, ids.as_mut_ptr() as *mut c_void) };
    ids.truncate(s as usize / 4);
    let (din, dout) = (numero(SISTEMA, cc(b"dIn ")), numero(SISTEMA, cc(b"dOut")));
    ids.into_iter()
        .map(|id| Dispositivo {
            nome: testo(id, cc(b"lnam")),
            ingresso: dimensione(id, cc(b"stm#"), cc(b"inpt")) > 0,
            uscita: dimensione(id, cc(b"stm#"), cc(b"outp")) > 0,
            tipo: tipo(numero(id, cc(b"tran")), &testo(id, cc(b"uid "))),
            predefinito_ingresso: id == din,
            predefinito_uscita: id == dout,
        })
        .collect()
}
```
In `main.rs`, `.run(...)` diventa:
```rust
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![dispositivi::dispositivi])
        .run(tauri::generate_context!())
        .expect("avvio di Live Vocoder");
```

- [ ] **Passo 4: fai girare i test**

Esegui: `cd src-tauri && cargo test --release dispositivi`
Atteso: PASS su `tipi_di_uscita`.

Esegui, con le cuffie a filo collegate: `cd src-tauri && cargo test --release elenca -- --ignored --nocapture`
Atteso: compaiono il microfono del Mac (`ingresso: true`, predefinito), le cuffie (`tipo: Cuffie`) e gli altoparlanti (`tipo: Altoparlanti`), con i nomi che si vedono in Impostazioni di Sistema → Suono.

- [ ] **Passo 5: commit**

```bash
git add src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/src/dispositivi.rs src-tauri/src/main.rs
git commit -m "Devices: CoreAudio list with defaults and output kind (headphones, speakers, Bluetooth)"
```

---

### Task 6: Audio in tempo reale e banco del Suono collegato

Microfono → `Motore` → cuffie con cpal, e il PCM va al webview. Le manopole, l'Effetto, le Note e l'Intensità della schermata arrivano a Rust. I selettori dei Dispositivi mostrano quelli veri, e con gli altoparlanti l'Ascolto resta spento con un avviso rosa.

**File:**
- Crea: `src-tauri/src/audio.rs`, `src/motore.js`, `src/avvisi.js`
- Modifica: `src-tauri/Cargo.toml`, `src-tauri/src/main.rs`, `src/ui.js`, `src/index.html`, `test/schermata.test.js`

**Interfacce:**
- Consuma: `suono::{Motore, Parametri, SR}` (Task 4), il comando `dispositivi` (Task 5), `parametriRust` e `scegli` (Task 2).
- Produce:
  - comandi Rust: `avvia_audio(ingresso: String, uscita: String, pcm: Channel) -> Result<String, String>`, `ferma_audio()`, `set(nome: String, valore: f32) -> Result<(), String>` con i nomi `effetto, wet, timbro, bande, cons, morb, scivola, gate, vol, muto`, `set_note(hz: Vec<f32>, k: u32)`;
  - `motore.js`: `avvia(ingresso, uscita)`, `parametri(obj)`, `note(hz, k)`, `livello(ritardo=80) -> number`, `ascolta(fn) -> stacca()`;
  - `avvisi.js`: `avviso(chiave, testo, azioni=[[testo, fn]])`, `togli(chiave)`, `stato(chiave, attivo, testo, azioni)`;
  - in `ui.js`: `invoke(...)`, `invia()`, `controllaDispositivi()`.

- [ ] **Passo 1: test che fallisce**

In `test/schermata.test.js`, la lista dei file nel ciclo `for (const f of [...])` diventa `['ui.js', 'video.js', 'motore.js', 'avvisi.js']`.

Esegui: `node --test test/*.test.js`
Atteso: FAIL su `motore.js si legge` e su `avvisi.js si legge`.

- [ ] **Passo 2: `src-tauri/src/audio.rs`**

Esegui: `cd src-tauri && cargo add cpal@0.18 ringbuf@0.5`

```rust
// Audio in tempo reale (spec §3): microfono -> Suono -> cuffie con cpal; il mix va anche al webview per la Registrazione.
// Struttura dei prototipi prova-ritardo (9adddb1) e suono-vocoder (6006148).
use crate::suono::{Motore, Parametri, SR};
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use ringbuf::{traits::*, HeapRb};
use std::sync::atomic::{AtomicU32, Ordering::Relaxed};
use std::sync::{mpsc, Arc, Mutex};
use std::time::Duration;
use tauri::ipc::{Channel, InvokeResponseBody};
use tauri::State;

// Manopole: la pagina le manda per nome (manopole.js, parametriRust), l'audio le legge una volta per blocco.
const NOMI: [&str; 10] = ["effetto", "wet", "timbro", "bande", "cons", "morb", "scivola", "gate", "vol", "muto"];

#[derive(Default)]
pub struct Audio {
    tx: Mutex<Option<mpsc::Sender<()>>>,
    p: Arc<[AtomicU32; 10]>,
    // ponytail: 5 frequenze + quante + k in atomici separati; un blocco (1,3 ms) può leggere un accordo a metà, non si sente.
    note: Arc<[AtomicU32; 7]>,
}

fn nome(d: &cpal::Device) -> String {
    d.description().map(|x| x.name().to_string()).unwrap_or_default()
}

#[tauri::command]
pub fn avvia_audio(a: State<Audio>, ingresso: String, uscita: String, pcm: Channel<InvokeResponseBody>) -> Result<String, String> {
    ferma_audio(a.clone());
    let (tx, rx) = mpsc::channel();
    let (pronto_tx, pronto_rx) = mpsc::channel();
    let (p, n) = (a.p.clone(), a.note.clone());
    std::thread::spawn(move || gira(ingresso, uscita, p, n, pcm, rx, pronto_tx));
    let info = pronto_rx.recv().map_err(|e| e.to_string())??;
    *a.tx.lock().unwrap() = Some(tx);
    Ok(info)
}

#[tauri::command]
pub fn ferma_audio(a: State<Audio>) {
    if let Some(tx) = a.tx.lock().unwrap().take() {
        let _ = tx.send(());
    }
}

#[tauri::command]
pub fn set(a: State<Audio>, nome: String, valore: f32) -> Result<(), String> {
    let i = NOMI.iter().position(|n| *n == nome).ok_or(format!("manopola sconosciuta {nome}"))?;
    a.p[i].store(valore.to_bits(), Relaxed);
    Ok(())
}

// Le note che suonano (accordo.js, noteDellAccordo); lista vuota = accordi fermi.
#[tauri::command]
pub fn set_note(a: State<Audio>, hz: Vec<f32>, k: u32) {
    for (i, slot) in a.note[..5].iter().enumerate() {
        slot.store(hz.get(i).copied().unwrap_or(0.0).to_bits(), Relaxed);
    }
    a.note[6].store(k, Relaxed);
    a.note[5].store(hz.len().min(5) as u32, Relaxed);
}

#[allow(clippy::too_many_arguments)]
fn gira(
    ingresso: String,
    uscita: String,
    p: Arc<[AtomicU32; 10]>,
    n: Arc<[AtomicU32; 7]>,
    pcm: Channel<InvokeResponseBody>,
    rx: mpsc::Receiver<()>,
    pronto: mpsc::Sender<Result<String, String>>,
) {
    let e = |e: cpal::Error| e.to_string();
    let host = cpal::default_host();
    let fatto = (|| -> Result<_, String> {
        let idev = host.input_devices().map_err(e)?.find(|d| nome(d) == ingresso).ok_or(format!("manca {ingresso}"))?;
        let odev = host.output_devices().map_err(e)?.find(|d| nome(d) == uscita).ok_or(format!("manca {uscita}"))?;
        let ich = idev.default_input_config().map_err(e)?.channels() as usize;
        let och = odev.default_output_config().map_err(e)?.channels() as usize;
        let cfg = |ch: usize| cpal::StreamConfig { channels: ch as u16, sample_rate: SR, buffer_size: cpal::BufferSize::Fixed(64) };
        let (mut voce_p, mut voce_c) = HeapRb::<f32>::new(8192).split();
        let (mut mix_p, mix_c) = HeapRb::<f32>::new(SR as usize).split();
        let istream = idev
            .build_input_stream(
                cfg(ich),
                move |data: &[f32], _: &cpal::InputCallbackInfo| {
                    for f in data.chunks(ich) {
                        let _ = voce_p.try_push(f[0]);
                    }
                },
                |err| eprintln!("ingresso: {err}"),
                None,
            )
            .map_err(e)?;
        let mut motore = Motore::new();
        let (mut voce, mut mix) = (vec![0f32; 4096], vec![0f32; 4096]);
        let ostream = odev
            .build_output_stream(
                cfg(och),
                move |out: &mut [f32], _: &cpal::OutputCallbackInfo| {
                    out.fill(0.0);
                    let frames = (out.len() / och).min(voce.len());
                    // ponytail: microfono e cuffie hanno orologi separati; si butta l'arretrato oltre 2 buffer invece di
                    // ricampionare. Limite: se gli orologi vanno a velocità diverse può scappare un micro-clic.
                    // Il ricampionamento adattivo si aggiunge solo se Keopees lo sente (spec §2).
                    voce_c.skip(voce_c.occupied_len().saturating_sub(frames * 2));
                    let v = |i: usize| f32::from_bits(p[i].load(Relaxed));
                    let par = Parametri { effetto: v(0) as usize, wet: v(1), timbro: v(2) as usize, bande: v(3) as usize, cons: v(4), morb: v(5), scivola: v(6), gate_db: v(7) };
                    let (vol, muto) = (v(8), v(9) > 0.5);
                    let nv = (n[5].load(Relaxed) as usize).min(5);
                    let hz: [f32; 5] = std::array::from_fn(|i| f32::from_bits(n[i].load(Relaxed)));
                    motore.note(&hz[..nv], n[6].load(Relaxed) as usize);
                    for x in &mut voce[..frames] {
                        *x = voce_c.try_pop().unwrap_or(0.0);
                    }
                    motore.blocco(&voce[..frames], &mut mix[..frames], &par);
                    for (f, &y) in out.chunks_mut(och).zip(&mix[..frames]) {
                        // Con gli altoparlanti l'Ascolto tace, ma la Registrazione ha comunque l'audio
                        f.fill(if muto { 0.0 } else { (y * vol).tanh() });
                        let _ = mix_p.try_push(y);
                    }
                },
                |err| eprintln!("uscita: {err}"),
                None,
            )
            .map_err(e)?;
        ostream.play().map_err(e)?;
        istream.play().map_err(e)?;
        Ok((istream, ostream, mix_c, format!("ingresso {ingresso}, uscita {uscita}")))
    })();
    let (_i, _o, mut mix_c, info) = match fatto {
        Ok(f) => f,
        Err(err) => return drop(pronto.send(Err(err))),
    };
    let _ = pronto.send(Ok(info));
    loop {
        match rx.recv_timeout(Duration::from_millis(10)) {
            Ok(()) | Err(mpsc::RecvTimeoutError::Disconnected) => break,
            Err(mpsc::RecvTimeoutError::Timeout) => {
                let k = mix_c.occupied_len();
                if k > 0 {
                    let mut b = vec![0f32; k];
                    mix_c.pop_slice(&mut b);
                    let _ = pcm.send(InvokeResponseBody::Raw(b.iter().flat_map(|x| x.to_le_bytes()).collect()));
                }
            }
        }
    }
}
```

`src-tauri/src/main.rs` diventa:
```rust
// Live Vocoder: app Mac per Keopees (spec docs/superpowers/specs/2026-10-11-live-vocoder-v1-design.md).
mod audio;
mod dispositivi;
mod suono;

fn main() {
    tauri::Builder::default()
        .manage(audio::Audio::default())
        .invoke_handler(tauri::generate_handler![
            audio::avvia_audio, audio::ferma_audio, audio::set, audio::set_note,
            dispositivi::dispositivi,
        ])
        .run(tauri::generate_context!())
        .expect("avvio di Live Vocoder");
}
```

Esegui: `cd src-tauri && cargo test --release`
Atteso: compila, e i test di `suono` e `dispositivi` passano.

- [ ] **Passo 3: `src/motore.js` e `src/avvisi.js`**

`src/motore.js`:
```js
// Il lato JS dell'audio Rust (audio.rs): avvio sui Dispositivi, manopole, note; il PCM torna qui per l'onda e la Registrazione.
const core = () => window.__TAURI__.core;
let inviati = {}, noteInviate = '';
const livelli = [], chi = new Set();

function suPcm(buf) {
  const f = new Float32Array(buf);
  let s = 0;
  for (const v of f) s += v * v;
  livelli.push([performance.now(), Math.sqrt(s / (f.length || 1))]);
  if (livelli.length > 100) livelli.shift();
  for (const fn of chi) fn(f);
}

// Un Channel nuovo a ogni avvio: riusato, si blocca (#6).
export const avvia = (ingresso, uscita) =>
  core().invoke('avvia_audio', { ingresso, uscita, pcm: Object.assign(new (core().Channel)(), { onmessage: suPcm }) });

// Solo i valori cambiati: le manopole restano in Rust anche quando l'audio riparte su altri Dispositivi.
export function parametri(p) {
  for (const [nome, valore] of Object.entries(p))
    if (inviati[nome] !== valore) { inviati[nome] = valore; core().invoke('set', { nome, valore }); }
}

export function note(hz, k) {
  const c = `${hz.join()}/${k}`;
  if (c !== noteInviate) { noteInviate = c; core().invoke('set_note', { hz, k }); }
}

// Livello (RMS) della voce trattata di ~80 ms fa: così l'onda sopra il video sta con le mani (#6).
export function livello(ritardo = 80) {
  const t = performance.now() - ritardo;
  let v = 0;
  for (const [ti, r] of livelli) { if (ti > t) break; v = r; }
  return v;
}

// La Registrazione si attacca qui al PCM; restituisce la funzione per staccarsi.
export function ascolta(fn) { chi.add(fn); return () => chi.delete(fn); }
```

`src/avvisi.js`:
```js
// Avvisi rosa nello stile dell'app, non finestre di sistema. Un avviso per chiave: rimetterlo lo aggiorna.
const box = () => document.getElementById('avvisi');
const el = (tag, props) => Object.assign(document.createElement(tag), props);

export function avviso(chiave, testo, azioni = []) {
  let a = box().querySelector(`[data-chiave="${chiave}"]`);
  if (!a) { a = el('div', { className: 'avviso' }); a.dataset.chiave = chiave; box().append(a); }
  a.replaceChildren(el('span', { textContent: testo }),
    ...azioni.map(([t, f]) => el('button', { className: 'pill small', textContent: t, onclick: () => { togli(chiave); f(); } })),
    el('button', { className: 'chiudi', textContent: '×', ariaLabel: 'Chiudi', onclick: () => togli(chiave) }));
}

export function togli(chiave) { box().querySelector(`[data-chiave="${chiave}"]`)?.remove(); }

// Per le cose controllate ogni 2 s: l'avviso compare quando lo stato comincia, non a ogni controllo, e sparisce quando finisce.
const visti = new Set();
export function stato(chiave, attivo, testo, azioni) {
  if (!attivo) { visti.delete(chiave); return togli(chiave); }
  if (!visti.has(chiave)) { visti.add(chiave); avviso(chiave, testo, azioni); }
}
```

In `src/index.html`:
1. Sostituisci `  <video id="cam" playsinline muted hidden></video>` con:
```html
  <video id="cam" playsinline muted hidden></video>
  <div id="avvisi" aria-live="polite"></div>
```
2. Prima di `/* finestra stretta (non è il Mac di Keopees): si impila e scorre */` aggiungi:
```css
/* avvisi rosa (avvisi.js) */
#avvisi{position:absolute;z-index:9;top:14px;left:50%;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:8px;width:min(620px,92vw);pointer-events:none}
.avviso{pointer-events:auto;display:flex;align-items:center;flex-wrap:wrap;gap:8px 10px;padding:10px 12px 10px 18px;border-radius:22px;background:var(--crema);color:var(--prugna);font-weight:800;font-size:.9rem;box-shadow:inset 0 0 0 2px var(--rosa),0 18px 36px -18px var(--ombra)}
.avviso > span{flex:1;min-width:12rem}
.avviso .chiudi{all:unset;cursor:pointer;width:28px;height:28px;border-radius:50%;display:grid;place-items:center;background:var(--confetto)}
```

- [ ] **Passo 4: collega la schermata**

In `src/ui.js`:
1. Sotto gli `import` aggiungi:
```js
import * as motore from './motore.js';
import { avviso, stato } from './avvisi.js';
import { parametriRust, scegli } from './manopole.js';
const invoke = (...a) => window.__TAURI__.core.invoke(...a);
```
2. In `sync()` sostituisci la riga `  $$('[data-act="reset"]').forEach(b => b.disabled = isDef());` con:
```js
  $$('[data-act="reset"]').forEach(b => b.disabled = isDef());
  invia();
```
3. Nel gestore `change` sostituisci `if (k) { st.dev[k] = e.target.value; setLcd('dev:' + k); }` con:
```js
if (k) { st.dev[k] = e.target.value; setLcd('dev:' + k); controllaDispositivi(); }
```
4. Nel `frame`, `livello: 0,` diventa `livello: motore.livello(),`.
5. Sopra `async function avvio() {` aggiungi:
```js
// Manda a Rust manopole, quota d'Effetto e note che suonano (motore.js manda solo quello che è cambiato).
function invia() {
  motore.parametri({ ...parametriRust(st), muto: st.muto ? 1 : 0 });
  const { hz, k } = noteDellAccordo(st.beads[st.i], st.mode, st.snd.voci);
  st.fermi ? motore.note([], 0) : motore.note(hz, k);
}

// Ogni 2 s e a ogni scelta: i Dispositivi veri. Si usa la scelta di Keopees se c'è, altrimenti quello di macOS (la scelta resta salvata).
let giroDisp = null;
function controllaDispositivi() {
  return (giroDisp ??= (async () => {
    const audio = await invoke('dispositivi');
    const ins = audio.filter(d => d.ingresso), outs = audio.filter(d => d.uscita);
    const prima = JSON.stringify(st.liste);
    st.liste = { ...st.liste, in: ins.map(d => d.nome), out: outs.map(d => d.nome) };
    const inn = scegli(st.liste.in, st.dev.in, ins.find(d => d.predefinito_ingresso)?.nome);
    const out = scegli(st.liste.out, st.dev.out, outs.find(d => d.predefinito_uscita)?.nome);
    const tipo = outs.find(d => d.nome === out)?.tipo;
    st.muto = tipo === 'altoparlanti';
    if (inn !== st.att.in || out !== st.att.out) {
      st.att.in = inn; st.att.out = out;
      await motore.avvia(inn, out).catch(e => avviso('audio', `Non riesco ad accendere l'audio: ${e}`));
    }
    stato('cuffie', st.muto, "Servono le cuffie a filo: con gli altoparlanti l'Ascolto resta spento, perché fischierebbe.");
    stato('bluetooth', tipo === 'bluetooth', "Con le cuffie Bluetooth l'Ascolto arriva in ritardo: meglio quelle a filo.");
    if (JSON.stringify(st.liste) !== prima) build(); else invia();
  })().finally(() => (giroDisp = null)));
}
```
6. `async function avvio() { … }` diventa:
```js
async function avvio() {
  build();
  await controllaDispositivi();
  setInterval(controllaDispositivi, 2000);
  requestAnimationFrame(frame);
}
```

- [ ] **Passo 5: test e prova a orecchio**

Esegui: `npm test`
Atteso: PASS.

Esegui: `npm run app` con le cuffie a filo collegate.
Atteso:
- macOS chiede il Microfono: rispondi Consenti.
- Cantando senti il Coro in cuffia, con le Note che cambiano ogni 2,6 s.
- Effetto Vocoder → voce di synth. Spento → tastiera sopra la Voce pulita.
- Le manopole cambiano il suono mentre canti. Il Volume in cuffia cambia solo quanto forte ti senti.
- I selettori Ingresso e Uscita mostrano i Dispositivi veri.
- Staccando le cuffie compare l'avviso rosa e non fischia niente. Riattaccandole, entro 2 s l'Ascolto torna e l'avviso sparisce.

Se l'avvio dice `manca …`, il nome di CoreAudio non coincide con quello di cpal. Confronta l'output di `cargo test --release elenca -- --ignored --nocapture` con `nome()` in `audio.rs`.

- [ ] **Passo 6: commit**

```bash
git add src-tauri src/motore.js src/avvisi.js src/ui.js src/index.html test/schermata.test.js
git commit -m "Audio: real-time duplex with cpal, Sound desk wired to Rust, real devices and headphone warning"
```

---
### Task 7: Canzoni salvate

Le Canzoni, la Canzone aperta e i Dispositivi scelti si salvano da soli in `canzoni.json`. Se il file non si legge, viene messo da parte con un avviso, mai sovrascritto.

**File:**
- Crea: `src-tauri/src/canzoni.rs`
- Modifica: `src-tauri/src/main.rs`, `src/canzoni.js`, `src/ui.js`, `test/canzoni.test.js`

**Interfacce:**
- Produce:
  - comandi `leggi_canzoni() -> Result<Option<String>, String>`, `scrivi_canzoni(json: String) -> Result<(), String>`, `metti_da_parte_canzoni() -> Result<(), String>`;
  - in `canzoni.js`: `interpreta(testo) -> dati | null`, `carica() -> Promise<{dati, rotto}>`, `salva(dati)` (dopo 300 ms di calma);
  - in `ui.js`: `ricorda()`.

- [ ] **Passo 1: test che falliscono**

In fondo a `test/canzoni.test.js`:
```js
import { interpreta } from '../src/canzoni.js';

test('canzoni.json rovinato o vuoto: null, così non si sovrascrive', () => {
  for (const t of ['', '{', 'null', '{"canzoni":[]}', '[]']) assert.equal(interpreta(t), null, t);
});

test('canzoni.json di una versione vecchia: si completano i campi mancanti', () => {
  const d = interpreta(JSON.stringify({ aperta: 'Notte', canzoni: [{ name: 'Notte', data: { eff: 'vocoder', snd: { bande: 16 } } }] }));
  assert.equal(d.aperta, 'Notte');
  assert.equal(d.guidaVista, false);
  assert.deepEqual(d.dispositivi, {});
  assert.equal(d.canzoni[0].data.eff, 'vocoder');
  assert.equal(d.canzoni[0].data.snd.bande, 16);
  assert.equal(d.canzoni[0].data.snd.vol, 2);
  assert.equal(d.canzoni[0].data.beads.length, 5);
});
```

`src-tauri/src/canzoni.rs`, per ora solo il test:
```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn scrive_e_mette_da_parte() {
        let d = std::env::temp_dir().join(format!("lv-canzoni-{}", std::process::id()));
        let p = d.join("canzoni.json");
        scrivi_atomico(&p, "{\"a\":1}").unwrap();
        scrivi_atomico(&p, "{\"a\":2}").unwrap();
        assert_eq!(std::fs::read_to_string(&p).unwrap(), "{\"a\":2}");
        assert!(!p.with_extension("json.tmp").exists());
        let messo = metti_da_parte(&p).unwrap();
        assert!(!p.exists() && messo.exists());
        assert_eq!(std::fs::read_to_string(&messo).unwrap(), "{\"a\":2}");
        std::fs::remove_dir_all(d).unwrap();
    }
}
```
In `main.rs` aggiungi `mod canzoni;`.

Esegui: `npm test`
Atteso: FAIL. Lato JS c'è l'errore `interpreta is not a function` o un export mancante; lato Rust `cannot find function scrivi_atomico`.

- [ ] **Passo 2: Rust**

In cima a `src-tauri/src/canzoni.rs`:
```rust
// Canzoni salvate (spec §8): un solo file, ~/Library/Application Support/com.keopees.live-vocoder/canzoni.json.
// Il JSON lo decide la pagina (canzoni.js); qui si legge e si scrive senza mai lasciarlo a metà.
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};

fn file(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app.path().app_data_dir().map_err(|e| e.to_string())?.join("canzoni.json"))
}

// Scrive accanto e poi rinomina: un crash a metà lascia il file buono di prima.
fn scrivi_atomico(p: &Path, testo: &str) -> std::io::Result<()> {
    std::fs::create_dir_all(p.parent().unwrap())?;
    let tmp = p.with_extension("json.tmp");
    std::fs::write(&tmp, testo)?;
    std::fs::rename(tmp, p)
}

// Un file che non si legge non si butta: si sposta accanto con la data, e si riparte.
fn metti_da_parte(p: &Path) -> std::io::Result<PathBuf> {
    let secs = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
    let dest = p.with_file_name(format!("canzoni-rotto-{secs}.json"));
    std::fs::rename(p, &dest)?;
    Ok(dest)
}

#[tauri::command]
pub fn leggi_canzoni(app: AppHandle) -> Result<Option<String>, String> {
    let p = file(&app)?;
    if !p.exists() {
        return Ok(None);
    }
    std::fs::read_to_string(p).map(Some).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn scrivi_canzoni(app: AppHandle, json: String) -> Result<(), String> {
    scrivi_atomico(&file(&app)?, &json).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn metti_da_parte_canzoni(app: AppHandle) -> Result<(), String> {
    metti_da_parte(&file(&app)?).map(|_| ()).map_err(|e| e.to_string())
}
```
In `main.rs`, in `generate_handler![…]` aggiungi:
```rust
            canzoni::leggi_canzoni, canzoni::scrivi_canzoni, canzoni::metti_da_parte_canzoni,
```

- [ ] **Passo 3: JS**

In fondo a `src/canzoni.js`:
```js
// Dai dati salvati: null se non si leggono (il file va messo da parte, non sovrascritto); i campi mancanti si completano.
export function interpreta(testo) {
  let d;
  try { d = JSON.parse(testo); } catch { return null; }
  if (!d || !Array.isArray(d.canzoni) || !d.canzoni.length) return null;
  return { ...datiIniziali(), ...d, dispositivi: d.dispositivi ?? {}, canzoni: d.canzoni.map((c) => canzone(c.name, c.data)) };
}

const invoke = (...a) => window.__TAURI__.core.invoke(...a);

export async function carica() {
  let t;
  try { t = await invoke('leggi_canzoni'); } catch { t = ''; }
  if (t == null) return { dati: datiIniziali(), rotto: false };
  const dati = interpreta(t);
  if (dati) return { dati, rotto: false };
  await invoke('metti_da_parte_canzoni').catch(() => {});
  return { dati: datiIniziali(), rotto: true };
}

// Salvataggio automatico: dopo 300 ms senza modifiche.
let attesa;
export function salva(dati) {
  clearTimeout(attesa);
  attesa = setTimeout(() => invoke('scrivi_canzoni', { json: JSON.stringify(dati) }), 300);
}
```

In `src/ui.js`:
1. `import { DEF_SONG, SONG_KEYS, controllaNome, datiIniziali } from './canzoni.js';` diventa:
```js
import { DEF_SONG, SONG_KEYS, controllaNome, datiIniziali, carica, salva } from './canzoni.js';
```
2. In `sync()` sostituisci le due righe finali:
```js
  $$('[data-act="reset"]').forEach(b => b.disabled = isDef());
  invia();
```
con:
```js
  $$('[data-act="reset"]').forEach(b => b.disabled = isDef());
  invia();
  ricorda();
```
3. Sopra `function invia() {` aggiungi:
```js
// Ogni modifica si salva da sola: non c'è un tasto Salva (spec §8).
function ricorda() {
  songs[st.song].data = snapshot();
  dati.aperta = songs[st.song].name;
  dati.dispositivi = st.dev;
  salva(dati);
}
```
4. `async function avvio() { … }` diventa:
```js
async function avvio() {
  const c = await carica();
  dati = c.dati; songs = dati.canzoni; st.dev = dati.dispositivi;
  openSong(Math.max(0, songs.findIndex(s => s.name === dati.aperta)), false);
  if (c.rotto) avviso('canzoni', 'Non riuscivo a leggere le Canzoni salvate: le ho messe da parte e si riparte da «Ma Lei».');
  build();
  await controllaDispositivi();
  setInterval(controllaDispositivi, 2000);
  requestAnimationFrame(frame);
}
```

- [ ] **Passo 4: test e prova**

Esegui: `npm test`
Atteso: PASS.

Esegui: `npm run app`
1. Crea la Canzone «Prova» con Effetto Vocoder, cambia una Nota e Dettaglio a 16, scegli un Ingresso.
2. Chiudi l'app con ⌘Q e riaprila.

Atteso: si riapre «Prova» con le stesse Note, lo stesso Suono e lo stesso Ingresso.

Poi metti `{` dentro `~/Library/Application Support/com.keopees.live-vocoder/canzoni.json` e riapri l'app.
Atteso: avviso rosa, si riparte da «Ma Lei», e nella stessa cartella c'è `canzoni-rotto-<numero>.json`.

- [ ] **Passo 5: commit**

```bash
git add src-tauri/src/canzoni.rs src-tauri/src/main.rs src/canzoni.js src/ui.js test/canzoni.test.js
git commit -m "Songs: autosave to canzoni.json, atomic write, unreadable file set aside"
```

---

### Task 8: Camera vera nella polaroid

Elenco delle camere da AVFoundation, camera preferita di sistema e `getUserMedia`. Il canvas mostra la camera vera ritagliata per il Formato.

**File:**
- Crea: `src-tauri/src/camera.rs`, `src/camera.js`
- Modifica: `src-tauri/src/main.rs`, `src/ui.js`, `test/schermata.test.js`

**Interfacce:**
- Produce:
  - comandi `camere() -> Vec<{nome, iphone}>` e `prefer_camera(nome: String) -> Result<(), String>`;
  - `camera.js`: `apriCamera(video, nome, [w, h])`;
  - in `ui.js`: `controllaDispositivi()` gestisce anche la Camera, e `st.camFormato`.

- [ ] **Passo 1: test che fallisce**

In `test/schermata.test.js` aggiungi `'camera.js'` alla lista dei file del ciclo `for`.

Esegui: `node --test test/*.test.js`
Atteso: FAIL su `camera.js si legge`.

- [ ] **Passo 2: `src-tauri/src/camera.rs`**

```rust
// Camere da AVFoundation (spec §5). WebKit mostra l'iPhone solo se è la camera preferita di sistema
// (AVCaptureDeviceManager.mm, setIsEphemeral; provato in #6): la scelta passa da qui prima di getUserMedia.
// Effetto collaterale noto: la camera preferita vale per tutto il Mac, anche per FaceTime.
use objc2::{class, msg_send, rc::Retained, runtime::{AnyObject, Bool}};
use objc2_foundation::{NSArray, NSString};
use serde::Serialize;

#[link(name = "AVFoundation", kind = "framework")]
unsafe extern "C" {}

fn nome_di(d: &AnyObject) -> String {
    unsafe {
        let s: Retained<NSString> = msg_send![d, localizedName];
        s.to_string()
    }
}

// iPhone (Continuity Camera) e camere USB sono "External", la webcam del Mac è "BuiltInWideAngleCamera".
// La Panoramica Scrivania (Desk View) è un altro tipo e così resta fuori.
fn tutte() -> Vec<Retained<AnyObject>> {
    unsafe {
        let tipi = NSArray::from_retained_slice(&[
            NSString::from_str("AVCaptureDeviceTypeExternal"),
            NSString::from_str("AVCaptureDeviceTypeBuiltInWideAngleCamera"),
        ]);
        let sess: Retained<AnyObject> = msg_send![class!(AVCaptureDeviceDiscoverySession), discoverySessionWithDeviceTypes: &*tipi, mediaType: &*NSString::from_str("vide"), position: 0isize];
        let d: Retained<NSArray<AnyObject>> = msg_send![&*sess, devices];
        d.iter().collect()
    }
}

#[derive(Serialize)]
pub struct Camera {
    nome: String,
    iphone: bool,
}

#[tauri::command]
pub fn camere() -> Vec<Camera> {
    tutte()
        .iter()
        .map(|d| Camera { nome: nome_di(d), iphone: unsafe { let b: Bool = msg_send![&**d, isContinuityCamera]; b.as_bool() } })
        .collect()
}

#[tauri::command]
pub fn prefer_camera(nome: String) -> Result<(), String> {
    let d = tutte().into_iter().find(|d| nome_di(d) == nome).ok_or(format!("manca la camera {nome}"))?;
    unsafe {
        let _: () = msg_send![class!(AVCaptureDevice), setUserPreferredCamera: &*d];
    }
    Ok(())
}
```
In `main.rs` aggiungi `mod camera;`, e in `generate_handler![…]`:
```rust
            camera::camere, camera::prefer_camera,
```

- [ ] **Passo 3: `src/camera.js`**

```js
// La camera del video (spec §5): prima la camera preferita di sistema (WebKit mostra l'iPhone solo così, #6), poi getUserMedia.
const invoke = (...a) => window.__TAURI__.core.invoke(...a);

export async function apriCamera(video, nome, [w, h]) {
  if (nome) await invoke('prefer_camera', { nome }).catch(() => {});
  video.srcObject?.getTracks().forEach(t => t.stop());
  // senza un primo permesso i nomi delle camere sono vuoti
  (await navigator.mediaDevices.getUserMedia({ video: true })).getTracks().forEach(t => t.stop());
  const lista = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput' && !/Panoramica|Desk View/.test(d.label));
  const d = lista.find(d => d.label === nome) ?? lista.find(d => nome && d.label.includes(nome)) ?? lista[0];
  video.srcObject = await navigator.mediaDevices.getUserMedia({
    video: { deviceId: d && { exact: d.deviceId }, width: { ideal: w }, height: { ideal: h }, frameRate: { ideal: 30, max: 30 } },
  });
  await video.play();
}
```

- [ ] **Passo 4: collega la schermata**

In `src/ui.js`:
1. Sotto gli `import` aggiungi `import { apriCamera } from './camera.js';`.
2. Nel gestore dei clic sostituisci `  if (a === 'format') st.format = v;` con:
```js
  if (a === 'format') { st.format = v; controllaDispositivi(); }
```
3. `function controllaDispositivi() { … }` diventa:
```js
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
    if (JSON.stringify(st.liste) !== prima) build(); else invia();
  })().finally(() => (giroDisp = null)));
}
```

- [ ] **Passo 5: test e prova**

Esegui: `npm test`
Atteso: PASS.

Esegui: `npm run app` con l'iPhone 14 Pro Max vicino al Mac, in verticale su un supporto (stesso Apple ID, Wi-Fi e Bluetooth accesi).
Atteso:
- macOS chiede la Camera: rispondi Consenti.
- La polaroid mostra l'iPhone in verticale, nitido e riempito.
- Specchio rovescia l'immagine. Filtro rosa mette il velo e il glitter, e spento lascia la camera pulita con colonna, onda e scritte.
- Orizzontale → riquadro 16:9 ritagliato.
- Scegliendo "Camera FaceTime HD" passa alla webcam del Mac.
- Il selettore Camera mostra le camere vere, senza "Panoramica Scrivania".

Per controllare la risoluzione apri la console del webview e scrivi `document.getElementById('cam').videoWidth`. Atteso: `1080` in verticale.

- [ ] **Passo 6: commit**

```bash
git add src-tauri/src/camera.rs src-tauri/src/main.rs src/camera.js src/ui.js test/schermata.test.js
git commit -m "Camera: AVFoundation list, preferred camera for Continuity Camera, real camera in the canvas"
```

---

### Task 9: Gesti

MediaPipe legge le mani. Le dita alzate della mano degli accordi scelgono la Nota; pugno o mano fuori campo fermano gli accordi. La seconda mano dà l'Intensità. Le mani a perline si disegnano sopra la camera vera, e la simulazione delle Note che girano da sole sparisce.

**File:**
- Crea: `src/mani.js`, `test/mani.test.js`
- Modifica: `src/ui.js`, `test/schermata.test.js`

**Interfacce:**
- Consuma: `src/vendor/mediapipe/*`, `src/vendor/hand_landmarker.task` (Task 1); `camVideo` e `st.mani` di `ui.js`.
- Produce, in `mani.js`:
  - `alzate(p21px) -> bool[5]` (pollice…mignolo), `conta(a) -> 0..5`;
  - `class Stabile(v, ms=90)` con `.metti(v, ora) -> v stabile`;
  - `assegna(mani, tracce, ora) -> {sinistra, destra}`;
  - `leggi(tracce, manoAccordi, ora) -> {accordi, seconda, nota, dita2}`;
  - `avviaMani(video, manoAccordi: () => 'sinistra'|'destra', quando: ({mani, nota, dita2}) => void)`.

- [ ] **Passo 1: test che falliscono**

`test/mani.test.js`:
```js
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
```
In `test/schermata.test.js` aggiungi `'mani.js'` alla lista dei file del ciclo `for`.

Esegui: `node --test test/*.test.js`
Atteso: FAIL con `Cannot find module '.../src/mani.js'`.

- [ ] **Passo 2: `src/mani.js`**

```js
// Gesti (spec §4): MediaPipe Hand Landmarker -> dita alzate di ogni mano -> Nota (mano degli accordi) e Intensità (seconda mano).
// Test delle dita, assegnazione delle mani e debounce portati da Londopy/gesture-synth (MIT),
// crates/gsyn-core/src/gesture.rs al commit 3e6a40a (vedi THIRD_PARTY_NOTICES.md).
const DITA = [[5, 6, 8], [9, 10, 12], [13, 14, 16], [17, 18, 20]]; // mcp, pip, punta di indice, medio, anulare, mignolo
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
function angolo(a, b, c) {
  const u = [a[0] - b[0], a[1] - b[1], a[2] - b[2]], v = [c[0] - b[0], c[1] - b[1], c[2] - b[2]];
  const cos = (u[0] * v[0] + u[1] * v[1] + u[2] * v[2]) / (Math.hypot(...u) * Math.hypot(...v) || 1);
  return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
}

// p: i 21 punti di una mano in pixel [x, y, z]. Pollice, indice, medio, anulare, mignolo alzati?
// Distanze e angoli, mai "la punta è più in alto": così la mano ruotata conta le stesse dita.
export function alzate(p) {
  const palmo = Math.max(dist(p[0], p[9]), 1e-4);
  return [dist(p[4], p[17]) > 1.1 * palmo,
    ...DITA.map(([m, q, t]) => dist(p[t], p[0]) > dist(p[q], p[0]) * 1.25 && angolo(p[m], p[q], p[t]) > 150)];
}
export const conta = (a) => a.filter(Boolean).length;

// Un valore nuovo vale solo se resta uguale per `ms` (Londopy: Debounce, 90 ms).
export class Stabile {
  constructor(v, ms = 90) { this.v = v; this.cand = v; this.da = 0; this.ms = ms; }
  metti(v, ora) {
    if (v !== this.cand) { this.cand = v; this.da = ora; }
    else if (v !== this.v && ora - this.da >= this.ms) this.v = v;
    return this.v;
  }
}

// ponytail: se sulla camera vera le mani risultano scambiate, si mette true (taratura, come swap_hands di Londopy).
const SCAMBIA = false;
const TIENI = 250; // ms: una mano persa da meno di così è ancora in campo (Londopy: hold dopo 250 ms)

// mani: [{ n: 21 punti normalizzati [x,y,z], etichetta: 'Left'|'Right' }] dal fotogramma grezzo, non specchiato.
// tracce: { sinistra, destra } di Keopees, con { polso, visto }. Risultato: { sinistra, destra } (mano o null).
export function assegna(mani, tracce, ora) {
  if (mani.length >= 2) {
    // due mani: decide la x del polso; nel fotogramma grezzo la destra di Keopees sta a x più piccola
    const [a, b] = mani;
    return (a.n[0][0] < b.n[0][0]) !== SCAMBIA ? { destra: a, sinistra: b } : { destra: b, sinistra: a };
  }
  if (!mani.length) return { sinistra: null, destra: null };
  const h = mani[0];
  // MediaPipe etichetta le mani come se l'immagine fosse specchiata: sul fotogramma grezzo l'etichetta va girata
  let lato = (h.etichetta === 'Left') !== SCAMBIA ? 'destra' : 'sinistra';
  const altro = () => (lato === 'destra' ? 'sinistra' : 'destra');
  const vicino = (t) => t && ora - t.visto < 400 && (t.polso[0] - h.n[0][0]) ** 2 + (t.polso[1] - h.n[0][1]) ** 2 < 0.12;
  if (vicino(tracce[altro()]) && !vicino(tracce[lato])) lato = altro();
  return { [lato]: h, [altro()]: null };
}

// Nota: dita della mano degli accordi (0 = pugno o fuori campo = accordi fermi). dita2: seconda mano, null se non c'è.
export function leggi(tracce, manoAccordi, ora) {
  const vista = (t) => (t && ora - t.visto < TIENI ? t : null);
  const a = vista(tracce[manoAccordi]), s = vista(tracce[manoAccordi === 'sinistra' ? 'destra' : 'sinistra']);
  return {
    accordi: a && { punti: a.n, alzate: a.alzate }, seconda: s && { punti: s.n, alzate: s.alzate },
    nota: a ? conta(a.alzate) : 0, dita2: s ? conta(s.alzate) : null,
  };
}

export async function avviaMani(video, manoAccordi, quando) {
  const { FilesetResolver, HandLandmarker } = await import('./vendor/mediapipe/vision_bundle.js');
  const files = await FilesetResolver.forVisionTasks('vendor/mediapipe/wasm');
  const opz = (delegate) => ({
    baseOptions: { modelAssetPath: 'vendor/hand_landmarker.task', delegate }, runningMode: 'VIDEO', numHands: 2,
    minHandDetectionConfidence: 0.6, minHandPresenceConfidence: 0.6, minTrackingConfidence: 0.6,
  });
  const lm = await HandLandmarker.createFromOptions(files, opz('GPU')).catch(() => HandLandmarker.createFromOptions(files, opz('CPU')));
  const tracce = {}, nota = new Stabile(0), dita2 = new Stabile(null);
  const giro = () => {
    if (video.videoWidth) {
      const ora = performance.now(), vw = video.videoWidth, vh = video.videoHeight;
      const r = lm.detectForVideo(video, ora);
      const mani = r.landmarks.map((n, i) => ({ n: n.map(q => [q.x, q.y, q.z]), etichetta: r.handedness[i][0].categoryName }));
      const as = assegna(mani, tracce, ora);
      for (const lato of ['sinistra', 'destra']) {
        const h = as[lato];
        // in pixel per il test delle dita: le coordinate normalizzate stirano la mano col 9:16
        if (h) tracce[lato] = { polso: h.n[0], visto: ora, n: h.n, alzate: alzate(h.n.map(([x, y, z]) => [x * vw, y * vh, z * vw])) };
      }
      const s = leggi(tracce, manoAccordi(), ora);
      quando({ mani: { accordi: s.accordi, seconda: s.seconda }, nota: nota.metti(s.nota, ora), dita2: dita2.metti(s.dita2, ora) });
    }
    video.requestVideoFrameCallback(giro);
  };
  video.requestVideoFrameCallback(giro);
}
```

Esegui: `node --test test/*.test.js`
Atteso: PASS.

- [ ] **Passo 3: collega la schermata e togli la simulazione**

In `src/ui.js`:
1. Sotto gli `import` aggiungi `import { avviaMani } from './mani.js';`.
2. Togli la simulazione: `sed -i '' '/simulazione: via con i Gesti/d' src/ui.js`
3. `let lastCycle = performance.now(), lastLv = performance.now(), ultimoDisegno = 0;` diventa `let ultimoDisegno = 0;`. Nel gestore dei clic cancella la riga `  lastCycle = performance.now();`.
4. Nel gestore dei clic sostituisci:
```js
  if (a === 'bead') { st.edit = st.edit === +v ? -1 : +v; if (st.edit >= 0) st.i = st.edit; }
```
con:
```js
  if (a === 'bead') { st.edit = st.edit === +v ? -1 : +v; if (st.edit >= 0) { st.i = st.edit; st.fermi = false; } }
```
5. Sopra `async function avvio() {` aggiungi:
```js
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
```
6. In `avvio()`, dopo `requestAnimationFrame(frame);` aggiungi:
```js
  avviaMani(camVideo, () => st.mano, suMani).catch(e => avviso('mani', `Non riesco a leggere le mani: ${e}`));
```

- [ ] **Passo 4: prova con le mani vere**

Esegui: `npm run app`, con l'iPhone in verticale e le cuffie, a mezzo busto.
Atteso:
- Mano sinistra con 1–5 dita → si accende la Nota 1–5 sulla ruota e nel video, con cuori e stelline sulle dita alzate.
- Pugno o mano giù → accordi fermi, Voce pulita in cuffia e onda piatta.
- Mano destra con 1–5 dita → la colonna dell'Intensità sale e scende e l'Effetto si sente più o meno. Abbassandola resta l'ultimo livello.
- Impostazioni → Accordi con la mano Destra → i ruoli si scambiano.
- Aprendo un'altra Canzone l'Intensità riparte da 3.

Se le mani risultano scambiate, metti `SCAMBIA = true` in `mani.js` e annota il perché nel commit.

- [ ] **Passo 5: commit**

```bash
git add src/mani.js src/ui.js test/mani.test.js test/schermata.test.js
git commit -m "Gestures: MediaPipe finger count drives Nota and Intensità, beaded hands over the real camera"
```

---
### Task 10: Registrazione

Registra → conto alla rovescia → MP4 con canvas e audio trattato, scritto a pezzi in `Cartella/<Canzone>/<Canzone> vN.mp4`. Durante la Registrazione è tutto bloccato tranne Stop. Ci sono i controlli del disco e l'avviso "Salvato" con Guarda, Mostra nel Finder e Butta. La cartella si sceglie dalle Impostazioni.

**File:**
- Crea: `src-tauri/src/registrazioni.rs`, `src/registra.js`, `src/worklet.js`
- Modifica: `src-tauri/Cargo.toml`, `src-tauri/src/main.rs`, `src/ui.js`, `src/index.html`, `test/schermata.test.js`

**Interfacce:**
- Consuma: `motore.ascolta` (Task 6), `avviso` (Task 6), `cv` e `st` di `ui.js`.
- Produce:
  - comandi `apri_registrazione(cartella, canzone) -> Result<String /*path*/, String>`, `aggiungi_pezzo(corpo raw) -> Result<(), String>`, `chiudi_registrazione() -> Result<(), String>`, `spazio_libero(cartella) -> u64`, `guarda(path)`, `mostra(path)`, `butta(path) -> Result<(), String>`, `scegli_cartella() -> Option<String>`, `cartella_predefinita() -> String`;
  - `registra.js`: `avviaRegistrazione({actx, canvas, cartella, canzone, onErrore}) -> {path, ferma(): Promise<path>}`.

- [ ] **Passo 1: test che falliscono**

`src-tauri/src/registrazioni.rs`, per ora solo il test:
```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn numerazione_senza_mai_sovrascrivere() {
        let d = std::env::temp_dir().join(format!("lv-reg-{}", std::process::id()));
        fs::create_dir_all(&d).unwrap();
        assert_eq!(prossimo_nome(&d, "Ma Lei"), d.join("Ma Lei v1.mp4"));
        for f in ["Ma Lei v1.mp4", "Ma Lei v3.mp4", "Ma Lei v10.mp4.part", "Altra v7.mp4", "Ma Lei vX.mp4"] {
            fs::write(d.join(f), b"").unwrap();
        }
        // buco al 2: si va dopo il più alto; i file che non sono "<Canzone> vN.mp4" non contano
        assert_eq!(prossimo_nome(&d, "Ma Lei"), d.join("Ma Lei v4.mp4"));
        // Rinomina che cambia solo le maiuscole: il disco del Mac non le distingue, quindi si continua da v4
        assert_eq!(prossimo_nome(&d, "MA LEI"), d.join("MA LEI v4.mp4"));
        fs::remove_dir_all(d).unwrap();
    }
}
```
In `main.rs` aggiungi `mod registrazioni;`.
In `test/schermata.test.js` aggiungi `'registra.js', 'worklet.js'` alla lista dei file del ciclo `for`.

Esegui: `npm test`
Atteso: FAIL. Lato JS mancano `registra.js` e `worklet.js`; lato Rust `cannot find function prossimo_nome`.

- [ ] **Passo 2: Rust**

Esegui: `cd src-tauri && cargo add libc@0.2 tauri-plugin-dialog@2`

In cima a `src-tauri/src/registrazioni.rs`:
```rust
// Registrazioni (spec §6): Cartella/<Canzone>/<Canzone> vN.mp4, mai sovrascritte.
// I pezzi MP4 arrivano dal webview ogni secondo e si aggiungono al file: la memoria non cresce e un crash lascia un file valido.
use std::fs::{self, File};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Mutex;
use tauri::ipc::{InvokeBody, Request};
use tauri::State;

#[derive(Default)]
pub struct Reg(Mutex<Option<File>>);

// Il numero più alto già presente + 1. Il confronto ignora le maiuscole, perché il disco del Mac non le distingue.
fn prossimo_nome(dir: &Path, canzone: &str) -> PathBuf {
    let pre = format!("{} v", canzone.to_lowercase());
    let n = fs::read_dir(dir)
        .into_iter()
        .flatten()
        .flatten()
        .filter_map(|e| e.file_name().to_str()?.to_lowercase().strip_prefix(&pre)?.strip_suffix(".mp4")?.parse::<u32>().ok())
        .max()
        .unwrap_or(0);
    dir.join(format!("{canzone} v{}.mp4", n + 1))
}

#[tauri::command]
pub fn apri_registrazione(reg: State<Reg>, cartella: String, canzone: String) -> Result<String, String> {
    let dir = Path::new(&cartella).join(&canzone);
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let p = prossimo_nome(&dir, &canzone);
    // create_new: se per qualunque motivo il file c'è già, errore invece di sovrascriverlo
    let f = File::options().write(true).create_new(true).open(&p).map_err(|e| e.to_string())?;
    *reg.0.lock().unwrap() = Some(f);
    Ok(p.display().to_string())
}

#[tauri::command]
pub fn aggiungi_pezzo(reg: State<Reg>, request: Request) -> Result<(), String> {
    let InvokeBody::Raw(b) = request.body() else { return Err("pezzo non binario".into()) };
    reg.0.lock().unwrap().as_mut().ok_or("nessuna Registrazione aperta")?.write_all(b).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn chiudi_registrazione(reg: State<Reg>) -> Result<(), String> {
    if let Some(f) = reg.0.lock().unwrap().take() {
        f.sync_all().map_err(|e| e.to_string())?;
    }
    Ok(())
}

// Byte liberi sul disco della cartella (o della prima cartella sopra che esiste già).
#[tauri::command]
pub fn spazio_libero(cartella: String) -> u64 {
    let p = Path::new(&cartella).ancestors().find(|a| a.exists()).unwrap_or(Path::new("/"));
    let Ok(c) = std::ffi::CString::new(p.as_os_str().as_encoded_bytes()) else { return u64::MAX };
    let mut s: libc::statvfs = unsafe { std::mem::zeroed() };
    if unsafe { libc::statvfs(c.as_ptr(), &mut s) } != 0 {
        return u64::MAX; // ponytail: se non si legge, niente falsi allarmi
    }
    s.f_bavail as u64 * s.f_frsize as u64
}

#[tauri::command]
pub fn guarda(path: String) {
    let _ = Command::new("open").arg(path).status();
}

#[tauri::command]
pub fn mostra(path: String) {
    let _ = Command::new("open").args(["-R", &path]).status();
}

// Nel Cestino, non cancellato: si può ancora recuperare.
#[tauri::command]
pub fn butta(path: String) -> Result<(), String> {
    use objc2::{class, msg_send, rc::Retained, runtime::{AnyObject, Bool}};
    use objc2_foundation::NSString;
    unsafe {
        let url: Retained<AnyObject> = msg_send![class!(NSURL), fileURLWithPath: &*NSString::from_str(&path)];
        let fm: Retained<AnyObject> = msg_send![class!(NSFileManager), defaultManager];
        let ok: Bool = msg_send![&*fm, trashItemAtURL: &*url, resultingItemURL: std::ptr::null_mut::<*mut AnyObject>(), error: std::ptr::null_mut::<*mut AnyObject>()];
        if ok.as_bool() { Ok(()) } else { Err("non riesco a spostarlo nel Cestino".into()) }
    }
}

#[tauri::command]
pub fn cartella_predefinita() -> String {
    format!("{}/Movies/Live Vocoder", std::env::var("HOME").unwrap_or_default())
}

#[tauri::command]
pub async fn scegli_cartella(app: tauri::AppHandle) -> Option<String> {
    use tauri_plugin_dialog::DialogExt;
    app.dialog().file().blocking_pick_folder().map(|p| p.to_string())
}
```

`src-tauri/src/main.rs` diventa:
```rust
// Live Vocoder: app Mac per Keopees (spec docs/superpowers/specs/2026-10-11-live-vocoder-v1-design.md).
mod audio;
mod camera;
mod canzoni;
mod dispositivi;
mod registrazioni;
mod suono;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(audio::Audio::default())
        .manage(registrazioni::Reg::default())
        .invoke_handler(tauri::generate_handler![
            audio::avvia_audio, audio::ferma_audio, audio::set, audio::set_note,
            dispositivi::dispositivi,
            camera::camere, camera::prefer_camera,
            canzoni::leggi_canzoni, canzoni::scrivi_canzoni, canzoni::metti_da_parte_canzoni,
            registrazioni::apri_registrazione, registrazioni::aggiungi_pezzo, registrazioni::chiudi_registrazione,
            registrazioni::spazio_libero, registrazioni::guarda, registrazioni::mostra, registrazioni::butta,
            registrazioni::scegli_cartella, registrazioni::cartella_predefinita,
        ])
        .run(tauri::generate_context!())
        .expect("avvio di Live Vocoder");
}
```

- [ ] **Passo 3: JS**

`src/worklet.js`:
```sh
git show 9adddb1ea6ac21ab33e063a4feaf9b428bf0963d:prototypes/prova-ritardo/src/worklet.js > src/worklet.js
sed -i '' '1s#.*#// Riproduce nel grafo Web Audio i blocchi PCM che arrivano da Rust, con 100 ms di cuscinetto (prototipo prova-ritardo, #6).#' src/worklet.js
```

`src/registra.js`:
```js
// Registrazione (spec §6): canvas (captureStream 30) + PCM della voce trattata in un solo MediaRecorder MP4.
// Ogni secondo il pezzo va a Rust e si aggiunge al file, nell'ordine in cui arriva.
import { ascolta } from './motore.js';
const invoke = (...a) => window.__TAURI__.core.invoke(...a);

// actx: AudioContext creato al clic su Registra (nel gesto dell'utente, così non resta sospeso).
export async function avviaRegistrazione({ actx, canvas, cartella, canzone, onErrore }) {
  const path = await invoke('apri_registrazione', { cartella, canzone });
  try {
    await actx.audioWorklet.addModule('worklet.js');
    const node = new AudioWorkletNode(actx, 'pcm', { numberOfInputs: 0, outputChannelCount: [1] });
    const dest = actx.createMediaStreamDestination();
    node.connect(dest);
    const stacca = ascolta(f => node.port.postMessage(f));
    const tracce = [canvas.captureStream(30).getVideoTracks()[0], dest.stream.getAudioTracks()[0]];
    const rec = new MediaRecorder(new MediaStream(tracce), { mimeType: 'video/mp4;codecs=avc1,mp4a.40.2', audioBitsPerSecond: 192e3 });
    let coda = Promise.resolve(), errore = null;
    rec.ondataavailable = e => {
      coda = coda.then(async () => {
        if (errore || !e.data.size) return;
        try { await invoke('aggiungi_pezzo', new Uint8Array(await e.data.arrayBuffer())); }
        catch (err) { errore = err; onErrore(err); }
      });
    };
    const finito = new Promise(r => (rec.onstop = r));
    rec.start(1000); // obbligatorio: senza timeslice WebKit smette di scrivere il video dopo ~20 MB (#6)
    return {
      path,
      async ferma() {
        if (rec.state !== 'inactive') rec.stop();
        await finito;
        await coda;
        stacca();
        tracce.forEach(t => t.stop());
        actx.close();
        await invoke('chiudi_registrazione');
        return path;
      },
    };
  } catch (e) {
    await invoke('chiudi_registrazione');
    actx.close();
    throw e;
  }
}
```

- [ ] **Passo 4: collega la schermata**

In `src/index.html`, prima di `/* avvisi rosa (avvisi.js) */` aggiungi:
```css
/* durante la Registrazione è tutto bloccato tranne Stop (spec §6) */
.app.rec .tools,.app.rec .wheel-box,.app.rec .hint,.app.rec .dock .seg,.app.rec .desk{pointer-events:none;opacity:.5}
```

In `src/ui.js`:
1. Sotto gli `import` aggiungi `import { avviaRegistrazione } from './registra.js';`.
2. Nel gestore dei clic, dopo la riga `  const a = b.dataset.act, v = b.dataset.val, ed = st.beads[st.edit];` aggiungi:
```js
  if (a === 'rec') return void (st.ui.rec ? fermaRegistrazione() : registra());
  if (st.ui.rec) return; // durante la Registrazione è tutto bloccato tranne Stop
  if (a === 'cartella') return void scegliCartella();
```
3. Blocca anche manopole e tastiera durante la Registrazione:
```sh
sed -i '' 's/  if (!kn) return;/  if (!kn || st.ui.rec) return;/; s/  if (kn) { const K = KM\[kn.dataset.knob\]/  if (kn \&\& !st.ui.rec) { const K = KM[kn.dataset.knob]/; s/  if (kn && e.key in KEYS) {/  if (kn \&\& e.key in KEYS \&\& !st.ui.rec) {/; s/if (k) { st.dev\[k\] = e.target.value;/if (k \&\& !st.ui.rec) { st.dev[k] = e.target.value;/' src/ui.js
grep -c 'st.ui.rec' src/ui.js
```
Atteso dal `grep`: almeno 7 righe. Ci sono due `if (!kn) return;` (pointerdown e wheel); se ne è cambiato uno solo, correggi a mano anche l'altro.
4. In `videoSet()` sostituisci `  <div class="vrow">Cartella delle Registrazioni <b>Filmati/Live Vocoder</b></div>` con:
```js
  <div class="vrow">Cartella delle Registrazioni <button class="pill small" data-act="cartella">${esc(nomeCartella())}</button></div>
```
5. In `paint()` sostituisci:
```js
  $$('[data-act="sw"]').forEach(b => b.setAttribute('aria-checked', st[b.dataset.val]));
  sync();
```
con:
```js
  $$('[data-act="sw"]').forEach(b => b.setAttribute('aria-checked', st[b.dataset.val]));
  $('.app').classList.toggle('rec', !!st.ui.rec);
  $('.rec').textContent = !st.ui.rec ? 'Registra 00:00' : st.ui.conto ? `Stop · ${st.ui.conto}` : `Stop ${mmss(performance.now() - inizio)}`;
  sync();
```
6. Sopra `async function avvio() {` aggiungi:
```js
// --- Registrazione (spec §6)
let reg = null, inizio = 0, orologi = [], predefinita = '';
const pausa = ms => new Promise(r => setTimeout(r, ms));
const mmss = ms => { const s = Math.floor(ms / 1000); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
const nomeCartella = () => dati.cartella === predefinita ? 'Filmati/Live Vocoder' : dati.cartella.replace(/^\/Users\/[^/]+/, '~');

async function scegliCartella() {
  const c = await invoke('scegli_cartella');
  if (c) { dati.cartella = c; salva(dati); build(); }
}

async function registra() {
  const actx = new AudioContext({ sampleRate: 48000 }); // subito, dentro il clic
  const cartella = dati.cartella;
  st.ui.rec = true; st.ui.conto = st.conto ? 3 : 0; inizio = performance.now(); build();
  if (await invoke('spazio_libero', { cartella }) < 2e9) avviso('disco', 'Restano meno di 2 GB sul disco: circa 20 minuti di video.');
  for (let n = st.conto ? 3 : 0; n > 0; n--) {
    st.ui.conto = n; paint();
    await pausa(1000);
    if (!st.ui.rec) { actx.close(); return; } // Stop durante il conto: nessun file
  }
  st.ui.conto = 0;
  try {
    reg = await avviaRegistrazione({ actx, canvas: cv, cartella, canzone: songs[st.song].name,
      onErrore: e => fermaRegistrazione(`La Registrazione si è fermata: ${e}`) });
  } catch (e) {
    st.ui.rec = false; build();
    return avviso('rec', `Non riesco a registrare: ${e}`);
  }
  inizio = performance.now();
  orologi = [
    setInterval(paint, 500),
    setInterval(async () => {
      if (await invoke('spazio_libero', { cartella }) < 5e8) fermaRegistrazione("Disco quasi pieno: ho fermato la Registrazione e l'ho salvata.");
    }, 5000),
  ];
  if (!st.ui.rec) { // Stop premuto mentre partiva: il file appena aperto va nel Cestino, niente "Salvato"
    const r = reg; reg = null; orologi.forEach(clearInterval);
    invoke('butta', { path: await r.ferma() }).catch(() => {});
    return build();
  }
  paint();
}

async function fermaRegistrazione(motivo) {
  if (!reg) { st.ui.rec = false; st.ui.conto = 0; return build(); } // durante il conto alla rovescia
  const r = reg; reg = null;
  orologi.forEach(clearInterval);
  const path = await r.ferma();
  st.ui.rec = false; build();
  if (motivo) avviso('rec', motivo);
  const nome = path.split('/').pop().replace(/\.mp4$/, '');
  avviso('salvato', `Salvato: ${nome}`, [
    ['Guarda', () => invoke('guarda', { path })],
    ['Mostra nel Finder', () => invoke('mostra', { path })],
    ['Butta', () => invoke('butta', { path }).catch(e => avviso('rec', String(e)))],
  ]);
}
```
7. In `avvio()`, dopo la riga `  dati = c.dati; songs = dati.canzoni; st.dev = dati.dispositivi;` aggiungi:
```js
  predefinita = await invoke('cartella_predefinita');
  dati.cartella ??= predefinita;
```
8. In `controllaDispositivi()`, prima della riga `    if (inn !== st.att.in || out !== st.att.out) {` aggiungi:
```js
    if (reg && inn !== st.att.in) fermaRegistrazione("Il microfono si è staccato: ho fermato la Registrazione e l'ho salvata.");
```

- [ ] **Passo 5: test e prova**

Esegui: `npm test`
Atteso: PASS, compreso `numerazione_senza_mai_sovrascrivere`.

Esegui: `npm run app` (iPhone in verticale, cuffie a filo). Prove:
1. Registra → 3, 2, 1 sul video → "Stop 00:01…". Canzone, Note, Formato, manopole, Impostazioni e "?" non rispondono, i Gesti sì. Canta 30 s → Stop → "Salvato: Ma Lei v1". Guarda lo apre in QuickTime con l'audio trattato a tempo con le mani. Mostra nel Finder lo trova in `Filmati/Live Vocoder/Ma Lei/`.
2. Registra di nuovo → `Ma Lei v2`. Butta → il file va nel Cestino.
3. **Stop durante il conto alla rovescia** → torna "Registra 00:00", nessun file nuovo, schermata sbloccata.
4. **Doppio clic veloce su Registra** → parte una sola Registrazione, oppure si ferma subito. In nessun caso restano file vuoti.
5. Rinomina «Ma Lei» in «MA LEI» e registra → `MA LEI v3.mp4` nella stessa cartella, senza sovrascrivere.
6. Impostazioni → Cartella delle Registrazioni → scegli un'altra cartella → la Registrazione dopo finisce lì.
7. Registrazione di 5 minuti → il file pesa circa 500 MB, si apre e la sincronia resta buona fino alla fine.

- [ ] **Passo 6: commit**

```bash
git add src-tauri src/registra.js src/worklet.js src/ui.js src/index.html test/schermata.test.js
git commit -m "Recording: MP4 written in 1 s chunks to Cartella/<Canzone>/<Canzone> vN.mp4, lock, countdown, disk checks"
```

---

### Task 11: Avvio, permessi e avvisi dei Dispositivi

Controlli silenziosi con avviso rosa solo se manca qualcosa: permessi, Dispositivi salvati che non ci sono più, iPhone non trovato. La guida si apre da sola al primo avvio.

**File:**
- Modifica: `src-tauri/src/camera.rs`, `src-tauri/src/main.rs`, `src/ui.js`

**Interfacce:**
- Produce: i comandi `permessi() -> (isize /*microfono*/, isize /*camera*/)` (0 da chiedere, 1 limitato, 2 negato, 3 concesso) e `apri_privacy(che: String)`.

- [ ] **Passo 1: Rust**

In fondo a `src-tauri/src/camera.rs`:
```rust
// AVAuthorizationStatus: 0 da chiedere, 1 limitato, 2 negato, 3 concesso. (Microfono, Camera)
#[tauri::command]
pub fn permessi() -> (isize, isize) {
    let s = |t: &str| -> isize { unsafe { msg_send![class!(AVCaptureDevice), authorizationStatusForMediaType: &*NSString::from_str(t)] } };
    (s("soun"), s("vide"))
}

// Apre Impostazioni di Sistema → Privacy e sicurezza → Microfono o Camera.
#[tauri::command]
pub fn apri_privacy(che: String) {
    let pannello = if che == "camera" { "Privacy_Camera" } else { "Privacy_Microphone" };
    let _ = std::process::Command::new("open").arg(format!("x-apple.systempreferences:com.apple.preference.security?{pannello}")).status();
}
```
In `main.rs`, `camera::camere, camera::prefer_camera,` diventa:
```rust
            camera::camere, camera::prefer_camera, camera::permessi, camera::apri_privacy,
```

Esegui: `cd src-tauri && cargo test --release`
Atteso: compila e passa.

- [ ] **Passo 2: JS**

In `src/ui.js`, in `controllaDispositivi()` sostituisci le due righe:
```js
    stato('cuffie', st.muto, "Servono le cuffie a filo: con gli altoparlanti l'Ascolto resta spento, perché fischierebbe.");
    stato('bluetooth', tipo === 'bluetooth', "Con le cuffie Bluetooth l'Ascolto arriva in ritardo: meglio quelle a filo.");
```
con:
```js
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
```
In `avvio()`, prima di `  build();` aggiungi:
```js
  if (!dati.guidaVista) { st.ui.panel = 'guida'; dati.guidaVista = true; } // la guida si apre da sola al primo avvio
```

- [ ] **Passo 3: prova**

Esegui: `npm run app`
1. Reset dei permessi: `tccutil reset Microphone com.keopees.live-vocoder && tccutil reset Camera com.keopees.live-vocoder`, poi cancella `~/Library/Application Support/com.keopees.live-vocoder/canzoni.json` e riapri l'app.
   Atteso: macOS chiede Microfono e Camera, e la guida è aperta.
2. Nega la Camera da Impostazioni di Sistema e riapri l'app.
   Atteso: avviso "non può usare la camera" con "Apri Impostazioni", che apre il pannello giusto.
3. Scegli le cuffie a filo come Uscita, poi staccale.
   Atteso: avvisi "«Cuffie…» non c'è: uso «Altoparlanti…»" e "Servono le cuffie a filo". Riattaccandole, entro 2 s gli avvisi spariscono e torna l'Ascolto.
4. Allontana l'iPhone o spegni il Bluetooth.
   Atteso: avviso "iPhone non trovato" e camera del Mac. Riavvicinandolo, si torna all'iPhone.
5. Chiudi l'app e riaprila.
   Atteso: la guida non si apre più da sola.

- [ ] **Passo 4: commit**

```bash
git add src-tauri/src/camera.rs src-tauri/src/main.rs src/ui.js
git commit -m "Startup: silent checks with pink warnings for permissions, missing devices and iPhone; guide on first launch"
```

---
### Task 12: Aggiornamenti e rilascio

All'avvio compare "C'è una versione nuova ✨ → Aggiorna / Più tardi", mai durante una Registrazione. C'è uno script che costruisce e pubblica una versione su `MeStakes/live-vocoder-releases`, e una pagina per Riccardo su chiavi, backup e prima installazione.

**File:**
- Crea: `src-tauri/src/aggiorna.rs`, `scripts/rilascio.sh`, `docs/rilascio.md`
- Modifica: `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`, `src-tauri/src/main.rs`, `src/ui.js`

**Interfacce:**
- Produce: i comandi `controlla_aggiornamento() -> Result<Option<String /*versione*/>, String>` e `aggiorna() -> Result<(), String>` (scarica, sostituisce l'app e la riapre).

- [ ] **Passo 1: Rust e configurazione**

Esegui: `cd src-tauri && cargo add tauri-plugin-updater@2`

`src-tauri/src/aggiorna.rs`:
```rust
// Aggiornamenti dentro l'app (spec §10, provati in #12): tauri-plugin-updater legge latest.json dal repo pubblico
// delle versioni. Il file scaricato dall'app non ha quarantena: niente "Apri comunque" e i permessi restano.
use tauri_plugin_updater::UpdaterExt;

fn e(e: tauri_plugin_updater::Error) -> String {
    e.to_string()
}

#[tauri::command]
pub async fn controlla_aggiornamento(app: tauri::AppHandle) -> Result<Option<String>, String> {
    Ok(app.updater().map_err(e)?.check().await.map_err(e)?.map(|u| u.version))
}

#[tauri::command]
pub async fn aggiorna(app: tauri::AppHandle) -> Result<(), String> {
    let Some(u) = app.updater().map_err(e)?.check().await.map_err(e)? else { return Ok(()) };
    u.download_and_install(|_, _| {}, || {}).await.map_err(e)?;
    app.restart()
}
```
In `main.rs`:
- aggiungi `mod aggiorna;`;
- dopo `.plugin(tauri_plugin_dialog::init())` aggiungi `.plugin(tauri_plugin_updater::Builder::new().build())`;
- in `generate_handler![…]` aggiungi `aggiorna::controlla_aggiornamento, aggiorna::aggiorna,`.

Configurazione (chiave pubblica creata da `scripts/certificato.sh` nel Task 1):
```sh
node -e 'const fs=require("fs"),f="src-tauri/tauri.conf.json",c=JSON.parse(fs.readFileSync(f));c.bundle.createUpdaterArtifacts=true;c.plugins={updater:{pubkey:fs.readFileSync(process.env.HOME+"/.live-vocoder/chiave-updater.key.pub","utf8").trim(),endpoints:["https://github.com/MeStakes/live-vocoder-releases/releases/latest/download/latest.json"]}};fs.writeFileSync(f,JSON.stringify(c,null,2)+"\n")'
```
La chiave pubblica nel repo va bene. La privata resta in `~/.live-vocoder/`.

Esegui: `cd src-tauri && cargo test --release`
Atteso: compila e passa.

- [ ] **Passo 2: JS**

In `src/ui.js`, sopra `async function avvio() {` aggiungi:
```js
// Aggiornamento (spec §10): solo su richiesta, mai durante una Registrazione.
async function aggiorna() {
  if (st.ui.rec) return avviso('aggiorna', "Finisci la Registrazione, poi premi di nuovo Aggiorna.", [['Aggiorna', aggiorna]]);
  avviso('aggiorna', 'Sto aggiornando Live Vocoder… si riapre da sola.');
  await invoke('aggiorna').catch(() => avviso('aggiorna', "L'aggiornamento non è andato: riprova più tardi.", [['Riprova', aggiorna]]));
}
```
In `avvio()`, dopo la riga `  avviaMani(camVideo, …` aggiungi:
```js
  // senza rete non dice niente: si riprova al prossimo avvio
  invoke('controlla_aggiornamento').then(v => v && avviso('aggiorna', `C'è una versione nuova ✨ (${v})`, [['Aggiorna', aggiorna], ['Più tardi', () => {}]]), () => {});
```

- [ ] **Passo 3: `scripts/rilascio.sh`**

```sh
#!/bin/sh
# Costruisce una versione di Live Vocoder e la pubblica su MeStakes/live-vocoder-releases (spec §10).
# Uso: sh scripts/rilascio.sh 0.1.0   (serve la cartella ~/.live-vocoder di scripts/certificato.sh)
set -e
V="$1"
[ -n "$V" ] || { echo "Uso: sh scripts/rilascio.sh 0.1.0"; exit 1; }
cd "$(dirname "$0")/.."
D="$HOME/.live-vocoder"
export CI=true # il .dmg senza AppleScript sul Finder (#12)
export TAURI_SIGNING_PRIVATE_KEY="$(cat "$D/chiave-updater.key")" TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""
sh scripts/vendor.sh
npm test
npx tauri build --bundles app,dmg --config "{\"version\":\"$V\"}"
B=src-tauri/target/release/bundle
O="dist/$V"
rm -rf "$O" && mkdir -p "$O"
cp "$B"/dmg/*_"$V"_*.dmg "$O/LiveVocoder-$V.dmg"
cp "$B/macos/Live Vocoder.app.tar.gz" "$O/LiveVocoder-$V.app.tar.gz"
U="https://github.com/MeStakes/live-vocoder-releases/releases/download/v$V"
cat > "$O/latest.json" <<JSON
{ "version": "$V", "pub_date": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "platforms": { "darwin-aarch64": { "url": "$U/LiveVocoder-$V.app.tar.gz",
    "signature": "$(cat "$B/macos/Live Vocoder.app.tar.gz.sig")" } } }
JSON
gh release create "v$V" "$O"/* -R MeStakes/live-vocoder-releases -t "Live Vocoder $V" -n "Versione $V"
echo "Pubblicata. Link per la prima installazione: $U/LiveVocoder-$V.dmg"
```

- [ ] **Passo 4: `docs/rilascio.md`**

````markdown
# Rilascio di Live Vocoder

Per Riccardo. Spec §10, prove in #8 e #12.

## Una volta sola

1. `sh scripts/certificato.sh`: crea `~/.live-vocoder/` con il certificato self-signed "Live Vocoder" (nel portachiavi) e la chiave degli aggiornamenti.
2. **Backup** della cartella `~/.live-vocoder/` e della password del certificato, fuori da questo Mac (per esempio una chiavetta e un gestore di password).
   - Se si perde `certificato.p12`, Keopees deve ridare i permessi Camera e Microfono una volta.
   - Se si perde `chiave-updater.key`, l'app installata non accetta più aggiornamenti e va reinstallata a mano.
3. Repo pubblico solo per le versioni (niente codice):
   `gh repo create MeStakes/live-vocoder-releases --public -d "Versioni di Live Vocoder"`

## Ogni versione

1. Alza il numero, per esempio da 0.1.0 a 0.1.1.
2. `sh scripts/rilascio.sh 0.1.1`: esegue i test, costruisce, firma e pubblica `.dmg`, `.app.tar.gz` e `latest.json`.
3. Al prossimo avvio Keopees vede "C'è una versione nuova ✨" → Aggiorna.

## Prima installazione sul Mac di Keopees

1. Passale il `.dmg` via AirDrop, oppure con il link che stampa lo script.
2. Lei apre il `.dmg` e trascina Live Vocoder in Applicazioni.
3. Apre l'app: macOS la blocca. Vai in Impostazioni di Sistema → Privacy e sicurezza → "Apri comunque" (serve la sua password). Si fa una volta sola.
4. Consenti Microfono e Camera.
5. Riserva: se non c'è Riccardo, la stessa cosa in 3 passi con le schermate.
````

- [ ] **Passo 5: prova dell'aggiornamento (Riccardo)**

1. **(Riccardo)** crea il repo pubblico (comando sopra).
2. **(Riccardo)** `sh scripts/rilascio.sh 0.1.0`, poi scarica il `.dmg` con Safari, installalo in Applicazioni, fai "Apri comunque" e concedi i permessi.
3. **(Riccardo)** `sh scripts/rilascio.sh 0.1.1`, poi apri l'app 0.1.0.

Atteso:
- compare "C'è una versione nuova ✨ (0.1.1)";
- Aggiorna → l'app si riapre in 0.1.1, senza "Apri comunque" e senza richieste di Camera o Microfono;
- le Canzoni ci sono ancora.

- [ ] **Passo 6: commit**

```bash
git add src-tauri src/ui.js scripts/rilascio.sh docs/rilascio.md
git commit -m "Updates: in-app updater from live-vocoder-releases, release script and release notes for Riccardo"
```

---

### Task 13: Guida "?"

La guida si scrive alla fine, quando le schermate sono definitive (spec §7). Prima viene come si suona, poi il Suono con gli stessi testi del display, poi la parte tecnica. Riccardo approva i testi.

**File:**
- Crea: `src/guida.js`
- Modifica: `src/ui.js`, `test/schermata.test.js`

**Interfacce:**
- Produce: `guida(onlyLabel) -> string` (HTML del pannello, con le classi `lbl`, `ctx`, `gl`, `only` del prototipo).

- [ ] **Passo 1: test che fallisce**

In fondo a `test/schermata.test.js`:
```js
test('la guida ha i tre capitoli, in ordine', async () => {
  const { guida } = await import('../src/guida.js');
  const h = guida(K => 'solo ' + K.for.join(' e '));
  const i = ['COME SI SUONA', 'IL SUONO', 'LA PARTE TECNICA'].map(t => h.indexOf(t));
  assert.ok(i.every(x => x >= 0) && i[0] < i[1] && i[1] < i[2], String(i));
  for (const t of ['Anti-fruscio', 'Cuffie a filo', 'Reazioni', 'Mac aperto']) assert.ok(h.includes(t), t);
});
```
Esegui: `node --test test/*.test.js`
Atteso: FAIL con `Cannot find module '.../src/guida.js'`.

- [ ] **Passo 2: `src/guida.js` (prima stesura, da far approvare a Riccardo)**

```js
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
```

In `src/ui.js`:
1. Sotto gli `import` aggiungi `import { guida } from './guida.js';`.
2. Sostituisci le quattro righe di `const guideSheet = () => …` (da `const guideSheet = () => \`<h2>Guida</h2><p class="lbl">IL SUONO</p>` fino a `…join('')}</dl>\`;`) con:
```js
const guideSheet = () => guida(onlyLabel);
```

- [ ] **Passo 3: test e prova**

Esegui: `node --test test/*.test.js`
Atteso: PASS.

Esegui: `npm run app` → "?".
Atteso: i tre capitoli nello stile del prototipo, con il pannello che scorre se serve. Le etichette "solo Vocoder e Spento" sono sulle manopole giuste.

**(Riccardo)** legge i testi e li corregge. Le parole devono restare quelle di `CONTEXT.md`.

- [ ] **Passo 4: commit**

```bash
git add src/guida.js src/ui.js test/schermata.test.js
git commit -m "Guide: how to play, Sound and technical chapters"
```

---

### Task 14: Verifica sul Mac di prova e beta per Keopees

Nessun codice nuovo. Si controlla tutto contro la spec, si sistema quello che non va e si consegna la beta.

**File:**
- Modifica: solo dove la verifica trova errori, ognuno con il suo commit.

- [ ] **Passo 1: test automatici**

Esegui: `npm test`
Atteso: tutto PASS.

- [ ] **Passo 2: verifica a mano sul Mac di prova (MacBook Pro M1 Pro, iPhone 14 Pro Max, cuffie a filo)**

Spunta ogni riga. Ogni riga che non passa diventa una correzione con il suo commit.
- [ ] Schermata identica al prototipo `pannello-suono` (a0270c0), aperti uno accanto all'altro, a 1440×820 e a 1280×720, senza scroll.
- [ ] Coro, Vocoder e Spento a orecchio come in `prototype/suono-vocoder`, con gli stessi predefiniti.
- [ ] Settima e Maj7 con Pienezza 3, 4 e 5; Nota singola con Pienezza 3, 4 e 5.
- [ ] Gesti: Nota 1–5, pugno = Voce pulita, Intensità 1–5 che resta all'ultimo livello, Mano degli accordi Destra.
- [ ] Video: Specchio, Filtro rosa, Titolo nel video, Verticale 1080×1920 con l'iPhone verticale, Orizzontale.
- [ ] Registrazione di 5 minuti: si apre in QuickTime, sincronia buona, file in `Filmati/Live Vocoder/<Canzone>/`.
- [ ] Punti 1–5 di "Punti da guardare in revisione".
- [ ] Monitoraggio Attività durante una Registrazione di 5 minuti: annota CPU e memoria di Live Vocoder, servono per la beta su 8 GB.

- [ ] **Passo 3: beta (Riccardo)**

1. **(Riccardo)** `sh scripts/rilascio.sh 0.1.0`, poi installa sul Mac di Keopees seguendo `docs/rilascio.md` → "Prima installazione".
2. **(Riccardo)** Con Keopees controlla quello che la spec rimanda alla beta (§11 e §12):
   - [ ] il Ritardo a orecchio (~40 ms + Coro);
   - [ ] il calore in una sessione di 20 minuti (MacBook Air senza ventola);
   - [ ] il caricamento di una Registrazione su Instagram e su TikTok;
   - [ ] i micro-clic degli orologi dei Dispositivi.

   Per ognuno che non va c'è già la strada nella tabella "Limiti noti" della spec.
3. **(Riccardo)** Aggiorna la mappa #1 con l'esito della beta.
