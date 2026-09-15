import { Queue } from '../queue/provider';

export interface MixSource {
  id: string;
  name: string;
}

export class QueuePoolMixSource implements MixSource {
  id: string;
  name: string;
  queues: Queue[];
  playing: boolean;
  currentSongId: string | null;
  private startedAt: number | null;
  private elapsedMs: number;

  constructor(id: string, name: string, queues: Queue[] = []) {
    this.id = id;
    this.name = name;
    this.queues = queues;
    this.playing = false;
    this.currentSongId = null;
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

    if (!this.currentSongId) {
      const songId = this.findFirstSongId();
      if (!songId) return;
      this.currentSongId = songId;
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

  private findFirstSongId(): string | null {
    for (const queue of this.queues) {
      if (queue.songs.length > 0) {
        return queue.songs[0].song.id;
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
      currentSongId: this.currentSongId,
      elapsedMs: this.getElapsedMs(),
    };
  }
}
