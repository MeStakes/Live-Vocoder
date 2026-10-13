# Live Vocoder

App per Mac con cui Keopees registra contenuti video cantando: la sua voce passa da un Effetto le cui Note sceglie con i gesti delle mani davanti alla webcam.

## Language

**Voce**:
Il canto di Keopees catturato dal microfono, prima di qualsiasi effetto.
_Avoid_: input, segnale

**Gesto**:
Una posizione o un movimento della mano, letto dalla webcam, che sceglie quale Nota suona o l'Intensità.
_Avoid_: comando, controllo

**Modalità**:
Come i gesti suonano l'Effetto, scelta da Keopees: **Accordi** (ogni Nota suona come accordo) o **Nota singola** (ogni Nota suona da sola).
_Avoid_: mode, preset

**Effetto**:
Cosa succede alla Voce, scelto da Keopees per ogni Canzone: **Coro** (predefinito), **Vocoder** o **Spento**. Con Spento gli accordi suonano da soli, come una tastiera, sopra la Voce pulita.
_Avoid_: filtro (è quello del video), modalità, preset

**Coro**:
L'Effetto che copia la Voce sull'accordo della Nota che suona: si sente un coro fatto della sua stessa voce.
_Avoid_: harmonizer, armonizzatore, seconde voci

**Vocoder**:
L'Effetto in cui la Voce dà la forma a un accordo di synth, che canta le sue parole.
_Avoid_: voce robot

**Ascolto**:
La voce già trattata dall'Effetto che Keopees sente in cuffia, in tempo reale, mentre canta.
_Avoid_: monitor, preascolto

**Ritardo**:
Il tempo tra quando Keopees canta e quando sente l'Ascolto in cuffia. Deve essere impercettibile.
_Avoid_: latenza, delay, lag

**Registrazione**:
Un file video con audio trattato, girato dentro l'app. Finisce nella cartella delle Registrazioni scelta da Keopees, in una sottocartella per ogni Canzone, numerato senza mai sovrascrivere ("Ma Lei v1", "Ma Lei v2"…).
_Avoid_: take, clip, export

**Formato**:
L'orientamento della registrazione: Verticale (per i social) o Orizzontale.
_Avoid_: aspect ratio, risoluzione

**Nota**:
Una delle 5 note o accordi che Keopees prepara per ogni Canzone: Base, tipo (Maggiore, Minore, Settima, Maj7, Sus4) e ottava. Le dita alzate della mano degli accordi (1–5) scelgono quale suona.
_Avoid_: perlina, slot, preset, pad

**Base**:
Il nome musicale da cui parte una Nota, da Do a Si: in "Lam" la Base è La.
_Avoid_: tonica, fondamentale, root, base musicale (è la musica di sottofondo, fuori dall'app)

**Intensità**:
Livello da 1 a 5 scelto dalle dita alzate della seconda mano. Con il Coro o il Vocoder è quanto Effetto si sente rispetto alla Voce pulita; con l'Effetto Spento è il volume degli accordi.
_Avoid_: volume, gain, mix

**Suono**:
Le regolazioni di come suona l'Effetto, salvate nella Canzone: Intensità con 1 e con 5 dita, pienezza, scivolata, timbro, dettaglio, morbidezza, consonanti chiare, anti-fruscio, volume in cuffia.
_Avoid_: preset, parametri, sound design

**Pienezza**:
Quante note suonano insieme in ogni accordo: 3 (leggero), 4 (col basso) o 5 (pieno).
_Avoid_: voci, note dell'accordo, polifonia

**Canzone**:
Un brano di Keopees salvato nell'app: il nome, le sue 5 Note, la Modalità, il Formato, l'Effetto, il Suono e le Impostazioni con cui lo registra. Il nome è il titolo che può comparire nel video accanto all'accordo.
_Avoid_: preset, set, progetto

**Impostazioni**:
Le scelte di una Canzone raccolte dietro un unico pulsante: accordo nel video, titolo nel video, filtro, specchio, conto alla rovescia, mano degli accordi. Effetto, Suono e Dispositivi non ne fanno parte. Fa eccezione la cartella delle Registrazioni, che vale per tutte le Canzoni.
_Avoid_: preferenze, opzioni, settings

**Dispositivi**:
L'Ingresso audio (il microfono in cui canta), l'Uscita audio (dove sente l'Ascolto) e la Camera del video, scelti da Keopees. Valgono per tutte le Canzoni, come la cartella delle Registrazioni.
_Avoid_: periferiche, device, hardware, sorgenti
