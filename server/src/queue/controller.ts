import { Body, Controller, Param, Put } from '@nestjs/common';
import type { Queue } from './provider';
import { QueueService } from './service';
import type { Song } from '../song/provider';

@Controller('queue')
export class QueueController {
  constructor(private readonly service: QueueService) {
    this.service = service;
  }

  @Put(':id/song')
  addSong(@Param('id') id: string, @Body() song: Song): Queue {
    return this.service.addSong(id, song);
  }
}
