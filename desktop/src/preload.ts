import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electron', {
  isElectron: true,
  rescanLibrary: () => ipcRenderer.invoke('library:rescan'),
  listSongs: () => ipcRenderer.invoke('library:list'),
  readFile: (path: string) => ipcRenderer.invoke('fs:read-file', path),
  addUrlSong: (kind: string, url: string) => ipcRenderer.invoke('library:add-url-song', kind, url),
  addFileSong: (path: string) => ipcRenderer.invoke('library:add-file-song', path),
  removeSong: (id: string) => ipcRenderer.invoke('library:remove-song', id),
  clickAt: (x: number, y: number) => ipcRenderer.invoke('window:click-at', x, y),
})
