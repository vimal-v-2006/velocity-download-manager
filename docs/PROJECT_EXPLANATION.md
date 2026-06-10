# Project Explanation

## Architecture

Velocity has two layers:

1. **Electron main process**
   - Starts `aria2c` locally with JSON-RPC enabled on localhost only.
   - Generates a random RPC secret every launch.
   - Exposes safe IPC commands: add, pause, resume, remove, status, choose folder, open path.

2. **React renderer**
   - Renders the animated dashboard.
   - Polls status once per second.
   - Displays speed, ETA, progress and queue state.
   - Sends user actions through the preload bridge only.

## Security model

The renderer does not receive Node.js access. Electron uses:

- `nodeIntegration: false`
- `contextIsolation: true`
- a small preload API exposed as `window.velocity`

aria2 RPC listens only on `127.0.0.1` with a random token, not on the network.

## Speed model

aria2 uses HTTP range requests and multiple connections. The app passes options:

- `split=16`
- `max-connection-per-server=16`
- `continue=true`
- `min-split-size=1M`

This gives fast segmented downloads where servers support it.

## Why Electron for v0.1

Rust/Tauri would be smaller, but this machine currently has Node and aria2 ready while Rust is not installed. Electron lets the first end product be built and tested quickly. The architecture can later be moved to Tauri/Rust while keeping the same UI and aria2 engine approach.

## Future native direction

A future v1 can replace Electron with Tauri and Rust while keeping:

- React UI
- aria2 engine or a native Rust segmented downloader
- same docs and user workflow
