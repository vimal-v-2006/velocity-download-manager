const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const crypto = require('crypto');
const { spawn } = require('child_process');

const isDev = process.env.NODE_ENV === 'development' || process.env.VITE_DEV_SERVER_URL;
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
let mainWindow;
let ariaProcess;
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
app.on('before-quit', async () => { try { await rpc('saveSession'); } catch {} if (ariaProcess) ariaProcess.kill(); });

ipcMain.handle('velocity:add', async (_e, payload) => {
  const requestedSplit = Number(payload.split || 16);
  const split = Number.isFinite(requestedSplit) ? Math.max(1, Math.min(16, requestedSplit)) : 16;
  const opts = {
    dir: payload.dir || defaultDownloadDir(),
    split: String(split),
    'max-connection-per-server': String(split),
    continue: 'true'
  };
  return rpc('addUri', [[payload.url], opts]);
});
ipcMain.handle('velocity:pause', (_e, gid) => rpc('pause', [gid]));
ipcMain.handle('velocity:resume', (_e, gid) => rpc('unpause', [gid]));
ipcMain.handle('velocity:remove', (_e, gid) => rpc('remove', [gid]).catch(() => rpc('removeDownloadResult', [gid])));
ipcMain.handle('velocity:status', async () => {
  const keys = ['gid','status','totalLength','completedLength','downloadSpeed','uploadSpeed','connections','numSeeders','files','errorMessage','dir','bittorrent'];
  const [active, waiting, stopped, globalStat, version] = await Promise.all([
    rpc('tellActive', [keys]), rpc('tellWaiting', [0, 100, keys]), rpc('tellStopped', [0, 100, keys]), rpc('getGlobalStat'), rpc('getVersion')
  ]);
  return { active, waiting, stopped, globalStat, version };
});
ipcMain.handle('velocity:chooseDir', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'], defaultPath: defaultDownloadDir() });
  return result.canceled ? null : result.filePaths[0];
});
ipcMain.handle('velocity:openPath', (_e, targetPath) => shell.openPath(targetPath));
