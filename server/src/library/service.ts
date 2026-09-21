import { basename } from 'node:path';
import { BadRequestException, Injectable } from '@nestjs/common';
import { rescanLibrary, listLibrarySongs, getLibrarySong, addUrlSong, removeLibrarySong, setSongTag } from 'hiddenite/library';
import type { LibrarySong } from 'hiddenite/library';
import { extractBandcampMetadata, extractYouTubeMetadata } from 'hiddenite/playback-event';
import { config } from '../config';

export interface LibraryFolder {
  name: string;
  path: string;
}

function uniqueFolderName(path: string, used: Set<string>): string {
  const base = basename(path) || 'root';
  let name = base;
  let suffix = 2;
  while (used.has(name)) {
    name = `${base}-${suffix}`;
    suffix += 1;
  }
  used.add(name);
  return name;
}

@Injectable()
export class LibraryService {
  rescan(): Promise<number> {
    const paths = config.library.folders.map((folder) => folder.path);
    return rescanLibrary(config.database.path, paths);
  }

  listFolders(): LibraryFolder[] {
    const usedNames = new Set<string>();
    return config.library.folders.map((folder) => ({
      name: uniqueFolderName(folder.path, usedNames),
      path: folder.path,
    }));
  }

  listSongs(): LibrarySong[] {
    return listLibrarySongs(config.database.path);
  }

  findSong(id: string): LibrarySong | null {
    return getLibrarySong(config.database.path, id);
  }

  async addSongByUrl(kind: string, url: string, folder: string): Promise<LibrarySong> {
    if (!config.library.folders.some((f) => f.path === folder)) {
      throw new BadRequestException(`Unknown library folder: ${folder}`);
    }

    const metadata = kind === 'bandcamp' ? await extractBandcampMetadata(url)
      : kind === 'youtube' ? await extractYouTubeMetadata(url)
      : { tags: {}, duration: null };

    return addUrlSong(config.database.path, kind, url, folder, metadata);
  }

  removeSong(id: string): void {
    removeLibrarySong(config.database.path, id);
  }

  setTag(id: string, key: string, value: string): void {
    setSongTag(config.database.path, id, key, value);
  }
}
