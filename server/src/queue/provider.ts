import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, extname } from 'node:path';
import { FileSong, Song } from '../song/provider';
import type { ExtractedMetadata } from 'common';

export class QueueSong {
  song: Song;
  data?: Buffer;
  metadata: ExtractedMetadata;

  constructor(song: Song, data: Buffer | undefined, metadata: ExtractedMetadata) {
    this.song = song;
    this.data = data;
    this.metadata = metadata;
  }

  static async create(song: Song, data?: Buffer): Promise<QueueSong> {
    const metadata = await QueueSong.extractMetadata(song, data);
    return new QueueSong(song, data, metadata);
  }

  private static async extractMetadata(
    song: Song,
    data?: Buffer,
  ): Promise<ExtractedMetadata> {
    if (!(song instanceof FileSong) || !data) {
      // TODO: resolve metadata for non-file songs (e.g. YouTube)
      return { tags: {}, duration: null };
    }

    const TagLib = await import('node-taglib-sharp');
    const dir = await mkdtemp(join(tmpdir(), 'party-player-'));
    const tmpPath = join(dir, `song${extname(song.path)}`);
    try {
      await writeFile(tmpPath, data);
      const file = TagLib.File.createFromPath(tmpPath);
      try {
        const tags: Record<string, string> = {};
        if (file.tag.firstPerformer) tags.artist = file.tag.firstPerformer;
        if (file.tag.album) tags.album = file.tag.album;
        if (file.tag.title) tags.title = file.tag.title;
        const duration = file.properties.durationMilliseconds || null;
        return { tags, duration };
      } finally {
        file.dispose();
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  toJSON() {
    return { id: this.song.id, kind: this.song.kind, tags: this.metadata.tags };
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

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
    this.songs = [];
    this.shuffle = false;
    this.repeat = false;
    this.autoAdd = false;
  }

  static create(): Queue {
    Queue.count += 1;
    return new Queue(randomUUID(), `Queue ${Queue.count}`);
  }
}
