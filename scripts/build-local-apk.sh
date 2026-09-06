#!/usr/bin/env bash
# Compila un APK localmente vía `eas build --local` (sin usar la cola cloud
# de EAS) y lo nombra con la versión actual de package.json, para poder
# instalar builds sucesivas en un emulador sin pisar el nombre del archivo
# anterior. Uso: scripts/build-local-apk.sh <preview|production>
set -euo pipefail

PROFILE="$1"
VERSION=$(node -p "require('./package.json').version")
OUTPUT_DIR="./builds"
OUTPUT="${OUTPUT_DIR}/paceron-${PROFILE}-v${VERSION}.apk"

mkdir -p "$OUTPUT_DIR"
npx eas-cli build --platform android --profile "$PROFILE" --local --output "$OUTPUT"

echo "APK generado en $OUTPUT"
