import { Queue } from '../queue/provider';

export interface MixSource {
  id: string;
  name: string;
}

export class QueuePoolMixSource implements MixSource {
  id: string;
  name: string;
  queues: Queue[] = [];

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
  }
}
