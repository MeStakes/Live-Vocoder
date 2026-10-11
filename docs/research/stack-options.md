# Live Vocoder: confronto degli stack per la v1

Data: 2026-10-11. Stato: **bozza; punti 1–5 del ticket #3 verificati in parte (vedi sezione "Esiti verifica ticket #3"), il resto resta da verificare.**

> **Aggiornamento ticket #3 (2026-10-11).** Cinque punti controllati su fonti primarie con budget limitato: esiti in fondo, sezione "Esiti verifica ticket #3". Dove scrivo "non confermato" la fonte primaria non diceva nulla. Il resto del documento è ancora la bozza originale.
>
> **Nota sulle fonti (bozza originale).** La ricerca su fonti primarie (5 agenti in parallelo) è stata interrotta per limiti di budget prima che arrivasse qualsiasi risultato. **Nessuna affermazione qui sotto è stata verificata su una fonte primaria in questa sessione.** Tutto viene da conoscenze pregresse (fino a metà 2026) ed è marcato **(da verificare)**. Per ogni sezione indico le fonti primarie da controllare. Prima di prendere la decisione finale, va fatto lo spike di misura descritto in fondo.

## Macchina target (confermata)

- MacBook Air M1 (2020), 8 GB RAM, **senza ventola** (con carico prolungato riduce le prestazioni), macOS Tahoe 26.6.2.
- Webcam integrata FaceTime HD **720p orizzontale** (1280x720).
- Conseguenza: il carico sostenuto (webcam + tracking delle mani + encoding video + DSP audio) deve stare basso, sia per la RAM (8 GB condivisi con la GPU) sia per la temperatura.

## Raccomandazione in breve

**Stack consigliato: (d) Swift nativo** (SwiftUI + AVAudioEngine + Vision + AVAssetWriter), distribuito come `.app` firmata con Developer ID e notarizzata.

**Alternativa a costo minimo: (b) PWA in Chrome**, ma solo se lo spike di misura conferma una latenza dell'Ascolto accettabile per lei (indicativamente sotto i 20 ms). Python (a) ed Electron/Tauri (c) sono sconsigliati.

## Tabella comparativa (tutti i valori da verificare)

