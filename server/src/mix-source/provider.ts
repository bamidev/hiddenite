import { Queue, QueueSong } from '../queue/provider';

export interface MixSource {
  id: string;
  name: string;
}

export class QueuePoolMixSource implements MixSource {
  id: string;
  name: string;
  queues: Queue[];
  playing: boolean;
  currentSong: QueueSong | null;
  private startedAt: number | null;
  private elapsedMs: number;

  constructor(id: string, name: string, queues: Queue[] = []) {
    this.id = id;
    this.name = name;
    this.queues = queues;
    this.playing = false;
    this.currentSong = null;
    this.startedAt = null;
    this.elapsedMs = 0;
  }

  togglePlay(): void {
    if (this.playing) {
      this.elapsedMs = this.getElapsedMs();
      this.playing = false;
      this.startedAt = null;
      return;
    }

    if (!this.currentSong) {
      const song = this.findFirstSong();
      if (!song) return;
      this.currentSong = song;
      this.elapsedMs = 0;
    }

    this.playing = true;
    this.startedAt = Date.now();
  }

  getElapsedMs(): number {
    if (this.playing && this.startedAt !== null) {
      return this.elapsedMs + (Date.now() - this.startedAt);
    }
    return this.elapsedMs;
  }

  private findFirstSong(): QueueSong | null {
    for (const queue of this.queues) {
      if (queue.songs.length > 0) {
        return queue.songs[0];
      }
    }
    return null;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      queues: this.queues,
      playing: this.playing,
      currentSongId: this.currentSong?.song.id ?? null,
      elapsedMs: this.getElapsedMs(),
    };
  }
}
