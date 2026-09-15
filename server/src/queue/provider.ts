import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, extname } from 'node:path';
import { FileSong, Song } from '../song/provider';

export class QueueSong {
  song: Song;
  data?: Buffer;
  tags: Record<string, string>;

  constructor(song: Song, data: Buffer | undefined, tags: Record<string, string>) {
    this.song = song;
    this.data = data;
    this.tags = tags;
  }

  static async create(song: Song, data?: Buffer): Promise<QueueSong> {
    const tags = await QueueSong.extractTags(song, data);
    return new QueueSong(song, data, tags);
  }

  private static async extractTags(
    song: Song,
    data?: Buffer,
  ): Promise<Record<string, string>> {
    if (!(song instanceof FileSong) || !data) {
      // TODO: resolve tags for non-file songs (e.g. YouTube metadata)
      return {};
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
        return tags;
      } finally {
        file.dispose();
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  toJSON() {
    return { id: this.song.id, kind: this.song.kind, tags: this.tags };
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