| Criterio | (a) Python/Qt | (b) PWA Chrome | (b) PWA Safari | (c) Electron / Tauri | (d) Swift nativo |
|---|---|---|---|---|---|
| Latenza Ascolto mic→cuffie (cuffie a filo) | ~10–20 ms possibili, ma jitter da GIL se audio + mediapipe + opencv stanno nello stesso processo | ~20–40 ms tipici | spesso peggio di Chrome e più variabile | Electron ≈ Chrome; Tauri ≈ Safari (WKWebView) | ~5–12 ms (buffer da 64–256 frame a 48 kHz) |
| Tracking delle mani | mediapipe Python, su macOS probabilmente solo CPU | MediaPipe JS con delegate GPU (WebGL) | MediaPipe JS, delegate GPU meno affidabile | come il browser sottostante | Apple Vision hand pose (Neural Engine/GPU) |
| Encoding video | ffmpeg / PyAV con `h264_videotoolbox` (hardware) | MediaRecorder MP4 H.264 (hardware), frame rate variabile | MediaRecorder MP4 H.264/AAC | come il browser | AVAssetWriter H.264/HEVC hardware, frame rate costante |
| RAM su 8 GB | alta (Qt + mediapipe + opencv, ~0,5–1 GB) | media-alta (processi Chrome + GPU) | media | Electron alta (+ un Chromium dentro l'app); Tauri media | bassa |
| Dipendenze al primo avvio | ~300–600 MB (Python + wheel) | nessuna (modello + WASM ~10–15 MB, in cache) | come Chrome | incluse nel bundle (Electron ~150 MB+) | nessuna (framework di sistema) |
| Gatekeeper | serve una `.app` launcher; senza firma c'è il blocco | nessuno | nessuno | serve firma + notarizzazione | serve firma + notarizzazione (99 USD/anno) |
| Continuity Camera (iPhone) | AVFoundation via OpenCV: probabile, ma ordine degli indici fragile | compare in getUserMedia; la rotazione verticale è incerta | come Chrome | come il browser sottostante | supporto pieno + RotationCoordinator |
| Complessità totale v1 | **alta** | **bassa** | media | media-alta | media |

## 1. Latenza dell'Ascolto (parzialmente verificato, vedi esiti)

- **Chrome (Web Audio):** con `echoCancellation`, `noiseSuppression` e `autoGainControl` a `false` e `latencyHint: "interactive"`, `baseLatency` su macOS è di pochi ms. La catena di ingresso di getUserMedia (pipeline di cattura WebRTC a blocchi da 10 ms, FIFO, eventuale ricampionamento 44,1↔48 kHz) aggiunge però latenza. Il round-trip reale riportato di solito è **20–40 ms** (da verificare). Fonti: crbug.com (input latency macOS), W3C Audio WG issues, MDN `AudioContext.outputLatency`, `AudioContext.playoutStats`.
- **Safari:** AudioWorklet supportato. La latenza di ingresso è storicamente più alta e variabile, e ci sono problemi di ricampionamento (da verificare su bugs.webkit.org).
- **Python sounddevice (PortAudio/CoreAudio):** `latency='low'` con blocksize 64–128 è possibile, ma callback in Python + GIL condiviso con l'inferenza mediapipe e opencv comportano rischio di glitch. Servirebbe un processo audio separato (da verificare: docs python-sounddevice, issue PortAudio).
- **AVAudioEngine:** su macOS il buffer si imposta con `kAudioDevicePropertyBufferFrameSize` (AVAudioSession esiste solo su iOS). Con 64–128 frame a 48 kHz, il round-trip è di circa **5–12 ms** (da verificare: docs Apple Core Audio, WWDC).
- **Bluetooth / AirPods:** sono **inutilizzabili per l'Ascolto**: 100–300 ms di latenza. Inoltre, se si usa il microfono degli AirPods, il collegamento passa al profilo HFP e l'audio peggiora molto. Servono **cuffie a filo** (jack 3,5 mm del MacBook Air oppure USB-C). L'app deve rilevare un'uscita Bluetooth e avvisarla.
- **Ingresso e uscita su device diversi** (mic integrato + cuffie USB): possibile deriva di clock e latenza extra. Meglio il jack integrato oppure un'unica interfaccia USB.

## 2. Registrazione MP4 e social (parzialmente verificato, vedi esiti)

- **Chrome:** MediaRecorder supporta `video/mp4` (H.264, audio AAC o Opus) da circa Chrome 126–130 (da verificare su chromestatus). L'MP4 prodotto è spesso **frammentato e a frame rate variabile**, cosa che può dare problemi in upload o in editing. Alternativa robusta: WebCodecs (VideoEncoder + AudioEncoder AAC) + Mediabunny / mp4-muxer, per avere un MP4 a frame rate costante.
- **Safari:** MediaRecorder produce MP4 H.264/AAC dalla versione 14.1. Ci sono bug storici su durata e sincronia (da verificare).
- **Instagram/TikTok:** accettano MP4 H.264/AAC, 1080x1920, 30 fps. WebM non è adatto (da verificare sulle pagine help di Meta e TikTok).
- **Formato Verticale dalla webcam 720p:** il ritaglio 9:16 vale solo **~405x720 px reali**. Portato a 1080x1920 è un ingrandimento di 2,7x, visibilmente morbido. La soluzione per una buona qualità è la **Continuity Camera** (iPhone in verticale), vedi §8.
- **Salvataggio in ~/Downloads:** nel browser si usa il download standard (Chrome: cartella Download di default; Safari: dipende dall'impostazione "Chiedi dove salvare"). Nell'app nativa la scrittura in `~/Downloads` fa scattare un prompt TCC "accesso alla cartella Download" (cartella protetta, da verificare); in alternativa un pannello di salvataggio una tantum.

## 3. Installazione della PWA su macOS (da verificare)

- **Chrome:** "Installa app" crea un'app con finestra propria, icona nel Dock e voce in `~/Applications/Chrome Apps`. Per lanciarla serve Chrome installato. Il permesso camera/mic resta legato all'origine e persiste se si sceglie "Consenti durante la visita al sito" (non "Consenti questa volta").
- **Safari "Aggiungi al Dock"** (Sonoma+): web app separata con storage proprio. I permessi camera/mic per sito sono gestiti in Impostazioni > Siti web (persistenza da verificare).
- **Contesto sicuro:** `localhost` o HTTPS. `file://` non basta per getUserMedia.
- **Offline:** i WASM di `@mediapipe/tasks-vision` e `hand_landmarker.task` (~8 MB) si possono ospitare in proprio (`FilesetResolver.forVisionTasks(path)`) e mettere in cache con un service worker (da verificare).

## 4. Gatekeeper e firma (verificato in parte, vedi esiti)

- **macOS 15 Sequoia ha tolto il bypass Ctrl-clic → Apri** per le app non notarizzate. Il nuovo percorso: si apre l'app, compare il blocco, poi si va in Impostazioni di Sistema > Privacy e sicurezza > "Apri comunque", con password di amministratore. Si presume che macOS 26 sia uguale o più restrittivo. Fonti: Apple Developer News (agosto 2024), support.apple.com/102445.
- **Su Apple Silicon** i binari devono avere almeno una firma ad-hoc. Una firma ad-hoc non evita Gatekeeper se il file ha l'attributo di quarantena.
- **Quarantena (`com.apple.quarantine`):** la impostano Safari e Chrome sui download, e anche AirDrop, Mail e Messaggi. Di solito *non* la impostano la copia da chiavetta USB né `curl` da Terminale (da verificare). Lo stesso vale per i file scaricati da uno script già in esecuzione.
- **Developer ID + notarizzazione:** Apple Developer Program a 99 USD/anno (in Italia circa 99 EUR), hardened runtime, entitlement `com.apple.security.device.camera` e `com.apple.security.device.audio-input`, chiavi `NSCameraUsageDescription` e `NSMicrophoneUsageDescription`, flusso con `notarytool`. Risultato: doppio clic e un solo avviso "scaricata da Internet".

## 5. Python su macOS stock (da verificare)

- **`/usr/bin/python3` su un Mac pulito è uno stub:** lanciarlo apre la finestra "Installa Command Line Tools" (download di diverse centinaia di MB). Non si può contare su di lui.
- **Bootstrap con uv + python-build-standalone:** fattibile (Python ~20–40 MB compressi). In totale però, con mediapipe (~40–50 MB), opencv (~40 MB), PySide6 (~150–250 MB con Addons), numpy e PyAV/ffmpeg, si arriva a **~300–600 MB** da scaricare al primo avvio.
- **Wheel mediapipe macOS arm64:** coprono solo alcune versioni di CPython (storicamente 3.9–3.12; 3.13 da verificare). Le API legacy `mp.solutions` sono deprecate. Ci sono conflitti noti con protobuf e numpy 2.
- **TCC:** se Python parte da Terminale o da un `.command`, il permesso camera/mic viene chiesto a nome di **Terminale**. Con un `.app` wrapper non firmato l'identità può cambiare e il prompt ripresentarsi. Un processo senza `NSCameraUsageDescription` viene negato o va in crash.
- **Verdetto:** è lo stack con la complessità totale più alta: bootstrap, Gatekeeper sul launcher, TCC attribuito al processo sbagliato, GIL, solo CPU sul Mac, RAM.

## 6. Tracking delle mani su Apple Silicon (da verificare)

- **MediaPipe HandLandmarker JS:** con il delegate GPU (WebGL2) gira a 30+ fps su M1 in Chrome. In Safari il delegate GPU è storicamente meno stabile.
- **mediapipe Python su macOS:** di fatto solo CPU (il delegate GPU è supportato su Linux), quindi più calore su un Air senza ventola.
- **Apple Vision `VNDetectHumanHandPoseRequest`** (macOS 11+; API Swift `DetectHumanHandPoseRequest` da WWDC24): 21 punti, chirality, gira su Neural Engine/GPU e lascia libera la CPU per l'audio.
- **Latenza del Gesto:** webcam a 30 fps + inferenza = ~60–120 ms dal Gesto al cambio nota. Va bene per scegliere gli accordi, non per attacchi ritmici.

## 7. Permessi camera/mic (TCC) per l'utente (da verificare)

| Stack | Primo avvio | Avvii successivi |
|---|---|---|
| PWA Chrome | prompt del sito (Consenti/Blocca) + prompt di macOS "Google Chrome vuole accedere a videocamera/microfono" (una volta per Chrome) | nessuno, se ha scelto "Consenti durante la visita" |
| PWA Safari | prompt del sito + prompt di macOS per Safari | può chiedere di nuovo, a seconda delle Impostazioni > Siti web |
| Python da `.command` | prompt di macOS a nome di "Terminale" (confonde) | nessuno, ma tutto Terminale ha accesso alla camera |
| Electron/Tauri | prompt di macOS a nome dell'app (servono le chiavi Info.plist); in Tauri si aggiunge il prompt di WKWebView | stabile solo se l'app è firmata |
| Swift nativo | due prompt di sistema chiari col nome dell'app + prompt "cartella Download" | nessuno |

## 8. Aggiunte per M1 8 GB e Continuity Camera (parzialmente verificato, vedi esiti)

- **Headroom:** il nativo è il più leggero (Vision su ANE, encoder hardware, niente runtime web). Chrome con MediaPipe WebGL e MediaRecorder è fattibile su 8 GB, ma con Tahoe e altre app aperte la pressione sulla memoria sale. Electron aggiunge un secondo Chromium. Python con Qt, mediapipe e opencv è il più pesante sulla CPU.
- **Senza ventola:** su sessioni lunghe (più di ~10 minuti) l'encoding software o l'inferenza solo su CPU possono causare throttling e glitch audio. È un motivo per preferire encoder hardware (VideoToolbox) e ANE.
- **Continuity Camera:** richiede macOS 13+ e un iPhone XR o successivo con iOS 16+, stesso Apple ID, Wi-Fi + Bluetooth (o USB). Appare come dispositivo AVFoundation (`AVCaptureDevice.DeviceType.continuityCamera`, macOS 14+; per alcune API di discovery serve la chiave `NSCameraUseContinuityCameraDeviceType` in Info.plist). Nei browser compare tra i dispositivi di getUserMedia. Che arrivino davvero **frame verticali 1080x1920** con l'iPhone montato in verticale va verificato per ciascuno stack: nel nativo si gestisce con `AVCaptureDevice.RotationCoordinator`, mentre nel browser e in OpenCV il comportamento è incerto. In OpenCV gli indici dei dispositivi cambiano.
- **Rischio "Reazioni" di macOS:** da Sonoma in poi certi gesti delle mani (pollice su, cuori, pace, ecc.) possono far partire **effetti a schermo intero nel video della camera** (fuochi d'artificio, palloncini) in qualsiasi app. Per un'app comandata a gesti è un rischio reale. Vanno disattivate da Centro di Controllo > Effetti video (per app). Nell'app nativa si può controllare (`AVCaptureDevice.reactionEffectsEnabled`, da verificare) e mostrare un avviso.

## Come funzionerebbe "un clic + controllo dipendenze" nello stack consigliato

1. Riceve `Live Vocoder.app` (firmata e notarizzata) in un `.dmg` o `.zip`, la trascina in Applicazioni e la tiene nel Dock. Al primo avvio compare un solo avviso "scaricata da Internet, vuoi aprirla?".
2. **Non c'è niente da scaricare:** audio, visione e video sono framework di sistema, e l'app pesa pochi MB.
3. Il "controllo dipendenze" diventa una schermata di **controllo pre-volo**, con una spia verde/rossa per ogni voce e un pulsante "Sistema":
   - permesso Microfono;
   - permesso Videocamera;
   - accesso alla cartella Download;
   - uscita audio: cuffie a filo sì, Bluetooth no (avviso);
   - camera scelta: integrata o iPhone;
   - Reazioni attive (avviso);
   - spazio libero su disco.

   Il pulsante "Sistema" apre direttamente il pannello giusto di Impostazioni di Sistema.
4. Gli aggiornamenti arrivano come nuova `.app`, o in automatico con Sparkle in una fase successiva.

## I 3 rischi principali

1. **Latenza dell'Ascolto.** Va misurata sul suo Mac con cuffie a filo. Se resta sopra i ~15 ms anche in nativo, il problema è l'hardware o il routing, non lo stack.
2. **Firma e Gatekeeper.** Senza Developer ID (99 USD/anno) ogni versione nuova la costringe al percorso "Apri comunque" in Impostazioni.
3. **Qualità video verticale e Gesti.** Dalla webcam 720p si ottiene solo ~405x720. Serve la Continuity Camera in verticale, che va verificata, e le Reazioni di macOS possono rovinare le Registrazioni.

## Spike consigliato prima di decidere (1–2 giorni)

1. Pagina web minima in Chrome sul suo M1: mic → AudioWorklet passthrough → cuffie a filo. Misurare il round-trip in loopback (cavo o "clap test" registrato) e leggere `baseLatency` e `outputLatency`.
2. App Swift minima: AVAudioEngine passthrough con buffer da 128 frame, stessa misura.
3. Collegare l'iPhone in verticale come Continuity Camera e controllare quale risoluzione e orientamento arrivano in Chrome (`getSettings()`) e in AVFoundation.
4. Se Chrome resta sotto i ~20 ms e lei non percepisce il ritardo → PWA (b). Altrimenti → nativo (d).

## Esiti verifica ticket #3

### 1. Latenza mic integrato → cuffie a filo con cpal/CoreAudio (M1, buffer 64–128)
- **Non confermato** per cpal: nessuna misura pubblicata trovata. Il README di cpal indica solo `BufferSize::Fixed(n)` e dice che buffer piccoli riducono la latenza ma aumentano il rischio di glitch; non dice se CoreAudio rispetta il valore. Fonte: https://github.com/RustAudio/cpal
- Dato generale CoreAudio (non cpal): circa 8,3 ms misurati a 64 frame/48 kHz, +~2 ms ogni 32 frame (MathWorks, https://www.mathworks.com/help/audio/ug/measure-audio-latency.html). Il round trip è circa due buffer più latenza del device e safety offset (JUCE, https://forum.juce.com/t/macos-round-trip-latency/45278). Un utente Max riporta +~15 ms con mic e altoparlanti integrati rispetto a uscita line-out (https://cycling74.com/forums/max-coreaudio-round-trip-latency).
- Stima ragionevole, **non misurata**: ~8–15 ms con 64–128 frame. Va misurata con lo spike.

### 2. Registrazione MP4 in WKWebView (macOS 26) con overlay su canvas
- Safari/WebKit: MediaRecorder produce MP4 con H.264 + AAC, `isTypeSupported` per il rilevamento, e accetta qualsiasi MediaStreamTrack, inclusi quelli da canvas e da WebAudio. Fonte: https://webkit.org/blog/11353/mediarecorder-api/ (articolo del 2021; opzioni di bitrate non disponibili in quel momento).
- Architettura prevista: `canvas.captureStream(30)` (frame camera + scheletro + onda disegnati sul canvas) + traccia audio da `MediaStreamAudioDestinationNode` (Web Audio) in un unico `MediaStream`. Per le tracce da canvas e WebAudio c'è conferma di principio dal blog WebKit.
- **Non confermato** su macOS 26 / WKWebView di Tauri: nessuna fonte 2025–2026 trovata. Rischi noti: bug storico di captureStream da canvas che registrava nero su macOS 12 (https://bugs.webkit.org/show_bug.cgi?id=229611, risultato duplicato di 230613, stato attuale non verificato); frame rate variabile; sincronia A/V. Da provare nello spike.
- Instagram/TikTok: fonti ufficiali (help.instagram.com, support.tiktok.com) **non raggiunte**. Guide di terzi concordano su MP4 H.264 + AAC, 1080x1920, 9:16, 30 fps; TikTok minimo 720x1280; AV1/VP9 non supportati; limiti di durata e dimensione discordanti. Quindi MP4 H.264/AAC di Safari dovrebbe andare, ma **non confermato** su fonte ufficiale né sul file reale.

### 3. Continuity Camera nella webview
- Requisiti Apple: iPhone XR o successivo, iOS 16+, macOS 13+, stesso Apple Account, Bluetooth e Wi-Fi attivi; verticale supportato; la pagina non indica risoluzione né fps. Fonte: https://support.apple.com/en-us/102546
- In getUserMedia: segnalazioni di terzi dicono che compare come dispositivo, ma in un caso Electron/Chromium mostra la traccia senza frame (https://forum.obsidian.md/t/macos-continuity-camera-is-detected-by-getusermedia-but-delivers-zero-video-frames-in-obsidian/116834). **Non confermato** per WKWebView.
- 1080x1920 verticale: un post sul forum Apple (iOS 26.6, non macOS) riporta che richiedere 1080x1920 restituisce 1920x1080 non ruotato e che `getSettings()` non corrisponde al frame mostrato (https://developer.apple.com/forums/thread/844826). **Non confermato** che arrivino frame 1080x1920; piano B: ruotare/ritagliare sul canvas.

### 4. Gatekeeper su macOS 15/26 per .app non firmata o ad-hoc
- Passi ufficiali: aprire l'app una volta (compare il blocco) → Impostazioni di Sistema > Privacy e sicurezza → "Apri comunque" → alla nuova finestra "Apri". Poi l'app resta come eccezione. Fonte: https://support.apple.com/en-us/102445 (screenshot di Sequoia; macOS 26 e password admin non menzionati).
- Rimozione del Ctrl-clic → Apri in Sequoia e richiesta della password admin: riportati da stampa/blog (https://appleinsider.com/inside/macos-sequoia/tips/whats-changed-in-runtime-protection-for-macos-sequoia), non dalla pagina Apple. Comportamento su macOS 26 **non confermato**.
- Quarantena via AirDrop/download: **non confermato** su fonte Apple (la guida Platform Security parla solo di "provenienza dei file scaricati": https://support.apple.com/guide/security/gatekeeper-and-runtime-protection-sec5599b66df/web). Resta l'ipotesi di bozza (browser, AirDrop, Mail sì; chiavetta USB e curl no).
- Developer ID + notarizzazione: Apple Developer Program **99 USD/anno** (https://developer.apple.com/programs/); la pagina collega Developer ID e notarizzazione all'iscrizione. Per default Gatekeeper richiede software firmato da sviluppatore registrato e notarizzato.

### 5. Reazioni macOS disattivabili per singola app?
- **Non confermato** su fonte Apple. Fonti di terzi: l'interruttore Reazioni sta nel menu Video / Centro di Controllo (Effetti video) durante l'uso della camera e sembra valere a livello di sistema, non per app (https://community.zoom.com/t5/Meetings/Balloons-and-confetti-on-screen/m-p/140481). Le Reazioni richiedono macOS Sonoma+ su Apple silicon, oppure Continuity Camera con iPhone 12+.
- Lato nativo, la pagina Apple su `AVCaptureDevice.reactionEffectsEnabled` è risultata vuota alla lettura; esistenza di una chiave Info.plist per il default dei gesti (`NSCameraReactionEffectGesturesEnabledDefault`) **non confermata**. In ogni caso non si può forzare il disattivo: l'app può solo avvisare l'utente.

### Note aggiuntive su Tauri/WKWebView
- Servono `NSCameraUsageDescription` e `NSMicrophoneUsageDescription`; senza, l'app va in crash all'accesso. Può servire il delegate `requestMediaCapturePermissionFor` di WKUIDelegate per far funzionare getUserMedia nella webview (fonti di terzi: https://developer.apple.com/forums/thread/134216 e https://github.com/tauri-apps/tauri/issues/2338). Se wry lo espone: non verificato.

## Fonti primarie da verificare (non consultate in questa sessione)

- Apple: support.apple.com/102445 (aprire app in sicurezza), Apple Developer News agosto 2024 (Gatekeeper in Sequoia), developer.apple.com (notarizzazione, hardened runtime, Continuity Camera, Vision hand pose, RotationCoordinator, reaction effects), specifiche del MacBook Air M1.
- Chromium: chromestatus.com (MediaRecorder MP4), crbug.com (latenza di ingresso audio su macOS); WebKit: bugs.webkit.org, note di rilascio di Safari.
- MediaPipe: ai.google.dev/edge/mediapipe (hand landmarker web e python), pagina PyPI di `mediapipe` (wheel macOS arm64), npm `@mediapipe/tasks-vision`.
- astral-sh/uv e python-build-standalone (dimensioni delle build aarch64-apple-darwin); pagine PyPI di PySide6, opencv-python, PyAV.
- Help Center di Meta/Instagram e di TikTok (specifiche di upload).
