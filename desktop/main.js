const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('node:path')
const { rescanLibrary } = require('./library.js')

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

app.whenReady().then(() => {
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
