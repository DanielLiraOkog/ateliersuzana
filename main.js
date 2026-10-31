const { app, BrowserWindow, ipcMain, dialog, Menu, shell, nativeImage } = require('electron');
const fs = require('fs');
const path = require('path');

const dataDir = path.join(app.getPath('documents'), 'Atelier Suzana Lira');
const dataFile = path.join(dataDir, 'dados.json');

function atomicWrite(file, text) {
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, file);
}

// ---------- cópias de segurança automáticas ----------
// As preferências ficam num arquivo local (não vão junto com os dados, porque a pasta é própria de cada computador).
const settingsFile = path.join(dataDir, 'config-app.json');
const INTERVALOS = { '1h': 3600e3, '6h': 6 * 3600e3, diario: 86400e3, semanal: 7 * 86400e3 };
let cfg;
function lerCfg() {
  const base = { backupDir: path.join(dataDir, 'backups'), frequencia: 'diario', manter: 30, ultimo: 0, ultimoErro: null };
  try { return { ...base, ...JSON.parse(fs.readFileSync(settingsFile, 'utf8')) }; } catch { return base; }
}
function gravarCfg() { fs.mkdirSync(dataDir, { recursive: true }); atomicWrite(settingsFile, JSON.stringify(cfg, null, 2)); }
const publico = () => ({ ...cfg, dataDir });
function stamp() {
  const d = new Date(), p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
}
function podar(prefixo, manter, dir = cfg.backupDir) {
  const arqs = fs.readdirSync(dir).filter((f) => f.startsWith(prefixo) && f.endsWith('.json')).sort();
  arqs.slice(0, Math.max(0, arqs.length - manter)).forEach((f) => { try { fs.unlinkSync(path.join(dir, f)); } catch {} });
}
// Na primeira abertura depois de trocar a versão do programa, guarda uma cópia dos dados antes de qualquer coisa.
// O programa em si nunca grava dentro da pasta dele: os dados ficam sempre em Documentos.
function copiaAntesDeAtualizar() {
  const atual = app.getVersion();
  if (cfg.versaoApp === atual) return;
  if (fs.existsSync(dataFile)) {
    const nome = `antes-de-atualizar-v${cfg.versaoApp || 'anterior'}-para-v${atual}-${stamp()}.json`;
    for (const dir of [cfg.backupDir, path.join(dataDir, 'backups')]) {
      try { fs.mkdirSync(dir, { recursive: true }); fs.copyFileSync(dataFile, path.join(dir, nome)); podar('antes-de-atualizar-', 5, dir); break; } catch {}
    }
  }
  cfg.versaoApp = atual; gravarCfg();
}
// Copia dados.json para a pasta escolhida. Sem `forcar`, só copia se houve alteração desde a última cópia.
function fazerBackup(forcar = false) {
  try {
    if (!fs.existsSync(dataFile)) return { ok: false, erro: 'Ainda não há dados para copiar.' };
    if (!forcar && fs.statSync(dataFile).mtimeMs <= cfg.ultimo) return { ok: true, pulou: true };
    fs.mkdirSync(cfg.backupDir, { recursive: true });
    const dest = path.join(cfg.backupDir, `dados-${stamp()}.json`);
    fs.copyFileSync(dataFile, dest);
    podar('dados-', cfg.manter);
    cfg.ultimo = Date.now(); cfg.ultimoErro = null; gravarCfg();
    return { ok: true, arquivo: dest };
  } catch (e) {
    cfg.ultimoErro = `${e.code || ''} ${e.message}`.trim();
    try { gravarCfg(); } catch {}
    return { ok: false, erro: cfg.ultimoErro };
  }
}
const backupDevido = () => cfg.frequencia === 'sessao' || (!!INTERVALOS[cfg.frequencia] && Date.now() - cfg.ultimo >= INTERVALOS[cfg.frequencia]);
let timer;
function agendar() {
  clearInterval(timer);
  if (INTERVALOS[cfg.frequencia]) timer = setInterval(() => { if (backupDevido()) fazerBackup(); }, 5 * 60e3);
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
ipcMain.handle('app:version', () => app.getVersion());
ipcMain.handle('settings:get', () => publico());
ipcMain.handle('settings:set', (_e, p) => {
  if (['desligado', 'sessao', '1h', '6h', 'diario', 'semanal'].includes(p.frequencia)) cfg.frequencia = p.frequencia;
  if (p.backupDir) cfg.backupDir = String(p.backupDir);
  if (p.manter !== undefined) cfg.manter = Math.max(1, Math.min(365, parseInt(p.manter, 10) || 30));
  gravarCfg(); agendar();
  return publico();
});
ipcMain.handle('backup:choose-dir', async () => {
  const r = await dialog.showOpenDialog(win, { title: 'Escolher a pasta das cópias de segurança', properties: ['openDirectory', 'createDirectory'] });
  return r.canceled ? null : r.filePaths[0];
});
ipcMain.handle('backup:now', () => ({ ...fazerBackup(true), config: publico() }));
ipcMain.handle('backup:list', () => {
  try {
    return fs.readdirSync(cfg.backupDir).filter((f) => f.endsWith('.json')).map((f) => { const s = fs.statSync(path.join(cfg.backupDir, f)); return { name: f, size: s.size, mtime: s.mtimeMs }; })
      .sort((a, b) => b.mtime - a.mtime).slice(0, 100);
  } catch { return []; }
});
ipcMain.handle('backup:read', (_e, name) => JSON.parse(fs.readFileSync(path.join(cfg.backupDir, path.basename(name)), 'utf8')));
// Guarda os dados atuais antes de uma restauração (as 5 últimas ficam).
ipcMain.handle('backup:safety', () => {
  if (!fs.existsSync(dataFile)) return false;
  fs.mkdirSync(cfg.backupDir, { recursive: true });
  fs.copyFileSync(dataFile, path.join(cfg.backupDir, `antes-de-restaurar-${stamp()}.json`));
  podar('antes-de-restaurar-', 5);
  return true;
});
ipcMain.handle('backup:open-folder', () => { fs.mkdirSync(cfg.backupDir, { recursive: true }); return shell.openPath(cfg.backupDir); });
// Ícone da janela/barra de tarefas: a logo dela, ou o ícone padrão.
ipcMain.handle('app:set-icon', (_e, dataUrl) => {
  const img = dataUrl ? nativeImage.createFromDataURL(dataUrl) : nativeImage.createFromPath(path.join(__dirname, 'build', 'icon.png'));
  if (!img.isEmpty() && win) win.setIcon(img);
  return true;
});


app.whenReady().then(() => {
  fs.mkdirSync(dataDir, { recursive: true });
  cfg = lerCfg(); gravarCfg();
  copiaAntesDeAtualizar();
  if (backupDevido()) fazerBackup();
  agendar();
  createWindow();
});
app.on('before-quit', () => { if (cfg && cfg.frequencia === 'sessao') fazerBackup(); });
app.on('window-all-closed', () => app.quit());
