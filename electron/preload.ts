import { contextBridge, ipcRenderer } from 'electron';
import type { AuroraAPI, MediaSnapshot } from '../src/core/types';
let lastArtwork: string | undefined;
let revision = 0;
const api: AuroraAPI = {
  findLyrics: (track, choice) => ipcRenderer.invoke('lyrics:find', track, choice),
  cancelLyrics: () => ipcRenderer.invoke('lyrics:cancel'),
  getSnapshot: async () => { const before = revision; const snapshot: MediaSnapshot = await ipcRenderer.invoke('media:snapshot'); if (before === revision) lastArtwork = snapshot.artwork; return snapshot; },
  onSnapshot: listener => {
    const handler = (_event: Electron.IpcRendererEvent, data: MediaSnapshot) => {
      revision++;
      if ('artwork' in data) lastArtwork = data.artwork ?? undefined;
      listener({ ...data, artwork: lastArtwork });
    };
    ipcRenderer.on('media:changed', handler);
    return () => ipcRenderer.removeListener('media:changed', handler);
  },
  command: command => ipcRenderer.invoke('media:command', command),
  importTTML: () => ipcRenderer.invoke('lyrics:import'),
  fullscreen: () => ipcRenderer.invoke('window:fullscreen'),
};
contextBridge.exposeInMainWorld('aurora', api);
