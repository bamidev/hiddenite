import { Body, Controller, Param, Post, Put } from '@nestjs/common';
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

  @Put(':id/name')
  rename(@Param('id') id: string, @Body('name') name: string): Queue {
    return this.service.rename(id, name);
  }

  @Post(':id/shuffle')
  toggleShuffle(@Param('id') id: string): Queue {
    return this.service.toggleShuffle(id);
  }

  @Post(':id/repeat')
  toggleRepeat(@Param('id') id: string): Queue {
    return this.service.toggleRepeat(id);
  }
}
