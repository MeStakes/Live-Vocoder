# Live Vocoder v1: spec

Data: 2026-10-11. Stato: approvata a sezioni da Riccardo, da rivedere per intero prima del piano.
Fonti: mappa [#1](https://github.com/MeStakes/Live-Vocoder/issues/1), ticket chiusi #2–#14, glossario `CONTEXT.md`, `docs/brand/`, `docs/research/`, prototipi sui branch `prototype/*`.

## Come leggere questa spec

- Le parole con la maiuscola (Voce, Gesto, Modalità, Effetto, Coro, Vocoder, Ascolto, Ritardo, Registrazione, Formato, Nota, Base, Intensità, Suono, Pienezza, Canzone, Impostazioni, Dispositivi) sono quelle di `CONTEXT.md`, con lo stesso significato. Nel codice e nei testi dell'app si usano queste, non i sinonimi da evitare.
- Quando due ticket si contraddicono, vale il più recente. Per esempio: la cartella è Filmati/Live Vocoder e non Download (#5); niente schermata pre-volo (#5); l'Effetto ha tre posizioni e non è un interruttore (#13); si dice Nota e non Perlina (#14); la Camera sta nei Dispositivi e non nelle Impostazioni (#14).
- **Il prototipo `prototypes/pannello-suono.prototype.html` (branch `prototype/pannello-suono`, commit `a0270c0`) è il riferimento visivo vincolante.** Schermata, CSS, testi e disegno del video si rifanno identici. Cambiano solo gli ingressi: camera, mani, audio e file diventano veri. Il branch non va cancellato finché la v1 non è costruita.
- Le scelte segnate `ponytail:` sono semplificazioni volute. Ognuna dice qual è il suo limite e quando si cambia.

## 1. Obiettivo

App Mac per Keopees, una cantante che non è una sviluppatrice. Lei canta nel microfono del Mac e sente in cuffia a filo, in tempo reale, la Voce trattata dall'Effetto (Coro, Vocoder o Spento). Sceglie le Note e l'Intensità con le dita davanti alla camera. Registra video Verticali o Orizzontali, con il video e l'audio già trattati, pronti per i social.

- **Mac di Keopees:** MacBook Air M1 2020, 8 GB, senza ventola, macOS Tahoe 26.6.2. Camera: iPhone 17 Pro Max via Continuity Camera.
- **Il suo setup:** iPhone su un'asta, cuffie a filo collegate al Mac, nessuna asta per il microfono, tutte e due le mani libere.
- **Mac di prova:** MacBook Pro 16" M1 Pro 16 GB, macOS 26.5.2, iPhone 14 Pro Max. Se una cosa funziona qui, sul Mac di Keopees basta un controllo veloce in beta.
- **Chi decide:** Riccardo. Keopees prova la beta.
- **Successo:** Keopees installa il `.dmg`, canta, registra e trova il file, senza aiuto e senza scaricare nient'altro.

### Fuori scope

- Base musicale (lei canta a cappella).
- Uso dal vivo sul palco.
- Montaggio o editing video.
- App per iPhone o per Windows.
- Riempire le Note partendo da una tonalità.
- Anteprima video dentro l'app.
- Blocco dell'accordo (latch).

## 2. Stack e architettura

**Stack confermato (#6):** Tauri 2 + Rust/cpal + WKWebView, solo Apple Silicon (`aarch64-apple-darwin`).

**Si parte da un'app nuova**, non dal fork di Londopy. L'app unisce i prototipi già provati:

| Prototipo | Cosa porta |
|---|---|
| `prototype/prova-ritardo` | audio duplex, PCM verso il webview, camera preferita, MP4 |
| `prototype/suono-vocoder` | DSP di Coro, Vocoder, tastiera e gate, con i `cargo test` |
| `prototype/prova-aggiornamento` | firma self-signed, updater, `.dmg` |
| `prototype/pannello-suono` | schermata, banco del Suono, menu Canzone, disegno del video |

- Il frontend è in JavaScript semplice, come i prototipi: niente framework e niente bundler. Tauri serve `src/` così com'è.
- MediaPipe Hand Landmarker (JS, WASM e modello `hand_landmarker.task`) ha la versione fissata e i file dentro l'app.
- Da Londopy/gesture-synth (MIT) si portano solo il test delle dita, l'assegnazione delle mani e il debounce (`crates/gsyn-core/src/gesture.rs`), riscritti in JS. La nota di copyright va in `THIRD_PARTY_NOTICES`.

### Moduli

**Rust** (`src-tauri/src/`)

| File | Cosa fa |
|---|---|
| `audio.rs` | Stream cpal di ingresso e di uscita sui Dispositivi scelti, con un ring buffer lock-free in mezzo. Le manopole arrivano come atomici con `set(nome, valore)`. Il PCM mono a 48 kHz va al webview con un `Channel<InvokeResponseBody>` raw, **creato nuovo a ogni avvio dell'audio** (riusato si blocca, #6). |
| `suono.rs` | La catena del Suono (§3). È senza allocazioni nel callback: tutto si alloca una volta, per 32 bande. |
| `canzoni.rs` | Legge e scrive `canzoni.json` (§8). |
| `registrazioni.rs` | Sceglie il nome `vN`, aggiunge i pezzi al file, controlla lo spazio su disco, gestisce Guarda, Mostra nel Finder e Butta (§6). |
| `camera.rs` | `prefer_camera(id)`: imposta `AVCaptureDevice.userPreferredCamera` con objc2 (#6). |
| `dispositivi.rs` | Elenco di ingressi, uscite e camere, e tipo di trasporto di ogni uscita (cuffie, altoparlanti, Bluetooth). |

Più il plugin `tauri-plugin-updater`, un opener per Guarda e Mostra nel Finder, e un dialog per scegliere la cartella.

**Webview** (`src/`)

| File | Cosa fa |
|---|---|
| `index.html` | Markup e CSS del prototipo `pannello-suono`, portati identici (CSS dentro la pagina, come nel prototipo). |
| `ui.js` | Stato e interazioni della schermata (§7), copiati dal prototipo. Dati e regole stanno in moduli piccoli (`accordo.js`, `manopole.js`, `canzoni.js`), più `motore.js`, `camera.js`, `avvisi.js`, `guida.js`: elenco completo nel piano. |
| `mani.js` | Camera → MediaPipe → conto delle dita → Nota e Intensità (§4). Dalla Nota la pagina calcola le frequenze che suonano (`accordo.js`, le stesse dell'onda) e la quota d'Effetto, e manda a Rust solo quelle. |
| `video.js` | Il canvas che si vede e si registra (§5). È la funzione `draw()` del prototipo. |
| `registra.js` | PCM → AudioWorklet → MediaRecorder → pezzi a Rust (§6). |

### Flusso

```
Microfono ─cpal─▶ ring ─▶ suono.rs ─┬─▶ × Volume in cuffia ─cpal─▶ Cuffie (Ascolto)
                                    └─▶ Channel PCM ─▶ AudioWorklet ─▶ MediaStreamDestination ─┐
Camera ─getUserMedia─▶ MediaPipe (mani.js) ─▶ note e quota d'Effetto ─invoke set()─▶ suono.rs   │
                 └──▶ video.js (canvas) ─captureStream(30)─────────────────────────────────────┴─▶ MediaRecorder MP4 ─▶ pezzi ogni 1 s ─▶ registrazioni.rs ─▶ file
```

La Voce verso l'Ascolto non passa mai dal webview: resta tutta nel thread audio di Rust.

`ponytail:` microfono e cuffie sono due dispositivi con orologi separati. Come nel prototipo, l'uscita butta l'arretrato dell'ingresso oltre 2 buffer invece di ricampionare. Il limite: se gli orologi vanno a velocità un po' diverse, ogni tanto può scappare un micro-clic. **Il ricampionamento adattivo si aggiunge solo se Keopees sente il problema dopo aver ricevuto l'app.**

## 3. Suono

### Catena (Rust, mono 48 kHz, nel callback d'uscita di cpal)

```
Ingresso → Anti-fruscio → Effetto → pareggio del volume → crossfade con l'Intensità → limitatore
        → PCM verso la Registrazione
        → × Volume in cuffia → Uscita (Ascolto)
```

- **Anti-fruscio** (noise gate, prima di tutto). Apre in ~2 ms, chiude in ~40 ms e si richiude solo sotto metà soglia, così non sbatte.
- **Pareggio del volume.** L'Effetto viene portato allo stesso volume medio della Voce (RMS, ~300 ms). Poi si miscela alla Voce con un crossfade a potenza costante guidato dall'Intensità. Così, cambiando le manopole, il volume non cambia.
- **Limitatore** prima della Registrazione, perché il microfono satura sui colpi forti (picco 6× il fondo scala, #6).
- Il Volume in cuffia vale solo per l'Ascolto e non entra nella Registrazione.

### Effetti

| Effetto | Cosa fa | Come |
|---|---|---|
| **Coro** (predefinito) | La Voce copiata sulle note dell'accordo: un coro fatto della sua stessa voce, il suono di "Hide and Seek". | YIN ogni 256 campioni (120–1000 Hz, soglia 0,15) + TD-PSOLA. Grani di Hann lunghi due periodi della Voce, rimessi in fila al periodo della nota voluta, con guadagno = periodo voluto / periodo cantato. Senza intonazione (consonanti, fiato) i grani restano al passo originale. Ogni nota dell'accordo va nell'ottava più vicina a quella cantata; basso e ottava sopra seguono la Base. Ritardo in più stimato in ~7–15 ms, non misurato. |
| **Vocoder** | La Voce dà la forma a un accordo di synth. | Portante PolyBLEP (Supersaw = 3 seghe a ±15 cent). Bande a passo logaritmico da 120 Hz a 8 kHz, con Q pari al passo. Inviluppo: attacco 2 ms, rilascio 25–80 ms (cresce con la Morbidezza). La Morbidezza porta il passa-basso della portante da 12 kHz a 1,2 kHz. |
| **Spento** | Gli accordi suonano da soli come una tastiera, anche quando lei non canta, sopra la Voce pulita. | Portante + passa-basso a 2,5 kHz, × 0,25 × Intensità. L'Intensità regola il volume degli accordi. |

- **Consonanti chiare** (Coro e Vocoder): la Voce sopra i 5 kHz (passa-alto) va dritta nell'Effetto, × 1,5.
- **Scivolata:** le note che suonano scivolano verso quelle del nuovo accordo.
- Riferimento del codice: `prototypes/suono-vocoder/src-tauri/src/main.rs`.

### Note dell'accordo

Una Nota è fatta di Base (Do…Si), Tipo e ottava. Ottava Bassa / Media / Alta = ottava 3 / 4 / 5; Media (ottava 4) è il registro della voce di Keopees.

| Tipo | Note (Pienezza 3) | Nome nel video |
|---|---|---|
| Maggiore | 1 · 3 · 5 | Do |
| Minore | 1 · ♭3 · 5 | Dom |
| Settima | 1 · 3 · ♭7 | Do7 |
| Maj7 | 1 · 3 · 7 | Domaj7 |
| Sus4 | 1 · 4 · 5 | Dosus4 |

- Nella Settima e nella Maj7 **la 7ª prende il posto della 5ª**, così le note sono sempre 3 e il numero della Pienezza resta vero.
- **Pienezza 3:** le 3 note. **4:** + la Base un'ottava sotto (basso). **5:** + la Base un'ottava sopra. Al massimo 5 voci.
- **Modalità Nota singola:** suona solo la Base e il Tipo non conta. Pienezza 3 = solo la Base, 4 = + il basso, 5 = + l'ottava sopra. Le Note della ruota e la scritta nel video mostrano solo la Base.

### Manopole del banco del Suono

Gamme, gradini, nomi e testi del display sono quelli del prototipo (`KN`, `EFF`, `DEVS`), e i valori predefiniti sono quelli di #13. Tutto si salva nella Canzone, tranne i Dispositivi.

| Gruppo | Manopola (etichetta) | Vale per | Valori | Predefinito |
|---|---|---|---|---|
| Effetto | Effetto | — | Coro / Vocoder / Spento | **Coro** |
| Mano | Intensità con 1 dito (Con 1 dito) | tutti | 0–100%, passo 5 | 60% |
| Mano | Intensità con 5 dita (Con 5 dita) | tutti | 0–100%, passo 5 | 90% |
| Accordo | Pienezza | tutti | 3 · leggero / 4 · col basso / 5 · pieno | 4 |
| Accordo | Scivolata | tutti | 0–0,4 s, passo 0,02 ("niente" a 0) | niente |
| Synth | Timbro | Vocoder, Spento | Sega / Supersaw / Quadra | Supersaw |
| Synth | Dettaglio | Vocoder | 8 / 12 / 16 / 24 / 32 fette | 24 |
| Synth | Morbidezza | Vocoder, Spento | 0–100%, passo 5 | 0% |
| Voce | Consonanti chiare (Consonanti) | Coro, Vocoder | 0–100%, passo 5 | 15% |
| Voce | Anti-fruscio | tutti | spento, poi −70…−30 dB passo 5 (leggero ≤ −60, medio ≤ −45, forte) | spento |
| Cuffia | Volume in cuffia (Volume) | tutti | ×0,25–×6, passo 0,25 | ×2 |

- L'Intensità a 2, 3 e 4 dita è lineare tra "con 1 dito" e "con 5 dita": `p(n) = i1 + (i5 − i1) · (n − 1) / 4`.
- Le manopole si girano trascinando su o giù, con la rotellina o con le frecce. Il doppio clic rimette il valore di partenza di quella manopola.
- Le manopole che non servono all'Effetto scelto restano visibili ma sbiadite, e il display dice "Vale solo …".
- **"Di partenza"** rimette tutte le manopole ai predefiniti; l'Effetto resta quello scelto. Il pulsante è spento quando è già tutto ai predefiniti.

### Ascolto e Dispositivi

- **Dispositivi:** Ingresso audio, Uscita audio, Camera. Stanno nel banco del Suono, valgono per tutte le Canzoni e si ricordano tra un avvio e l'altro.
- Se l'Uscita sono gli **altoparlanti**, l'Ascolto resta spento (fischierebbe) e compare un avviso rosa. Il motore audio gira lo stesso e manda silenzio all'Uscita, così la Registrazione ha l'audio.
- Se l'Uscita è **Bluetooth**, l'Ascolto resta acceso e compare l'avviso rosa "arriva in ritardo".
- Il tipo di uscita si riconosce dal tipo di trasporto CoreAudio.
- **I microfoni Bluetooth non si usano** e non compaiono tra gli Ingressi (deciso il 2026-10-12). Il microfono delle AirPods va solo a 24 kHz e porta le AirPods in vivavoce: anche l'Ascolto scende a 24 kHz mono e la voce registrata suona come al telefono. Se il microfono predefinito di macOS è Bluetooth, si usa quello del Mac. Le AirPods restano usabili come Uscita, con l'avviso del ritardo (~150–250 ms in più); la Registrazione non ne risente.
- **Ritardo:** con il microfono interno è ~40 ms. Dipende dall'elaborazione dei 3 microfoni del Mac, non dallo stack (#6). Riccardo lo accetta per ora e lo giudica Keopees in beta. Se non va bene: cuffie con il microfono sul filo nel jack, oppure un'interfaccia USB.

## 4. Gesti

`mani.js`, nel webview: camera → MediaPipe Hand Landmarker (modalità VIDEO, 2 mani, 30 fps) sul **fotogramma intero** della camera → conto delle dita → Nota (1–5, 0 = accordi fermi) e Intensità (1–5). Verso Rust vanno le frequenze delle note che suonano (`set_note`, lista vuota = accordi fermi) e la quota d'Effetto (`set('wet', …)`).

- **Dita alzate:** si conta quante dita sono alzate, da 1 a 5, pollice compreso; quali dita non conta. Il test è quello di Londopy e non dipende dalla rotazione della mano: la punta deve essere più lontana dal polso della PIP × 1,25 **e** l'angolo MCP-PIP-punta deve superare i 150°. Il pollice è alzato se la sua punta dista più di 1,1 palmi dalla nocca del mignolo. 0 dita = pugno.
- **Debounce di 90 ms:** un conteggio nuovo vale solo se resta stabile per 90 ms.
- **Assegnazione delle mani** (come Londopy):
  - con due mani si decide dalla posizione x del polso;
  - con una mano sola si usa l'etichetta di MediaPipe corretta per lo specchio, più la continuità con l'ultima posizione vista (400 ms);
  - una mano sotto la soglia di confidenza 0,6 per 250 ms è "fuori campo".
- **Mano degli accordi** (Impostazioni, Sinistra di default): 1–5 dita suonano la Nota 1–5. Pugno o mano fuori campo fermano gli accordi con una rampa breve, senza clic, e la Voce pulita resta. Non c'è mai silenzio totale.
- **Seconda mano** (facoltativa): 1–5 dita danno l'Intensità 1–5. Pugno o mano fuori campo tengono l'ultimo livello. Aprendo una Canzone si riparte da 3. Il passaggio da un livello all'altro è smussato (60–120 ms, da regolare a orecchio).
- Con una mano sola funziona tutto, con l'Intensità ferma all'ultimo livello.

## 5. Video

### Camera

- La camera di partenza è l'iPhone se c'è, altrimenti la webcam del Mac. Si cambia con il selettore Camera dei Dispositivi.
- **WebKit mostra l'iPhone solo se è la camera preferita di sistema** (#6). Per questo, all'avvio e a ogni cambio, `prefer_camera` imposta `AVCaptureDevice.userPreferredCamera` e poi `getUserMedia` apre quella camera.
- Effetto collaterale noto: la camera preferita vale per tutto il sistema, anche per FaceTime.
- **Non** mettere `NSCameraUseContinuityCameraDeviceType` in Info.plist: sposta l'iPhone in un tipo di dispositivo che WebKit non cerca.
- Massimo 30 fps. L'iPhone in verticale manda 1080×1920 (una volta è arrivato 1080×1440). La webcam del Mac manda 1280×720.
- Lo zoom 0,5× su macOS non si può fare: si allontana l'iPhone, oppure si usa Center Stage (da provare).

### Il canvas: si vede e si registra

- **Misura fissa per Formato:** Verticale 1080×1920, Orizzontale 1920×1080, 30 fps. La polaroid mostra lo stesso canvas rimpicciolito.
- La camera **riempie il riquadro tagliando i bordi**, in qualunque verso arrivi. La guida dice di girare l'iPhone per l'Orizzontale; altrimenti il video viene sgranato, come il Verticale con la webcam del Mac.
- I punti delle mani passano dalla stessa trasformazione del ritaglio. Una mano fuori dal ritaglio ma dentro il fotogramma della camera non si disegna, ma si legge lo stesso.

**`video.js` è la funzione `draw()` del prototipo `pannello-suono`, portata identica.** Proporzioni, colori, spessori, aloni e animazioni non cambiano. Cambia solo questo:

| Nel prototipo | Nell'app |
|---|---|
| sfondo sfumato e sagome finte della persona | fotogramma della camera, ritagliato |
| mano finta (`HAND`, `handPoints`) | i 21 punti di MediaPipe di ogni mano |
| dita alzate simulate | dita alzate lette da `mani.js` |
| Nota e Intensità che cambiano da sole | Nota e Intensità vere |
| "respiro" dell'onda con un seno finto | livello vero dell'audio (vedi sotto) |
| scritta "camera simulata · …" | tolta |

Strati, dal basso verso l'alto:

1. **Camera.**
2. **Filtro rosa** (se è acceso): un velo rosa/prugna su tutta l'immagine della camera, più il glitter che brilla. Spento, toglie solo questo strato; mani, onda e scritte restano.
3. **Mani a perline:** scheletro color crema con alone, perline sulle articolazioni, cuori con tre stelline intorno sulle punte delle dita alzate. L'alone è rosa sulla mano degli accordi e viola chiaro sulla seconda mano.
4. **Colonna dell'Intensità:** 5 perline al bordo del video, dal lato della seconda mano. Quelle accese sono viola chiaro e l'ultima accesa è rosa.
5. **Onda.**
6. **Accordo** (se Accordo nel video è acceso) in Pacifico rosa, con estrusione crema e ombra prugna, in alto a sinistra. Se Titolo nel video è acceso, accanto c'è "– <nome della Canzone>" in crema, che si rimpicciolisce se non ci sta; con l'accordo spento il titolo prende il suo posto.

- **Specchio** (se è acceso): rovescia camera, mani e colonna. Le scritte e l'onda restano dritte. Vale anche per il file.

### Onda (identica al prototipo)

- **Forma:** la somma dei seni delle note che suonano, disegnata su tutta la larghezza a ~86% dell'altezza.
- **Due tracce:** una "fantasma" rovesciata e trasparente (× −0,6, opacità 0,35) e una piena (spessore doppio), con l'alone rosa e la sfumatura orizzontale da rosa a viola chiaro.
- **Ampiezza:** cresce con l'Intensità e con il "respiro".
- **Respiro:** con Coro e Vocoder è il livello vero dell'audio (RMS del PCM che arriva al webview, ritardato di ~80 ms per stare con le mani, #6). Con Spento è fisso a 0,85, come nel prototipo.
- **Accordi fermi** (pugno o mano fuori campo): l'onda è piatta.

## 6. Registrazione

### Avvio e stop

1. Keopees preme **Registra**. Se il disco ha meno di 2 GB liberi compare un avviso rosa, ma si può registrare lo stesso.
2. Se il **Conto alla rovescia 3 s** è acceso, il conto compare sul video e non finisce nel file.
3. Rust crea `Cartella/<Canzone>/` se non c'è e sceglie `<Canzone> vN.mp4`, dove N è il numero più alto già presente in quella cartella + 1, partendo da 1. Un file non si sovrascrive mai.
4. MediaRecorder parte. Il pulsante diventa Stop e mostra il timer.
5. **Durante la Registrazione è tutto bloccato tranne Stop.** Canzone, Note, Modalità, Formato, Effetto, manopole, Dispositivi, Impostazioni, Nascondi, guida e aggiornamenti non rispondono. I Gesti funzionano.
6. Stop → l'ultimo pezzo viene scritto, il file si chiude e compare l'avviso **"Salvato: Ma Lei v3"** con:
   - **Guarda:** apre il file nel lettore di sistema;
   - **Mostra nel Finder;**
   - **Butta:** sposta il file nel Cestino.

### Come si scrive il file

- Il video è `canvas.captureStream(30)`. L'audio è il PCM che arriva da Rust (dopo il limitatore, senza il Volume in cuffia) e passa da un AudioWorklet (cuscinetto di 150–180 ms) a un `MediaStreamAudioDestinationNode`. Un solo MediaRecorder registra le due tracce con lo stesso orologio.
- `video/mp4;codecs=avc1,mp4a.40.2`, AAC 48 kHz.
- **Obbligatorio `rec.start(1000)`:** senza timeslice WebKit smette di scrivere il video dopo ~20 MB (#6).
- **A ogni pezzo da 1 s**, `registra.js` lo manda a Rust (invoke con corpo raw) e Rust lo aggiunge al file. La memoria non cresce, e se l'app si chiude di colpo resta un file valido fino all'ultimo secondo, perché l'MP4 è frammentato.
- WebKit ignora `videoBitsPerSecond`: escono ~14 Mbps (~105 MB al minuto), H.264 Constrained Baseline.
- Sincronia: l'audio arriva ~40–55 ms dopo l'immagine, sotto la soglia ITU (~125 ms).
- La finestra ha `backgroundThrottling: "disabled"`.
- Non c'è limite di durata.

### Disco

Durante la Registrazione Rust controlla lo spazio libero del volume della cartella ogni 5 s. **Sotto i 500 MB la Registrazione si ferma da sola**, il file si salva e compare l'avviso rosa.

`ponytail:` l'MP4 resta frammentato, così come esce da WebKit. Il caricamento su Instagram e TikTok non è ancora provato. Se in beta i social lo rifiutano, si aggiunge un remux `+faststart` dopo lo stop (AVFoundation passthrough o Mediabunny).

## 7. Schermata

È quella del prototipo `pannello-suono`, identica. Tutto sta nella finestra senza scroll verticale (provato a 1440×820 e a 1280×720). La finestra minima è 1280×720 e il titolo della finestra è "Live Vocoder".

- **In alto a sinistra:**
  - titolo "Live Vocoder" in Pacifico, icona "K" e "by Keopees";
  - il pulsante **"Canzone: Ma Lei ▾"** e il pulsante **Impostazioni** sulla stessa riga;
  - la **ruota** con le 5 Note, che si adatta all'altezza. Le Note sono perline viola; quella che suona è rosa, con il nome al centro. Ogni Nota mostra il nome, "N dita" e ↑ o ↓ per l'ottava. Sotto la ruota: "Tocca una Nota per cambiarla.";
  - l'**editor della Nota**, che si apre accanto alla ruota senza spingere giù niente. Contiene "Nota da N dita: Lam", Base (Do…Si), Tipo (Maggiore, Minore, Settima, Maj7, Sus4), Ottava (Bassa, Media, Alta) e Fatto.
- **In alto a destra:**
  - la **polaroid** con il canvas, che si adatta all'altezza e al Formato, e la didascalia "questo finisce nel video ♥";
  - sotto, **Modalità** (Accordi / Nota singola), **Formato** (Verticale / Orizzontale) e **Registra**.
- **In basso, il banco del Suono** a tutta larghezza:
  - "Suono", il display di aiuto, "Di partenza", "Nascondi" / "Mostra" (chiude il banco e ingrandisce il video) e "?" per la guida;
  - i gruppi Effetto (manopola a 3 posizioni con i nomi cliccabili), Mano, Accordo, Synth, Voce, Cuffia, Dispositivi (Ingresso audio, Uscita audio, Camera).
- **Display:** passando sopra una manopola, un nome di Effetto o un Dispositivo, oppure dandogli il fuoco, mostra il nome e la spiegazione. I testi sono quelli del prototipo.
- **Impostazioni** (pannello laterale): Accordo nel video, Titolo nel video ("il nome della Canzone"), Filtro rosa, Specchio, Conto alla rovescia 3 s, Accordi con la mano (Sinistra / Destra), Cartella delle Registrazioni.
  - I primi quattro sono accesi di default, la mano degli accordi è la Sinistra.
  - La cartella vale per tutte le Canzoni. Di default è `~/Movies/Live Vocoder` (Filmati/Live Vocoder) e si cambia con la finestra di scelta cartella di macOS.
- **Guida "?"** (pannello laterale). Si apre da sola al primo avvio. Capitoli, in quest'ordine:
  1. **Come si suona:** Canzone, Note, Gesti, Intensità, registrare, trovare i file.
  2. **Il Suono:** gli Effetti e le manopole, con gli stessi testi del display.
  3. **La parte tecnica:** cuffie a filo, iPhone come webcam (in verticale per il Verticale, girato per l'Orizzontale), permessi, spegnere le Reazioni di macOS, la cartella, "tieni il Mac aperto" (con il coperchio chiuso il microfono interno si spegne).

  I testi si scrivono alla fine, quando le schermate sono definitive. Lo stile è carino, chiaro, breve e a tema.
- Esc chiude pannelli e menu.
- I font Pacifico, Amatic SC e Nunito sono **inclusi nell'app** (il prototipo li prende da Google Fonts; l'app deve funzionare offline). Palette e token sono quelli del prototipo e di `docs/brand/README.md`.

## 8. Canzoni e dati salvati

Una Canzone salva: nome, le 5 Note, Modalità, Formato, Effetto, tutte le manopole del Suono (compreso il Volume in cuffia) e le Impostazioni (Accordo nel video, Titolo nel video, Filtro rosa, Specchio, Conto alla rovescia, mano degli accordi). La cartella delle Registrazioni e i Dispositivi invece valgono per tutte le Canzoni.

**Il salvataggio è automatico** a ogni modifica: non c'è un tasto Salva. I dati vanno in un solo file, `~/Library/Application Support/com.keopees.live-vocoder/canzoni.json`, scritto su un file temporaneo e poi rinominato, così un crash non lo rovina.

```json
{
  "versione": 1,
  "cartella": "~/Movies/Live Vocoder",
  "dispositivi": { "ingresso": "…", "uscita": "…", "camera": "…" },
  "aperta": "Ma Lei",
  "canzoni": [{
    "name": "Ma Lei",
    "data": {
      "beads": [{ "r": 0, "t": "M", "o": 0 }, …],
      "mode": "accordi", "format": "verticale", "eff": "coro",
      "snd": { "i1": 60, "i5": 90, "voci": 4, "scivola": 0, "timbro": "supersaw", "bande": 24,
               "morb": 0, "cons": 15, "gate": -75, "vol": 2 },
      "titolo": true, "filtro": true, "specchio": true, "conto": true, "mano": "sinistra"
    }
  }],
  "guidaVista": true
}
```

Le chiavi sono quelle del prototipo, così lo script si porta senza rinominare. `r` è la Base, da 0 (Do) a 11 (Si). `t` è il Tipo, uno tra `M`, `m`, `s7`, `maj7`, `sus`. `o` è l'ottava: −1 / 0 / 1 per Bassa / Media / Alta. `scivola` è in ms, `gate` in dB (−75 = spento).

### Menu "Canzone: Ma Lei ▾"

- **Lista** delle Canzoni, ognuna con "Effetto · Formato"; quella aperta è evidenziata. Un clic apre la Canzone e l'Intensità riparte da 3.
- **+ Nuova Canzone:** chiede il nome e "Parti da", con due scelte:
  - **Copia di «Canzone attuale»**, già selezionata;
  - **Note e Suono di partenza:** le Note Do, Sol, Lam, Fa, Mim, i predefiniti del Suono e delle Impostazioni, Accordi, Verticale, Coro.
- **Rinomina «…».** Le Registrazioni già fatte restano nella cartella con il nome vecchio e non si tocca nessun file. Le nuove vanno in `Cartella/<nome nuovo>/`, con la numerazione che riparte da quello che c'è lì.
- **Elimina.** Chiede conferma: "Eliminare «…»? Note e Suono si perdono. Le Registrazioni restano nella cartella." L'ultima Canzone non si può eliminare.
- **Regole del nome** (il nome diventa una cartella):
  - non vuoto, massimo 40 caratteri;
  - senza `/` e `:`;
  - non inizia con un punto (sarebbe una cartella nascosta, o fuori dalla cartella con `..`);
  - unico, senza distinguere maiuscole e minuscole.

  Gli errori compaiono sotto la casella con i testi del prototipo.

**Primo avvio:** c'è una sola Canzone, **«Ma Lei»**, con le Note Do, Lam, Fa, Sol, Mim (tutte Media), i predefiniti del Suono e delle Impostazioni, Accordi, Verticale, Coro.

## 9. Avvio e avvisi

Niente schermata pre-volo. All'avvio i controlli sono silenziosi, e l'avviso rosa (in stile, non una finestra di sistema) compare solo se manca qualcosa:

| Situazione | Cosa fa l'app |
|---|---|
| Permesso Microfono o Camera negato | avviso con un pulsante che apre il pannello giusto di Impostazioni di Sistema |
| Uscita sugli altoparlanti | Ascolto spento + avviso "servono cuffie a filo" |
| Uscita Bluetooth | avviso "l'Ascolto arriva in ritardo" |
| iPhone non trovato | si usa la webcam del Mac + avviso |
| Dispositivo salvato che non c'è più | si usa quello predefinito di macOS + avviso |
| Dispositivo staccato durante l'uso | si applicano le stesse regole al nuovo stato. Una Registrazione in corso continua; se si stacca il microfono, si ferma e salva. |
| Disco sotto 2 GB / sotto 500 MB | §6 |
| Versione nuova disponibile | "C'è una versione nuova ✨" con Aggiorna / Più tardi (§10) |

Le Reazioni di macOS (fuochi d'artificio e simili sui gesti) non si possono spegnere per una sola app: c'è solo un promemoria nella guida.

## 10. Distribuzione e aggiornamenti

Decisi in #8 e confermati in #12. Niente Developer ID.

- **Prima installazione:** Riccardo passa il `.dmg` a Keopees via AirDrop o con un link. Lei lo trascina in Applicazioni, poi Riccardo fa "Apri comunque" in Privacy e sicurezza (serve la password di lei). Si fa **una volta sola**. Come riserva c'è una guida illustrata di 3 passi.
- **Tutto in uno:** il `.dmg` contiene MediaPipe (JS, WASM, modello) e i font, e sul Mac di Keopees non si scarica nient'altro. Niente ffmpeg: l'MP4 esce già da MediaRecorder.
- **Firma:** certificato self-signed con EKU `codeSigning`, creato con `openssl` e importato nel portachiavi. In `tauri.conf.json`: `bundle.macOS.signingIdentity` e `hardenedRuntime: false`. Si firma sempre con lo stesso certificato, così i permessi di Camera e Microfono restano da una versione all'altra.
- **Info.plist:** `NSCameraUsageDescription` e `NSMicrophoneUsageDescription`, in italiano. Senza queste chiavi l'app va in crash.
- **Identificatore:** `com.keopees.live-vocoder`. Non va mai cambiato, perché i permessi dipendono da identificatore + certificato.
- **Aggiornamenti:**
  - si usa `tauri-plugin-updater` con `bundle.createUpdaterArtifacts: true` e una chiave minisign (`tauri signer generate`, `TAURI_SIGNING_PRIVATE_KEY` alla build);
  - `latest.json` ha `darwin-aarch64` → `url` + `signature`;
  - versioni e `latest.json` stanno nelle release del repo principale `MeStakes/Live-Vocoder`, che è **pubblico**;
  - il controllo si fa solo all'avvio: "C'è una versione nuova ✨" → **Aggiorna** (scarica, sostituisce l'app, la riapre) / **Più tardi**. Mai durante una Registrazione.
  - Il file scaricato dall'app non ha quarantena, quindi non serve "Apri comunque" e i permessi non vengono richiesti di nuovo (provato in #12).
  - Se l'aggiornamento fallisce: avviso "non è andato, riprova più tardi", e l'app continua a funzionare.
- **Build:** il `.dmg` si costruisce con `CI=true`, per evitare l'AppleScript sul Finder.
- **Due chiavi da non perdere mai**, con un backup fuori dal Mac di Riccardo:
  - il certificato `.p12`: se si perde, Keopees deve ridare i permessi una volta;
  - la chiave privata dell'updater: se si perde, l'app installata non accetta più aggiornamenti e va reinstallata a mano.
- **`THIRD_PARTY_NOTICES`:** Londopy/gesture-synth (MIT), Pacifico, Amatic SC e Nunito (OFL), MediaPipe (Apache-2.0).

## 11. Test e verifica

**Automatici:**
- `cargo test --release`:
  - i test del prototipo: il Coro sente la nota e la sposta, il Vocoder pareggia il volume e tace senza Voce, il gate taglia il fruscio, il Coro sceglie l'ottava vicina;
  - in più: `near` per accordi e Nota singola, Dettaglio che cambia senza allocare, accordi fermi = Voce pulita, tetto del limitatore;
  - la scelta del nome `vN`, con la cartella vuota, i buchi nella numerazione e il nome rinominato;
  - `canzoni.json` scritto senza lasciarlo a metà e messo da parte se rotto;
  - il tipo d'uscita dei Dispositivi.
- `node --test` (logica JS, dove sta il codice):
  - le note dell'accordo per ogni Tipo, con la 7ª al posto della 5ª, la Pienezza 3/4/5 e la Nota singola;
  - le regole del nome della Canzone e la lettura di `canzoni.json` rotto o vecchio;
  - la scelta del Dispositivo quando sparisce e ricompare;
  - il conto delle dita (0–5, anche a mano ruotata), l'assegnazione delle mani e il debounce.

**A mano sul Mac di prova**, prima della beta:
- schermata identica al prototipo a 1440×820 e a 1280×720;
- una Registrazione di 5 minuti in Verticale con l'iPhone, che si apre in QuickTime con la sincronia giusta;
- Butta e Mostra nel Finder;
- un aggiornamento da una versione a quella dopo.

**In beta sul Mac di Keopees:**
- il Ritardo a orecchio (~40 ms + il Coro);
- il calore nelle sessioni lunghe (8 GB, senza ventola);
- il caricamento su Instagram e TikTok;
- micro-clic dovuti agli orologi dei dispositivi (§2).

## 12. Limiti noti e cosa fare se si presentano

| Limite | Si cambia quando | Con cosa |
|---|---|---|
| Ritardo ~40 ms dal microfono interno | Keopees lo sente | cuffie con microfono sul filo, o interfaccia USB |
| Orologi di ingresso e uscita non allineati | Keopees sente dei clic | ricampionamento adattivo nel ring |
| MP4 frammentato | i social lo rifiutano | remux `+faststart` dopo lo stop |
| Verticale sgranato con la webcam del Mac | — | la guida dice di usare l'iPhone |
| Niente zoom 0,5× | l'inquadratura è stretta | iPhone più lontano o Center Stage |
| Reazioni di macOS | rovinano una Registrazione | promemoria nella guida (non si possono spegnere per una sola app) |

## Fonti

- Ticket: #2 Decisioni di partenza · #3 Verifica fonti · #4 Anatomia di Londopy · #5 Funzionalità must-have v1 · #6 Prova del Ritardo e della camera · #7 Stile grafico · #8 Distribuzione · #9 Audio del vocoder nella Registrazione MP4 · #10 Cosa fa la seconda mano · #11 Interruttore Vocoder sulla voce · #12 Prova dell'aggiornamento · #13 Suono del vocoder · #14 Pannello del Suono.
- Documenti: `CONTEXT.md`, `docs/brand/README.md`, `docs/research/stack-options.md`, `docs/research/londopy-anatomy.md`, `docs/research/gesture-synth-reference.md` (branch `brand-e-ricerca`), `docs/research/audio-registrazione-mp4.md` (branch `research/audio-mp4`).
- Prototipi: `prototype/prova-ritardo`, `prototype/suono-vocoder`, `prototype/prova-aggiornamento`, `prototype/pannello-suono` (a0270c0), `prototype/stile-grafico` (superato da `pannello-suono`).
