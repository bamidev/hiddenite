import { Injectable } from '@nestjs/common';
import { rescanLibrary, listLibrarySongs, getLibrarySong, addUrlSong, removeLibrarySong } from 'hiddenite/library';
import type { LibrarySong } from 'hiddenite/library';
import { extractBandcampMetadata, extractYouTubeMetadata } from 'hiddenite/playback-event';
import { config } from '../config';

@Injectable()
export class LibraryService {
  rescan(): Promise<number> {
    return rescanLibrary(config.database.path, config.library.paths);
  }

  listSongs(): LibrarySong[] {
    return listLibrarySongs(config.database.path);
  }

  findSong(id: string): LibrarySong | null {
    return getLibrarySong(config.database.path, id);
  }

  async addSongByUrl(kind: string, url: string): Promise<LibrarySong> {
    const metadata = kind === 'bandcamp' ? await extractBandcampMetadata(url)
      : kind === 'youtube' ? await extractYouTubeMetadata(url)
      : { tags: {}, duration: null };

    return addUrlSong(config.database.path, kind, url, metadata);
  }

  removeSong(id: string): void {
    removeLibrarySong(config.database.path, id);
  }
}
