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

function getMimeType(path: string): string {
  return MIME_TYPES[extname(path).toLowerCase()] ?? 'application/octet-stream';
}

@Controller('mix-source')
export class MixSourceController {
  constructor(private readonly service: MixSourceService) {
    this.service = service;
  }

  @Get()
  getMixSources(): MixSource[] {
    return this.service.findAll();
  }

  @Put()
  putMixSource(): MixSource {
    return this.service.create();
  }

  @Put(':id/queue')
  addQueue(@Param('id') id: string): Queue {
    return this.service.addQueue(id);
  }

  @Put(':id/name')
  rename(@Param('id') id: string, @Body('name') name: string): MixSource {
    return this.service.rename(id, name);
  }

  @Post(':id/play')
  togglePlay(@Param('id') id: string): MixSource {
    return this.service.togglePlay(id);
  }

  @Sse(':id/events')
  events(@Param('id') id: string): Observable<MessageEvent> {
    return this.service.getEvents(id).pipe(
      map((event: PlaybackEvent) => ({ data: event })),
    );
  }

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
    });
    response.status(206).send(chunk);
  }
}
