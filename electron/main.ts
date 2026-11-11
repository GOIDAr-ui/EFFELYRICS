import { automaticLyrics } from './lyrics';
import { app, BrowserWindow, dialog, ipcMain, session } from 'electron';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { WindowsMediaSessionAdapter } from './WindowsMediaSessionAdapter';
import type { MediaCommand } from '../src/core/types';
const adapter = new WindowsMediaSessionAdapter();
let window: BrowserWindow | null = null;
const devURL = !app.isPackaged && process.env.AURORA_DEV_URL === 'http://127.0.0.1:5173' ? process.env.AURORA_DEV_URL : undefined;
function trusted(event: Electron.IpcMainInvokeEvent) {
  if (!window || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) throw new Error('Untrusted IPC sender');
}
app.whenReady().then(async () => {
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  window = new BrowserWindow({ width: 1440, height: 940, minWidth: 840, minHeight: 640, backgroundColor: '#14131c', title: 'Aurora Lyrics', autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true, devTools: !app.isPackaged } });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.webContents.on('will-attach-webview', event => event.preventDefault());
  let lyricsRequest: AbortController | undefined;
  ipcMain.handle('lyrics:cancel', event => { trusted(event); lyricsRequest?.abort(); });
  ipcMain.handle('lyrics:find', async (event, track, choice) => {
    trusted(event);
    if (!track || typeof track.title !== 'string' || typeof track.artist !== 'string' || track.title.length > 500 || track.artist.length > 500 || (track.album != null && (typeof track.album !== 'string' || track.album.length > 500)) || (track.duration != null && (typeof track.duration !== 'number' || !Number.isFinite(track.duration))) || (choice != null && (typeof choice !== 'string' || choice.length > 200))) throw Error('Invalid track query');
    lyricsRequest?.abort(); lyricsRequest = new AbortController();
    return automaticLyrics.find(track, lyricsRequest.signal, choice);
  });
  ipcMain.handle('media:snapshot', event => { trusted(event); return adapter.snapshot; });
  ipcMain.handle('media:seek', (event, position: unknown) => { trusted(event); if (typeof position !== 'number' || !Number.isFinite(position) || position < 0) throw Error('Invalid seek position'); return adapter.seek(position); });
  ipcMain.handle('media:command', (event, command: unknown) => { trusted(event); if (typeof command !== 'string' || !['toggle', 'next', 'previous'].includes(command)) throw new Error('Invalid command'); return adapter.command(command as MediaCommand); });
  ipcMain.handle('window:fullscreen', event => { trusted(event); window!.setFullScreen(!window!.isFullScreen()); });
  ipcMain.handle('lyrics:import', async event => {
    trusted(event);
    const result = await dialog.showOpenDialog(window!, { title: 'Импорт TTML', filters: [{ name: 'Timed Text', extensions: ['ttml', 'xml'] }], properties: ['openFile'] });
    if (result.canceled || result.filePaths.length !== 1) return null;
    const file = result.filePaths[0];
    if ((await stat(file)).size > 2_000_000) throw new Error('TTML слишком большой (максимум 2 МБ).');
    return { name: path.basename(file), content: await readFile(file, 'utf8') };
  });
  let lastArtwork: string | undefined;
  adapter.on('snapshot', snapshot => {
    if (!window || window.isDestroyed()) return;
    const { artwork, ...rest } = snapshot;
    window.webContents.send('media:changed', artwork === lastArtwork ? rest : { ...rest, artwork: artwork ?? null });
    lastArtwork = artwork;
  });
  adapter.start(app.isPackaged ? path.join(process.resourcesPath, 'bridge', 'WindowsMediaBridge.exe') : path.join(app.getAppPath(), 'native', 'publish', 'win-x64', 'WindowsMediaBridge.exe'));
  if (devURL) await window.loadURL(devURL); else await window.loadFile(path.join(__dirname, '../dist/index.html'));
  window.on('closed', () => { window = null; });
});
app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => adapter.dispose());
