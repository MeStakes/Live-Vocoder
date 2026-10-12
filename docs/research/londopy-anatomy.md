# Anatomia di Londopy/gesture-synth per il Live Vocoder

Ricerca del 2026-10-11, ticket #4. Commit analizzato: `3e6a40a`. Tutti i percorsi sono relativi alla radice del repo Londopy. Il codice è stato solo letto, mai eseguito. Le valutazioni sono mie.

## In breve

1. **Registrazione.** Il browser (MediaRecorder dentro la webview) registra webm VP9/VP8 + Opus. Il video è `canvas.captureStream()` della scena, quindi **include già camera + scheletro delle mani + effetti**. Su desktop l'audio dello strumento **non finisce nel file**: ci va solo il microfono.
2. **Duplex.** No. Il thread cpal è solo output (`build_output_stream`). Va aggiunto uno stream di input.
3. **Punto d'innesto del vocoder.** Tra `Synth::render` e l'uscita, in `engine.rs` L779. Le note dell'accordo sono già la portante.
4. **Build.** DMG Apple Silicon via Tauri 2 su CI. **Nessuna firma né notarizzazione.**
5. **Overlay nel video.** Già così nella modalità "practice"/"clear". Per noi si può tenere solo il necessario e buttare Three.js.

## 1. Registrazione video + audio

- **Formato.** `MediaRecorder` con candidati `video/webm;codecs=vp9,opus`, poi vp8, poi webm, poi mp4; 8 Mbps video, 192 kbps audio (`app/src/lib/export/recorder.ts` L78-80). L'mp4 si ottiene convertendo dopo con ffmpeg: sidecar su desktop (`src-tauri/src/lib.rs` L284-331, `tauri.conf.json` `externalBin`), ffmpeg.wasm sul web (`app/src/lib/export/video.ts` L1-6).
- **Video.** Due sorgenti (`recorder.ts` L12, L44-52): `'scene'` = `canvas.captureStream(fps)`, oppure `'camera'` = la traccia grezza della webcam.
- **Audio nel file.**
  - Build web (AudioWorklet): `recordMix()` collega il bus master a un `MediaStreamDestination` e, se richiesto, aggiunge il microfono con guadagno (`app/src/lib/audio/audio.ts` L220-238). Nel file finiscono strumento e microfono; il metronomo è escluso.
  - Build desktop con audio nativo: **il mix cpal non è accessibile alla webview**. `recorder.ts` L62-66 prende solo il microfono. L'interfaccia lo dice esplicitamente (`app/src/lib/ui/RecordSheet.svelte` L141-142) e consiglia di disattivare l'audio nativo.
- **Sincronia.** Nessuna correzione esplicita. Video e audio entrano nello stesso `MediaStream`/`MediaRecorder` e il browser li allinea con i propri timestamp. Il mic passa da `getUserMedia` con echo cancellation e noise suppression attivi, autoGainControl spento (`recorder.ts` L55-58). Non ho trovato compensazione della latenza tra scena renderizzata e audio.
- **Implicazione per noi.** Registrare la Voce modulata dal vocoder richiede di avere il mix **dentro la webview** (web audio) oppure di mandare il mix nativo al frontend, oppure di registrare nativamente (AVFoundation/AVAssetWriter, o ffmpeg con pipe). Valutazione mia: la strada più pulita per una app Mac nativa è comporre frame e audio lato nativo e scrivere un unico file.

## 2. Il thread cpal supporta il duplex?

**No.** `src-tauri/src/audio.rs`:

- L104-110: configurazione presa da `default_output_config()`, forzata a 2 canali, buffer fisso 32-2048 campioni.
- L136: solo `build_output_stream`. Nessun `build_input_stream`, nessuna occorrenza di "input" come dispositivo.
- Il callback (L137-250) legge i comandi dal ring SPSC, lo stato live dal triple buffer, poi chiama `engine.process(out_l, out_r, cue)`.

Per il duplex servono:

