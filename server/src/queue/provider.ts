import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { BandcampSong, FileSong, YouTubeSong } from '../song/provider';
import { extractBandcampMetadata, extractYouTubeMetadata, extractFileMetadataFromBuffer } from 'hiddenite/playback-event';
import { listLibrarySongs } from 'hiddenite/library';
import type { LibrarySong } from 'hiddenite/library';
import type { ExtractedMetadata, Song } from 'hiddenite';
import { config } from '../config';

export const URL_SONG_KINDS = {
  bandcamp: BandcampSong,
  youtube: YouTubeSong,
};

const AUTO_ADD_TARGET = 3;

export class QueueSong {
  song: Song;
  data?: Buffer;
  metadata: ExtractedMetadata;

  constructor(song: Song, data: Buffer | undefined, metadata: ExtractedMetadata) {
    this.song = song;
    this.data = data;
    this.metadata = metadata;
  }

  static async create(
    song: Song,
    data?: Buffer,
    metadata?: ExtractedMetadata,
  ): Promise<QueueSong> {
    return new QueueSong(song, data, metadata ?? await QueueSong.extractMetadata(song, data));
  }

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

  toJSON() {
    return { id: this.song.id, kind: this.song.kind, tags: this.metadata.tags, duration: this.metadata.duration };
  }
}

export class Queue {
  private static count = 0;

  id: string;
  name: string;
  songs: QueueSong[];
  shuffle: boolean;
  repeat: boolean;
  autoAdd: boolean;
  filter: string;

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
    this.songs = [];
    this.shuffle = false;
    this.repeat = false;
    this.autoAdd = false;
    this.filter = '';
  }

  static create(): Queue {
    Queue.count += 1;
    return new Queue(randomUUID(), `Queue ${Queue.count}`);
  }
}

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

function matchesFilter(librarySong: LibrarySong, filter: string): boolean {
  if (!filter) return true;
  const needle = filter.toLowerCase();
  return Object.values(librarySong.tags).some((value) => value.toLowerCase().includes(needle));
}

function pickRandom<T>(items: T[], count: number): T[] {
  const pool = [...items];
  const picked: T[] = [];
  while (pool.length > 0 && picked.length < count) {
    const index = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(index, 1)[0]);
  }
  return picked;
}

export async function refillQueueIfNeeded(queue: Queue): Promise<void> {
  if (!queue.autoAdd) return;
  const needed = AUTO_ADD_TARGET - queue.songs.length;
  if (needed <= 0) return;

  const queuedPaths = new Set(queue.songs.map((entry) => entry.song.path));
  const candidates = listLibrarySongs(config.database.path).filter(
    (librarySong) => matchesFilter(librarySong, queue.filter) && !queuedPaths.has(librarySong.path),
  );
  if (candidates.length === 0) return;

  for (const librarySong of pickRandom(candidates, needed)) {
    queue.songs.push(await createQueueSongFromLibrarySong(librarySong));
  }
}
