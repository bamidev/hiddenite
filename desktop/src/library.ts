import { DatabaseSync } from 'node:sqlite'
import { app } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { extractBandcampMetadata, extractYouTubeMetadata, extractFileMetadata } from 'hiddenite'

const AUDIO_EXTENSIONS = new Set(['.mp3', '.flac', '.wav', '.ogg', '.m4a', '.aac'])

function getDatabase() {
  const dbPath = path.join(app.getPath('userData'), 'pp.sqlite')
  const db = new DatabaseSync(dbPath)
  db.exec(`
    CREATE TABLE IF NOT EXISTS song (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL,
      duration INTEGER
    )
  `)
  db.exec(`
    CREATE TABLE IF NOT EXISTS tag (
      song_id INTEGER NOT NULL REFERENCES song (id),
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      PRIMARY KEY (song_id, key)
    )
  `)
  return db
}

async function findAudioFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...await findAudioFiles(fullPath))
    } else if (AUDIO_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      files.push(fullPath)
    }
  }
  return files
}

export async function rescanLibrary(): Promise<number> {
  const musicDir = path.join(os.homedir(), 'Music')
  const files = await findAudioFiles(musicDir)
  const db = getDatabase()

  db.exec('DELETE FROM tag')
  db.exec('DELETE FROM song')
  const insertSong = db.prepare('INSERT INTO song (path, type, duration) VALUES (?, ?, ?)')
  const insertTag = db.prepare('INSERT INTO tag (song_id, key, value) VALUES (?, ?, ?)')

  for (const filePath of files) {
    const { tags, duration } = await extractFileMetadata(filePath)
    const { lastInsertRowid: songId } = insertSong.run(filePath, 'file', duration)
    for (const [key, value] of Object.entries(tags)) {
      insertTag.run(songId as number, key, value)
    }

    console.log(`Indexed file ${filePath}.`)
  }

  db.close()
  return files.length
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
  const { tags, duration } = kind === 'bandcamp' ? await extractBandcampMetadata(url)
    : kind === 'youtube' ? await extractYouTubeMetadata(url)
    : { tags: {}, duration: null }

  const db = getDatabase()
  const { lastInsertRowid: songId } = db
    .prepare('INSERT INTO song (path, type, duration) VALUES (?, ?, ?)')
    .run(url, kind, duration)
  const insertTag = db.prepare('INSERT INTO tag (song_id, key, value) VALUES (?, ?, ?)')
  for (const [key, value] of Object.entries(tags)) {
    insertTag.run(songId as number, key, value)
  }
  db.close()
}

export async function addFileSong(filePath: string): Promise<void> {
  const { tags, duration } = await extractFileMetadata(filePath)
  const db = getDatabase()
  const { lastInsertRowid: songId } = db
    .prepare('INSERT INTO song (path, type, duration) VALUES (?, ?, ?)')
    .run(filePath, 'file', duration)
  const insertTag = db.prepare('INSERT INTO tag (song_id, key, value) VALUES (?, ?, ?)')
  for (const [key, value] of Object.entries(tags)) {
    insertTag.run(songId as number, key, value)
  }
  db.close()
}

export function listSongs() {
  const db = getDatabase()
  const songs = db.prepare('SELECT id, path, type, duration FROM song').all() as { id: number, path: string, type: string, duration: number | null }[]
  const tagRows = db.prepare('SELECT song_id, key, value FROM tag').all() as { song_id: number, key: string, value: string }[]
  db.close()

  const tagsBySongId = new Map<number, Record<string, string>>()
  for (const row of tagRows) {
    if (!tagsBySongId.has(row.song_id)) tagsBySongId.set(row.song_id, {})
    tagsBySongId.get(row.song_id)![row.key] = row.value
  }

  return songs.map(song => ({
    id: String(song.id),
    path: song.path,
    type: song.type,
    duration: song.duration,
    tags: tagsBySongId.get(song.id) ?? {},
  }))
}