1. Un secondo stream cpal in input sul microfono (o un'unica unità duplex via CoreAudio/AUHAL, che su macOS dà latenza più bassa e clock unico).
2. Un ring lock-free input → output (la crate ha già `SpscRing` e `TripleBuffer` in `crates/gsyn-core/src/rt.rs`).
3. Attenzione: due stream cpal separati su dispositivi diversi hanno clock diversi e vanno ricampionati. Stesso dispositivo = meglio.
4. Permesso microfono macOS (`NSMicrophoneUsageDescription` nell'Info.plist). In `src-tauri/` non c'è nessun Info.plist né entitlements: va aggiunto, vedi punto 4.

## 3. Dove inserire il vocoder in gsyn-core

- `Synth::render` (`crates/gsyn-core/src/synth/mod.rs` L673-) azzera i buffer, fa girare 4+ slot di accordi (`ChordSlot::render`, L355) con `Voice` a oscillatori, filtro, ADSR (L95-), più riverbero/delay sul bus master.
- `Engine::process_block` chiama `self.synth.render(out_l, out_r, &params, theremin)` a `crates/gsyn-core/src/engine.rs` L779.
- **Proposta (mia):**
  - Il **carrier** è la somma degli slot prima di riverbero e delay: serve quindi un'uscita "dry" del synth, oppure ridurre a mono l'uscita L/R di `Synth::render` subito dopo la chiamata.
  - Il **modulator** è un buffer di input passato a `Engine::process` come quarto argomento (oggi: `out_l, out_r, cue`, L527).
  - Un nuovo modulo `vocoder.rs` (banca di filtri, 16-24 bande; inseguitore di inviluppo per banda) prende `(modulator, carrier) → out`. Poi si mescola con il secco e si applicano riverbero/delay.
- **Cose da modificare nel synth per il vocoder:** le voci sono pensate per essere ascoltate direttamente (pan casuale per voce `spread`, ADSR). Per una portante ricca di armoniche servono dente di sega e rilascio corto; si tratta di un preset dello `Instrument`, non di codice.
- **Interazione con la Voce:** per tenere la latenza bassa il modulatore non passa dal thread JS. L'ingresso resta tutto nativo.

## 4. Build e packaging macOS Apple Silicon

- **Stack.** Tauri 2 (`src-tauri/Cargo.toml`), cpal 0.15, midir, frontend Svelte 5 in webview WKWebView (che su macOS non è Chromium: `MediaRecorder` webm potrebbe non essere supportato, da verificare; per questo c'è il fallback mp4 nei candidati).
- **Pipeline.** `npm run wasm` (compila `gsyn-core` in WASM), `npm --workspace app run build`, poi bundle Tauri (`tauri.conf.json` `build.*`). Workflow dedicato `.github/workflows/macos.yml` con target `aarch64-apple-darwin` su `macos-15`, timeout 45 min, modelli MediaPipe scaricati da `scripts/fetch-models.mjs`, ffmpeg statico da `scripts/fetch-ffmpeg.mjs --static`. L'output è un `.dmg` con checksum SHA256. Anche `release.yml` costruisce il DMG ARM.
- **Firma: nessuna.** In `release.yml` (L69-71) `tauri-action` riceve solo `GITHUB_TOKEN`. Non ci sono variabili `APPLE_*` / `APPLE_CERTIFICATE`, né notarizzazione, né entitlements. Una ricerca di "sign/notar/codesign/Gatekeeper" in workflow, README e DEPLOY non dà nulla di pertinente. Su Apple Silicon Tauri produce un'app con firma ad-hoc, che Gatekeeper blocca da un download. Per Keopees servono almeno: apertura manuale (clic destro > Apri) oppure Apple Developer ID (99 USD/anno) + notarizzazione.
- **Camera e microfono.** Nessun `NSCameraUsageDescription`/`NSMicrophoneUsageDescription` nel repo: da aggiungere in `tauri.conf.json` (`bundle.macOS.infoPlist`) o con un Info.plist.
- **Peso.** Webview + ffmpeg sidecar + WASM + modello MediaPipe. Non lo considero "leggero" rispetto a un'app Swift nativa; a favore c'è il lavoro già fatto.

## 5. Overlay (scheletro mani, forma d'onda) nel video registrato

### Come disegna Londopy

- Tutto è una scena **Three.js** su un unico `<canvas>` (`app/src/lib/ui/SceneCanvas.svelte` L24; `app/src/lib/scene/scene.ts` L56). Strati: sfondo, cerchio delle quinte, **mani**, costellazione, particelle, theremin, poi post-processing (`EffectComposer`: `RenderPass` + `UnrealBloomPass` + `HazePass` + `OutputPass`, `scene.ts` L74-78).
- **Mani** (`app/src/lib/scene/hands.ts`): 21 punti con `THREE.Points` e shader proprio, ossa con `LineSegments2` (`HAND_BONES` da `app/src/lib/tracking/landmarks.ts`), mescolanza additiva, colori legati a qualità/taglio; fino a 4 coppie "ghost" per i loop (L1-5). Le coordinate arrivano come 63 float, con smoothing (`smooth`, L25).
- **Camera in scena:** `VideoTexture` su un piano (`scene.ts` L83-102). Modalità `performance` (niente camera), `practice` (camera scurita al 32% sotto gli effetti), `clear` (camera pura, senza effetti, mani opzionali) (`scene.ts` L113-146).
- **Forma d'onda:** non c'è una vera forma d'onda. Il motore audio fornisce solo `bass/treble/level` da un `AnalyserNode` FFT (`audio.ts` L195-212), che guidano sfondo e particelle (`SceneCanvas.svelte` L70-73).

### La registrazione cattura il composito?

**Sì, in modalità "scene".** `recorder.ts` L49-51 usa `canvas.captureStream(fps)`, e il canvas ha `preserveDrawingBuffer: true` (`scene.ts` L56). Quindi nel file ci sono camera + mani + effetti, esattamente come li vede l'utente. Con sorgente `'camera'` (L44-47) invece c'è la sola webcam, senza overlay.

Due note:
- Se la vista è `performance`, la camera non c'è e il video registrato è solo effetti e mani. Per il nostro caso serve `practice` o `clear` con `clearShowHands = true`.
- Il canvas è reso a risoluzione dello schermo (pixel ratio massimo 1,5), non a un formato fisso: niente verticale 9:16.

### Cosa serve per avere gli overlay nel nostro video

Il pattern giusto è lo stesso di Londopy: **un solo compositore** che disegna camera + scheletro + forma d'onda su una superficie, e quella superficie è ciò che si registra. Opzioni (valutazione mia):

| Opzione | Cosa fare | Pro | Contro |
|---|---|---|---|
| A. Tenere webview | Canvas 2D (non Three.js) con `drawImage(video)` + linee delle ossa + `AnalyserNode.getFloatTimeDomainData` per la forma d'onda; `captureStream()` | Poco codice; sincronia gestita dal browser | Audio vocoder da portare nella webview |
| B. App Swift/Metal | `AVCaptureSession` + Vision hand pose + `CGContext`/Metal per disegnare; `AVAssetWriter` con frame e audio | Leggero, latenza controllabile, un solo file con timestamp comuni | Riscrivere il parser (si porta da `gesture.rs`) |
| C. Mista | Core Rust (vocoder, parser) come libreria statica, UI e registrazione in Swift | Riusa DSP e parser MIT | Due linguaggi |

La forma d'onda "dei chords" richiede di leggere dal bus della portante; nel core attuale non è esposta, ma `Synth::render` produce già L/R (basta una copia di 512 campioni in un ring verso il frontend, come fa il triple buffer per lo stato).

### Cosa si può togliere per restare leggeri su MacBook Air M1 8 GB

Londopy chiede 1280×720 a 60 fps e Three.js con bloom (`mediapipe.ts` L68-112; `scene.ts` L56-78), con un meccanismo di qualità adattiva (livelli 0-3, `scene.ts` L190-227). Da eliminare per noi:

- **Three.js intero** (`app/src/lib/scene/*`, ~1.360 righe) e le dipendenze `three` ^0.180 (`app/package.json`). Un canvas 2D basta per camera + 21 punti + 20 ossa + forma d'onda.
- **Bloom, Haze, EffectComposer, OutputPass**, tone mapping ACES.
- **Livelli** `background.ts`, `fifths.ts`, `constellation.ts`, `particles.ts`, `theremin.ts`, `haze.ts` e il codice dei "ghost" per i loop.
- **Moduli lontani dal nostro caso:** `achievements`, `community`, `demo`, `eggs`, `learn`, `stage` (giochi/classifiche), `tour`, `router`, Builder/Community/Learn (cartella `app/src/routes`), looper a 4 tracce (`crates/gsyn-core/src/looper.rs`), MIDI (`midi.rs`, `midir`), `session.rs`.
- **Cosa tenere dal core:** `gesture.rs`, `music.rs`, `math.rs`, `state.rs`, `rt.rs` (ring e triple buffer), `synth/` ridotto (voci, ADSR, legato).
- Ridurre camera a 960×540 o 1280×720 a 30 fps; il tracking gira sul frame originale e si disegna ciò che serve.

## Rischi e punti da verificare

- **WKWebView e `MediaRecorder` webm:** va provato su Mac reale; Londopy ha il fallback mp4 ma non so cosa produca WKWebView.
- **Sincronia audio/video** non è corretta per costruzione se l'audio è nativo e il video web. Va deciso un solo orologio.
- **Latenza del duplex:** nessuna misura in Londopy; il buffer cpal minimo è 32 campioni ma il default dipende dal dispositivo.
- **Firma/notarizzazione** a carico nostro, con costo annuale.
- **Licenza:** MIT di Londopy; mantenere la nota di copyright (vedi `gesture-synth-reference.md`).
