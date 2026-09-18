import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { BandcampSong, FileSong, YouTubeSong } from '../song/provider';
import { extractBandcampMetadata, extractYouTubeMetadata, extractFileMetadataFromBuffer } from 'hiddenite/playback-event';
import type { ExtractedMetadata, Song } from 'hiddenite';

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
