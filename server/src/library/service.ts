import { basename } from 'node:path';
import { BadRequestException, Injectable } from '@nestjs/common';
import * as library from 'hiddenite/library';
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
  rescan(folder: string): Promise<number> {
    if (!config.library.folders.some((f) => f.path === folder)) {
      throw new BadRequestException(`Unknown library folder: ${folder}`);
    }
    return library.rescanLibrary(config.database.path, [folder]);
  }

  listFolders(): LibraryFolder[] {
    const usedNames = new Set<string>();
    return config.library.folders.map((folder) => ({
      name: uniqueFolderName(folder.path, usedNames),
      path: folder.path,
    }));
  }

  listSongs(): Promise<LibrarySong[]> {
    return library.listLibrarySongs(config.database.path);
  }

  findSong(id: string): LibrarySong | null {
    return library.getLibrarySong(config.database.path, id);
  }

  async addSongByUrl(kind: string, url: string, folder: string): Promise<LibrarySong> {
    if (!config.library.folders.some((f) => f.path === folder)) {
      throw new BadRequestException(`Unknown library folder: ${folder}`);
    }

    const metadata = kind === 'bandcamp' ? await extractBandcampMetadata(url)
      : kind === 'youtube' ? await extractYouTubeMetadata(url)
      : { tags: {}, duration: null };

    return library.addUrlSong(config.database.path, kind, url, folder, metadata);
  }

  removeSong(id: string): void {
    library.removeLibrarySong(config.database.path, id);
  }

  setTag(id: string, key: string, value: string): void {
    library.setSongTag(config.database.path, id, key, value);
  }

  listColumns(folder: string): string[] {
    return library.listColumns(config.database.path, folder);
  }

  addColumn(folder: string, key: string): void {
    library.addColumn(config.database.path, folder, key);
  }

  removeColumn(folder: string, key: string): void {
    library.removeColumn(config.database.path, folder, key);
  }
}
