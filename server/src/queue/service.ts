import { Injectable, NotFoundException } from '@nestjs/common';
import { Queue, QueueSong } from './provider';

@Injectable()
export class QueueService {
  private readonly queues: Queue[] = [];

  create(): Queue {
    const queue = Queue.create();
    this.queues.push(queue);
    return queue;
  }

  addSong(queueId: string, song: QueueSong): Queue {
    const queue = this.findOne(queueId);
    queue.songs.push(song);
    return queue;
  }

  listSongs(queueId: string) {
    const queue = this.findOne(queueId);
    return queue.songs.map((entry) => entry.toJSON());
  }

  removeSong(queueId: string, songId: string): Queue {
    const queue = this.findOne(queueId);
    queue.songs = queue.songs.filter((entry) => entry.song.id !== songId);
    return queue;
  }

  rename(queueId: string, name: string): Queue {
    const queue = this.findOne(queueId);
    queue.name = name;
    return queue;
  }

  toggleShuffle(queueId: string): Queue {
    const queue = this.findOne(queueId);
    queue.shuffle = !queue.shuffle;
    return queue;
  }

  toggleRepeat(queueId: string): Queue {
    const queue = this.findOne(queueId);
    queue.repeat = !queue.repeat;
    return queue;
  }

  toggleAutoAdd(queueId: string): Queue {
    const queue = this.findOne(queueId);
    queue.autoAdd = !queue.autoAdd;
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
