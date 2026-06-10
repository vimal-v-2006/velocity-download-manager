const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('velocity', {
  addDownload: (payload) => ipcRenderer.invoke('velocity:add', payload),
  pause: (gid) => ipcRenderer.invoke('velocity:pause', gid),
  resume: (gid) => ipcRenderer.invoke('velocity:resume', gid),
  remove: (gid) => ipcRenderer.invoke('velocity:remove', gid),
  status: () => ipcRenderer.invoke('velocity:status'),
  chooseDir: () => ipcRenderer.invoke('velocity:chooseDir'),
  openPath: (targetPath) => ipcRenderer.invoke('velocity:openPath', targetPath)
});
