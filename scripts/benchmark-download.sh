#!/usr/bin/env bash
set -euo pipefail
URL="${1:-}"
if [ -z "$URL" ]; then
  echo "Usage: scripts/benchmark-download.sh <direct-download-url>"
  echo "Example: scripts/benchmark-download.sh https://speed.hetzner.de/100MB.bin"
  exit 1
fi
TMPDIR="$(mktemp -d)"
cleanup() { rm -rf "$TMPDIR"; }
trap cleanup EXIT

echo "Benchmark URL: $URL"
echo "Output temp dir: $TMPDIR"

echo
echo "1) Single connection baseline"
/usr/bin/time -f 'single_connection_seconds=%e' aria2c --allow-overwrite=true --file-allocation=none --split=1 --max-connection-per-server=1 --dir="$TMPDIR" --out=single.bin "$URL"
rm -f "$TMPDIR/single.bin"

echo
echo "2) Velocity Fastest Mode profile: split=16 connections=16"
/usr/bin/time -f 'velocity_fastest_mode_seconds=%e' aria2c --allow-overwrite=true --file-allocation=none --split=16 --max-connection-per-server=16 --min-split-size=1M --dir="$TMPDIR" --out=fastest.bin "$URL"

echo
echo "Benchmark complete. Use real numbers before making 'fastest' claims."
