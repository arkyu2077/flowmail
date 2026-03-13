#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_DIR="$ROOT_DIR/openclaw"
ARTIFACTS_DIR="$ROOT_DIR/artifacts"
OUTPUT_DIR="$ARTIFACTS_DIR/clawhub-skill"
ZIP_PATH="$ARTIFACTS_DIR/flowmail-skill.zip"

mkdir -p "$ARTIFACTS_DIR"
mkdir -p "$OUTPUT_DIR"
rm -f "$ZIP_PATH"
cp "$SOURCE_DIR/SKILL.md" "$OUTPUT_DIR/SKILL.md"
cp "$SOURCE_DIR/_meta.json" "$OUTPUT_DIR/_meta.json"
cp "$SOURCE_DIR/README.md" "$OUTPUT_DIR/README.md"

(
  cd "$OUTPUT_DIR"
  zip -q -r "$ZIP_PATH" SKILL.md _meta.json README.md
)

printf 'Created %s\n' "$ZIP_PATH"
