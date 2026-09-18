import { app } from 'electron'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { APP_NAME } from 'hiddenite'
import { openLibraryDatabase, rescanLibrary as scanLibrary, listLibrarySongs, addUrlSong as addLibraryUrlSong, removeLibrarySong } from 'hiddenite/library'
import { extractBandcampMetadata, extractYouTubeMetadata, extractFileMetadata } from 'hiddenite/playback-event'

const xdgDataHome = process.env.XDG_DATA_HOME || path.join(app.getPath('home'), '.local', 'share')
app.setPath('userData', path.join(xdgDataHome, APP_NAME))

function getDbPath(): string {
  return path.join(app.getPath('userData'), 'library.sqlite')
}

const DB_PATH: string = getDbPath()
mkdirSync(path.dirname(DB_PATH), { recursive: true })

export async function rescanLibrary(): Promise<number> {
  const musicDir = path.join(os.homedir(), 'Music')
  return scanLibrary(DB_PATH, [musicDir])
}

const WRITABLE_TAG_KEYS: Record<string, (tag: any, value: string) => void> = {
  artist: (tag, value) => { tag.performers = [value] },
  album: (tag, value) => { tag.album = value },
  title: (tag, value) => { tag.title = value },
}

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

export async function addUrlSong(kind: string, url: string): Promise<void> {
  const metadata = kind === 'bandcamp' ? await extractBandcampMetadata(url)
    : kind === 'youtube' ? await extractYouTubeMetadata(url)
    : { tags: {}, duration: null }

  addLibraryUrlSong(DB_PATH, kind, url, metadata)
}

export async function addFileSong(filePath: string): Promise<void> {
  const { tags, duration } = await extractFileMetadata(filePath)
  const db = openLibraryDatabase(DB_PATH)
  const { lastInsertRowid: songId } = db
    .prepare('INSERT INTO song (path, kind, duration) VALUES (?, ?, ?)')
    .run(filePath, 'file', duration)
  const insertTag = db.prepare('INSERT INTO tag (song_id, key, value) VALUES (?, ?, ?)')
  for (const [key, value] of Object.entries(tags)) {
    insertTag.run(songId as number, key, value)
  }
  db.close()
}

export function listSongs() {
  return listLibrarySongs(DB_PATH)
}

export function removeSong(id: string): void {
  removeLibrarySong(DB_PATH, id)
}
