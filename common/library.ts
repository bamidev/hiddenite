/**
 * Sqlite-backed music library: manages the `song`, `tag`, and `column` tables that
 * store scanned/added songs, their tag values, and each folder's configured display
 * columns, plus the folder-scanning logic that populates them from disk.
 */

import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs/promises';
import path from 'node:path';
import * as songMetadata from './song-metadata.js';
import type { ExtractedMetadata } from './playback-event.js';

const AUDIO_EXTENSIONS = new Set(['.mp3', '.flac', '.wav', '.ogg', '.m4a', '.aac']);
const DEFAULT_COLUMNS = ['artist', 'album', 'title'];

/**
 * A song as stored in and returned from the library database.
 */
export interface LibrarySong {
  /** Database row id, as a string. */
  id: string;
  /** Filesystem path for local files, or the source URL for streamed songs. */
  path: string;
  /** Source type of the song, e.g. `'file'`, `'youtube'`, or `'bandcamp'`. */
  kind: string;
  /** Duration in milliseconds, or `null` if unknown. */
  duration: number | null;
  /** Tag values keyed by tag name, excluding any tags with no value. */
  tags: Record<string, string>;
  /** Library folder (root directory or logical grouping) the song belongs to. */
  folder: string;
}

/**
 * Opens (creating if necessary) the sqlite database at `dbPath` and ensures the
 * `song`, `tag`, and `column` tables exist.
 *
 * @param dbPath Filesystem path to the sqlite database file.
 * @returns An open database handle; the caller is responsible for closing it.
 */
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

/**
 * Populates a folder's `column` rows with {@link DEFAULT_COLUMNS} if it has none yet,
 * so a folder always has a usable set of display columns the first time it's queried.
 *
 * @param db Open library database handle.
 * @param folder Folder to seed default columns for.
 */
function ensureColumnsSeeded(db: DatabaseSync, folder: string): void {
  const { count } = db.prepare('SELECT COUNT(*) AS count FROM column WHERE folder = ?').get(folder) as { count: number };
  if (count === 0) {
    const insertColumn = db.prepare('INSERT INTO column (folder, position, key) VALUES (?, ?, ?)');
    DEFAULT_COLUMNS.forEach((key, position) => insertColumn.run(folder, position, key));
  }
}

/**
 * Reads the ordered list of display column keys configured for a folder.
 * Also seeds the default columns for the folder the first time it's read (e.g. when its
 * library is first loaded), so the defaults are actually persisted, not just implied.
 *
 * @param db Open library database handle.
 * @param folder Folder to read display columns for.
 * @returns Column keys in display order.
 */
function readColumns(db: DatabaseSync, folder: string): string[] {
  ensureColumnsSeeded(db, folder);
  const rows = db.prepare('SELECT key FROM column WHERE folder = ? ORDER BY position').all(folder) as { key: string }[];
  return rows.map(row => row.key);
}

/**
 * Public accessor for a folder's configured display columns, opening and closing
 * its own database handle.
 *
 * @param dbPath Path to the sqlite database file.
 * @param folder Folder to list display columns for.
 * @returns Column keys in display order.
 */
export function listColumns(dbPath: string, folder: string): string[] {
  const db = openLibraryDatabase(dbPath);
  try {
    return readColumns(db, folder);
  } finally {
    db.close();
  }
}

// Tag keys that are always extracted for a file, on top of whatever display columns are
// configured, because they drive playback behavior rather than being shown in the table.
const IMPLICIT_TAG_KEYS = ['replaygain_track_gain', 'replaygain_track_peak', 'replaygain_album_gain', 'replaygain_album_peak'];

/**
 * Combines a folder's configured display columns with the always-extracted implicit
 * tag keys (ReplayGain fields), deduplicated.
 *
 * @param db Open library database handle.
 * @param folder Folder to compute extractable tag keys for.
 * @returns Tag keys that should be extracted for files in this folder.
 */
function extractableTagKeys(db: DatabaseSync, folder: string): string[] {
  return [...new Set([...readColumns(db, folder), ...IMPLICIT_TAG_KEYS])];
}

/**
 * Public accessor for the set of tag keys that get extracted for files in a folder
 * (display columns plus implicit keys), opening and closing its own database handle.
 *
 * @param dbPath Path to the sqlite database file.
 * @param folder Folder to compute extractable tag keys for.
 * @returns Tag keys that should be extracted for files in this folder.
 */
export function listExtractableTagKeys(dbPath: string, folder: string): string[] {
  const db = openLibraryDatabase(dbPath);
  try {
    return extractableTagKeys(db, folder);
  } finally {
    db.close();
  }
}

/**
 * Adds a new display column for a folder, appended after its existing columns.
 * Has no effect if the column already exists (per the table's primary key).
 *
 * @param dbPath Path to the sqlite database file.
 * @param folder Folder to add the column to.
 * @param key Tag key to add as a display column.
 */
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

/**
 * Removes a display column from a folder.
 *
 * @param dbPath Path to the sqlite database file.
 * @param folder Folder to remove the column from.
 * @param key Tag key of the column to remove.
 */
export function removeColumn(dbPath: string, folder: string, key: string): void {
  const db = openLibraryDatabase(dbPath);
  try {
    ensureColumnsSeeded(db, folder);
    db.prepare('DELETE FROM column WHERE folder = ? AND key = ?').run(folder, key);
  } finally {
    db.close();
  }
}

