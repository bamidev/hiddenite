import {
  BadRequestException,
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
import { BandcampSong, FileSong, YouTubeSong } from '../song/provider';

const URL_SONG_KINDS = {
  bandcamp: BandcampSong,
  youtube: YouTubeSong,
};

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
    @Body('kind') kind: string,
    @Body('url') url: string,
  ): Promise<Queue> {
    if (file) {
      const song = new FileSong(randomUUID(), file.originalname);
      const queueSong = await QueueSong.create(song, file.buffer);
      return this.service.addSong(id, queueSong);
    }

    const SongClass = URL_SONG_KINDS[kind as keyof typeof URL_SONG_KINDS];
    if (!SongClass) {
      throw new BadRequestException(`Unsupported song kind: ${kind}`);
    }
    const song = new SongClass(randomUUID(), url);
    const queueSong = await QueueSong.create(song);
    return this.service.addSong(id, queueSong);
  }

  @Put(':id/song/url')
  async addSongByUrl(
    @Param('id') id: string,
    @Body('kind') kind: string,
    @Body('url') url: string,
  ): Promise<Queue> {
    const SongClass = URL_SONG_KINDS[kind as keyof typeof URL_SONG_KINDS];
    if (!SongClass) {
      throw new BadRequestException(`Unsupported song kind: ${kind}`);
    }
    const song = new SongClass(randomUUID(), url);
    const queueSong = await QueueSong.create(song);
    return this.service.addSong(id, queueSong);
  }

  @Get(':id/song')
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
