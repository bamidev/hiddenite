const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electron', {
  isElectron: true,
  rescanLibrary: () => ipcRenderer.invoke('library:rescan'),
})
