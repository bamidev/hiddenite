/**
 * Defines mix sources: playback state machines that play songs pulled from
 * a pool of attached queues. `QueuePoolMixSource` is the concrete
 * implementation, tracking playback position with a timer and emitting
 * `PlaybackEvent`s (play/pause/new) that clients can subscribe to over SSE.
 */
import { Subject } from 'rxjs';
import { readFile } from 'node:fs/promises';
import { Queue, QueueSong, refillQueueIfNeeded } from '../queue/provider';
import { FileSong } from '../song/provider';
import type {
  PlaybackEvent,
  PlayPlaybackEvent,
  PausePlaybackEvent,
  NewPlaybackEvent,
} from 'hiddenite';

/** Minimal identity of a mix source, as seen by consumers that don't need playback details. */
export interface MixSource {
  /** Unique id of the mix source. */
  id: string;
  /** Display name of the mix source. */
  name: string;
}

/**
 * A mix source that plays songs pulled round-robin from a pool of attached
 * queues. Tracks play/pause state and elapsed playback time, automatically
 * advances to the next song when the current one finishes (via a timer
 * scheduled for the song's duration), and emits `PlaybackEvent`s for
 * clients subscribed over SSE.
 */
export class QueuePoolMixSource implements MixSource {
  id: string;
  name: string;
  queues: Queue[];
  playing: boolean;
  currentSong: QueueSong | null;
  /** Stream of playback events (play/pause/new) that clients can subscribe to. */
  readonly events = new Subject<PlaybackEvent>();
  /** Wall-clock timestamp (ms) when playback of the current song last (re)started, or null while paused/stopped. */
  private startedAt: number | null;
  /** Milliseconds of the current song already played through as of the last pause/seek reference point. */
  private elapsedMs: number;
  /** Timer scheduled to advance to the next song when the current one finishes, or null when none is scheduled. */
  private timer: NodeJS.Timeout | null;

  /**
   * @param id unique id for this mix source.
   * @param name display name for this mix source.
   * @param queues initial pool of queues to pull songs from.
   */
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

  /**
   * Toggles playback: pauses if currently playing, otherwise starts/resumes
   * playback.
   */
  async togglePlay(): Promise<void> {
    if (this.playing) {
      this.pause();
    } else {
      await this.play();
    }
  }

  /**
   * Starts or resumes playback. If a song is already loaded as current, it
   * resumes from its stored elapsed position; otherwise it pulls the next
   * song from the queue pool, loads its audio data if needed, and emits a
   * `new` event. Schedules the auto-advance timer and emits a `play` event
   * when a song is already loaded.
   */
  private async play(): Promise<void> {
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

    const taken = await this.takeFirstSong();
    if (!taken) return;
    if (taken.song.data === undefined && taken.song.song instanceof FileSong) {
      taken.song.data = await readFile(taken.song.song.path);
    }
    this.currentSong = taken.song;
    this.elapsedMs = 0;

    this.playing = true;
    this.startedAt = Date.now();
    this.scheduleAdvance();
    this.emitNew(taken.queueId);
  }

  /**
   * Pauses playback: freezes the elapsed time, clears the auto-advance
   * timer, and emits a `pause` event.
   */
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

  /**
   * Called when the current song finishes: pulls the next song from the
   * queue pool (loading its audio data if needed), resets the elapsed
   * timer, and either schedules the next auto-advance and emits a `new`
   * event, or stops playback if the pool is now empty.
   */
  private async advance(): Promise<void> {
    const taken = await this.takeFirstSong();
    if (taken && taken.song.data === undefined && taken.song.song instanceof FileSong) {
      taken.song.data = await readFile(taken.song.song.path);
    }
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

  /**
   * Emits a `new` playback event for the current song, if one is loaded.
   * @param queueId id of the queue the current song was pulled from.
   */
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

  /**
   * (Re)schedules the timer that will call `advance()` when the current
   * song's remaining playback time elapses. Does nothing if the current
   * song has no known duration.
   */
  private scheduleAdvance(): void {
    this.clearTimer();
    const duration = this.currentSong?.metadata.duration;
    if (!duration) return;
    const remaining = duration - this.getElapsed();
    this.timer = setTimeout(() => this.advance(), Math.max(0, remaining));
  }

  /** Clears the pending auto-advance timer, if any. */
  private clearTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  /**
   * Computes how far into the current song playback has progressed.
   * @returns elapsed milliseconds, accounting for time passed since `startedAt` while playing.
   */
  getElapsed(): number {
    if (this.playing && this.startedAt !== null) {
      return this.elapsedMs + (Date.now() - this.startedAt);
    }
    return this.elapsedMs;
  }

  /**
   * Pulls the next available song from the first non-empty queue in the
   * pool (in pool order), removing it from that queue and triggering a
   * refill of that queue if it has auto-add enabled.
   * @returns the taken song along with the id of the queue it came from, or null if every queue is empty.
   */
  private async takeFirstSong(): Promise<{ song: QueueSong; queueId: string } | null> {
    for (const queue of this.queues) {
      if (queue.songs.length > 0) {
        const song = queue.songs.shift();
        if (song) {
          await refillQueueIfNeeded(queue);
          return { song, queueId: queue.id };
        }
      }
    }
    return null;
  }

  /**
   * Serializes the mix source for API responses, replacing the derived
   * elapsed getter with a computed `elapsedMs` field and expanding the
   * current song with its metadata.
   * @returns a plain-object representation suitable for JSON serialization.
   */
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
