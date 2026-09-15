import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { MixSource, QueuePoolMixSource } from './provider';
import { QueueService } from '../queue/service';
import type { Queue } from '../queue/provider';

@Injectable()
export class MixSourceService {
  private readonly sources: MixSource[] = [];

  constructor(private readonly queueService: QueueService) {
    this.queueService = queueService;
  }

  findAll(): MixSource[] {
    return this.sources;
  }

  create(): MixSource {
    const source = new QueuePoolMixSource(
      randomUUID(),
      `Mix source ${this.sources.length + 1}`,
    );
    this.sources.push(source);
    return source;
  }

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

  rename(mixSourceId: string, name: string): MixSource {
    const source = this.findOne(mixSourceId);
    source.name = name;
    return source;
  }

  private findOne(id: string): MixSource {
    const source = this.sources.find((s) => s.id === id);
    if (!source) {
      throw new NotFoundException(`Mix source ${id} not found`);
    }
    return source;
  }
}
