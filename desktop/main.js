const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('node:path')
const { rescanLibrary, listSongs } = require('./library.js')

const createWindow = () => {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  win.removeMenu()
  win.loadURL('http://localhost:5173')
}

ipcMain.handle('library:rescan', () => rescanLibrary())
ipcMain.handle('library:list', () => listSongs())

app.whenReady().then(() => {
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
