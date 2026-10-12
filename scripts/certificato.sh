#!/bin/sh
# Una volta sola, sul Mac di Riccardo: il certificato self-signed che firma Live Vocoder (#12) e la chiave degli aggiornamenti.
# Tutta la cartella ~/.live-vocoder e la password vanno nel backup (docs/rilascio.md). Mai nel repo.
set -e
cd "$(dirname "$0")/.."
D="$HOME/.live-vocoder"
mkdir -p "$D"
[ -f "$D/certificato.p12" ] && { echo "C'è già $D/certificato.p12: non lo rifaccio."; exit 1; }
printf "Password nuova per il certificato: "; stty -echo; read -r P; stty echo; echo
openssl req -x509 -newkey rsa:2048 -keyout "$D/k.pem" -out "$D/c.pem" -days 3650 -nodes -subj "/CN=Live Vocoder" \
  -addext "basicConstraints=critical,CA:false" -addext "keyUsage=critical,digitalSignature" -addext "extendedKeyUsage=critical,codeSigning"
openssl pkcs12 -export -legacy -inkey "$D/k.pem" -in "$D/c.pem" -out "$D/certificato.p12" -passout "pass:$P"
rm "$D/k.pem" "$D/c.pem"
security import "$D/certificato.p12" -k ~/Library/Keychains/login.keychain-db -P "$P" -T /usr/bin/codesign
[ -f "$D/chiave-updater.key" ] || npx tauri signer generate --ci -p "" -w "$D/chiave-updater.key"
echo "Fatto. Metti nel backup la cartella $D e la password del certificato."
