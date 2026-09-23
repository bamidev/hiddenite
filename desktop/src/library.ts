/**
 * Desktop-side wrapper around the shared `hiddenite/library` module.
 *
 * This file is responsible for resolving where the app stores its sqlite
 * database and scans music from on disk, and for exposing a set of
 * desktop-specific library operations (rescanning, reading/writing tags,
 * adding songs, and managing custom tag columns) that `main.ts` wires up to
 * IPC handlers. It also owns writing edited tags back to audio files on disk
 * via node-taglib-sharp.
 */

import { app } from 'electron'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { APP_NAME } from 'hiddenite'
import * as library from 'hiddenite/library'
import { extractBandcampMetadata, extractYouTubeMetadata, extractFileMetadata } from 'hiddenite/playback-event'

const xdgDataHome = process.env.XDG_DATA_HOME || path.join(app.getPath('home'), '.local', 'share')
app.setPath('userData', path.join(xdgDataHome, APP_NAME))

/**
 * Computes the absolute path to the app's sqlite library database, located
 * inside Electron's per-user `userData` directory.
 *
 * @returns The absolute path to `library.sqlite`.
 */
function getDbPath(): string {
  return path.join(app.getPath('userData'), 'library.sqlite')
}

const DB_PATH: string = getDbPath()
mkdirSync(path.dirname(DB_PATH), { recursive: true })

const MUSIC_DIR = path.join(os.homedir(), 'Music')

/**
 * Rescans the user's music directory and syncs any new or changed files into
 * the library database.
 *
 * @returns The number of songs found/processed by the scan.
 */
export async function rescanLibrary(): Promise<number> {
  return library.rescanLibrary(DB_PATH, [MUSIC_DIR])
}

/**
 * Maps the tag keys that can be written back to an audio file's metadata to
 * a setter function that applies the value onto a node-taglib-sharp `Tag`
 * object. Only keys present here are eligible for on-disk tag writes.
 */
const WRITABLE_TAG_KEYS: Record<string, (tag: any, value: string) => void> = {
  artist: (tag, value) => { tag.performers = [value] },
  album: (tag, value) => { tag.album = value },
  title: (tag, value) => { tag.title = value },
}

/**
 * Writes a single tag value directly onto an audio file on disk using
 * node-taglib-sharp, opening the file, applying the change, saving, and
 * disposing of the file handle.
 *
 * @param filePath - Absolute path of the audio file to modify.
 * @param key - Tag key to write; must be one of {@link WRITABLE_TAG_KEYS}.
 * @param value - New value to assign to the tag.
 * @throws If `key` is not a supported writable tag key.
 */
export async function writeTag(filePath: string, key: string, value: string): Promise<void> {
  const setter = WRITABLE_TAG_KEYS[key]
  if (!setter) {
    throw new Error(`Unsupported tag key for writing: ${key}`)
  }

  const TagLib = await import('node-taglib-sharp')
  const file = TagLib.File.createFromPath(filePath)
  try {
    setter(file.tag, value)
    file.save()
  } finally {
    file.dispose()
  }
}

/**
 * Adds a song that lives at a remote URL (e.g. Bandcamp or YouTube) to the
 * library. Metadata is extracted from the URL according to `kind` before the
 * song record is inserted into the database.
 *
 * @param kind - Source of the URL; `'bandcamp'` and `'youtube'` trigger
 *   dedicated metadata extraction, any other value falls back to empty tags
 *   and an unknown duration.
 * @param url - The URL of the song to add.
 */
export async function addUrlSong(kind: string, url: string): Promise<void> {
  const metadata = kind === 'bandcamp' ? await extractBandcampMetadata(url)
    : kind === 'youtube' ? await extractYouTubeMetadata(url)
    : { tags: {}, duration: null }

  library.addUrlSong(DB_PATH, kind, url, MUSIC_DIR, metadata)
}

/**
 * Adds a local audio file to the library by extracting its tags/duration
 * and inserting a new `song` row plus one `tag` row per extracted tag.
 *
 * @param filePath - Absolute path of the audio file to add.
 */
export async function addFileSong(filePath: string): Promise<void> {
  const { tags, duration } = await extractFileMetadata(filePath, library.listExtractableTagKeys(DB_PATH, MUSIC_DIR))
  const db = library.openLibraryDatabase(DB_PATH)
  const { lastInsertRowid: songId } = db
    .prepare('INSERT INTO song (path, kind, duration, folder) VALUES (?, ?, ?, ?)')
    .run(filePath, 'file', duration, MUSIC_DIR)
  const insertTag = db.prepare('INSERT INTO tag (song_id, key, value) VALUES (?, ?, ?)')
  for (const [key, value] of Object.entries(tags)) {
    insertTag.run(songId as number, key, value)
  }
  db.close()
}

/**
 * Updates a tag value for a song in the database, and if the song is a local
 * file (`kind === 'file'`) and the tag is one of the writable tag keys, also
 * writes the new value back to the file's on-disk metadata.
 *
 * @param id - Database id of the song to update.
 * @param key - Tag key to set.
 * @param value - New value for the tag.
 */
export async function setTag(id: string, key: string, value: string): Promise<void> {
  library.setSongTag(DB_PATH, id, key, value)

  const song = library.getLibrarySong(DB_PATH, id)
  if (song?.kind === 'file' && WRITABLE_TAG_KEYS[key]) {
    await writeTag(song.path, key, value)
  }
}

/**
 * Lists all songs currently stored in the library database.
 *
 * @returns A promise resolving to the full list of library songs.
 */
export function listSongs() {
  return library.listLibrarySongs(DB_PATH, {})
}

/**
 * Removes a song from the library database.
 *
 * @param id - Database id of the song to remove.
 */
export function removeSong(id: string): void {
  library.removeLibrarySong(DB_PATH, id)
}

/**
 * Lists the tag columns currently configured for the library (the set of
 * tag keys shown/tracked in addition to the defaults).
 *
 * @returns The list of column keys.
 */
export function listColumns(): string[] {
  return library.listColumns(DB_PATH, MUSIC_DIR)
}

/**
 * Adds a new tag column to the library configuration.
 *
 * @param key - Tag key to add as a column.
 */
export function addColumn(key: string): void {
  library.addColumn(DB_PATH, MUSIC_DIR, key)
}

/**
 * Removes a tag column from the library configuration.
 *
 * @param key - Tag key to remove as a column.
 */
export function removeColumn(key: string): void {
  library.removeColumn(DB_PATH, MUSIC_DIR, key)
}
