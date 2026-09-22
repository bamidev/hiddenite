import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electron', {
  isElectron: true,
  rescanLibrary: () => ipcRenderer.invoke('library:rescan'),
  listSongs: () => ipcRenderer.invoke('library:list'),
  readFile: (path: string) => ipcRenderer.invoke('fs:read-file', path),
  addUrlSong: (kind: string, url: string) => ipcRenderer.invoke('library:add-url-song', kind, url),
  addFileSong: (path: string) => ipcRenderer.invoke('library:add-file-song', path),
  removeSong: (id: string) => ipcRenderer.invoke('library:remove-song', id),
  setTag: (id: string, key: string, value: string) => ipcRenderer.invoke('library:set-tag', id, key, value),
  listColumns: () => ipcRenderer.invoke('library:list-columns'),
  addColumn: (key: string) => ipcRenderer.invoke('library:add-column', key),
  removeColumn: (key: string) => ipcRenderer.invoke('library:remove-column', key),
  clickAt: (x: number, y: number) => ipcRenderer.invoke('window:click-at', x, y),
})
