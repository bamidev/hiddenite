import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { LibraryService } from './service';

const URL_SONG_KINDS = new Set(['bandcamp', 'youtube']);

@Controller('library')
export class LibraryController {
  constructor(private readonly service: LibraryService) {
    this.service = service;
  }

  @Get('song')
  listSongs() {
    return this.service.listSongs();
  }

  @Put('song/url')
  addSongByUrl(@Body('kind') kind: string, @Body('url') url: string) {
    if (!URL_SONG_KINDS.has(kind)) {
      throw new BadRequestException(`Unsupported song kind: ${kind}`);
    }
    return this.service.addSongByUrl(kind, url);
  }

  @Delete('song/:id')
  removeSong(@Param('id') id: string) {
    this.service.removeSong(id);
  }

  @Post('rescan')
  async rescan() {
    const count = await this.service.rescan();
    return { count };
  }
}
