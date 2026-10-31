const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const fs = require('fs');
const path = require('path');

const dataDir = path.join(app.getPath('documents'), 'Atelier Suzana Lira');
const dataFile = path.join(dataDir, 'dados.json');
const backupDir = path.join(dataDir, 'backups');

function ensureDirs() {
  fs.mkdirSync(backupDir, { recursive: true });
}

// Uma cópia por dia, guarda as últimas 30.
function dailyBackup() {
  if (!fs.existsSync(dataFile)) return;
  const name = `dados-${new Date().toISOString().slice(0, 10)}.json`;
  const dest = path.join(backupDir, name);
  if (!fs.existsSync(dest)) fs.copyFileSync(dataFile, dest);
  const files = fs.readdirSync(backupDir).filter((f) => f.startsWith('dados-')).sort();
  files.slice(0, Math.max(0, files.length - 30)).forEach((f) => fs.unlinkSync(path.join(backupDir, f)));
}

function atomicWrite(file, text) {
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, file);
}

let win;
function createWindow() {
  win = new BrowserWindow({
    width: 1280, height: 820, minWidth: 1000, minHeight: 640,
    title: 'Atelier Suzana Lira',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
  });
  Menu.setApplicationMenu(null);
  win.maximize();
  win.loadFile(path.join(__dirname, 'src', 'index.html'));
}

ipcMain.handle('db:load', () => {
  try { return JSON.parse(fs.readFileSync(dataFile, 'utf8')); } catch { return null; }
});
ipcMain.handle('db:save', (_e, data) => { atomicWrite(dataFile, JSON.stringify(data)); return true; });

ipcMain.handle('backup:export', async () => {
  const r = await dialog.showSaveDialog(win, {
    title: 'Salvar cópia de segurança',
    defaultPath: `atelier-backup-${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: 'Backup', extensions: ['json'] }],
  });
  if (r.canceled) return false;
  fs.copyFileSync(dataFile, r.filePath);
  return true;
});
ipcMain.handle('backup:import', async () => {
  const r = await dialog.showOpenDialog(win, { title: 'Escolher backup', filters: [{ name: 'Backup', extensions: ['json'] }], properties: ['openFile'] });
  if (r.canceled) return null;
  return JSON.parse(fs.readFileSync(r.filePaths[0], 'utf8'));
});
ipcMain.handle('file:open-text', async (_e, ext) => {
  const r = await dialog.showOpenDialog(win, { filters: [{ name: ext.toUpperCase(), extensions: [ext] }], properties: ['openFile'] });
  if (r.canceled) return null;
  return fs.readFileSync(r.filePaths[0], 'utf8');
});
ipcMain.handle('pdf:save', async (_e, suggested) => {
  const r = await dialog.showSaveDialog(win, { defaultPath: suggested, filters: [{ name: 'PDF', extensions: ['pdf'] }] });
  if (r.canceled) return false;
  const buf = await win.webContents.printToPDF({ pageSize: 'A4', printBackground: true });
  fs.writeFileSync(r.filePath, buf);
  return true;
});
ipcMain.handle('app:data-dir', () => dataDir);

app.whenReady().then(() => {
  ensureDirs();
  dailyBackup();
  createWindow();
});
app.on('window-all-closed', () => app.quit());
