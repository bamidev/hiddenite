import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs/promises';
import path from 'node:path';
import * as songMetadata from './song-metadata.js';
import type { ExtractedMetadata } from './playback-event.js';

const AUDIO_EXTENSIONS = new Set(['.mp3', '.flac', '.wav', '.ogg', '.m4a', '.aac']);

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
      value TEXT NOT NULL,
      PRIMARY KEY (song_id, key)
    )
  `);
  return db;
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
      for (const filePath of files) {
        let metadata: ExtractedMetadata;
        try {
          metadata = await songMetadata.extractFileMetadata(filePath);
        } catch (err) {
          console.warn(`Skipping library file ${filePath}:`, err);
          continue;
        }

        const { tags, duration } = metadata;
        const { lastInsertRowid: songId } = insertSong.run(filePath, 'file', duration, folder);
        for (const [key, value] of Object.entries(tags)) {
          insertTag.run(songId as number, key, value);
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

export function listLibrarySongs(dbPath: string, query: LibrarySongQuery = {}): LibrarySong[] {
  const db = openLibraryDatabase(dbPath);
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

  let songs: { id: number, path: string, kind: string, duration: number | null, folder: string }[];
  let tagRows: { song_id: number, key: string, value: string }[];
  try {
    songs = db.prepare(`SELECT id, path, kind, duration, folder FROM song ${where}`).all(...params) as typeof songs;
    const songIds = songs.map(song => song.id);
    tagRows = songIds.length > 0
      ? db.prepare(`SELECT song_id, key, value FROM tag WHERE song_id IN (${songIds.map(() => '?').join(',')})`).all(...songIds) as typeof tagRows
      : [];
  } finally {
    db.close();
  }

  const tagsBySongId = new Map<number, Record<string, string>>();
  for (const row of tagRows) {
    if (!tagsBySongId.has(row.song_id)) tagsBySongId.set(row.song_id, {});
    tagsBySongId.get(row.song_id)![row.key] = row.value;
  }

  return songs.map(song => ({
    id: String(song.id),
    path: song.path,
    kind: song.kind,
    duration: song.duration,
    tags: tagsBySongId.get(song.id) ?? {},
    folder: song.folder,
  }));
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
  let tagRows: { key: string, value: string }[];
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
    tags: Object.fromEntries(tagRows.map(row => [row.key, row.value])),
    folder: song.folder,
  };
}
