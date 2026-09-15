import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
import type { Queue } from './provider';
import { QueueSong } from './provider';
import { QueueService } from './service';
import { FileSong } from '../song/provider';

@Controller('queue')
export class QueueController {
  constructor(private readonly service: QueueService) {
    this.service = service;
  }

  @Put(':id/song')
  @UseInterceptors(FileInterceptor('file'))
  async addSong(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<Queue> {
    const song = new FileSong(randomUUID(), file.originalname);
    const queueSong = await QueueSong.create(song, file.buffer);
    return this.service.addSong(id, queueSong);
  }

  @Get(':id/songs')
  listSongs(@Param('id') id: string) {
    return this.service.listSongs(id);
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

  @Post(':id/auto-add')
  toggleAutoAdd(@Param('id') id: string): Queue {
    return this.service.toggleAutoAdd(id);
  }
}
