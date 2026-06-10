# Benchmarking Velocity

Velocity is built to chase fastest-class Linux download performance through aria2 segmented downloads. Do not make a factual "fastest in the world" claim without benchmark evidence.

## Run a local benchmark

Use a direct public test file URL:

```bash
scripts/benchmark-download.sh https://speed.hetzner.de/100MB.bin
```

The script compares:

1. Single connection aria2 download
2. Velocity Fastest Mode profile: `split=16`, `max-connection-per-server=16`, `min-split-size=1M`

## Fair benchmark rules

- Use the same URL and same network.
- Clear downloaded file between runs.
- Test at least 3 times.
- Compare against known apps: browser, XDM, Persepolis, uGet, Motrix, aria2 CLI.
- Record CPU/RAM as well as download time.
- Mention when the server blocks or throttles multi-connection downloads.

## Safe marketing language before proof

Use:

- "Built to be the fastest Linux download manager."
- "Fastest Mode segmented downloads."
- "World-class Linux download speed powered by aria2."

Avoid until proven:

- "The fastest download manager in the world."
- "Always faster than every other manager."
