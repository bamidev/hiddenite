import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { MixSource } from './provider';

@Injectable()
export class MixSourceService {
  private readonly sources: MixSource[] = [];

  findAll(): MixSource[] {
    return this.sources;
  }

  create(): MixSource {
    const source: MixSource = {
      id: randomUUID(),
      name: `Mix source ${this.sources.length + 1}`,
    };
    this.sources.push(source);
    return source;
  }
}
