# Live Vocoder

App per Mac con cui Keopees registra contenuti video cantando: la sua voce passa da un vocoder le cui note sceglie con i gesti delle mani davanti alla webcam.

## Language

**Voce**:
Il canto di Keopees catturato dal microfono, prima di qualsiasi effetto.
_Avoid_: input, segnale

**Gesto**:
Una posizione o un movimento della mano, letto dalla webcam, che sceglie le note del vocoder.
_Avoid_: comando, controllo

**Modalità**:
Come i gesti suonano il vocoder, scelta da Keopees: **Accordi** (la mano sceglie un accordo) o **Nota singola** (la mano sceglie una nota).
_Avoid_: mode, preset

**Ascolto**:
La voce già trattata dal vocoder che Keopees sente in cuffia, in tempo reale, mentre canta.
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

**Perlina**:
Uno dei 5 accordi (o note) che Keopees prepara prima di cantare: nota, tipo e ottava. Le dita alzate della mano degli accordi (1–5) scelgono quale suona.
_Avoid_: slot, preset, pad

**Intensità**:
Livello da 1 a 5 scelto dalle dita alzate della seconda mano. Con il vocoder acceso è quanto vocoder si sente rispetto alla Voce pulita; spento è il volume degli accordi.
_Avoid_: volume, gain, mix

**Canzone**:
Un brano di Keopees salvato nell'app: il nome, le sue 5 Perline, la Modalità, il Formato e tutte le Impostazioni con cui lo registra. Il nome è il titolo che può comparire nel video accanto all'accordo.
_Avoid_: preset, set, progetto

**Impostazioni**:
Le scelte di una Canzone raccolte dietro un unico pulsante: vocoder, titolo nel video, filtro, specchio, conto alla rovescia, mano degli accordi. Fa eccezione la cartella delle Registrazioni, che vale per tutte le Canzoni.
_Avoid_: preferenze, opzioni, settings
