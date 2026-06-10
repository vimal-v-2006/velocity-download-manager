# Velocity User Manual

## Add a download

1. Copy a download URL.
2. Paste it into the **Add high-speed download** box.
3. Choose a folder or leave it blank to use `~/Downloads`.
4. Select split count. Use 16 for maximum speed, 4-8 for strict servers.
5. Press **Start**.

## Pause and resume

Use **Pause** to pause an active download. Use **Resume** to continue it. aria2 keeps partial data and continues when possible.

## Remove

Use **Remove** to remove a running or completed item from the queue/list.

## Open file

When aria2 reports a file path, use **Open** to ask the operating system to open it.

## Best speed tips

- Use Ethernet or strong Wi-Fi.
- Use split count 16 for public files like Linux ISOs.
- Use lower split count if a website blocks too many connections.
- Keep downloads on an SSD if possible.
- Do not expect segmented downloading to bypass server-side speed limits.

## Strict hosts / failed downloads

Some hosts block aggressive multi-connection downloads. If a download fails, stays at `0 B / 0 B`, or shows a TLS/connection error, set the split slider to **1 split** and retry.

Example: Pixeldrain may reject 16-split aria2 downloads. Use 1 split for that kind of host.

## Troubleshooting

### App says aria2 did not start

Install aria2:

```bash
sudo apt install aria2
```

Then restart Velocity.

### Download does not start

Check that the URL is direct and accessible. Some websites require cookies or browser headers; browser integration is planned.

### Speed is not higher than browser

The remote server may limit speed or connections. Try a lower/higher split count or another URL.
