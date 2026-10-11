#!/bin/sh
# PROTOTIPO usa e getta, ticket #12: costruisce v0.1.0 (.dmg da installare) e v0.2.0 (aggiornamento),
# poi li serve su http://localhost:8765 finché non premi Ctrl+C.
# Serve il certificato "Live Vocoder Prova" nel portachiavi (vedi README.md).
set -e
cd "$(dirname "$0")"
export CI=true # il .dmg senza AppleScript sul Finder
[ -f chiave-updater.key ] || npx tauri signer generate --ci -p "" -w chiave-updater.key
export TAURI_SIGNING_PRIVATE_KEY="$(cat chiave-updater.key)" TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""
PUB="$(cat chiave-updater.key.pub)"
B=src-tauri/target/release/bundle
build() { npx tauri build --bundles "$2" --config "{\"version\":\"$1\",\"plugins\":{\"updater\":{\"pubkey\":\"$PUB\"}}}"; }
rm -rf servi && mkdir servi
build 0.1.0 dmg
cp $B/dmg/*_0.1.0_*.dmg servi/ProvaAggiornamento-0.1.0.dmg
build 0.2.0 app
cp "$B/macos/Prova Aggiornamento.app.tar.gz" servi/v0.2.0.app.tar.gz
cat > servi/latest.json <<JSON
{ "version": "0.2.0",
  "platforms": { "darwin-aarch64": { "url": "http://localhost:8765/v0.2.0.app.tar.gz",
    "signature": "$(cat "$B/macos/Prova Aggiornamento.app.tar.gz.sig")" } } }
JSON
echo "Pronto: con Safari scarica http://localhost:8765/ProvaAggiornamento-0.1.0.dmg"
python3 -m http.server 8765 -d servi
