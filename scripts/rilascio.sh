#!/bin/sh
# Costruisce una versione di Live Vocoder e la pubblica su MeStakes/live-vocoder-releases (spec §10).
# Uso: sh scripts/rilascio.sh 0.1.0   (serve la cartella ~/.live-vocoder di scripts/certificato.sh)
set -e
V="$1"
[ -n "$V" ] || { echo "Uso: sh scripts/rilascio.sh 0.1.0"; exit 1; }
cd "$(dirname "$0")/.."
D="$HOME/.live-vocoder"
export CI=true # il .dmg senza AppleScript sul Finder (#12)
export TAURI_SIGNING_PRIVATE_KEY="$(cat "$D/chiave-updater.key")" TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""
sh scripts/vendor.sh
npm test
npx tauri build --bundles app,dmg --config "{\"version\":\"$V\"}"
B=src-tauri/target/release/bundle
O="dist/$V"
rm -rf "$O" && mkdir -p "$O"
cp "$B"/dmg/*_"$V"_*.dmg "$O/LiveVocoder-$V.dmg"
cp "$B/macos/Live Vocoder.app.tar.gz" "$O/LiveVocoder-$V.app.tar.gz"
U="https://github.com/MeStakes/live-vocoder-releases/releases/download/v$V"
cat > "$O/latest.json" <<JSON
{ "version": "$V", "pub_date": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "platforms": { "darwin-aarch64": { "url": "$U/LiveVocoder-$V.app.tar.gz",
    "signature": "$(cat "$B/macos/Live Vocoder.app.tar.gz.sig")" } } }
JSON
gh release create "v$V" "$O"/* -R MeStakes/live-vocoder-releases -t "Live Vocoder $V" -n "Versione $V"
echo "Pubblicata. Link per la prima installazione: $U/LiveVocoder-$V.dmg"
