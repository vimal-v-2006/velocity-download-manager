#!/usr/bin/env bash
set -euo pipefail
if command -v apt >/dev/null 2>&1; then
  sudo apt update
  sudo apt install -y aria2
elif command -v pacman >/dev/null 2>&1; then
  sudo pacman -S --needed aria2
elif command -v dnf >/dev/null 2>&1; then
  sudo dnf install -y aria2
else
  echo "Install aria2 with your distro package manager, then run Velocity."
  exit 1
fi
aria2c --version | head -n 2
echo "Linux dependency setup complete."
