import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
import { getLibrarySong } from 'hiddenite/library';
import type { Queue } from './provider';
import { QueueSong, URL_SONG_KINDS, createQueueSongFromLibrarySong } from './provider';
import { QueueService } from './service';
import { config } from '../config';
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
    @Body('kind') kind: string,
    @Body('url') url: string,
    @Body('tags') tagsJson: string,
    @Body('duration') duration: string,
  ): Promise<Queue> {
    const metadata = tagsJson
      ? { tags: JSON.parse(tagsJson), duration: duration ? Number(duration) : null }
      : undefined;

    if (file) {
      const song = new FileSong(randomUUID(), file.originalname);
      const queueSong = await QueueSong.create(song, file.buffer, metadata);
      return this.service.addSong(id, queueSong);
    }

    const SongClass = URL_SONG_KINDS[kind as keyof typeof URL_SONG_KINDS];
    if (!SongClass) {
      throw new BadRequestException(`Unsupported song kind: ${kind}`);
    }
    const song = new SongClass(randomUUID(), url);
    const queueSong = await QueueSong.create(song, undefined, metadata);
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

  @Put(':id/song/library')
  async addSongFromLibrary(
    @Param('id') id: string,
    @Body('songId') songId: string,
  ): Promise<Queue> {
    const librarySong = getLibrarySong(config.database.path, songId);
    if (!librarySong) {
      throw new NotFoundException(`Library song ${songId} not found`);
    }

    const queueSong = await createQueueSongFromLibrarySong(librarySong);
    return this.service.addSong(id, queueSong);
  }

  @Get(':id/song')
  listSongs(@Param('id') id: string) {
    return this.service.listSongs(id);
  }

  @Delete(':id/song/:songId')
  removeSong(@Param('id') id: string, @Param('songId') songId: string): Promise<Queue> {
    return this.service.removeSong(id, songId);
  }

  @Put(':id/name')
  rename(@Param('id') id: string, @Body('name') name: string): Queue {
    return this.service.rename(id, name);
  }

  @Put(':id/filter')
  setFilter(@Param('id') id: string, @Body('filter') filter: string): Promise<Queue> {
    return this.service.setFilter(id, filter ?? '');
  }

  @Post(':id/auto-add-folder')
  setAutoAddFolder(@Param('id') id: string, @Body('folder') folder: string | null): Promise<Queue> {
    return this.service.setAutoAddFolder(id, folder ?? null);
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
  toggleAutoAdd(@Param('id') id: string): Promise<Queue> {
    return this.service.toggleAutoAdd(id);
  }
}
