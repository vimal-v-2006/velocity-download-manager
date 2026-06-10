const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { buildDownloadOptions, isPixeldrainUrl } = require('./download-options.cjs');

const isDev = process.env.NODE_ENV === 'development' || process.env.VITE_DEV_SERVER_URL;
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
let mainWindow;
let ariaProcess;
const nativeDownloads = new Map();
const rpcPort = 16800 + Math.floor(Math.random() * 1200);
const rpcSecret = crypto.randomBytes(18).toString('hex');
const sessionDir = () => path.join(app.getPath('userData'), 'aria2');
const sessionFile = () => path.join(sessionDir(), 'session.txt');
const defaultDownloadDir = () => path.join(os.homedir(), 'Downloads');

function ensureAriaFiles() {
  fs.mkdirSync(sessionDir(), { recursive: true });
  if (!fs.existsSync(sessionFile())) fs.writeFileSync(sessionFile(), '');
}

function startAria2() {
  ensureAriaFiles();
  const args = [
    '--enable-rpc=true', `--rpc-listen-port=${rpcPort}`, '--rpc-listen-all=false', `--rpc-secret=${rpcSecret}`,
    '--continue=true', '--max-connection-per-server=16', '--split=16', '--min-split-size=1M', '--max-concurrent-downloads=8',
    '--file-allocation=none', '--summary-interval=1', '--auto-file-renaming=true', '--allow-overwrite=false',
    `--dir=${defaultDownloadDir()}`, `--input-file=${sessionFile()}`, `--save-session=${sessionFile()}`, '--save-session-interval=10'
  ];
  ariaProcess = spawn('aria2c', args, { stdio: ['ignore', 'pipe', 'pipe'] });
  ariaProcess.stdout.on('data', (d) => console.log(`[aria2] ${d}`));
  ariaProcess.stderr.on('data', (d) => console.error(`[aria2] ${d}`));
  ariaProcess.on('exit', (code) => console.log(`aria2 exited ${code}`));
}

async function rpc(method, params = []) {
  const res = await fetch(`http://127.0.0.1:${rpcPort}/jsonrpc`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now().toString(), method: `aria2.${method}`, params: [`token:${rpcSecret}`, ...params] })
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.result;
}

async function waitForAria2() {
  for (let i = 0; i < 40; i++) {
    try { await rpc('getVersion'); return true; } catch { await new Promise((r) => setTimeout(r, 150)); }
  }
  throw new Error('aria2c did not start. Install aria2 first.');
}

