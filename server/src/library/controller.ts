import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Put,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
import { QueueSong } from '../queue/provider';
import { LibraryService } from './service';
import { BandcampSong, FileSong, YouTubeSong } from '../song/provider';

const URL_SONG_KINDS = {
  bandcamp: BandcampSong,
  youtube: YouTubeSong,
};

@Controller('library')
export class LibraryController {
  constructor(private readonly service: LibraryService) {
    this.service = service;
  }

  @Put('song')
  @UseInterceptors(FileInterceptor('file'))
  async addSong(@UploadedFile() file: Express.Multer.File) {
    const song = new FileSong(randomUUID(), file.originalname);
    const librarySong = await QueueSong.create(song, file.buffer);
    return this.service.addSong(librarySong).toJSON();
  }

  @Put('song/url')
  async addSongByUrl(@Body('kind') kind: string, @Body('url') url: string) {
    const SongClass = URL_SONG_KINDS[kind as keyof typeof URL_SONG_KINDS];
    if (!SongClass) {
      throw new BadRequestException(`Unsupported song kind: ${kind}`);
    }
    const song = new SongClass(randomUUID(), url);
    const librarySong = await QueueSong.create(song);
    return this.service.addSong(librarySong).toJSON();
  }

  @Get('song')
  listSongs() {
    return this.service.listSongs();
  }
}
