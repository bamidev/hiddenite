import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import type { MixSource } from './provider';
import { MixSourceService } from './service';
import type { Queue } from '../queue/provider';

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

  @Put(':id/queue')
  addQueue(@Param('id') id: string): Queue {
    return this.service.addQueue(id);
  }

  @Put(':id/name')
  rename(@Param('id') id: string, @Body('name') name: string): MixSource {
    return this.service.rename(id, name);
  }

  @Post(':id/play')
  togglePlay(@Param('id') id: string): MixSource {
    return this.service.togglePlay(id);
  }
}
