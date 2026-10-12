#!/bin/sh
# Costruisce Live Vocoder.app firmata e la apre, per provare le modifiche sul Mac di Riccardo.
set -e
cd "$(dirname "$0")/.."
sh scripts/vendor.sh
K="$HOME/.live-vocoder/chiave-updater.key"
[ -f "$K" ] && export TAURI_SIGNING_PRIVATE_KEY="$(cat "$K")" TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""
npx tauri build --bundles app
open "src-tauri/target/release/bundle/macos/Live Vocoder.app"
