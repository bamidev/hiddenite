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
}

export function openLibraryDatabase(dbPath: string): DatabaseSync {
  const db = new DatabaseSync(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS song (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT NOT NULL UNIQUE,
      kind TEXT NOT NULL,
      duration INTEGER
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
  const fileLists = await Promise.all(rootDirs.map(dir => findAudioFiles(dir)));
  const files = fileLists.flat();
  const db = openLibraryDatabase(dbPath);

  db.exec('DELETE FROM tag');
  db.exec('DELETE FROM song');
  const insertSong = db.prepare('INSERT INTO song (path, kind, duration) VALUES (?, ?, ?)');
  const insertTag = db.prepare('INSERT INTO tag (song_id, key, value) VALUES (?, ?, ?)');

  try {
    for (const filePath of files) {
      const { tags, duration } = await songMetadata.extractFileMetadata(filePath);
      const { lastInsertRowid: songId } = insertSong.run(filePath, 'file', duration);
      for (const [key, value] of Object.entries(tags)) {
        insertTag.run(songId as number, key, value);
      }
    }
  } finally {
    db.close();
  }

  return files.length;
}

export function listLibrarySongs(dbPath: string): LibrarySong[] {
  const db = openLibraryDatabase(dbPath);
  let songs: { id: number, path: string, kind: string, duration: number | null }[];
  let tagRows: { song_id: number, key: string, value: string }[];
  try {
    songs = db.prepare('SELECT id, path, kind, duration FROM song').all() as typeof songs;
    tagRows = db.prepare('SELECT song_id, key, value FROM tag').all() as typeof tagRows;
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
  }));
}

export function addUrlSong(dbPath: string, kind: string, url: string, metadata: ExtractedMetadata): LibrarySong {
  const { tags, duration } = metadata;
  const db = openLibraryDatabase(dbPath);
  let songId: number;
  try {
    ({ lastInsertRowid: songId } = db
      .prepare('INSERT INTO song (path, kind, duration) VALUES (?, ?, ?)')
      .run(url, kind, duration) as { lastInsertRowid: number });
    const insertTag = db.prepare('INSERT INTO tag (song_id, key, value) VALUES (?, ?, ?)');
    for (const [key, value] of Object.entries(tags)) {
      insertTag.run(songId, key, value);
    }
  } finally {
    db.close();
  }

  return { id: String(songId), path: url, kind, duration, tags };
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
  let song: { id: number, path: string, kind: string, duration: number | null } | undefined;
  let tagRows: { key: string, value: string }[];
  try {
    song = db.prepare('SELECT id, path, kind, duration FROM song WHERE id = ?').get(Number(id)) as typeof song;
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
  };
}
