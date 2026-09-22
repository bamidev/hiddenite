import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs/promises';
import path from 'node:path';
import * as songMetadata from './song-metadata.js';
import type { ExtractedMetadata } from './playback-event.js';

const AUDIO_EXTENSIONS = new Set(['.mp3', '.flac', '.wav', '.ogg', '.m4a', '.aac']);
const DEFAULT_COLUMNS = ['artist', 'album', 'title'];

export interface LibrarySong {
  id: string;
  path: string;
  kind: string;
  duration: number | null;
  tags: Record<string, string>;
  folder: string;
}

export function openLibraryDatabase(dbPath: string): DatabaseSync {
  const db = new DatabaseSync(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS song (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT NOT NULL UNIQUE,
      kind TEXT NOT NULL,
      duration INTEGER,
      folder TEXT NOT NULL,
      added_by_scan INTEGER NOT NULL DEFAULT 0
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS tag (
      song_id INTEGER NOT NULL REFERENCES song (id),
      key TEXT NOT NULL,
      value TEXT,
      PRIMARY KEY (song_id, key)
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS column (
      folder TEXT NOT NULL,
      position INTEGER NOT NULL,
      key TEXT NOT NULL,
      PRIMARY KEY (folder, key)
    )
  `);
  return db;
}

function ensureColumnsSeeded(db: DatabaseSync, folder: string): void {
  const { count } = db.prepare('SELECT COUNT(*) AS count FROM column WHERE folder = ?').get(folder) as { count: number };
  if (count === 0) {
    const insertColumn = db.prepare('INSERT INTO column (folder, position, key) VALUES (?, ?, ?)');
    DEFAULT_COLUMNS.forEach((key, position) => insertColumn.run(folder, position, key));
  }
}

// Also seeds the default columns for the folder the first time it's read (e.g. when its
// library is first loaded), so the defaults are actually persisted, not just implied.
function readColumns(db: DatabaseSync, folder: string): string[] {
  ensureColumnsSeeded(db, folder);
  const rows = db.prepare('SELECT key FROM column WHERE folder = ? ORDER BY position').all(folder) as { key: string }[];
  return rows.map(row => row.key);
}

export function listColumns(dbPath: string, folder: string): string[] {
  const db = openLibraryDatabase(dbPath);
  try {
    return readColumns(db, folder);
  } finally {
    db.close();
  }
}

export function addColumn(dbPath: string, folder: string, key: string): void {
  const db = openLibraryDatabase(dbPath);
  try {
    ensureColumnsSeeded(db, folder);
    const { count } = db.prepare('SELECT COUNT(*) AS count FROM column WHERE folder = ?').get(folder) as { count: number };
    db.prepare('INSERT OR IGNORE INTO column (folder, position, key) VALUES (?, ?, ?)').run(folder, count, key);
  } finally {
    db.close();
  }
}

export function removeColumn(dbPath: string, folder: string, key: string): void {
  const db = openLibraryDatabase(dbPath);
  try {
    ensureColumnsSeeded(db, folder);
    db.prepare('DELETE FROM column WHERE folder = ? AND key = ?').run(folder, key);
  } finally {
    db.close();
  }
}

async function findAudioFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await findAudioFiles(fullPath));
    } else if (AUDIO_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      files.push(fullPath);
    }
  }
  return files;
}

export async function rescanLibrary(dbPath: string, rootDirs: string[]): Promise<number> {
  const filesByFolder = await Promise.all(rootDirs.map(async folder => ({
    folder,
    files: await findAudioFiles(folder),
  })));
  const db = openLibraryDatabase(dbPath);

  db.exec('DELETE FROM tag WHERE song_id IN (SELECT id FROM song WHERE added_by_scan = 1)');
  db.exec('DELETE FROM song WHERE added_by_scan = 1');
  const insertSong = db.prepare('INSERT INTO song (path, kind, duration, folder, added_by_scan) VALUES (?, ?, ?, ?, 1)');
  const insertTag = db.prepare('INSERT INTO tag (song_id, key, value) VALUES (?, ?, ?)');

  let fileCount = 0;
  try {
    for (const { folder, files } of filesByFolder) {
      const columns = readColumns(db, folder);
      for (const filePath of files) {
        let metadata: ExtractedMetadata;
        try {
          metadata = await songMetadata.extractFileMetadata(filePath, columns);
        } catch (err) {
          console.warn(`Skipping library file ${filePath}:`, err);
          continue;
        }

        const { tags, duration } = metadata;
        const { lastInsertRowid: songId } = insertSong.run(filePath, 'file', duration, folder);
        for (const key of columns) {
          insertTag.run(songId as number, key, tags[key] ?? null);
        }
        fileCount += 1;
      }
    }
  } finally {
    db.close();
  }

  return fileCount;
}

export interface LibrarySongQuery {
  folder?: string;
  filter?: string;
}

export async function listLibrarySongs(dbPath: string, query: LibrarySongQuery = {}): Promise<LibrarySong[]> {
  const db = openLibraryDatabase(dbPath);
  try {
    const conditions: string[] = [];
    const params: string[] = [];
    if (query.folder !== undefined) {
      conditions.push('folder = ?');
      params.push(query.folder);
    }
    if (query.filter) {
      conditions.push('EXISTS (SELECT 1 FROM tag WHERE tag.song_id = song.id AND LOWER(tag.value) LIKE ?)');
      params.push(`%${query.filter.toLowerCase()}%`);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const songs = db.prepare(`SELECT id, path, kind, duration, folder FROM song ${where}`).all(...params) as
      { id: number, path: string, kind: string, duration: number | null, folder: string }[];
    const songIds = songs.map(song => song.id);
    const tagRows = songIds.length > 0
      ? db.prepare(`SELECT song_id, key, value FROM tag WHERE song_id IN (${songIds.map(() => '?').join(',')})`).all(...songIds) as
        { song_id: number, key: string, value: string | null }[]
      : [];

    const tagsBySongId = new Map<number, Map<string, string | null>>();
    for (const row of tagRows) {
      if (!tagsBySongId.has(row.song_id)) tagsBySongId.set(row.song_id, new Map());
      tagsBySongId.get(row.song_id)!.set(row.key, row.value);
    }

    const columnsByFolder = new Map<string, string[]>();
    const insertTag = db.prepare('INSERT INTO tag (song_id, key, value) VALUES (?, ?, ?)');
    for (const song of songs) {
      if (song.kind !== 'file') continue;
      if (!columnsByFolder.has(song.folder)) columnsByFolder.set(song.folder, readColumns(db, song.folder));

      const knownTags = tagsBySongId.get(song.id) ?? new Map<string, string | null>();
      const missingKeys = columnsByFolder.get(song.folder)!.filter(key => !knownTags.has(key));
      if (missingKeys.length === 0) continue;

      tagsBySongId.set(song.id, knownTags);
      try {
        const { tags } = await songMetadata.extractFileMetadata(song.path, missingKeys);
        for (const key of missingKeys) {
          const value = tags[key] ?? null;
          insertTag.run(song.id, key, value);
          knownTags.set(key, value);
        }
      } catch (err) {
        console.warn(`Failed to extract tags for ${song.path}:`, err);
      }
    }

    return songs.map(song => {
      const tags: Record<string, string> = {};
      for (const [key, value] of tagsBySongId.get(song.id) ?? []) {
        if (value != null) tags[key] = value;
      }
      return {
        id: String(song.id),
        path: song.path,
        kind: song.kind,
        duration: song.duration,
        tags,
        folder: song.folder,
      };
    });
  } finally {
    db.close();
  }
}

function normalizeSongUrl(kind: string, url: string): string {
  if (kind === 'youtube') {
    const videoId = songMetadata.extractYouTubeVideoId(url);
    if (videoId) return `https://www.youtube.com/watch?v=${videoId}`;
  }
  return url;
}

export function addUrlSong(dbPath: string, kind: string, url: string, folder: string, metadata: ExtractedMetadata): LibrarySong {
  const normalizedUrl = normalizeSongUrl(kind, url);
  const { tags, duration } = metadata;
  const db = openLibraryDatabase(dbPath);
  let songId: number;
  try {
    ({ lastInsertRowid: songId } = db
      .prepare('INSERT INTO song (path, kind, duration, folder) VALUES (?, ?, ?, ?)')
      .run(normalizedUrl, kind, duration, folder) as { lastInsertRowid: number });
    const insertTag = db.prepare('INSERT INTO tag (song_id, key, value) VALUES (?, ?, ?)');
    for (const [key, value] of Object.entries(tags)) {
      insertTag.run(songId, key, value);
    }
  } finally {
    db.close();
  }

  return { id: String(songId), path: normalizedUrl, kind, duration, tags, folder };
}

export function setSongTag(dbPath: string, id: string, key: string, value: string): void {
  const db = openLibraryDatabase(dbPath);
  try {
    db.prepare(`
      INSERT INTO tag (song_id, key, value) VALUES (?, ?, ?)
      ON CONFLICT (song_id, key) DO UPDATE SET value = excluded.value
    `).run(Number(id), key, value);
  } finally {
    db.close();
  }
}

export function removeLibrarySong(dbPath: string, id: string): void {
  const db = openLibraryDatabase(dbPath);
  try {
    db.prepare('DELETE FROM tag WHERE song_id = ?').run(Number(id));
    db.prepare('DELETE FROM song WHERE id = ?').run(Number(id));
  } finally {
    db.close();
  }
}

export function getLibrarySong(dbPath: string, id: string): LibrarySong | null {
  const db = openLibraryDatabase(dbPath);
  let song: { id: number, path: string, kind: string, duration: number | null, folder: string } | undefined;
  let tagRows: { key: string, value: string | null }[];
  try {
    song = db.prepare('SELECT id, path, kind, duration, folder FROM song WHERE id = ?').get(Number(id)) as typeof song;
    if (!song) return null;
    tagRows = db.prepare('SELECT key, value FROM tag WHERE song_id = ?').all(song.id) as typeof tagRows;
  } finally {
    db.close();
  }

  return {
    id: String(song.id),
    path: song.path,
    kind: song.kind,
    duration: song.duration,
    tags: Object.fromEntries(tagRows.filter(row => row.value != null).map(row => [row.key, row.value as string])),
    folder: song.folder,
  };
}
