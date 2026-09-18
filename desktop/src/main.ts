import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'node:path'
import fs from 'node:fs/promises'
import { rescanLibrary, listSongs, addUrlSong, addFileSong } from './library'

let win: BrowserWindow

const createWindow = () => {
  win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  win.removeMenu()
  win.loadURL('http://localhost:5173')
  win.webContents.openDevTools()
}

ipcMain.handle('library:rescan', () => rescanLibrary())
ipcMain.handle('library:list', () => listSongs())
ipcMain.handle('library:add-url-song', (_event, kind: string, url: string) => addUrlSong(kind, url))
ipcMain.handle('library:add-file-song', (_event, filePath: string) => addFileSong(filePath))
ipcMain.handle('fs:read-file', (_event, filePath: string) => fs.readFile(filePath))
ipcMain.handle('window:click-at', async (_event, x: number, y: number) => {
  win.webContents.sendInputEvent({ type: 'mouseMove', x, y })
  await new Promise(resolve => setTimeout(resolve, 200))
  win.webContents.sendInputEvent({ type: 'mouseDown', x, y, button: 'left', clickCount: 1 })
  await new Promise(resolve => setTimeout(resolve, 100))
  win.webContents.sendInputEvent({ type: 'mouseUp', x, y, button: 'left', clickCount: 1 })
})

app.whenReady().then(() => {
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
