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
