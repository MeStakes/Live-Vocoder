# Stile grafico (deciso)

Approvato da Riccardo il 2026-10-11. Stile girly rosa/viola: Keopees è fan di Taylor Swift, ma nell'app non vanno nome, loghi o testi di Taylor, solo i motivi (perline dei braccialetti dell'amicizia, glitter, cuori).

## Schermata: variante Poster

Prototipo: https://claude.ai/artifact/BW8gzdaKt6Nvr8xigGaAu3 (sorgente sul branch `prototype/stile-grafico`).

- A sinistra: titolo grande, icona "by Keopees", ruota-braccialetto con le 5 perline (1–5 dita). Perline viola, quella che suona rosa.
- Tocca una perlina: si apre il pannello Nota / Tipo (Maggiore, Minore, Settima, Sus4) / Ottava (Bassa, Media, Alta), poi Fatto.
- Sotto la ruota, in riga: Vocoder sulla voce, Titolo (+ casella, nel video "Fa – Ma Lei"), Filtro rosa, Specchio, Conto alla rovescia 3 s, Accordi con la mano Sinistra/Destra.
- A destra: video dritto in una polaroid, sotto Modalità, Formato e Registra.
- Nel video: mani a perline (cuori sulle dita alzate), glitter, onda degli accordi, nome accordo + titolo, colonna di 5 perline per l'intensità della seconda mano. Il Filtro rosa toglie solo il colore dello sfondo.

Riferimento: `reference-ma-lei.png` (copertina "Ma Lei" by Keopees).

## Font

- **Pacifico** (`Pacifico-Regular.ttf`, licenza OFL in `OFL-Pacifico.txt`): il gratuito più vicino allo script retrò della copertina. Va usato per titoli e icona, non per i testi piccoli.
- Lo stile "Ma Lei" si ottiene con lettera piena, estrusione crema in basso a destra e ombra prugna morbida (vedi `make_icon.py`).
- L'originale sembra un font commerciale: se Keopees ha il file, si sostituisce.

## Palette

| Token | Hex | Uso |
|---|---|---|
| `--rosa` | `#FF4F9A` | pulsante Registra, azioni principali |
| `--rosa-chiaro` | `#FF8FC4` | hover, sfumature |
| `--confetto` | `#FFD3E7` | testo secondario su scuro |
| `--viola` | `#6B2BD9` | selezione, accordo attivo, lettere dei titoli |
| `--prugna` | `#2B1145` | sfondo dell'app |
| `--crema` | `#FFF0D9` | testo principale, estrusione dei titoli |

## Overlay (finiscono nella Registrazione)

- Mani: scheletro in `--crema`, articolazioni `--viola`, alone `--rosa`.
- Forma d'onda degli accordi: sfumatura `--rosa` → `--viola`.

## Icona

`icon-1024.png` e `AppIcon.icns`, generate da `make_icon.py` (serve Pillow). Per cambiare colori basta modificare le costanti in cima e rilanciare lo script.
