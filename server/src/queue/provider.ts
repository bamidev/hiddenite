/**
 * Defines playback queues and the songs within them: `Queue` holds an
 * ordered list of `QueueSong`s plus playback-adjacent settings (shuffle,
 * repeat, auto-add), and this file provides helpers to build queue songs
 * (extracting metadata as needed) and to auto-refill a queue from the
 * library when it runs low.
 */
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { BandcampSong, FileSong, YouTubeSong } from '../song/provider';
import { extractBandcampMetadata, extractYouTubeMetadata, extractFileMetadataFromBuffer } from 'hiddenite/playback-event';
import { listLibrarySongs } from 'hiddenite/library';
import type { LibrarySong } from 'hiddenite/library';
import type { ExtractedMetadata, Song } from 'hiddenite';
import { config } from '../config';

/** Maps a URL-based song's `kind` string to the `Song` subclass that represents it. */
export const URL_SONG_KINDS = {
  bandcamp: BandcampSong,
  youtube: YouTubeSong,
};

/** Number of songs a queue with auto-add enabled tries to keep queued up. */
const AUTO_ADD_TARGET = 3;

/**
 * A song placed in a queue, pairing the underlying `Song` (file/URL
 * reference) with its extracted metadata and, optionally, its loaded audio
 * data.
 */
export class QueueSong {
  song: Song;
  /** Loaded audio bytes for the song, if fetched/uploaded; absent for URL-based songs until played. */
  data?: Buffer;
  metadata: ExtractedMetadata;

  constructor(song: Song, data: Buffer | undefined, metadata: ExtractedMetadata) {
    this.song = song;
    this.data = data;
    this.metadata = metadata;
  }

  /**
   * Creates a `QueueSong`, extracting metadata automatically if it isn't
   * supplied.
   * @param song the underlying song reference (file, Bandcamp, or YouTube).
   * @param data raw audio bytes for the song, when already available (e.g. an uploaded file).
   * @param metadata pre-known metadata to use instead of extracting it.
   * @returns the constructed `QueueSong`.
   */
  static async create(
    song: Song,
    data?: Buffer,
    metadata?: ExtractedMetadata,
  ): Promise<QueueSong> {
    return new QueueSong(song, data, metadata ?? await QueueSong.extractMetadata(song, data));
  }

  /**
   * Extracts metadata (tags/duration) for a song based on its kind: remote
   * lookup for Bandcamp/YouTube songs, or parsing the audio buffer for
   * uploaded files. Falls back to empty metadata if extraction isn't
   * possible (e.g. a file song with no buffer supplied).
   * @param song the song to extract metadata for.
   * @param data raw audio bytes, required to extract metadata for file songs.
   * @returns the extracted metadata.
   */
  private static async extractMetadata(
    song: Song,
    data?: Buffer,
  ): Promise<ExtractedMetadata> {
    if (song instanceof BandcampSong) {
      return extractBandcampMetadata(song.path);
    }

    if (song instanceof YouTubeSong) {
      return extractYouTubeMetadata(song.path);
    }

    if (song instanceof FileSong && data) {
      return extractFileMetadataFromBuffer(data, extname(song.path));
    }

    return { tags: {}, duration: null };
  }

  /**
   * Serializes the queue song for API responses, omitting the raw audio
   * data and the full song reference.
   * @returns a plain-object representation suitable for JSON serialization.
   */
  toJSON() {
    return { id: this.song.id, kind: this.song.kind, tags: this.metadata.tags, duration: this.metadata.duration };
  }
}

/**
 * An ordered list of songs to be played, along with playback-related
 * settings: shuffle, repeat, and auto-add (automatically topping up the
 * queue with songs from a library folder, optionally filtered).
 */
export class Queue {
  private static count = 0;

  id: string;
  name: string;
  songs: QueueSong[];
  shuffle: boolean;
  repeat: boolean;
  autoAdd: boolean;
  /** Library filter string applied when auto-adding songs. */
  filter: string;
  /** Library folder path auto-add pulls songs from, or null to pull from the whole library. */
  autoAddFolder: string | null;

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
    this.songs = [];
    this.shuffle = false;
    this.repeat = false;
    this.autoAdd = false;
    this.filter = '';
    this.autoAddFolder = config.library.folders[0]?.path ?? null;
  }

  /**
   * Creates a new queue with an auto-generated name and id.
   * @returns the newly created queue.
   */
  static create(): Queue {
    Queue.count += 1;
    return new Queue(randomUUID(), `Queue ${Queue.count}`);
  }
}

/**
 * Builds a `QueueSong` from an existing library song, reusing its already-known
 * metadata (tags/duration) rather than re-extracting it.
 * @param librarySong the library song to convert.
 * @returns the constructed `QueueSong`, referencing a new `Song` instance appropriate to the library song's kind.
 */
export async function createQueueSongFromLibrarySong(librarySong: LibrarySong): Promise<QueueSong> {
  const metadata: ExtractedMetadata = { tags: librarySong.tags, duration: librarySong.duration };

  if (librarySong.kind === 'file') {
    const song = new FileSong(randomUUID(), librarySong.path);
    return QueueSong.create(song, undefined, metadata);
  }

  const SongClass = URL_SONG_KINDS[librarySong.kind as keyof typeof URL_SONG_KINDS];
  if (!SongClass) {
    throw new Error(`Unsupported library song kind: ${librarySong.kind}`);
  }
  const song = new SongClass(randomUUID(), librarySong.path);
  return QueueSong.create(song, undefined, metadata);
}

/**
 * Picks a given number of random, distinct items from an array without
 * mutating the input.
 * @param items the items to pick from.
 * @param count how many items to pick; picks fewer if `items` is shorter.
 * @returns the picked items, in random order.
 */
function pickRandom<T>(items: T[], count: number): T[] {
  const pool = [...items];
  const picked: T[] = [];
  while (pool.length > 0 && picked.length < count) {
    const index = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(index, 1)[0]);
  }
  return picked;
}

/**
 * Tops up a queue with random songs from the library when auto-add is
 * enabled and the queue has fewer than `AUTO_ADD_TARGET` songs, respecting
 * the queue's configured folder and filter. Does nothing if auto-add is
 * off, the queue is already full enough, or no matching library songs are
 * found.
 * @param queue the queue to potentially refill; mutated in place by appending songs.
 */
export async function refillQueueIfNeeded(queue: Queue): Promise<void> {
  if (!queue.autoAdd) return;
  const needed = AUTO_ADD_TARGET - queue.songs.length;
  if (needed <= 0) return;

  const candidates = await listLibrarySongs(config.database.path, {
    folder: queue.autoAddFolder ?? undefined,
    filter: queue.filter,
  });
  if (candidates.length === 0) return;

  for (const librarySong of pickRandom(candidates, needed)) {
    queue.songs.push(await createQueueSongFromLibrarySong(librarySong));
  }
}
