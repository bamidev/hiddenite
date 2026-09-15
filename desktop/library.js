const { DatabaseSync } = require('node:sqlite')
const { app } = require('electron')
const fs = require('node:fs/promises')
const path = require('node:path')
const os = require('node:os')

const AUDIO_EXTENSIONS = new Set(['.mp3', '.flac', '.wav', '.ogg', '.m4a', '.aac'])

function getDatabase() {
  const dbPath = path.join(app.getPath('userData'), 'pp.sqlite')
  const db = new DatabaseSync(dbPath)
  db.exec(`
    CREATE TABLE IF NOT EXISTS song (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL
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

async function findAudioFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const files = []
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

function readTags(TagLib, filePath) {
  const file = TagLib.File.createFromPath(filePath)
  try {
    const tags = {}
    if (file.tag.firstPerformer) tags.artist = file.tag.firstPerformer
    if (file.tag.album) tags.album = file.tag.album
    if (file.tag.title) tags.title = file.tag.title
    // NOTE: rating (ID3 POPM) isn't part of TagLib's generic cross-format Tag
    // interface - reading/writing it would need the format-specific tag
    // (e.g. Id3v2Tag.popularimeters), not verified yet.
    return tags
  } finally {
    file.dispose()
  }
}

async function rescanLibrary() {
  const TagLib = await import('node-taglib-sharp')
  const musicDir = path.join(os.homedir(), 'Music')
  const files = await findAudioFiles(musicDir)
  const db = getDatabase()

  db.exec('DELETE FROM tag')
  db.exec('DELETE FROM song')
  const insertSong = db.prepare('INSERT INTO song (path, type) VALUES (?, ?)')
  const insertTag = db.prepare('INSERT INTO tag (song_id, key, value) VALUES (?, ?, ?)')

  for (const filePath of files) {
    const tags = readTags(TagLib, filePath)
    const { lastInsertRowid: songId } = insertSong.run(filePath, 'file')
    for (const [key, value] of Object.entries(tags)) {
      insertTag.run(songId, key, value)
    }

    console.log(`Indexed file ${filePath}.`)
  }

  db.close()
  return files.length
}

const WRITABLE_TAG_KEYS = {
  artist: (tag, value) => { tag.performers = [value] },
  album: (tag, value) => { tag.album = value },
  title: (tag, value) => { tag.title = value },
}

async function writeTag(filePath, key, value) {
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

function listSongs() {
  const db = getDatabase()
  const songs = db.prepare('SELECT id, path, type FROM song').all()
  const tagRows = db.prepare('SELECT song_id, key, value FROM tag').all()
  db.close()

  const tagsBySongId = new Map()
  for (const row of tagRows) {
    if (!tagsBySongId.has(row.song_id)) tagsBySongId.set(row.song_id, {})
    tagsBySongId.get(row.song_id)[row.key] = row.value
  }

  return songs.map(song => ({
    id: String(song.id),
    path: song.path,
    type: song.type,
    tags: tagsBySongId.get(song.id) ?? {},
  }))
}

module.exports = { rescanLibrary, writeTag, listSongs }
