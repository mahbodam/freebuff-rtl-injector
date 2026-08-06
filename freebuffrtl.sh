#!/usr/bin/env bash
# Freebuff RTL Injector — one-click "patch + launch"
#
# Freebuff checks for updates and can silently replace app.asar every time
# it starts, which wipes the RTL hook. Use THIS script instead of opening
# Freebuff directly: it re-patches first (instant no-op if nothing
# changed) and then opens Freebuff for you.
#
# Tip: point your Dock/desktop shortcut at this script instead of
# Freebuff's own binary so you never have to think about it again.

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

node scripts/patch-asar.mjs --launch "$@"

