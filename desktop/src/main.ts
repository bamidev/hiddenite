/**
 * Electron main process entry point.
 *
 * Creates the application's browser window, registers all `ipcMain` handlers
 * that back the `window.electron` API exposed to the renderer by
 * `preload.ts` (library operations, file reads, and simulated clicks), and
 * wires up app lifecycle events.
 */

import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'node:path'
import fs from 'node:fs/promises'
import * as library from './library'

let win: BrowserWindow

/**
 * Creates the app's main `BrowserWindow`, points it at the dev server, and
 * opens the DevTools. Assigns the created window to the module-level `win`
 * variable used by other handlers (e.g. `window:click-at`).
 */
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

/** IPC handler for `library:rescan`. Rescans the music directory and syncs new/changed files into the library. @returns The number of songs found/processed. */
ipcMain.handle('library:rescan', () => library.rescanLibrary())
/** IPC handler for `library:list`. @returns The full list of songs currently in the library. */
ipcMain.handle('library:list', () => library.listSongs())
/**
 * IPC handler for `library:add-url-song`. Adds a song located at a remote URL to the library.
 * @param _event - Electron IPC event (unused).
 * @param kind - Source of the URL (e.g. `'bandcamp'` or `'youtube'`), determines how metadata is extracted.
 * @param url - The URL of the song to add.
 */
ipcMain.handle('library:add-url-song', (_event, kind: string, url: string) => library.addUrlSong(kind, url))
/**
 * IPC handler for `library:add-file-song`. Adds a local audio file to the library.
 * @param _event - Electron IPC event (unused).
 * @param filePath - Absolute path of the audio file to add.
 */
ipcMain.handle('library:add-file-song', (_event, filePath: string) => library.addFileSong(filePath))
/**
 * IPC handler for `library:remove-song`. Removes a song from the library.
 * @param _event - Electron IPC event (unused).
 * @param id - Database id of the song to remove.
 */
ipcMain.handle('library:remove-song', (_event, id: string) => library.removeSong(id))
/**
 * IPC handler for `library:set-tag`. Updates a tag value for a song, writing it back to the file on disk when applicable.
 * @param _event - Electron IPC event (unused).
 * @param id - Database id of the song to update.
 * @param key - Tag key to set.
 * @param value - New value for the tag.
 */
ipcMain.handle('library:set-tag', (_event, id: string, key: string, value: string) => library.setTag(id, key, value))
/** IPC handler for `library:list-columns`. @returns The list of configured tag column keys. */
ipcMain.handle('library:list-columns', () => library.listColumns())
/**
 * IPC handler for `library:add-column`. Adds a new tag column to the library configuration.
 * @param _event - Electron IPC event (unused).
 * @param key - Tag key to add as a column.
 */
ipcMain.handle('library:add-column', (_event, key: string) => library.addColumn(key))
/**
 * IPC handler for `library:remove-column`. Removes a tag column from the library configuration.
 * @param _event - Electron IPC event (unused).
 * @param key - Tag key to remove as a column.
 */
ipcMain.handle('library:remove-column', (_event, key: string) => library.removeColumn(key))
/**
 * IPC handler for `fs:read-file`. Reads an arbitrary file's raw contents from disk.
 * @param _event - Electron IPC event (unused).
 * @param filePath - Absolute path of the file to read.
 * @returns The file's contents as a Buffer.
 */
ipcMain.handle('fs:read-file', (_event, filePath: string) => fs.readFile(filePath))
/**
 * IPC handler for `window:click-at`. Simulates a left mouse click at the given
 * coordinates within the main window by dispatching synthetic move/down/up
 * input events with short delays between them, for use in automated testing.
 * @param _event - Electron IPC event (unused).
 * @param x - X coordinate (in window content pixels) to click at.
 * @param y - Y coordinate (in window content pixels) to click at.
 */
ipcMain.handle('window:click-at', async (_event, x: number, y: number) => {
  win.webContents.sendInputEvent({ type: 'mouseMove', x, y })
  await new Promise(resolve => setTimeout(resolve, 200))
  win.webContents.sendInputEvent({ type: 'mouseDown', x, y, button: 'left', clickCount: 1 })
  await new Promise(resolve => setTimeout(resolve, 100))
  win.webContents.sendInputEvent({ type: 'mouseUp', x, y, button: 'left', clickCount: 1 })
})

// Create the main window once Electron has finished initializing.
app.whenReady().then(() => {
  createWindow()
})

// Quit the app when all windows are closed, except on macOS where apps
// conventionally stay active until the user quits explicitly.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
