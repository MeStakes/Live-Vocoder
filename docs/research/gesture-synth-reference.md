# Riferimento gesture-synth per il Live Vocoder

Ricerca del 2026-10-11. Domanda: tra cinque repository open source di "gesture synth", quale prendere come riferimento (ed eventualmente da cui riusare codice) per scegliere con i **Gesti** le note della portante (carrier) del vocoder, mentre la **Voce** di Keopees è la modulante?

## In breve

- **Riferimento consigliato: [Londopy/gesture-synth](https://github.com/Londopy/gesture-synth).** È l'unico con licenza MIT pulita, scritto in modo indipendente, e con un parser dei Gesti progettato sul serio: test delle dita che non dipendono dalla rotazione della mano, debounce per ogni valore, isteresi, mani assegnate per posizione, correzione dello specchio, perdita di tracking gestita, latch dell'accordo, schemi semplificati. Inoltre: legato degli accordi (le note comuni restano tenute), core Rust indipendente dalla piattaforma e un'app desktop con thread audio nativo.
- **Da non copiare**:
  - ericwei97-cloud: licenza non commerciale.
  - Ekmand: nessuna licenza, ed è un porting del codice di Eric.
  - amerob: nessun file LICENSE, e fa altro.
  - rainbow686: MIT solo sulla carta, perché deriva dichiaratamente da Eric. Fanno eccezione le idee sulla Registrazione in Verticale.
- **Il vocabolario dei Gesti è lo stesso in quattro repo su cinque** (dita alzate per i gradi I–V, "corna" per VI, corna+pollice per VII, mano destra per la forma dell'accordo). Viene dal progetto originale di Eric Wei. È un'idea, non codice: possiamo adottarla e adattarla.
- **Adattamenti per il vocoder**:
  - qualità degli accordi diatonica automatica (niente inclinazione per maggiore/minore);
  - se la mano esce dall'inquadratura l'accordo resta tenuto;
  - niente volume dall'altezza della mano;
  - legato con condotta delle voci;
  - si deve poter suonare con una mano sola.

## Metodo

Ho letto README, LICENSE, `package.json`/`Cargo.toml`, la cronologia dei commit e i file sorgente principali via `gh api`, sui commit HEAD di oggi:

| Repo | Commit analizzato |
|---|---|
| ericwei97-cloud/gesture-synth | `7ee25ba` |
| Ekmand/gesture-synth | `90bb803` |
| rainbow686/gesture-synth-weld | `f006db6` |
| amerob/GestureSynth | `dffb84f` |
| Londopy/gesture-synth | `3e6a40a` |

I numeri di riga citati si riferiscono a questi commit. Le valutazioni di qualità e le proposte sono mie e sono segnalate come tali. Non è una consulenza legale.

## Confronto rapido

| | ericwei97-cloud | Ekmand | rainbow686 | amerob | **Londopy** |
|---|---|---|---|---|---|
| Licenza | Custom, solo non commerciale, credito richiesto | **Nessuna** | MIT (provenienza dubbia) | **Nessun file** (il README dice MIT) | **MIT** |
| Stack | JS vanilla, Vite, Web Audio | React 19, TS, Vite, Web Audio | React 18, TS, Tone.js 15 | JS (ES5 transpilato), Tone.js, Three.js | Rust core (+WASM), Svelte 5, Three.js, Tauri 2, cpal |
| MediaPipe tasks-vision | WASM 0.10.14 da CDN (npm ^0.10.35) | 0.10.35 | 1.0.1 self-hosted | 0.10.14 da esm.sh | ^0.10.22, modello locale |
| Codice sorgente | 1 file, 27 KB | 34 file, 187 KB | 34 file, 404 KB | 6 file, 108 KB | 156 file, 1,16 MB |
| Stelle / fork | 135 / 47 | 67 / 13 | 18 / 4 | 12 / 3 | 2 / 0 |
| Ultimo push | 2026-08-13 | 2026-08-09 | 2026-10-09 | 2026-04-07 | 2026-09-14 |
| Demo (HTTP 200 oggi) | gesture-synth-weld.vercel.app | gesturesynth.com | gesturesynthweld.com | aamergesture.netlify.app | gesture-synth.onrender.com |
| Registrazione video | no | no (solo loop) | sì: 9:16, 16:9, 1:1, mic | no | sì: webm, mp4 su desktop, mic |

L'ultima versione di `@mediapipe/tasks-vision` su npm oggi è la 1.1.0 (licenza Apache-2.0) ([npm registry](https://registry.npmjs.org/@mediapipe/tasks-vision)).

## Schede

### 1. ericwei97-cloud/gesture-synth (l'originale)

**Licenza.** "Gesture Synth License" personalizzata ([LICENSE](https://github.com/ericwei97-cloud/gesture-synth/blob/7ee25ba8c30f0a0cf544835a2dae199e4b7b9484/LICENSE)):
- uso, copia, modifica e condivisione sono permessi solo "for personal, educational, and non-commercial purposes";
- chi condivide versioni derivate deve dare credito;
- l'uso commerciale, inclusa l'incorporazione di "substantial portions" in un prodotto a pagamento, richiede il permesso dell'autore.

Un progetto privato personale rientra nella licenza. "Commercial" però non è definito, e contenuti social monetizzati sarebbero una zona grigia.

**Stack.** Un solo `main.js` (1.125 righe) più `index.html`, con Vite e Web Audio.
- La WASM di MediaPipe viene caricata da jsDelivr alla 0.10.14, mentre la dipendenza npm è ^0.10.35: versioni disallineate ([main.js L352-365](https://github.com/ericwei97-cloud/gesture-synth/blob/7ee25ba8c30f0a0cf544835a2dae199e4b7b9484/main.js#L352-L365), [package.json](https://github.com/ericwei97-cloud/gesture-synth/blob/7ee25ba8c30f0a0cf544835a2dae199e4b7b9484/package.json)).
- Delegate GPU senza fallback su CPU; camera a 640×480 ([L335-347](https://github.com/ericwei97-cloud/gesture-synth/blob/7ee25ba8c30f0a0cf544835a2dae199e4b7b9484/main.js#L335-L347)).
- Il tutorial è su Instagram.

**Mappatura.**
- **Mano "Left", grado dell'accordo** ([L56-79](https://github.com/ericwei97-cloud/gesture-synth/blob/7ee25ba8c30f0a0cf544835a2dae199e4b7b9484/main.js#L56-L79)):
  - conta le dita estese, pollice incluso: 1–5 → I–V;
  - indice+mignolo senza pollice → VI; con pollice → VII;
  - 0 dita → nessun accordo.
- **Maggiore/minore** dall'inclinazione orizzontale della stessa mano: `leftTilt >= 0` → maggiore ([L864-865](https://github.com/ericwei97-cloud/gesture-synth/blob/7ee25ba8c30f0a0cf544835a2dae199e4b7b9484/main.js#L864-L865)).
  - L'inclinazione è la posizione x del polso rispetto alle nocche di medio e anulare, normalizzata su 0,12, con zona morta tra le due nocche ([L81-127](https://github.com/ericwei97-cloud/gesture-synth/blob/7ee25ba8c30f0a0cf544835a2dae199e4b7b9484/main.js#L81-L127)).
  - La qualità è forzata, non diatonica: si può ottenere un "ii maggiore", fuori tonalità.
- **Mano "Right", forma dell'accordo** (conta indice..mignolo, [L539-575](https://github.com/ericwei97-cloud/gesture-synth/blob/7ee25ba8c30f0a0cf544835a2dae199e4b7b9484/main.js#L539-L575)):

  | Dita | Maggiore | Minore |
  |---|---|---|
  | 1 | [R, 5, 8ª, 3ª+8ª] (voicing aperto) | idem con 3ª minore |
  | 2 | primo rivolto | primo rivolto |
  | 3 | maj7 | m7 |
  | 4 | dom7 | dim7 |
  | 0 | silenzio ([L1031-1034](https://github.com/ericwei97-cloud/gesture-synth/blob/7ee25ba8c30f0a0cf544835a2dae199e4b7b9484/main.js#L1031-L1034)) | |

  - Pollice destro esteso → tutto un'ottava sotto ([L1059-1064](https://github.com/ericwei97-cloud/gesture-synth/blob/7ee25ba8c30f0a0cf544835a2dae199e4b7b9484/main.js#L1059-L1064)).
  - Altezza del polso (y da 0,05 a 0,95) → volume lineare ([L305-313](https://github.com/ericwei97-cloud/gesture-synth/blob/7ee25ba8c30f0a0cf544835a2dae199e4b7b9484/main.js#L305-L313)).
  - Inclinazione → lowpass da 250 a 5000 Hz con Q fino a 5,2 ([L621-644](https://github.com/ericwei97-cloud/gesture-synth/blob/7ee25ba8c30f0a0cf544835a2dae199e4b7b9484/main.js#L621-L644)).
- **Tonalità.** 12 tonalità (default La), gradi sulla scala maggiore; il VII è il tono sensibile sotto la tonica (`7: -1`, [L416](https://github.com/ericwei97-cloud/gesture-synth/blob/7ee25ba8c30f0a0cf544835a2dae199e4b7b9484/main.js#L416)).
- **Rilevamento delle dita.** `tip.y < pip.y` ([L34-37](https://github.com/ericwei97-cloud/gesture-synth/blob/7ee25ba8c30f0a0cf544835a2dae199e4b7b9484/main.js#L34-L37)) e, per il pollice, il confronto delle x tra punta e IP secondo l'etichetta della mano ([L39-48](https://github.com/ericwei97-cloud/gesture-synth/blob/7ee25ba8c30f0a0cf544835a2dae199e4b7b9484/main.js#L39-L48)).

**Jitter e latenza.**
- Uno stabilizzatore sull'intero stato (accordo, modo, forma, pollice): un nuovo stato viene accettato solo se persiste per 100 ms; buchi di tracking sotto i 50 ms vengono colmati ([L229-302](https://github.com/ericwei97-cloud/gesture-synth/blob/7ee25ba8c30f0a0cf544835a2dae199e4b7b9484/main.js#L229-L302)).
- Nessuno smoothing sui landmark.
- Audio:
  - a ogni cambio si creano nuovi `OscillatorNode` e i vecchi vengono fermati subito, senza inviluppo ([L646-667](https://github.com/ericwei97-cloud/gesture-synth/blob/7ee25ba8c30f0a0cf544835a2dae199e4b7b9484/main.js#L646-L667));
  - il gain ha una rampa di 50 ms, il filtro `setTargetAtTime` con costante di 40 ms;
  - forma d'onda di default triangolare ("Warm Synth").
- Senza la mano destra il suono va a zero ([L1080-1084](https://github.com/ericwei97-cloud/gesture-synth/blob/7ee25ba8c30f0a0cf544835a2dae199e4b7b9484/main.js#L1080-L1084)).

**Qualità per Keopees (valutazione mia).**
- Lo schema è memorabile e si legge in camera.
- È fragile:
  - `tip.y < pip.y` funziona solo con le dita verticali, e l'inclinazione richiesta per maggiore/minore ruota proprio la mano che deve contare le dita;
  - il pollice contato nei gradi I–V è il dito più instabile;
  - servono sempre entrambe le mani in vista;
  - il cambio accordo "a scatto" produrrebbe click e buchi nel vocoder;
  - la qualità forzata dall'inclinazione porta facilmente fuori tonalità.

### 2. Ekmand/gesture-synth (porting di Eric)

**Licenza.** Il repo non ha un file LICENSE: l'API GitHub restituisce `license: null` e il `package.json` è `"private": true` ([package.json](https://github.com/Ekmand/gesture-synth/blob/90bb8038da784117c7295c4a6174ed631d61b80d/package.json)). Senza licenza vale "tutti i diritti riservati". In più il codice dichiara di essere un porting di quello di Eric: "ported from gesture-synth El()", dove `El()` sembra il nome di una funzione minificata ([src/music/gestures.ts L69](https://github.com/Ekmand/gesture-synth/blob/90bb8038da784117c7295c4a6174ed631d61b80d/src/music/gestures.ts#L69)). L'HUD accredita Eric, con link al suo Instagram ([src/lib/siteLinks.ts](https://github.com/Ekmand/gesture-synth/blob/90bb8038da784117c7295c4a6174ed631d61b80d/src/lib/siteLinks.ts)); il commit "Credit Ethan and Eric in the HUD" è del 2026-07-26. **Non riutilizzabile.**

**Stack.** React 19, TypeScript, Vite 8, `@mediapipe/tasks-vision` 0.10.35 con fallback GPU→CPU ([src/vision/useHandTracking.ts L15, L62-79](https://github.com/Ekmand/gesture-synth/blob/90bb8038da784117c7295c4a6174ed631d61b80d/src/vision/useHandTracking.ts#L15)), Supabase per le canzoni della community.

**Mappatura.**
- Identica a Eric: stessi numeri, stesso stabilizzatore con hold di 100 ms e grazia di 50 ms ([gestures.ts L105-136](https://github.com/Ekmand/gesture-synth/blob/90bb8038da784117c7295c4a6174ed631d61b80d/src/music/gestures.ts#L105-L136)), stesse voicing ([src/music/chords.ts](https://github.com/Ekmand/gesture-synth/blob/90bb8038da784117c7295c4a6174ed631d61b80d/src/music/chords.ts)).
- Aggiunge impostazioni "fixed" per bloccare modo e forma ([src/music/gestureSettings.ts](https://github.com/Ekmand/gesture-synth/blob/90bb8038da784117c7295c4a6174ed631d61b80d/src/music/gestureSettings.ts)).
- Modalità theremin: altezza della mano destra → 65–1200 Hz esponenziale, non quantizzata (`pitchFromHandY`).
- Loop a 4 tracce, modalità Learn.
- La sintesi fa ancora stop/start degli oscillatori a dente di sega a ogni cambio ([src/audio/SynthEngine.ts L118-134](https://github.com/Ekmand/gesture-synth/blob/90bb8038da784117c7295c4a6174ed631d61b80d/src/audio/SynthEngine.ts#L118-L134)).

**Qualità.** Stessi pregi e difetti di Eric. Utile solo come prova che lo schema "fixed" (modo bloccato) serve agli utenti non musicisti.

### 3. rainbow686/gesture-synth-weld

**Licenza e provenienza.** Il file LICENSE è MIT, "Copyright (c) 2026 Gesture Synth Weld" ([LICENSE](https://github.com/rainbow686/gesture-synth-weld/blob/f006db686cfb68e58cb0834e59a3d38c6659ff17/LICENSE)). La provenienza però è dubbia:
- Il nome del repo coincide con il sottodominio Vercel del sito di Eric (`gesture-synth-weld.vercel.app`), che è l'homepage del repo di Eric.
- Il primo commit di rainbow686 è del 2026-07-30; il deploy e la licenza di Eric sono del 2026-07-26.
- Il codice si dichiara modellato sul "competitor": "matching competitor", "simplify audio engine to match competitor approach" (commit del 2026-07-31), "Time-based chord stabilizer (similar to competitor's approach)" ([src/App.tsx L499-513](https://github.com/rainbow686/gesture-synth-weld/blob/f006db686cfb68e58cb0834e59a3d38c6659ff17/src/App.tsx#L499-L513)).
- Ha costanti identiche a Eric: zona di inclinazione 0,12, filtro 1200−950 / 1200+3800 Hz con Q 0,7+1,5 / 0,7+4,5, hold di 100 ms ([src/handTracker.ts](https://github.com/rainbow686/gesture-synth-weld/blob/f006db686cfb68e58cb0834e59a3d38c6659ff17/src/handTracker.ts), [src/audioEngine.ts L273-290](https://github.com/rainbow686/gesture-synth-weld/blob/f006db686cfb68e58cb0834e59a3d38c6659ff17/src/audioEngine.ts#L273-L290)).

Ne deduco che il codice derivato da Eric non può essere coperto da una MIT concessa da terzi.

C'è anche un secondo problema: `src/handArt.ts` contiene SVG da Wikimedia Commons (CC BY-SA 3.0) e da OpenMoji (CC BY-SA 4.0), licenze share-alike ([src/handArt.ts L7-15](https://github.com/rainbow686/gesture-synth-weld/blob/f006db686cfb68e58cb0834e59a3d38c6659ff17/src/handArt.ts#L7-L15)). Il sito di produzione ha analytics (GA4/Clarity) e AdSense ([src/config.ts](https://github.com/rainbow686/gesture-synth-weld/blob/f006db686cfb68e58cb0834e59a3d38c6659ff17/src/config.ts), [CLAUDE.md](https://github.com/rainbow686/gesture-synth-weld/blob/f006db686cfb68e58cb0834e59a3d38c6659ff17/CLAUDE.md)).

**Stack.** React 18, TypeScript, Tone.js ^15.1.22, `@mediapipe/tasks-vision` 1.0.1 con WASM e modello self-hosted ([package.json](https://github.com/rainbow686/gesture-synth-weld/blob/f006db686cfb68e58cb0834e59a3d38c6659ff17/package.json), [mediapipe-version.json](https://github.com/rainbow686/gesture-synth-weld/blob/f006db686cfb68e58cb0834e59a3d38c6659ff17/mediapipe-version.json)), Vitest. Ha circa 400 commit e il repo più attivo. `App.tsx` da solo pesa 134 KB.

**Mappatura** ([src/App.tsx L751-948](https://github.com/rainbow686/gesture-synth-weld/blob/f006db686cfb68e58cb0834e59a3d38c6659ff17/src/App.tsx#L751-L948)).
- **Mano sinistra:**
  - conteggio delle dita, pollice incluso → I–V (`FINGER_TO_CHORD_INDEX`, [src/types.ts](https://github.com/rainbow686/gesture-synth-weld/blob/f006db686cfb68e58cb0834e59a3d38c6659ff17/src/types.ts));
  - VI e VII come in Eric;
  - pugno → muto.
- **Qualità**, scelta nelle impostazioni ([src/components/SettingsPanel.tsx](https://github.com/rainbow686/gesture-synth-weld/blob/f006db686cfb68e58cb0834e59a3d38c6659ff17/src/components/SettingsPanel.tsx)):
  - "scaleTilt": l'inclinazione sceglie maggiore/minore;
  - "scaleLocked": maggiore, minore, oppure **Diatonic Major / Diatonic Minor**, dove ogni grado mantiene la sua qualità naturale ([src/chords.ts](https://github.com/rainbow686/gesture-synth-weld/blob/f006db686cfb68e58cb0834e59a3d38c6659ff17/src/chords.ts), tabelle `DIATONIC_CHORDS` e `DIATONIC_CHORDS_MINOR`);
  - lo stato iniziale nel codice è scaleLocked con modo "major", cioè tutti gli accordi maggiori, in La.
- **Mano destra:**
  - conteggio → triade / primo rivolto / 7ª / 9ª (default: stile fisso "majorTriad");
  - il conteggio include il pollice, quindi alzare il pollice per l'ottava sotto cambia anche la forma: un accoppiamento che ho osservato nel codice;
  - altezza → volume (`1.1 - y`);
  - inclinazione → filtro;
  - il pugno destro non ferma il suono.
- Le modalità theremin e MonoPiano richiedono due mani.

**Jitter e latenza.**
- Debounce in entrata della presenza della mano: 2 frame su 3 ([src/input/cameraSource.ts L16](https://github.com/rainbow686/gesture-synth-weld/blob/f006db686cfb68e58cb0834e59a3d38c6659ff17/src/input/cameraSource.ts#L16)).
- Hold di 100 ms sul grado; grazia di 80 ms prima dello stop.
- Maggioranza 3 su 5 sul conteggio della mano destra.
- "Pinky memory": il mignolo resta considerato alzato per **60 frame (~2 s)** dopo l'ultima volta che è stato visto ([App.tsx L763-783](https://github.com/rainbow686/gesture-synth-weld/blob/f006db686cfb68e58cb0834e59a3d38c6659ff17/src/App.tsx#L763-L783)). È una toppa che rischia di far tornare un VI fantasma.
- Detection limitata a 30 fps, che scende in automatico a 20/15 fps se l'inferenza è lenta ([App.tsx L1101-1118](https://github.com/rainbow686/gesture-synth-weld/blob/f006db686cfb68e58cb0834e59a3d38c6659ff17/src/App.tsx#L1101-L1118)).
- Audio: `Tone.PolySynth` a dente di sega con attacco di 1 ms e rilascio di 100 ms; a ogni cambio rilascia tutto e riattacca tutto, senza tenere le note comuni ([src/audioEngine.ts L306-345, L671-675](https://github.com/rainbow686/gesture-synth-weld/blob/f006db686cfb68e58cb0834e59a3d38c6659ff17/src/audioEngine.ts#L306-L345)).

**Registrazione (la parte più interessante per noi, come idee).**
- Formati 9:16 a 720×1280, 16:9 a 1280×720 e 1:1, fino a 120 s ([src/recording/constants.tsx](https://github.com/rainbow686/gesture-synth-weld/blob/f006db686cfb68e58cb0834e59a3d38c6659ff17/src/recording/constants.tsx)).
- Mirino con la striscia del ritaglio 9:16 sovrapposta alla vista live.
- Microfono solo sulla Registrazione, mai sugli altoparlanti, con una catena "vocal polish": HPF → compressore → riverbero.
- Il codice segnala che su alcuni Mac Chrome sceglie per default un device di loopback (BlackHole) e che con l'echo cancellation può arrivare silenzio ([src/recording/useRecording.ts L165-216](https://github.com/rainbow686/gesture-synth-weld/blob/f006db686cfb68e58cb0834e59a3d38c6659ff17/src/recording/useRecording.ts#L165-L216)).

**Qualità.** È il prodotto più rifinito come UX, e ha l'opzione diatonica che serve a una non musicista. Il motore dei Gesti però è quello di Eric con delle toppe; licenza e provenienza lo escludono come fonte di codice.

### 4. amerob/GestureSynth

**Licenza.** Il README mostra un badge "License: MIT" che punta a `LICENSE`, ma il file non esiste: l'API restituisce 404 ([README](https://github.com/amerob/GestureSynth/blob/dffb84ffd71c8474e2682ae12d3186d99979997c/README.md)). Senza file valgono tutti i diritti riservati.

**Stack.**
- `game.js` di 68 KB, ES5 transpilato con gli helper di Babel, quindi non sorgente scritto a mano.
- MediaPipe 0.10.14 da esm.sh, Tone.js da `https://esm.sh/tone` senza versione fissata, Three.js 0.161.0 ([game.js L218-224](https://github.com/amerob/GestureSynth/blob/dffb84ffd71c8474e2682ae12d3186d99979997c/game.js#L218-L224)).
- Un solo giorno di commit (2026-04-07).

**Mappatura.**
- I ruoli vanno per **ordine di rilevamento** (`i === 0`), non per mano destra o sinistra.
- **Mano 1:**
  - avvia una **melodia fissa** ("My Heart Will Go On", `Tone.Part`);
  - l'altezza calcola una nota nella scala di Mi maggiore, ma la usa solo per colore e display: `updateArpeggio` non fa nulla ([MusicManager.js L340-389](https://github.com/amerob/GestureSynth/blob/dffb84ffd71c8474e2682ae12d3186d99979997c/MusicManager.js#L340-L389), [game.js L836-849](https://github.com/amerob/GestureSynth/blob/dffb84ffd71c8474e2682ae12d3186d99979997c/game.js#L836-L849));
  - la distanza pollice–indice ×5 dà il volume;
  - il pugno cambia preset.
- **Mano 2:** le singole dita alzate attivano i layer di batteria.
- **Smoothing:** EMA con α = 0,4 su tutti i 21 landmark ([game.js L261, L738-749](https://github.com/amerob/GestureSynth/blob/dffb84ffd71c8474e2682ae12d3186d99979997c/game.js#L738-L749)).

**Qualità.** Non sceglie note: non è pertinente. L'unica idea utile è l'EMA sui landmark.

### 5. Londopy/gesture-synth (consigliato)

**Licenza.** MIT, "Copyright (c) 2026 Londopy" ([LICENSE](https://github.com/Londopy/gesture-synth/blob/3e6a40ad5073b8c0afe92cd1fbd96af74c675335/LICENSE)). Si può riusare liberamente, anche commercialmente. L'unico obbligo è includere la nota di copyright e il testo del permesso in ogni copia o porzione sostanziale.

L'implementazione è indipendente da Eric: test delle dita, pattern dei gradi e sintesi sono diversi. Il vocabolario dei Gesti è lo stesso; Eric non viene citato (ho cercato riferimenti nel repo).

**Stack.**
- `crates/gsyn-core`: Rust indipendente dalla piattaforma, con dipendenze solo `serde`, `serde_json`, `libm`, e niente allocazioni nel path audio ([lib.rs](https://github.com/Londopy/gesture-synth/blob/3e6a40ad5073b8c0afe92cd1fbd96af74c675335/crates/gsyn-core/src/lib.rs), [Cargo.toml](https://github.com/Londopy/gesture-synth/blob/3e6a40ad5073b8c0afe92cd1fbd96af74c675335/crates/gsyn-core/Cargo.toml)).
- La stessa crate compila in WASM per l'AudioWorklet e in nativo per Tauri 2 + cpal.
- Frontend Svelte 5 + Three.js.
- MediaPipe ^0.10.22 con modello servito localmente (offline/PWA). La camera chiede 1280×720 a 60 fps ideali, con fallback GPU→CPU ([app/src/lib/tracking/mediapipe.ts L68-112](https://github.com/Londopy/gesture-synth/blob/3e6a40ad5073b8c0afe92cd1fbd96af74c675335/app/src/lib/tracking/mediapipe.ts#L68-L112)).
- Audio desktop: cpal con buffer fisso da 32 a 2048 campioni e latenza calcolata ([src-tauri/src/audio.rs L108, L252](https://github.com/Londopy/gesture-synth/blob/3e6a40ad5073b8c0afe92cd1fbd96af74c675335/src-tauri/src/audio.rs#L108)).
- Il README dichiara 68 test core e 106 frontend; il parser ha test su mani sintetiche.
- Release desktop anche per macOS Apple Silicon.
- Repo giovane: 37 commit tra il 13 e il 14 settembre 2026, 2 stelle. Il codice va trattato come base da adottare e mantenere noi, non come dipendenza.

**Mappatura** (tutto in [crates/gsyn-core/src/gesture.rs](https://github.com/Londopy/gesture-synth/blob/3e6a40ad5073b8c0afe92cd1fbd96af74c675335/crates/gsyn-core/src/gesture.rs)).
- **Mano sinistra, grado** per pattern esplicito, non per conteggio ([L664-675](https://github.com/Londopy/gesture-synth/blob/3e6a40ad5073b8c0afe92cd1fbd96af74c675335/crates/gsyn-core/src/gesture.rs#L664-L675)):

  | Pattern | Grado |
  |---|---|
  | indice | I |
  | indice+medio | II |
  | +anulare | III |
  | quattro dita senza pollice | IV |
  | cinque | V |
  | indice+mignolo | VI |
  | pollice+indice+mignolo | VII |
  | pugno | muto |
  | qualsiasi altro pattern | **mantiene il grado precedente** |

- **Maggiore/minore** (schema "Full"): inclinazione oltre +8° → maggiore, sotto −8° → minore; in mezzo resta il valore precedente, cioè c'è isteresi ([L679-687](https://github.com/Londopy/gesture-synth/blob/3e6a40ad5073b8c0afe92cd1fbd96af74c675335/crates/gsyn-core/src/gesture.rs#L679-L687)).
  - L'inclinazione è calcolata dalla normale 3D del palmo (prodotto vettoriale polso→nocca dell'indice × polso→nocca del mignolo) ([L584-604](https://github.com/Londopy/gesture-synth/blob/3e6a40ad5073b8c0afe92cd1fbd96af74c675335/crates/gsyn-core/src/gesture.rs#L584-L604)).
  - Lo schema **"ScaleOnly"** usa la qualità diatonica del grado (I, IV, V maggiori; ii, iii, vi minori; vii°), oppure quella del minore naturale ([music.rs L239](https://github.com/Londopy/gesture-synth/blob/3e6a40ad5073b8c0afe92cd1fbd96af74c675335/crates/gsyn-core/src/music.rs#L239)).
  - Lo schema "FixedDegree" blocca il grado.
- **Mano destra** ([L713-781](https://github.com/Londopy/gesture-synth/blob/3e6a40ad5073b8c0afe92cd1fbd96af74c675335/crates/gsyn-core/src/gesture.rs#L713-L781)):
  - conteggio indice..mignolo: 1 → triade, 2 → primo rivolto, 3 → maj7/m7, 4 → dom7 (sul minore m7b5 di default, oppure dim7); 0 → mantiene la forma;
  - pollice con isteresi: piegato verso la nocca del medio (sotto 0,55 palmi) → ottava −1; esteso → +1; oltre 0,85 → 0; nella banda intermedia → mantiene ([L572-582](https://github.com/Londopy/gesture-synth/blob/3e6a40ad5073b8c0afe92cd1fbd96af74c675335/crates/gsyn-core/src/gesture.rs#L572-L582));
  - inclinazione → cutoff (one-pole da 80 ms);
  - altezza tra i valori calibrati 0,15 e 0,85, elevata a 1,6 → volume (one-pole da 60 ms);
  - posizione x → pan (120 ms);
  - pinch tenuto più di 150 ms → attiva/disattiva l'arpeggiatore, e allora l'altezza regola la velocità.
- **Extra:**
  - colpo verso la camera (velocità z oltre 2,5 palmi/s) → nota di basso;
  - due pugni a contatto ruotati di 30° → cambio tonalità sul circolo delle quinte ([L783-834](https://github.com/Londopy/gesture-synth/blob/3e6a40ad5073b8c0afe92cd1fbd96af74c675335/crates/gsyn-core/src/gesture.rs#L783-L834));
  - theremin con predizione di un frame, smoothing da 45 ms e "snap to scale" opzionale ([L836-875](https://github.com/Londopy/gesture-synth/blob/3e6a40ad5073b8c0afe92cd1fbd96af74c675335/crates/gsyn-core/src/gesture.rs#L836-L875), [music.rs L393](https://github.com/Londopy/gesture-synth/blob/3e6a40ad5073b8c0afe92cd1fbd96af74c675335/crates/gsyn-core/src/music.rs#L393)).
- **Note dell'accordo** ([music.rs L257-325](https://github.com/Londopy/gesture-synth/blob/3e6a40ad5073b8c0afe92cd1fbd96af74c675335/crates/gsyn-core/src/music.rs#L257-L325)):
  - radice = Do3 (MIDI 48) + tonalità + offset del grado nel modo (maggiore o minore naturale) + 12 × ottava;
  - massimo 4 note, ordinate in modo ascendente;
  - Inv1 sposta la radice un'ottava sopra;
  - `open_voicing` sposta 3ª e 7ª un'ottava sopra.
- **Sintesi:** "chord legato", cioè le note comuni restano tenute e si riattaccano solo le voci che cambiano; glide opzionale ([synth/mod.rs L275-313](https://github.com/Londopy/gesture-synth/blob/3e6a40ad5073b8c0afe92cd1fbd96af74c675335/crates/gsyn-core/src/synth/mod.rs#L275-L313)).

**Jitter e latenza.**
- **Test delle dita indipendenti dalla rotazione:** la punta deve essere più lontana dal polso della PIP ×1,25 **e** l'angolo MCP-PIP-punta deve superare i 150°. Pollice esteso se la sua punta dista più di 1,1 palmi dalla nocca del mignolo ([L559-570](https://github.com/Londopy/gesture-synth/blob/3e6a40ad5073b8c0afe92cd1fbd96af74c675335/crates/gsyn-core/src/gesture.rs#L559-L570)).
- **Debounce separato per grado, qualità, forma e ottava:** il candidato deve restare stabile per 90 ms ([L167-203](https://github.com/Londopy/gesture-synth/blob/3e6a40ad5073b8c0afe92cd1fbd96af74c675335/crates/gsyn-core/src/gesture.rs#L167-L203), default a [L145-165](https://github.com/Londopy/gesture-synth/blob/3e6a40ad5073b8c0afe92cd1fbd96af74c675335/crates/gsyn-core/src/gesture.rs#L145-L165)).
- **Assegnazione delle mani** ([L471-541](https://github.com/Londopy/gesture-synth/blob/3e6a40ad5073b8c0afe92cd1fbd96af74c675335/crates/gsyn-core/src/gesture.rs#L471-L541)):
  - con due mani usa la x del polso ("far more reliable than labels");
  - con una mano sola usa l'etichetta corretta per lo specchio, più la continuità con l'ultima posizione vista (entro 400 ms);
  - flag di calibrazione `mirror_frame`, `swap_hands` e `invert_tilt`.
  - La documentazione MediaPipe conferma che "handedness is determined assuming the input image is mirrored … If it is not the case, please swap the handedness output" ([MediaPipe Hands, legacy](https://mediapipe.readthedocs.io/en/latest/solutions/hands.html)). Eric, Ekmand e rainbow686 usano le etichette così come arrivano.
- **Perdita di tracking** ([L394-428](https://github.com/Londopy/gesture-synth/blob/3e6a40ad5073b8c0afe92cd1fbd96af74c675335/crates/gsyn-core/src/gesture.rs#L394-L428)):
  - soglia di confidenza 0,6;
  - dopo 250 ms sotto soglia lo stato viene congelato;
  - dopo 1 s sfuma a silenzio in 300 ms, **tranne se l'accordo è in latch**;
  - al ritorno risale in 100 ms.
- **Latch:** se entrambe le mani restano ferme per 2 s, l'accordo resta tenuto ([L445-464](https://github.com/Londopy/gesture-synth/blob/3e6a40ad5073b8c0afe92cd1fbd96af74c675335/crates/gsyn-core/src/gesture.rs#L445-L464)).
- **Thread separati:** il parser produce lo stato, che arriva al thread audio tramite un ring lock-free o un triple buffer. L'audio non dipende quindi dal frame rate della camera ([README, "How it works"](https://github.com/Londopy/gesture-synth/blob/3e6a40ad5073b8c0afe92cd1fbd96af74c675335/README.md)).

**Qualità per Keopees (valutazione mia).**
- È il parser più robusto: un pattern non riconosciuto non cambia l'accordo, una mano ruotata non cambia il conteggio delle dita, un'etichetta sbagliata non scambia le mani.
- Gli schemi semplificati (ScaleOnly, FixedStyle, DynamicsOnly) sono esattamente quello che serve a una non musicista.
- I punti deboli:
  - nessun preset di Registrazione 9:16 (registra in webm/mp4 il canvas della scena o la camera);
  - progetto molto ampio (Gleam, Zig, community, medaglie), da cui prendere solo `gesture.rs`, `music.rs`, `math.rs`, `state.rs` e la logica di legato.

## Verdetto sulle licenze

| Repo | Copiare codice nel nostro progetto privato? | Attribuzione |
|---|---|---|
| ericwei97-cloud | Permesso solo per uso personale e non commerciale; è a rischio se i contenuti diventano commerciali. **Prendere solo le idee.** | Credito obbligatorio se si condivide un derivato |
| Ekmand | **No** (nessuna licenza, ed è un derivato di Eric) | n/a |
| rainbow686 | Sconsigliato: la MIT non copre le parti derivate da Eric, e `handArt.ts` è CC BY-SA. Le idee sulla Registrazione si possono riprendere. | Copyright MIT, più CC BY-SA sugli asset |
| amerob | **No** (nessun file LICENSE) | n/a |
| **Londopy** | **Sì** | Mantenere la nota "MIT © 2026 Londopy" (per esempio in `THIRD_PARTY_NOTICES`) |

Lo schema di Gesti in sé (quali dita corrispondono a quale grado) è un'idea di design, non codice. Il copyright protegge l'espressione, cioè il codice, non il metodo. Adottarlo riscrivendolo non pone problemi di licenza (valutazione non legale).

## Raccomandazione

Riferimento unico: **Londopy/gesture-synth**. Si può riusare (o portare in Swift) il parser dei Gesti e la derivazione degli accordi, che sono MIT e indipendenti dalla piattaforma. Da rainbow686 prendiamo solo ispirazione per la UX della Registrazione in Verticale. Da Eric prendiamo il vocabolario dei Gesti, già familiare a chi l'ha visto sui social.

## Schema Gesto → note proposto per la portante

Proposta mia, adattata da Londopy. I vincoli sono quelli del vocoder: la **Voce** decide quando si sente qualcosa, la portante decide solo **quali note**.

1. **Una mano basta.** La mano degli accordi è configurabile, di default la sinistra; l'altra è facoltativa. Se Keopees tiene il microfono in mano, deve poter fare tutto con una mano sola.
2. **Grado con i pattern di Londopy** (indice = I … pollice+indice+mignolo = VII). Un pattern non riconosciuto mantiene il grado; debounce di 90 ms, regolabile tra 80 e 120.
3. **Qualità diatonica automatica (schema ScaleOnly) come default.** Tonalità e modo (maggiore o minore naturale) si scelgono nell'interfaccia prima della Registrazione: ogni accordo è sempre in tonalità. Il maggiore/minore dall'inclinazione è da escludere come default: in camera non si vede, è fragile, porta fuori tonalità e ruota la stessa mano che deve contare le dita.
4. **Pugno = portante spenta** (voce secca o silenzio, da decidere). **Mano fuori campo = accordo tenuto**, senza la sfumatura di 1 s di Londopy. Il vocoder resta comunque muto quando lei non canta, quindi tenere l'accordo non costa nulla e le permette di abbassare la mano e continuare a cantare. È il contrario di Eric e rainbow686, che fermano il suono quando perdono la mano e taglierebbero la Voce a metà frase.
5. **Mano facoltativa per le forme**: 1 dito triade, 2 dita aperto/spread, 3 dita settima, 4 dita sus o 9ª (da provare a orecchio); pollice fuori = ottava sopra, con isteresi. Senza seconda mano si usa una forma fissa scelta nell'interfaccia (schema FixedStyle).
6. **Condotta delle voci automatica al posto del rivolto a gesti.** Si sceglie il rivolto più vicino all'accordo precedente e si tengono le note comuni (chord legato di Londopy), con una piccola rampa sulle voci che cambiano. Il cambio d'accordo dentro una parola cantata resta così fluido, senza click né buchi.
7. **Voicing pensato per il vocoder:**
   - 4–6 voci a dente di sega, cioè ricche di armoniche, non triangolari come il default di Eric;
   - radice raddoppiata all'ottava bassa;
   - registro attorno a quello della Voce.
8. **Parametri continui** (altezza della seconda mano):
   - non volume, perché la dinamica arriva dalla Voce;
   - piuttosto brillantezza della portante (cutoff) o mix secco/vocoder;
   - smoothing one-pole da 60–120 ms;
   - range di altezza calibrato all'avvio (top/bottom come la `Calibration` di Londopy).
9. **Assegnazione delle mani come in Londopy:**
   - con due mani per posizione x;
   - correzione dello specchio (MediaPipe assume input specchiato);
   - flag di calibrazione da verificare a mano sulla webcam reale.
10. **Latch:** utile come opzione "accordo bloccato" (mani ferme per 2 s, oppure un Gesto dedicato), per cantare una strofa intera su un accordo con le mani libere.

**Latenza attesa (stima mia).** Camera a 30–60 fps (17–33 ms per frame) + inferenza MediaPipe (12–17 ms nel benchmark Google su Pixel 6, [Hand Landmarker](https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker)) + debounce di 90 ms ≈ **120–150 ms dal Gesto al cambio d'accordo**. Per i cambi d'accordo è accettabile, se Keopees anticipa di poco. La Voce verso l'Ascolto non deve mai passare dal ciclo video: va su un percorso audio nativo separato, con buffer piccoli (come il thread cpal di Londopy).

**In camera.**
- I pattern delle dita sono leggibili e "scenici".
- In Verticale il ritaglio 9:16 di una webcam orizzontale è stretto. Il tracking deve girare sul frame intero, mentre l'interfaccia mostra la zona del ritaglio (come il mirino di rainbow686), così Keopees tiene le mani dentro l'inquadratura, all'altezza del petto, vicino al viso.

## Da evitare

- `tip.y < pip.y` come test delle dita (Eric, Ekmand, rainbow686): sbaglia appena la mano ruota.
- Il pollice contato nei gradi I–V (Eric) e il pollice che cambia insieme forma e ottava (rainbow686).
- Lo stop/start "a scatto" degli oscillatori, o il rilascio totale e il riattacco a ogni cambio: con il vocoder diventano click e buchi sulla Voce.
- Fermare la portante quando si perde una mano, o pretendere due mani per avere suono.
- Le toppe a lunga memoria come la "pinky memory" di 2 s di rainbow686, che produce gradi fantasma.
- La qualità forzata dall'inclinazione come default: accordi fuori tonalità per una non musicista.
- Le etichette di handedness usate senza correzione per lo specchio né fallback sulla posizione.
- Versioni di MediaPipe disallineate (Eric: npm 0.10.35 contro WASM 0.10.14) e il modello scaricato a runtime da un CDN. Il modello va incluso nell'app; Tone.js non va lasciato senza versione fissata (amerob).

## Implicazioni per l'architettura Mac (da approfondire)

- MediaPipe Tasks elenca ufficialmente Android, Python e Web, più una pagina iOS; macOS nativo non è elencato ([Hand Landmarker](https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker)).
- Le strade possibili sono:
  - una webview come fa Londopy con Tauri;
  - Python;
  - **Apple Vision** `VNDetectHumanHandPoseRequest`, disponibile da macOS 11 con 21 joint (4 per dito più il polso) ([Apple](https://developer.apple.com/documentation/vision/vndetecthumanhandposerequest), [JointName](https://developer.apple.com/documentation/vision/vnhumanhandposeobservation/jointname)).
- Apple Vision restituisce punti 2D (`VNPoint`, "a single 2D point"). L'inclinazione di Londopy (normale 3D del palmo) e il colpo in z non si portano così come sono, ma lo schema proposto non ne ha bisogno.
- I test di Londopy su distanze e angoli funzionano anche in 2D, con un po' di taratura.
- Il core di Londopy (Rust, senza allocazioni nel path audio) è collegabile a Swift come libreria statica oppure portabile in Swift.

## Domande aperte

- Keopees canta con il microfono in mano o su un'asta/headset? Questo decide se la seconda mano sia davvero disponibile.
- Pugno = portante muta o Voce secca?
- Quante voci e quale registro per la portante: va verificato a orecchio con la sua Voce.
- Tonalità e modo: scelti prima di ogni Registrazione o anche cambiabili con un Gesto (come i due pugni ruotati di Londopy)?

## Fonti

- Repo e file citati sopra, ai commit `7ee25ba`, `90bb803`, `f006db6`, `dffb84f`, `3e6a40a` (letti via `gh api` il 2026-10-11).
- Metadati dei repo (licenza SPDX, stelle, date) da `gh api repos/<owner>/<repo>`; la presenza o assenza di LICENSE da `gh api repos/<owner>/<repo>/license`.
- [npm registry @mediapipe/tasks-vision](https://registry.npmjs.org/@mediapipe/tasks-vision): ultima versione 1.1.0, licenza Apache-2.0.
- [MediaPipe Hand Landmarker guide](https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker): 21 punti, opzioni con default 0,5, benchmark Pixel 6 (CPU 17,12 ms, GPU 12,27 ms), piattaforme.
- [MediaPipe Hands (legacy)](https://mediapipe.readthedocs.io/en/latest/solutions/hands.html): handedness calcolata assumendo un input specchiato.
- [Apple VNDetectHumanHandPoseRequest](https://developer.apple.com/documentation/vision/vndetecthumanhandposerequest), [VNHumanHandPoseObservation.JointName](https://developer.apple.com/documentation/vision/vnhumanhandposeobservation/jointname), [VNPoint](https://developer.apple.com/documentation/vision/vnpoint).
- Demo verificate con `curl` (HTTP 200) il 2026-10-11.
