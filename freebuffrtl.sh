#!/usr/bin/env bash
# Freebuff RTL Injector — macOS / Linux patcher
# Run this any time after Freebuff updates:
#   ./freebuffrtl.sh
# (On macOS you may need: chmod +x freebuffrtl.sh   — once, the first time)

set -e
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "[ERROR] Node.js not found in PATH."
  echo "Install it from https://nodejs.org and try again."
  exit 1
fi

if [ ! -f "scripts/patch-asar.mjs" ]; then
  echo "[ERROR] scripts/patch-asar.mjs not found."
  echo "Make sure this script sits inside the freebuff-rtl-injector folder,"
  echo "next to the 'scripts' subfolder."
  exit 1
fi

echo "Patching Freebuff for RTL support..."
echo ""
node scripts/patch-asar.mjs "$@"

echo ""
echo "Done. (Re)start Freebuff."
