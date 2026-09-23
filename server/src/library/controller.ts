/**
 * HTTP API for browsing and managing the music library: songs, folders,
 * tags/columns, and rescanning folders on disk. Delegates all actual work
 * to `LibraryService`.
 */
import { BadRequestException, Body, Controller, Delete, Get, type MessageEvent, Param, Post, Put, Query, Sse } from '@nestjs/common';
import { map, type Observable } from 'rxjs';
import type { LibraryRescanEvent } from 'hiddenite';
import { LibraryService } from './service';

const URL_SONG_KINDS = new Set(['bandcamp', 'youtube']);

/**
 * Exposes REST endpoints under `/library` for listing songs and folders,
 * adding songs from external URLs, tagging songs, managing per-folder
 * tag columns, and triggering rescans.
 */
@Controller('library')
export class LibraryController {
  constructor(private readonly service: LibraryService) {
    this.service = service;
  }

  /**
   * Lists every song currently known to the library.
   * @returns all library songs.
   */
  @Get('song')
  listSongs() {
    return this.service.listSongs();
  }

  /**
   * Lists the configured library folders.
   * @returns all library folders, with display names.
   */
  @Get('folder')
  listFolders() {
    return this.service.listFolders();
  }

  /**
   * Adds a song to the library by fetching its metadata from an external URL
   * (Bandcamp or YouTube) rather than from a local file.
   * @param kind the source kind of the URL; must be `bandcamp` or `youtube`.
   * @param url the external URL to fetch metadata from.
   * @param folder the library folder path the song should be filed under.
   * @returns the newly added library song.
   */
  @Put('song/url')
  addSongByUrl(@Body('kind') kind: string, @Body('url') url: string, @Body('folder') folder: string) {
    if (!URL_SONG_KINDS.has(kind)) {
      throw new BadRequestException(`Unsupported song kind: ${kind}`);
    }
    return this.service.addSongByUrl(kind, url, folder);
  }

  /**
   * Removes a song from the library.
   * @param id id of the song to remove, taken from the route.
   */
  @Delete('song/:id')
  removeSong(@Param('id') id: string) {
    this.service.removeSong(id);
  }

  /**
   * Sets (or clears) a tag value on a song.
   * @param id id of the song to tag, taken from the route.
   * @param key the tag's key/name.
   * @param value the value to store for the tag.
   */
  @Put('song/:id/tag')
  setTag(@Param('id') id: string, @Body('key') key: string, @Body('value') value: string) {
    this.service.setTag(id, key, value);
  }

  /**
   * Starts a rescan of a library folder on disk in the background, picking up
   * added/removed/changed files. Completion is announced over {@link events}.
   * @param folder path of the library folder to rescan.
   * @returns whether a new rescan was started, or one for this folder was already running.
   */
  @Post('rescan')
  rescan(@Body('folder') folder: string) {
    return this.service.rescan(folder);
  }

  /**
   * Subscribes to rescan completion/failure events as a server-sent-events stream.
   * @returns an observable of SSE message events, each wrapping a `LibraryRescanEvent`.
   */
  @Sse('events')
  events(): Observable<MessageEvent> {
    return this.service.getRescanEvents().pipe(
      map((event: LibraryRescanEvent) => ({ data: event })),
    );
  }

  /**
   * Lists the extra tag columns configured for a folder (used by the client
   * to know which tag keys to show as columns in the song table).
   * @param folder path of the library folder to list columns for.
   * @returns the configured column keys.
   */
  @Get('column')
  listColumns(@Query('folder') folder: string) {
    return this.service.listColumns(folder);
  }

  /**
   * Adds a tag column to a folder.
   * @param folder path of the library folder to add the column to.
   * @param key the tag key to expose as a column.
   */
  @Put('column')
  addColumn(@Body('folder') folder: string, @Body('key') key: string) {
    this.service.addColumn(folder, key);
  }

  /**
   * Removes a tag column from a folder.
   * @param folder path of the library folder to remove the column from.
   * @param key the tag key to stop exposing as a column.
   */
  @Delete('column')
  removeColumn(@Body('folder') folder: string, @Body('key') key: string) {
    this.service.removeColumn(folder, key);
  }
}
