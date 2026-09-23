/**
 * Business logic for playback queues: an in-memory registry of `Queue`
 * instances, with operations to create queues, add/remove songs, and
 * update their settings (name, shuffle, repeat, filter, auto-add). Setting
 * changes that affect auto-add eligibility trigger a refill check.
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { Queue, QueueSong, refillQueueIfNeeded } from './provider';

/**
 * Manages the set of playback queues in memory: creation, lookup, song
 * management, and settings updates.
 */
@Injectable()
export class QueueService {
  private readonly queues: Queue[] = [];

  /**
   * Creates a new, empty queue and registers it.
   * @returns the newly created queue.
   */
  create(): Queue {
    const queue = Queue.create();
    this.queues.push(queue);
    return queue;
  }

  /**
   * Appends a song to the end of a queue.
   * @param queueId id of the queue to add the song to.
   * @param song the queue song to add.
   * @returns the updated queue.
   */
  addSong(queueId: string, song: QueueSong): Queue {
    const queue = this.findOne(queueId);
    queue.songs.push(song);
    return queue;
  }

  /**
   * Lists the songs in a queue, serialized for API responses.
   * @param queueId id of the queue.
   * @returns the queue's songs.
   */
  listSongs(queueId: string) {
    const queue = this.findOne(queueId);
    return queue.songs.map((entry) => entry.toJSON());
  }

  /**
   * Removes a song from a queue by id, then refills the queue if auto-add
   * needs it.
   * @param queueId id of the queue.
   * @param songId id of the song to remove.
   * @returns the updated queue.
   */
  async removeSong(queueId: string, songId: string): Promise<Queue> {
    const queue = this.findOne(queueId);
    queue.songs = queue.songs.filter((entry) => entry.song.id !== songId);
    await refillQueueIfNeeded(queue);
    return queue;
  }

  /**
   * Renames a queue.
   * @param queueId id of the queue to rename.
   * @param name new display name.
   * @returns the updated queue.
   */
  rename(queueId: string, name: string): Queue {
    const queue = this.findOne(queueId);
    queue.name = name;
    return queue;
  }

  /**
   * Toggles the shuffle setting on a queue.
   * @param queueId id of the queue.
   * @returns the updated queue.
   */
  toggleShuffle(queueId: string): Queue {
    const queue = this.findOne(queueId);
    queue.shuffle = !queue.shuffle;
    return queue;
  }

  /**
   * Toggles the repeat setting on a queue.
   * @param queueId id of the queue.
   * @returns the updated queue.
   */
  toggleRepeat(queueId: string): Queue {
    const queue = this.findOne(queueId);
    queue.repeat = !queue.repeat;
    return queue;
  }

  /**
   * Toggles auto-add on a queue, refilling it immediately if it was just
   * enabled.
   * @param queueId id of the queue.
   * @returns the updated queue.
   */
  async toggleAutoAdd(queueId: string): Promise<Queue> {
    const queue = this.findOne(queueId);
    queue.autoAdd = !queue.autoAdd;
    await refillQueueIfNeeded(queue);
    return queue;
  }

  /**
   * Sets the library filter used by auto-add for a queue, then refills the
   * queue if needed under the new filter.
   * @param queueId id of the queue.
   * @param filter the new filter string.
   * @returns the updated queue.
   */
  async setFilter(queueId: string, filter: string): Promise<Queue> {
    const queue = this.findOne(queueId);
    queue.filter = filter;
    await refillQueueIfNeeded(queue);
    return queue;
  }

  /**
   * Sets the library folder auto-add pulls from for a queue, then refills
   * the queue if needed from the new folder.
   * @param queueId id of the queue.
   * @param folder the new folder path, or null to pull from the whole library.
   * @returns the updated queue.
   */
  async setAutoAddFolder(queueId: string, folder: string | null): Promise<Queue> {
    const queue = this.findOne(queueId);
    queue.autoAddFolder = folder;
    await refillQueueIfNeeded(queue);
    return queue;
  }

  /**
   * Looks up a queue by id.
   * @param id the queue's id.
   * @returns the matching queue.
   */
  private findOne(id: string): Queue {
    const queue = this.queues.find((q) => q.id === id);
    if (!queue) {
      throw new NotFoundException(`Queue ${id} not found`);
    }
    return queue;
  }
}
