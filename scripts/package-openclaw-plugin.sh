#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PLUGIN_DIR="$ROOT_DIR/packages/openclaw-flowmail"
ARTIFACTS_DIR="$ROOT_DIR/artifacts"
TMP_DIR="$(mktemp -d)"
NPM_CACHE_DIR="$ROOT_DIR/.tmp/npm-cache"

mkdir -p "$ARTIFACTS_DIR"
mkdir -p "$NPM_CACHE_DIR"

pushd "$PLUGIN_DIR" >/dev/null
npm_config_cache="$NPM_CACHE_DIR" npm pack --pack-destination "$TMP_DIR" >/dev/null
ZIP_PATH="$ARTIFACTS_DIR/openclaw-flowmail-plugin.zip"
rm -f "$ZIP_PATH"
zip -qr "$ZIP_PATH" package.json openclaw.plugin.json README.md skills src tsconfig.json
popd >/dev/null

TGZ_SOURCE="$(find "$TMP_DIR" -maxdepth 1 -type f -name '*.tgz' | head -n 1)"
if [[ -z "$TGZ_SOURCE" ]]; then
  echo "Failed to create npm pack tarball" >&2
  exit 1
fi

TGZ_TARGET="$ARTIFACTS_DIR/$(basename "$TGZ_SOURCE")"
mv "$TGZ_SOURCE" "$TGZ_TARGET"
rm -rf "$TMP_DIR"

echo "Created $TGZ_TARGET"
echo "Created $ZIP_PATH"
