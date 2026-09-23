/**
 * Electron context-bridge preload script.
 *
 * Runs in an isolated context with access to Node/Electron APIs before the
 * renderer's web content loads, and exposes a safe, minimal `window.electron`
 * API to the renderer process by forwarding each method to the corresponding
 * `ipcMain` handler registered in `main.ts` via `ipcRenderer.invoke`.
 */

import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electron', {
  /** Marker property the renderer can check to detect it's running inside Electron. */
  isElectron: true,
  /**
   * Rescans the music directory and syncs new/changed files into the library.
   * @returns A promise resolving to the number of songs found/processed.
   */
  rescanLibrary: () => ipcRenderer.invoke('library:rescan'),
  /**
   * Lists all songs currently in the library.
   * @returns A promise resolving to the full list of library songs.
   */
  listSongs: () => ipcRenderer.invoke('library:list'),
  /**
   * Reads a file's raw contents from disk.
   * @param path - Absolute path of the file to read.
   * @returns A promise resolving to the file's contents as a Buffer.
   */
  readFile: (path: string) => ipcRenderer.invoke('fs:read-file', path),
  /**
   * Adds a song located at a remote URL to the library.
   * @param kind - Source of the URL (e.g. `'bandcamp'` or `'youtube'`), determines how metadata is extracted.
   * @param url - The URL of the song to add.
   */
  addUrlSong: (kind: string, url: string) => ipcRenderer.invoke('library:add-url-song', kind, url),
  /**
   * Adds a local audio file to the library.
   * @param path - Absolute path of the audio file to add.
   */
  addFileSong: (path: string) => ipcRenderer.invoke('library:add-file-song', path),
  /**
   * Removes a song from the library.
   * @param id - Database id of the song to remove.
   */
  removeSong: (id: string) => ipcRenderer.invoke('library:remove-song', id),
  /**
   * Updates a tag value for a song, writing it back to the file on disk when applicable.
   * @param id - Database id of the song to update.
   * @param key - Tag key to set.
   * @param value - New value for the tag.
   */
  setTag: (id: string, key: string, value: string) => ipcRenderer.invoke('library:set-tag', id, key, value),
  /**
   * Lists the tag columns currently configured for the library.
   * @returns A promise resolving to the list of column keys.
   */
  listColumns: () => ipcRenderer.invoke('library:list-columns'),
  /**
   * Adds a new tag column to the library configuration.
   * @param key - Tag key to add as a column.
   */
  addColumn: (key: string) => ipcRenderer.invoke('library:add-column', key),
  /**
   * Removes a tag column from the library configuration.
   * @param key - Tag key to remove as a column.
   */
  removeColumn: (key: string) => ipcRenderer.invoke('library:remove-column', key),
  /**
   * Simulates a left mouse click at the given coordinates in the main window,
   * for use in automated testing.
   * @param x - X coordinate (in window content pixels) to click at.
   * @param y - Y coordinate (in window content pixels) to click at.
   */
  clickAt: (x: number, y: number) => ipcRenderer.invoke('window:click-at', x, y),
})
