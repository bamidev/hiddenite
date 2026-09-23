/**
 * Business logic for mix sources: an in-memory registry of `MixSource`
 * instances, with operations to create, rename, and control playback on
 * them. A mix source is created automatically at startup with one attached
 * queue, so there is always a default source available.
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Observable } from 'rxjs';
import { MixSource, QueuePoolMixSource } from './provider';
import { QueueService } from '../queue/service';
import type { Queue, QueueSong } from '../queue/provider';
import type { PlaybackEvent } from 'hiddenite';

/**
 * Manages the set of mix sources in memory: creation, lookup, renaming, and
 * delegating playback control/queue management to the underlying
 * `QueuePoolMixSource` instances.
 */
@Injectable()
export class MixSourceService {
  private readonly sources: MixSource[] = [];

  /**
   * @param queueService used to create queues attached to mix sources.
   */
  constructor(private readonly queueService: QueueService) {
    this.queueService = queueService;
    const source = this.create();
    this.addQueue(source.id);
  }

  /**
   * Lists all mix sources.
   * @returns all currently registered mix sources.
   */
  findAll(): MixSource[] {
    return this.sources;
  }

  /**
   * Creates a new mix source (with an auto-generated name) and registers it.
   * @returns the newly created mix source.
   */
  create(): MixSource {
    const source = new QueuePoolMixSource(
      randomUUID(),
      `Mix source ${this.sources.length + 1}`,
    );
    this.sources.push(source);
    return source;
  }

  /**
   * Creates a new queue and attaches it to a mix source's queue pool.
   * @param mixSourceId id of the mix source to attach the queue to; must support queues.
   * @returns the newly created queue.
   */
  addQueue(mixSourceId: string): Queue {
    const source = this.findOne(mixSourceId);
    if (!(source instanceof QueuePoolMixSource)) {
      throw new NotFoundException(
        `Mix source ${mixSourceId} does not support queues`,
      );
    }
    const queue = this.queueService.create();
    source.queues.push(queue);
    return queue;
  }

  /**
   * Renames a mix source.
   * @param mixSourceId id of the mix source to rename.
   * @param name new display name.
   * @returns the updated mix source.
   */
  rename(mixSourceId: string, name: string): MixSource {
    const source = this.findOne(mixSourceId);
    source.name = name;
    return source;
  }

  /**
   * Toggles play/pause on a mix source.
   * @param mixSourceId id of the mix source to toggle; must support playback.
   * @returns the mix source after the toggle has taken effect.
   */
  async togglePlay(mixSourceId: string): Promise<MixSource> {
    const source = this.findOne(mixSourceId);
    if (!(source instanceof QueuePoolMixSource)) {
      throw new NotFoundException(
        `Mix source ${mixSourceId} does not support playback`,
      );
    }
    await source.togglePlay();
    return source;
  }

  /**
   * Gets the song currently loaded on a mix source.
   * @param mixSourceId id of the mix source; must support playback and have a song currently loaded.
   * @returns the current queue song, including its audio data if loaded.
   */
  getCurrentSong(mixSourceId: string): QueueSong {
    const source = this.findOne(mixSourceId);
    if (!(source instanceof QueuePoolMixSource) || !source.currentSong) {
      throw new NotFoundException(`Mix source ${mixSourceId} has no song playing`);
    }
    return source.currentSong;
  }

  /**
   * Gets the observable stream of playback events for a mix source.
   * @param mixSourceId id of the mix source; must support playback.
   * @returns an observable emitting the source's playback events.
   */
  getEvents(mixSourceId: string): Observable<PlaybackEvent> {
    const source = this.findOne(mixSourceId);
    if (!(source instanceof QueuePoolMixSource)) {
      throw new NotFoundException(
        `Mix source ${mixSourceId} does not support playback`,
      );
    }
    return source.events.asObservable();
  }

  /**
   * Looks up a mix source by id.
   * @param id the mix source's id.
   * @returns the matching mix source.
   */
  private findOne(id: string): MixSource {
    const source = this.sources.find((s) => s.id === id);
    if (!source) {
      throw new NotFoundException(`Mix source ${id} not found`);
    }
    return source;
  }
}