function sanitizeFileName(name) {
  return (name || 'download.bin').replace(/[\\/:*?"<>|]/g, '_').slice(0, 180);
}

function contentDispositionFileName(header) {
  if (!header) return null;
  const utf = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf) return decodeURIComponent(utf[1].replace(/"/g, ''));
  const ascii = header.match(/filename="?([^";]+)"?/i);
  return ascii ? ascii[1] : null;
}

async function probeUrlMetadata(url) {
  try {
    const res = await fetch(url, { headers: { Range: 'bytes=0-0' } });
    const disposition = res.headers.get('content-disposition');
    const range = res.headers.get('content-range');
    const rangeTotal = range?.match(/\/(\d+)$/)?.[1];
    return {
      fileName: sanitizeFileName(contentDispositionFileName(disposition) || path.basename(new URL(url).pathname) || 'download.bin'),
      totalLength: rangeTotal || res.headers.get('content-length') || '0',
    };
  } catch {
    return { fileName: sanitizeFileName(path.basename(new URL(url).pathname) || 'download.bin'), totalLength: '0' };
  }
}

async function startCurlDownload(payload) {
  const dir = payload.dir || defaultDownloadDir();
  fs.mkdirSync(dir, { recursive: true });
  const meta = await probeUrlMetadata(payload.url);
  const gid = `curl-${crypto.randomBytes(8).toString('hex')}`;
  const filePath = path.join(dir, meta.fileName || `${gid}.bin`);
  const item = {
    gid,
    url: payload.url,
    status: 'active',
    totalLength: meta.totalLength || '0',
    completedLength: '0',
    downloadSpeed: '0',
    connections: '1',
    files: [{ path: filePath, length: meta.totalLength || '0', completedLength: '0' }],
    dir,
    errorMessage: '',
    process: null,
    lastBytes: 0,
    lastChecked: Date.now(),
  };
  nativeDownloads.set(gid, item);
  launchCurlProcess(item);
  return gid;
}

function launchCurlProcess(item) {
  item.status = 'active';
  item.errorMessage = '';
  const child = spawn('curl', ['-L', '--fail', '--continue-at', '-', '--output', item.files[0].path, item.url], { stdio: ['ignore', 'ignore', 'pipe'] });
  item.process = child;
  let stderr = '';
  child.stderr.on('data', (data) => { stderr += data.toString(); stderr = stderr.slice(-1200); });
  child.on('exit', (code, signal) => {
    updateNativeProgress(item);
    item.process = null;
    if (item.status === 'paused' || item.status === 'removed') return;
    if (code === 0) {
      item.status = 'complete';
      item.downloadSpeed = '0';
    } else if (signal === 'SIGTERM') {
      item.status = 'paused';
      item.downloadSpeed = '0';
    } else {
      item.status = 'error';
      item.downloadSpeed = '0';
      item.errorMessage = stderr.trim() || `curl exited with code ${code}`;
    }
  });
}

function updateNativeProgress(item) {
  let size = 0;
  try { size = fs.statSync(item.files[0].path).size; } catch {}
  const now = Date.now();
  const seconds = Math.max((now - item.lastChecked) / 1000, 0.001);
  const speed = item.status === 'active' ? Math.max(0, Math.round((size - item.lastBytes) / seconds)) : 0;
  item.completedLength = String(size);
  item.downloadSpeed = String(speed);
  item.files[0].completedLength = String(size);
  item.lastBytes = size;
  item.lastChecked = now;
}

function nativeSnapshotItems() {
  for (const item of nativeDownloads.values()) updateNativeProgress(item);
  return Array.from(nativeDownloads.values()).map((item) => {
    const publicItem = { ...item };
    delete publicItem.process;
    delete publicItem.lastBytes;
    delete publicItem.lastChecked;
    delete publicItem.url;
    return publicItem;
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1260, height: 820, minWidth: 980, minHeight: 680,
    title: 'Velocity Download Manager', backgroundColor: '#070A12',
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true }
  });
  if (isDev) mainWindow.loadURL('http://127.0.0.1:5173');
  else mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
}

app.whenReady().then(async () => { startAria2(); await waitForAria2(); createWindow(); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', async () => {
  try { await rpc('saveSession'); } catch {}
  for (const item of nativeDownloads.values()) if (item.process) item.process.kill();
  if (ariaProcess) ariaProcess.kill();
});

ipcMain.handle('velocity:add', async (_e, payload) => {
  if (isPixeldrainUrl(payload.url)) return startCurlDownload(payload);
  const opts = buildDownloadOptions(payload, defaultDownloadDir());
  return rpc('addUri', [[payload.url], opts]);
});
ipcMain.handle('velocity:pause', async (_e, gid) => {
  const native = nativeDownloads.get(gid);
  if (native) { native.status = 'paused'; if (native.process) native.process.kill(); return gid; }
  return rpc('pause', [gid]);
});
ipcMain.handle('velocity:resume', async (_e, gid) => {
  const native = nativeDownloads.get(gid);
  if (native) { if (!native.process && native.status !== 'complete') launchCurlProcess(native); return gid; }
  return rpc('unpause', [gid]);
});
ipcMain.handle('velocity:remove', async (_e, gid) => {
  const native = nativeDownloads.get(gid);
  if (native) { native.status = 'removed'; if (native.process) native.process.kill(); nativeDownloads.delete(gid); return gid; }
  return rpc('remove', [gid]).catch(() => rpc('removeDownloadResult', [gid]));
});
ipcMain.handle('velocity:status', async () => {
  const keys = ['gid','status','totalLength','completedLength','downloadSpeed','uploadSpeed','connections','numSeeders','files','errorMessage','dir','bittorrent'];
  const [active, waiting, stopped, globalStat, version] = await Promise.all([
    rpc('tellActive', [keys]), rpc('tellWaiting', [0, 100, keys]), rpc('tellStopped', [0, 100, keys]), rpc('getGlobalStat'), rpc('getVersion')
  ]);
  const nativeItems = nativeSnapshotItems();
  const nativeActive = nativeItems.filter((item) => item.status === 'active');
  const nativeWaiting = nativeItems.filter((item) => item.status === 'paused');
  const nativeStopped = nativeItems.filter((item) => ['complete', 'error'].includes(item.status));
  const nativeSpeed = nativeActive.reduce((sum, item) => sum + Number(item.downloadSpeed || 0), 0);
  return {
    active: [...nativeActive, ...active],
    waiting: [...nativeWaiting, ...waiting],
    stopped: [...nativeStopped, ...stopped],
    globalStat: {
      ...globalStat,
      downloadSpeed: String(Number(globalStat.downloadSpeed || 0) + nativeSpeed),
      numActive: String(Number(globalStat.numActive || 0) + nativeActive.length),
      numWaiting: String(Number(globalStat.numWaiting || 0) + nativeWaiting.length),
      numStopped: String(Number(globalStat.numStopped || 0) + nativeStopped.length),
    },
    version,
  };
});
ipcMain.handle('velocity:chooseDir', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'], defaultPath: defaultDownloadDir() });
  return result.canceled ? null : result.filePaths[0];
});
ipcMain.handle('velocity:openPath', (_e, targetPath) => shell.openPath(targetPath));
