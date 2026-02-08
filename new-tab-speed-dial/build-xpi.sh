#!/usr/bin/env bash
set -euo pipefail

SRC_DIR="${1:-new_tab_speed_dial-4.0.0-firefox}"

if [[ ! -d "$SRC_DIR" ]]; then
  echo "Source directory not found: $SRC_DIR" >&2
  exit 1
fi

MANIFEST="$SRC_DIR/manifest.json"
if [[ ! -f "$MANIFEST" ]]; then
  echo "manifest.json not found in: $SRC_DIR" >&2
  exit 1
fi

VERSION=$(python - <<'PY'
import json
import sys

with open(sys.argv[1], "r", encoding="utf-8") as f:
    data = json.load(f)

print(data.get("version", "0.0.0"))
PY
"$MANIFEST")

OUT_DIR="dist"
OUT_FILE="$OUT_DIR/new_tab_speed_dial-${VERSION}-firefox.xpi"

mkdir -p "$OUT_DIR"
rm -f "$OUT_FILE"

(
  cd "$SRC_DIR"
  zip -r -9 "../$OUT_FILE" . -x "**/.DS_Store" "**/__MACOSX" "**/*.map"
)

echo "Created $OUT_FILE"
