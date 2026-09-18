import { Subject } from 'rxjs';
import { Queue, QueueSong } from '../queue/provider';
import type {
  PlaybackEvent,
  PlayPlaybackEvent,
  PausePlaybackEvent,
  NewPlaybackEvent,
} from 'hiddenite';

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
  readonly events = new Subject<PlaybackEvent>();
  private startedAt: number | null;
  private elapsedMs: number;
  private timer: NodeJS.Timeout | null;

  constructor(id: string, name: string, queues: Queue[] = []) {
    this.id = id;
    this.name = name;
    this.queues = queues;
    this.playing = false;
    this.currentSong = null;
    this.startedAt = null;
    this.elapsedMs = 0;
    this.timer = null;
  }

  togglePlay(): void {
    if (this.playing) {
      this.pause();
    } else {
      this.play();
    }
  }

  private play(): void {
    if (this.currentSong) {
      this.playing = true;
      this.startedAt = Date.now();
      this.scheduleAdvance();

      const event: PlayPlaybackEvent = {
        event: 'play',
        songId: this.currentSong.song.id,
        elapsed: this.getElapsed(),
      };
      this.events.next(event);
      return;
    }

    const taken = this.takeFirstSong();
    if (!taken) return;
    this.currentSong = taken.song;
    this.elapsedMs = 0;

    this.playing = true;
    this.startedAt = Date.now();
    this.scheduleAdvance();
    this.emitNew(taken.queueId);
  }

  private pause(): void {
    this.elapsedMs = this.getElapsed();
    this.playing = false;
    this.startedAt = null;
    this.clearTimer();

    const event: PausePlaybackEvent = {
      event: 'pause',
      songId: this.currentSong?.song.id ?? null,
    };
    this.events.next(event);
  }

  private advance(): void {
    const taken = this.takeFirstSong();
    this.currentSong = taken?.song ?? null;
    this.elapsedMs = 0;
    this.startedAt = taken ? Date.now() : null;
    this.playing = taken !== null;

    if (taken) {
      this.scheduleAdvance();
      this.emitNew(taken.queueId);
    } else {
      this.clearTimer();
    }
  }

  private emitNew(queueId: string): void {
    if (!this.currentSong) return;
    const event: NewPlaybackEvent = {
      event: 'new',
      songId: this.currentSong.song.id,
      queueId,
      song: { ...this.currentSong.song, metadata: this.currentSong.metadata },
      elapsed: this.getElapsed(),
    };
    this.events.next(event);
  }

  private scheduleAdvance(): void {
    this.clearTimer();
    const duration = this.currentSong?.metadata.duration;
    if (!duration) return;
    const remaining = duration - this.getElapsed();
    this.timer = setTimeout(() => this.advance(), Math.max(0, remaining));
  }

  private clearTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  getElapsed(): number {
    if (this.playing && this.startedAt !== null) {
      return this.elapsedMs + (Date.now() - this.startedAt);
    }
    return this.elapsedMs;
  }

  private takeFirstSong(): { song: QueueSong; queueId: string } | null {
    for (const queue of this.queues) {
      if (queue.songs.length > 0) {
        const song = queue.songs.shift();
        if (song) return { song, queueId: queue.id };
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
      currentSong: this.currentSong
        ? { ...this.currentSong.song, metadata: this.currentSong.metadata }
        : null,
      elapsedMs: this.getElapsed(),
    };
  }
}
