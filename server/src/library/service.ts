import { Injectable } from '@nestjs/common';
import { QueueSong } from '../queue/provider';

@Injectable()
export class LibraryService {
  private readonly songs: QueueSong[] = [];

  addSong(song: QueueSong): QueueSong {
    this.songs.push(song);
    return song;
  }

  listSongs() {
    return this.songs.map((entry) => entry.toJSON());
  }
}
