const { DatabaseSync } = require('node:sqlite')
const { app } = require('electron')
const fs = require('node:fs/promises')
const path = require('node:path')
const os = require('node:os')

const AUDIO_EXTENSIONS = new Set(['.mp3', '.flac', '.wav', '.ogg', '.m4a', '.aac'])

function getDatabase() {
  const dbPath = path.join(app.getPath('userData'), 'library.sqlite')
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

async function rescanLibrary() {
  const { parseFile } = await import('music-metadata')
  const musicDir = path.join(os.homedir(), 'Music')
  const files = await findAudioFiles(musicDir)
  const db = getDatabase()

  db.exec('DELETE FROM tag')
  db.exec('DELETE FROM song')
  const insertSong = db.prepare('INSERT INTO song (path, type) VALUES (?, ?)')
  const insertTag = db.prepare('INSERT INTO tag (song_id, key, value) VALUES (?, ?, ?)')

  for (const filePath of files) {
    const { common } = await parseFile(filePath)
    const tags = {}
    if (common.artist) tags.artist = common.artist
    if (common.album) tags.album = common.album
    if (common.title) tags.title = common.title
    if (common.rating?.[0]?.rating != null) tags.rating = String(common.rating[0].rating)

    const { lastInsertRowid: songId } = insertSong.run(filePath, 'file')
    for (const [key, value] of Object.entries(tags)) {
      insertTag.run(songId, key, value)
    }
  }

  db.close()
  return files.length
}

module.exports = { rescanLibrary }
