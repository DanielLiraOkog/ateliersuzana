const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('electronAPI', {
  load: () => ipcRenderer.invoke('db:load'),
  save: (d) => ipcRenderer.invoke('db:save', d),
  exportBackup: () => ipcRenderer.invoke('backup:export'),
  importBackup: () => ipcRenderer.invoke('backup:import'),
  openText: (ext) => ipcRenderer.invoke('file:open-text', ext),
  savePdf: (name) => ipcRenderer.invoke('pdf:save', name),
  dataDir: () => ipcRenderer.invoke('app:data-dir'),
});
