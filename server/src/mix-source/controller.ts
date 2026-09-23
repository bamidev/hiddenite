/**
 * HTTP/SSE API for mix sources: the playback state machines that pull songs
 * from their attached queues and play them. Exposes endpoints to create and
 * rename sources, attach queues, control playback, stream playback events
 * over SSE, and stream the currently playing song's audio data (with HTTP
 * range support for seeking).
 */
import {
  Body,
  Controller,
  Get,
  type MessageEvent,
  NotFoundException,
  Param,
  Post,
  Put,
  Req,
  Res,
  Sse,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { map, type Observable } from 'rxjs';
import { extname } from 'node:path';
import type { MixSource } from './provider';
import { MixSourceService } from './service';
import type { Queue } from '../queue/provider';
import type { PlaybackEvent } from 'hiddenite';

const MIME_TYPES: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.flac': 'audio/flac',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
};

/**
 * Resolves the MIME type to serve for an audio file based on its extension.
 * @param path file path (or URL) whose extension determines the MIME type.
 * @returns the matching MIME type, or `application/octet-stream` if the extension is unrecognized.
 */
function getMimeType(path: string): string {
  return MIME_TYPES[extname(path).toLowerCase()] ?? 'application/octet-stream';
}

/**
 * Exposes REST/SSE endpoints under `/mix-source` for managing mix sources
 * and their playback: listing and creating sources, attaching queues,
 * renaming, toggling play/pause, subscribing to playback events, and
 * streaming the currently playing song's audio.
 */
@Controller('mix-source')
export class MixSourceController {
  constructor(private readonly service: MixSourceService) {
    this.service = service;
  }

  /**
   * Lists all existing mix sources.
   * @returns all mix sources.
   */
  @Get()
  getMixSources(): MixSource[] {
    return this.service.findAll();
  }

  /**
   * Creates a new mix source.
   * @returns the newly created mix source.
   */
  @Put()
  putMixSource(): MixSource {
    return this.service.create();
  }

  /**
   * Creates a new queue and attaches it to a mix source.
   * @param id id of the mix source to attach the queue to.
   * @returns the newly created queue.
   */
  @Put(':id/queue')
  addQueue(@Param('id') id: string): Queue {
    return this.service.addQueue(id);
  }

  /**
   * Renames a mix source.
   * @param id id of the mix source to rename.
   * @param name new display name for the mix source.
   * @returns the updated mix source.
   */
  @Put(':id/name')
  rename(@Param('id') id: string, @Body('name') name: string): MixSource {
    return this.service.rename(id, name);
  }

  /**
   * Toggles playback (play if paused, pause if playing) on a mix source.
   * @param id id of the mix source to toggle.
   * @returns the updated mix source once the toggle has taken effect.
   */
  @Post(':id/play')
  togglePlay(@Param('id') id: string): Promise<MixSource> {
    return this.service.togglePlay(id);
  }

  /**
   * Subscribes to a mix source's playback events (play/pause/new song) as
   * a server-sent-events stream.
   * @param id id of the mix source to subscribe to.
   * @returns an observable of SSE message events, each wrapping a `PlaybackEvent`.
   */
  @Sse(':id/events')
  events(@Param('id') id: string): Observable<MessageEvent> {
    return this.service.getEvents(id).pipe(
      map((event: PlaybackEvent) => ({ data: event })),
    );
  }

  /**
   * Streams the audio data of a mix source's currently playing song,
   * honoring HTTP `Range` requests so clients can seek within the track.
   * Writes directly to the response rather than returning a value.
   * @param id id of the mix source whose current song should be streamed.
   * @param request the incoming request, used to read the `Range` header.
   * @param response the outgoing response, written to directly with headers and audio bytes.
   */
  @Get(':id/stream')
  stream(@Param('id') id: string, @Req() request: Request, @Res() response: Response): void {
    const entry = this.service.getCurrentSong(id);
    if (!entry.data) {
      throw new NotFoundException('Song has no audio data available');
    }

    const data = entry.data;
    const mimeType = getMimeType(entry.song.path);
    const range = request.headers.range;

    if (!range) {
      response.set({
        'Content-Type': mimeType,
        'Content-Length': data.length,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-store',
      });
      response.status(200).send(data);
      return;
    }

    const [startStr, endStr] = range.replace('bytes=', '').split('-');
    const start = parseInt(startStr, 10);
    const end = endStr ? parseInt(endStr, 10) : data.length - 1;
    const chunk = data.subarray(start, end + 1);

    response.set({
      'Content-Type': mimeType,
      'Content-Length': chunk.length,
      'Content-Range': `bytes ${start}-${end}/${data.length}`,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-store',
    });
    response.status(206).send(chunk);
  }
}
