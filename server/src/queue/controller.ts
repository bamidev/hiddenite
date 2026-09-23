/**
 * HTTP API for managing playback queues: adding songs from an uploaded
 * file, an external URL, or the library; removing songs; and configuring
 * queue behavior (name, filter, shuffle, repeat, auto-add).
 */
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

/**
 * Exposes REST endpoints under `/queue` for adding songs to a queue (via
 * file upload, external URL, or library reference), removing songs, and
 * updating queue settings such as name, filter, shuffle, repeat, and
 * auto-add.
 */
@Controller('queue')
export class QueueController {
  constructor(private readonly service: QueueService) {
    this.service = service;
  }

  /**
   * Adds a song to a queue from either an uploaded file or an external URL,
   * optionally with pre-supplied metadata (tags/duration) instead of
   * extracting it. If a file is uploaded it takes precedence over the URL
   * fields.
   * @param id id of the queue to add the song to.
   * @param file uploaded audio file, if adding a local file rather than a URL song.
   * @param kind source kind for a URL-based song (e.g. `bandcamp`, `youtube`); ignored when a file is uploaded.
   * @param url external URL for a URL-based song; ignored when a file is uploaded.
   * @param tagsJson JSON-encoded tag map to use as metadata instead of extracting it; when absent, metadata is auto-extracted.
   * @param duration duration in seconds (as a string) to use alongside `tagsJson`, if provided.
   * @returns the updated queue.
   */
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

  /**
   * Adds a song to a queue sourced from an external URL, extracting its
   * metadata automatically.
   * @param id id of the queue to add the song to.
   * @param kind source kind of the URL; must be a supported kind (e.g. `bandcamp`, `youtube`).
   * @param url the external URL to add as a song.
   * @returns the updated queue.
   */
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

  /**
   * Adds a song from the library to a queue, copying its known metadata
   * rather than re-extracting it.
   * @param id id of the queue to add the song to.
   * @param songId id of the library song to add.
   * @returns the updated queue.
   */
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

  /**
   * Lists the songs currently in a queue.
   * @param id id of the queue.
   * @returns the queue's songs, serialized for the client.
   */
  @Get(':id/song')
  listSongs(@Param('id') id: string) {
    return this.service.listSongs(id);
  }

  /**
   * Removes a song from a queue.
   * @param id id of the queue.
   * @param songId id of the song to remove.
   * @returns the updated queue.
   */
  @Delete(':id/song/:songId')
  removeSong(@Param('id') id: string, @Param('songId') songId: string): Promise<Queue> {
    return this.service.removeSong(id, songId);
  }

  /**
   * Renames a queue.
   * @param id id of the queue to rename.
   * @param name new display name.
   * @returns the updated queue.
   */
  @Put(':id/name')
  rename(@Param('id') id: string, @Body('name') name: string): Queue {
    return this.service.rename(id, name);
  }

  /**
   * Sets the library filter used when auto-adding songs to this queue.
   * @param id id of the queue.
   * @param filter filter string; empty/falsy resets to no filter.
   * @returns the updated queue.
   */
  @Put(':id/filter')
  setFilter(@Param('id') id: string, @Body('filter') filter: string): Promise<Queue> {
    return this.service.setFilter(id, filter ?? '');
  }

  /**
   * Sets which library folder auto-add pulls songs from for this queue.
   * @param id id of the queue.
   * @param folder library folder path to auto-add from, or null to clear it.
   * @returns the updated queue.
   */
  @Post(':id/auto-add-folder')
  setAutoAddFolder(@Param('id') id: string, @Body('folder') folder: string | null): Promise<Queue> {
    return this.service.setAutoAddFolder(id, folder ?? null);
  }

  /**
   * Toggles the shuffle setting on a queue.
   * @param id id of the queue.
   * @returns the updated queue.
   */
  @Post(':id/shuffle')
  toggleShuffle(@Param('id') id: string): Queue {
    return this.service.toggleShuffle(id);
  }

  /**
   * Toggles the repeat setting on a queue.
   * @param id id of the queue.
   * @returns the updated queue.
   */
  @Post(':id/repeat')
  toggleRepeat(@Param('id') id: string): Queue {
    return this.service.toggleRepeat(id);
  }

  /**
   * Toggles auto-add on a queue, triggering an immediate refill if it was
   * just enabled.
   * @param id id of the queue.
   * @returns the updated queue.
   */
  @Post(':id/auto-add')
  toggleAutoAdd(@Param('id') id: string): Promise<Queue> {
    return this.service.toggleAutoAdd(id);
  }
}