/**
 * Recursively walks a directory and collects the paths of all files whose extension
 * matches {@link AUDIO_EXTENSIONS}.
 *
 * @param dir Directory to search, walked recursively.
 * @returns Absolute/relative paths (matching `dir`'s form) of found audio files.
 */
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

/**
 * Rescans a set of root directories, replacing all previously scan-added songs (and
 * their tags) for each directory's folder with freshly discovered audio files and
 * extracted tags. Songs added manually (not via scanning, i.e. `added_by_scan = 0`,
 * such as YouTube/Bandcamp entries) are left untouched. Files that fail metadata
 * extraction are skipped with a warning rather than aborting the whole scan.
 *
 * @param dbPath Path to the sqlite database file.
 * @param rootDirs Directories to scan; each directory's path also serves as its library folder identifier.
 * @returns Total number of audio files successfully scanned and inserted across all directories.
 */
export async function rescanLibrary(dbPath: string, rootDirs: string[]): Promise<number> {
  const filesByFolder = await Promise.all(rootDirs.map(async folder => ({
    folder,
    files: await findAudioFiles(folder),
  })));
  const db = openLibraryDatabase(dbPath);

  const deleteTags = db.prepare('DELETE FROM tag WHERE song_id IN (SELECT id FROM song WHERE folder = ? AND added_by_scan = 1)');
  const deleteSongs = db.prepare('DELETE FROM song WHERE folder = ? AND added_by_scan = 1');
  const insertSong = db.prepare('INSERT INTO song (path, kind, duration, folder, added_by_scan) VALUES (?, ?, ?, ?, 1)');
  const insertTag = db.prepare('INSERT INTO tag (song_id, key, value) VALUES (?, ?, ?)');

  let fileCount = 0;
  try {
    for (const { folder, files } of filesByFolder) {
      deleteTags.run(folder);
      deleteSongs.run(folder);
      const tagKeys = extractableTagKeys(db, folder);
      for (const filePath of files) {
        let metadata: ExtractedMetadata;
        try {
          metadata = await songMetadata.extractFileMetadata(filePath, tagKeys);
        } catch (err) {
          console.warn(`Skipping library file ${filePath}:`, err);
          continue;
        }

        const { tags, duration } = metadata;
        const { lastInsertRowid: songId } = insertSong.run(filePath, 'file', duration, folder);
        for (const key of tagKeys) {
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

/**
 * Filter criteria for {@link listLibrarySongs}.
 */
export interface LibrarySongQuery {
  /** Restrict results to songs in this folder; when omitted, songs from all folders are returned. */
  folder?: string;
  /** Case-insensitive substring to match against any of a song's tag values. */
  filter?: string;
}

/**
 * Lists songs from the library matching an optional folder/filter query. As a side
 * effect, for file-based songs missing any of their folder's currently extractable
 * tag keys (e.g. because a display column was added after the song was scanned), this
 * lazily extracts and persists the missing tags before returning results, so the
 * returned songs are always up to date with the folder's current column configuration.
 *
 * @param dbPath Path to the sqlite database file.
 * @param query Optional folder/filter criteria to restrict the results; defaults to no filtering.
 * @returns Matching songs, each with its full set of known tag values.
 */
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
      if (!columnsByFolder.has(song.folder)) columnsByFolder.set(song.folder, extractableTagKeys(db, song.folder));

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

/**
 * Canonicalizes a song URL before it's stored, currently only rewriting YouTube URLs
 * to their standard `watch?v=` form (e.g. collapsing `youtu.be` short links) so the
 * same video isn't stored under multiple differently-formatted URLs.
 *
 * @param kind Source type of the song, e.g. `'youtube'`.
 * @param url URL as provided by the caller.
 * @returns The canonicalized URL, or the original `url` unchanged if no normalization applies.
 */
function normalizeSongUrl(kind: string, url: string): string {
  if (kind === 'youtube') {
    const videoId = songMetadata.extractYouTubeVideoId(url);
    if (videoId) return `https://www.youtube.com/watch?v=${videoId}`;
  }
  return url;
}

/**
 * Adds a non-file (e.g. YouTube/Bandcamp) song to the library, storing its already-extracted
 * metadata as tags. Unlike scanned files, these songs are not marked `added_by_scan`
 * and so survive {@link rescanLibrary}.
 *
 * @param dbPath Path to the sqlite database file.
 * @param kind Source type of the song, e.g. `'youtube'` or `'bandcamp'`.
 * @param url Source URL of the song; normalized via {@link normalizeSongUrl} before storing.
 * @param folder Library folder to add the song to.
 * @param metadata Previously extracted tags and duration to store for the song.
 * @returns The newly created library song, including its assigned id.
 */
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

/**
 * Sets (inserting or overwriting) a single tag value on a song.
 *
 * @param dbPath Path to the sqlite database file.
 * @param id Id of the song to update.
 * @param key Tag key to set.
 * @param value New value for the tag.
 */
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

/**
 * Deletes a song and all of its tags from the library.
 *
 * @param dbPath Path to the sqlite database file.
 * @param id Id of the song to remove.
 */
export function removeLibrarySong(dbPath: string, id: string): void {
  const db = openLibraryDatabase(dbPath);
  try {
    db.prepare('DELETE FROM tag WHERE song_id = ?').run(Number(id));
    db.prepare('DELETE FROM song WHERE id = ?').run(Number(id));
  } finally {
    db.close();
  }
}

/**
 * Fetches a single song by id, including its tags.
 *
 * @param dbPath Path to the sqlite database file.
 * @param id Id of the song to fetch.
 * @returns The song, or `null` if no song with that id exists.
 */
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
