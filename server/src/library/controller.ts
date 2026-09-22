import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
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

  @Get('folder')
  listFolders() {
    return this.service.listFolders();
  }

  @Put('song/url')
  addSongByUrl(@Body('kind') kind: string, @Body('url') url: string, @Body('folder') folder: string) {
    if (!URL_SONG_KINDS.has(kind)) {
      throw new BadRequestException(`Unsupported song kind: ${kind}`);
    }
    return this.service.addSongByUrl(kind, url, folder);
  }

  @Delete('song/:id')
  removeSong(@Param('id') id: string) {
    this.service.removeSong(id);
  }

  @Put('song/:id/tag')
  setTag(@Param('id') id: string, @Body('key') key: string, @Body('value') value: string) {
    this.service.setTag(id, key, value);
  }

  @Post('rescan')
  async rescan() {
    const count = await this.service.rescan();
    return { count };
  }

  @Get('column')
  listColumns(@Query('folder') folder: string) {
    return this.service.listColumns(folder);
  }

  @Put('column')
  addColumn(@Body('folder') folder: string, @Body('key') key: string) {
    this.service.addColumn(folder, key);
  }

  @Delete('column')
  removeColumn(@Body('folder') folder: string, @Body('key') key: string) {
    this.service.removeColumn(folder, key);
  }
}
