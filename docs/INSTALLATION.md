# Velocity Installation Guide

## Ubuntu / Debian

```bash
sudo apt update
sudo apt install -y aria2
```

Or use the included helper:

```bash
scripts/install-linux-deps.sh
```

Download the latest `.AppImage` or `.deb` from releases.

### AppImage

```bash
chmod +x "Velocity Download Manager-0.1.0.AppImage"
./"Velocity Download Manager-0.1.0.AppImage"
```

### deb

```bash
sudo apt install ./velocity-download-manager_0.1.0_amd64.deb
```

## Arch Linux

```bash
sudo pacman -S aria2
```

Then run the AppImage.

## Fedora

```bash
sudo dnf install aria2
```

Then run the AppImage.

## Windows/macOS notes

Velocity is built with Electron, so the UI is cross-platform. For Windows/macOS, install aria2 and make sure `aria2c` is available in PATH, then run from source or build a platform package.

## Developer setup

```bash
git clone https://github.com/vimal-v-2006/velocity-download-manager.git
cd velocity-download-manager
npm install
npm run dev
```

## Build Linux package

```bash
npm test
npm run build
npm run dist:linux
```
