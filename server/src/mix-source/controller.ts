import { Controller, Get, Put } from '@nestjs/common';
import type { MixSource } from './provider';
import { MixSourceService } from './service';

@Controller('mix-source')
export class MixSourceController {
  constructor(private readonly service: MixSourceService) {
    this.service = service;
  }

  @Get()
  getMixSources(): MixSource[] {
    return this.service.findAll();
  }

  @Put()
  putMixSource(): MixSource {
    return this.service.create();
  }
}
