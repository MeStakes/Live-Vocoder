#!/bin/sh
# Scarica una volta, a versioni fissate, quello che finisce dentro l'app: MediaPipe, il modello delle mani, i font.
# Sul Mac di Keopees non si scarica niente: va tutto nel .dmg (spec §10).
set -e
cd "$(dirname "$0")/.."
V=src/vendor
[ -f "$V/.fatto-0.10.35" ] && exit 0
rm -rf "$V" && mkdir -p "$V/mediapipe" "$V/fonts"
T=$(mktemp -d)
curl -fsSL https://registry.npmjs.org/@mediapipe/tasks-vision/-/tasks-vision-0.10.35.tgz | tar xz -C "$T"
cp "$T/package/vision_bundle.mjs" "$V/mediapipe/vision_bundle.js"
cp -R "$T/package/wasm" "$V/mediapipe/wasm"
curl -fsSL -o "$V/hand_landmarker.task" https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task
G=https://github.com/google/fonts/raw/main/ofl
curl -fsSL -o "$V/fonts/AmaticSC-Bold.ttf" "$G/amaticsc/AmaticSC-Bold.ttf"
curl -fsSL -o "$V/fonts/OFL-AmaticSC.txt" "$G/amaticsc/OFL.txt"
curl -fsSL -o "$V/fonts/Nunito.ttf" "$G/nunito/Nunito%5Bwght%5D.ttf"
curl -fsSL -o "$V/fonts/OFL-Nunito.txt" "$G/nunito/OFL.txt"
cp docs/brand/Pacifico-Regular.ttf docs/brand/OFL-Pacifico.txt "$V/fonts/"
rm -rf "$T"
touch "$V/.fatto-0.10.35"
