# Stile grafico (proposta per #7)

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
