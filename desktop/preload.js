const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electron', {
  isElectron: true,
  rescanLibrary: () => ipcRenderer.invoke('library:rescan'),
  listSongs: () => ipcRenderer.invoke('library:list'),
  readFile: (path) => ipcRenderer.invoke('fs:read-file', path),
})
