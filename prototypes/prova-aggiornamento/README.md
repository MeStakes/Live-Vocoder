# Prova Aggiornamento (PROTOTIPO usa e getta)

Ticket: [Prova dell'aggiornamento senza firma Apple](https://github.com/MeStakes/Live-Vocoder/issues/12).

Domanda: un'app Tauri firmata self-signed, aggiornata da `tauri-plugin-updater`, si riapre **senza** "Apri comunque" e **senza** richiedere di nuovo Camera e Microfono?

## Una volta sola: il certificato self-signed

```sh
openssl req -x509 -newkey rsa:2048 -keyout k.pem -out c.pem -days 3650 -nodes -subj "/CN=Live Vocoder Prova" \
  -addext "basicConstraints=critical,CA:false" -addext "keyUsage=critical,digitalSignature" -addext "extendedKeyUsage=critical,codeSigning"
openssl pkcs12 -export -legacy -inkey k.pem -in c.pem -out c.p12 -passout pass:prova
security import c.p12 -k ~/Library/Keychains/login.keychain-db -P prova -T /usr/bin/codesign
```

Al primo `codesign` macOS chiede la password: "Consenti sempre".
Per toglierlo dopo la prova: Accesso Portachiavi → "Live Vocoder Prova" → elimina.

## La prova

1. `npm i && npm run prova`: costruisce v0.1.0 e v0.2.0 e le serve su `localhost:8765` (Ctrl+C per spegnere).
2. Con **Safari** scarica http://localhost:8765/ProvaAggiornamento-0.1.0.dmg (così ha la quarantena, come per Keopees).
3. Apri il `.dmg`, trascina l'app in **Applicazioni**, aprila da lì.
4. Bloccata → Impostazioni di Sistema → Privacy e sicurezza → **Apri comunque**.
5. Consenti **Camera** e **Microfono**. Nel riquadro: `quarantena:` piena, Camera ok, Microfono ok.
6. Premi **Aggiorna**. L'app si chiude e si riapre.
7. Guarda: "Versione 0.2.0"? Nessun "Apri comunque"? Nessuna richiesta Camera/Microfono? Nessun avviso "ha impedito di modificare le app"? `quarantena:` vuota?
8. Chiudi e riapri l'app da Applicazioni: ancora nessuna richiesta?

Ripetere da capo: cestina l'app, `tccutil reset All com.mestakes.prova-aggiornamento`.
