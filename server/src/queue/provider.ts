import { randomUUID } from 'node:crypto';
import { Song } from '../song/provider';

export class Queue {
  private static count = 0;

  id: string;
  name: string;
  songs: Song[];
  shuffle: boolean;
  repeat: boolean;

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
    this.songs = [];
    this.shuffle = false;
    this.repeat = false;
  }

  static create(): Queue {
    Queue.count += 1;
    return new Queue(randomUUID(), `Queue ${Queue.count}`);
  }
}
