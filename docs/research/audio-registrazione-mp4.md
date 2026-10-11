# Audio del vocoder nella Registrazione MP4

Data: 2026-10-11. Stack: Tauri 2 (WKWebView) + Rust/cpal + Svelte, fork di Londopy/gesture-synth. Nota: `londopy-anatomy.md` non esiste nel repo, ho usato `gesture-synth-reference.md` e `stack-options.md`.

## Problema

Londopy registra `canvas.captureStream()` con MediaRecorder in WebM e nel file arriva solo il microfono grezzo. Il vocoder gira in Rust e la sua uscita non passa dal webview. Serve un MP4 (H.264/AAC) con il video del canvas (overlay inclusi) e l'audio processato (vocoder + voce pulita).

## Fatti verificati

- Safari/WebKit: MediaRecorder supporta "MP4 con H.264 e AAC" ([WebKit blog](https://webkit.org/blog/11353/mediarecorder-api/), articolo del 2021). Accetta come ingresso "any MediaStreamTrack", comprese quelle generate da Canvas e WebAudio (stessa fonte). Opzioni di bitrate: non disponibili all'epoca, oggi non confermato.
- Safari 18.4 aggiunge WebM (VP8/VP9 + Opus) e MP4 **frammentato** (ISOBMFF, pensato per MSE) in MediaRecorder ([WebKit 18.4](https://webkit.org/blog/16574/webkit-features-in-safari-18-4/)). Quindi l'MP4 di MediaRecorder potrebbe essere frammentato: se Instagram/TikTok lo accettino senza remux e' **non confermato**.
- In WKWebView `getUserMedia` e' esposto solo se l'app puo' catturare nativamente, con prompt utente (WebKit blog, stessa fonte). Canvas + WebAudio non richiedono permessi.
- Bug WebKit storici su MediaRecorder: file non validi per sync A/V in Safari 14 ([bug 216832](https://bugs.webkit.org/show_bug.cgi?id=216832)), `captureStream` che produce video vuoto in Safari 15 ([bug 229611](https://bugs.webkit.org/show_bug.cgi?id=229611)), regressione MP4 in iOS 18.4 beta ([bug 290002](https://bugs.webkit.org/show_bug.cgi?id=290002), chiuso come duplicato; esito finale **non confermato**). Nessun bug trovato su drift con `MediaStreamAudioDestinationNode`: assenza di prova, non prova di assenza.
- Tauri 2: i Channel sono "fast and deliver ordered data", raccomandati per "ordered, high-throughput data" mentre gli eventi no ([Tauri docs](https://v2.tauri.app/develop/calling-frontend/)). Per i byte grezzi si usa `Channel<InvokeResponseBody>` con `InvokeResponseBody::Raw`; JS riceve un `ArrayBuffer`. Un `Channel<Vec<u8>>` invece serializza in JSON come array di numeri ([docs.rs Channel](https://docs.rs/tauri/latest/tauri/ipc/struct.Channel.html)). Nessun benchmark ufficiale; un utente riporta ~5 ms per 10 MB su macOS (aneddotico, [discussione Tauri](https://github.com/tauri-apps/tauri/discussions/5690)).
- Banda audio: stereo float32 a 48 kHz = 384 KB/s, trascurabile per un Channel.
- Rust nativo: `objc2-av-foundation` espone `AVAssetWriter` dietro feature flag (`AVAssetWriter`, `AVAssetWriterInput`, `AVMediaFormat`, `objc2-core-media`, `block2`) ([docs.rs](https://docs.rs/objc2-av-foundation/latest/objc2_av_foundation/struct.AVAssetWriter.html)). Complessita' alta: API Objective-C via binding, blocchi, CMSampleBuffer.
- Mediabunny: libreria TypeScript senza dipendenze, tree-shakable, scrive MP4 anche "with Fast Start, fragmented", encoding hardware via WebCodecs ([mediabunny.dev](https://mediabunny.dev/guide/introduction)).
- Social: le guide terze concordano su MP4, H.264, AAC, 1080x1920, 9:16, 30 fps (Reels accetta 23-60 fps) ([Swat.io](https://help.swat.io/en/articles/11663331-instagram-reels-format-requirements), [Orlo](https://support.orlo.tech/instagram-media-upload-limits)). Pagine help ufficiali Meta/TikTok non lette: **non confermato** a livello primario. WebM non adatto (stack-options.md, da verificare).
- `AudioEncoder` con AAC (`mp4a.40.2`) in Safari/WKWebView: **non confermato** (le note Safari 18.4 non lo citano; si verifica a runtime con `AudioEncoder.isConfigSupported`, [MDN](https://developer.mozilla.org/en-US/docs/Web/API/AudioEncoder)). Anche `VideoEncoder` H.264 in WKWebView su macOS 26: non verificato.

## Opzioni

### (a) PCM da Rust al webview, AudioWorklet, MediaStreamDestination, MediaRecorder MP4

Flusso: il motore Rust copia il mix finale (vocoder + voce pulita) in un ring buffer lock-free; un thread non-realtime lo invia in blocchi (10-20 ms) su un `Channel<InvokeResponseBody>`; in JS un AudioWorklet li riproduce in un `MediaStreamAudioDestinationNode` (non collegato alle casse, nessun doppio ascolto). La traccia audio e la traccia video di `canvas.captureStream()` vanno in un unico `MediaRecorder` con mimeType `video/mp4;codecs=avc1,mp4a.40.2`.

- Sync A/V: audio e video sono stampati dallo stesso clock del browser, quindi restano allineati tra loro. Resta un offset costante (latenza IPC + worklet + camera) rispetto a cio' che si e' visto/sentito; va misurato con un clap test e compensato. Gli underrun del worklet causano click nel file: serve un buffer di 50-100 ms (in registrazione la latenza non conta).
- CPU/RAM: minimi (audio) piu' il costo gia' pagato del MediaRecorder H.264 hardware. Nessun processo in piu'.
- MP4: output nativo di WebKit, ma frammentato e/o a frame rate variabile e' possibile (non confermato). Mitigabile con un remux/fast-start finale.
- Complessita': bassa-media (ring buffer + Channel + worklet, stima 100-200 righe). Dipendenze: nessuna. Peso app: +0.
- Rischi: bug WebKit su MediaRecorder; AudioContext in WKWebView puo' restare sospeso senza gesto utente (si risolve avviandolo dal click su "Registra").

### (b) Video nel webview, audio WAV nativo da Rust, mux nativo

Il video (MediaRecorder solo video) e il WAV del motore vengono uniti con AVFoundation (`AVAssetWriter` o composition + export) oppure con ffmpeg incluso.

- Sync: punto debole. Due clock diversi (cpal e webview); serve un ancoraggio comune e MediaRecorder non garantisce il primo timestamp: offset e drift da correggere a mano, peggio con frame rate variabile del canvas.
- CPU/RAM: il mux e' leggero se si copia lo stream (passthrough); ricodificare il video e' costoso su M1 fanless. Mandare i frame 1080x1920 a Rust via IPC (~8 MB/frame RGBA) e' da scartare.
- Complessita': alta (binding objc2 o ffmpeg). ffmpeg: peso app +30-80 MB (stima, non verificata), licenza LGPL/GPL, firma e notarizzazione del binario. `AVAssetExportSession` passthrough evita dipendenze esterne ma va chiamato via binding.
- Vantaggio: output controllabile (fast start, frame rate costante se si ricodifica); il WAV pulito e' un bonus.

### (c) WebCodecs (VideoEncoder/AudioEncoder) + Mediabunny

Il canvas fornisce i `VideoFrame` con timestamp espliciti; i blocchi PCM da Rust, con timestamp calcolati dal numero di campioni, vanno a `AudioEncoder`; Mediabunny scrive l'MP4 con fast start.

- Sync: il migliore (timestamp espliciti e unici, niente MediaRecorder, frame rate costante possibile).
- Rischio principale: supporto AAC in `AudioEncoder` e H.264 in `VideoEncoder` dentro WKWebView **non confermato**. Se manca AAC, l'audio va codificato altrove (crate AAC in Rust: non valutato) e il vantaggio si perde.
- Complessita': media-alta (pipeline di encoding a mano, backpressure e memoria dei VideoFrame su 8 GB). Dipendenza: Mediabunny (JS, piccola).

### (d) Registrazione tutta nativa

Camera + overlay catturati in Rust: cambia lo stack (gli overlay sono nel canvas del webview). Scartata.

## Confronto

| Criterio | (a) PCM al webview + MediaRecorder | (b) mux nativo | (c) WebCodecs + Mediabunny |
|---|---|---|---|
| Sync A/V | buona; offset costante da calibrare | debole, due clock | ottima, timestamp espliciti |
| CPU/RAM M1 8 GB | bassa | bassa se passthrough, alta se ricodifica | media |
| Compatibilita' social | probabile; MP4 frammentato/VFR da testare | alta se si controlla il mux | alta (fast start, CFR) |
| Complessita' | bassa | alta | media-alta |
| Dipendenze / peso | nessuna | objc2 o ffmpeg (decine di MB) | Mediabunny (piccola) |
| Rischio principale | bug WebKit MediaRecorder, MP4 frammentato | drift, lavoro di binding | supporto AAC/H.264 WebCodecs non confermato |

## Raccomandazione

1. **Partire da (a)**: strada piu' corta, nessuna dipendenza, sync tra le tracce preservato. Il mix (vocoder + voce pulita) si decide in Rust; il webview lo riceve come ArrayBuffer da un Channel con `InvokeResponseBody::Raw` (non `Vec<u8>`).
2. **Spike di mezza giornata prima di costruire**, su macOS 26 reale, M1, con Continuity Camera:
   - `MediaRecorder.isTypeSupported('video/mp4;codecs=avc1,mp4a.40.2')` nel WKWebView di Tauri;
   - registrare 60 s e controllare con `ffprobe` durata, frame rate (CFR/VFR), frammentazione, offset audio/video;
   - caricare il file su Instagram e TikTok e verificare audio e durata;
   - provare `AudioEncoder.isConfigSupported({codec:'mp4a.40.2',...})` e `VideoEncoder` H.264 per decidere su (c).
3. **Se l'MP4 e' frammentato, VFR o rifiutato**: aggiungere un remux/fast-start finale (es. `AVAssetExportSession` passthrough via objc2, o Mediabunny nel webview) invece di passare a (b) completo. **Se lo spike mostra drift**: passare a (c) se AAC e H.264 sono supportati.
4. **(b) con ffmpeg** solo come ultima risorsa: peso app, firma e licenza.
5. In ogni caso salvare in parallelo il WAV del motore Rust come backup (costo trascurabile) e prevedere una calibrazione manuale dell'offset audio/video.

## Da verificare (non confermato)

- Forma finale dell'MP4 di MediaRecorder in WKWebView su macOS 26 (frammentato, VFR) e accettazione da Instagram/TikTok.
- Esito del bug WebKit 290002/288459 nelle versioni rilasciate.
- Supporto `AudioEncoder` AAC e `VideoEncoder` H.264 in WKWebView.
- Latenza e jitter reali di un Channel Tauri su macOS con blocchi da 10-20 ms (nessun benchmark ufficiale).
- Requisiti ufficiali Meta/TikTok (fonti primarie non lette).
