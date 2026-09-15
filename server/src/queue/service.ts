import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Queue } from './provider';
import { Song } from '../song/provider';

@Injectable()
export class QueueService {
  private readonly queues: Queue[] = [];

  create(): Queue {
    const queue: Queue = {
      id: randomUUID(),
      name: `Queue ${this.queues.length + 1}`,
      songs: [],
    };
    this.queues.push(queue);
    return queue;
  }

  addSong(queueId: string, song: Song): Queue {
    const queue = this.findOne(queueId);
    queue.songs.push(song);
    return queue;
  }

  rename(queueId: string, name: string): Queue {
    const queue = this.findOne(queueId);
    queue.name = name;
    return queue;
  }

  private findOne(id: string): Queue {
    const queue = this.queues.find((q) => q.id === id);
    if (!queue) {
      throw new NotFoundException(`Queue ${id} not found`);
    }
    return queue;
  }
}
