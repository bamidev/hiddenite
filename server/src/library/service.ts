/**
 * Business logic for the music library: listing songs and folders, adding
 * songs from files or external URLs, tagging, and managing per-folder tag
 * columns. Thin wrapper around the `hiddenite/library` sqlite-backed
 * library package, adding folder validation and folder display-name
 * de-duplication.
 */
import { basename } from 'node:path';
import { BadRequestException, Injectable } from '@nestjs/common';
import * as library from 'hiddenite/library';
import type { LibrarySong } from 'hiddenite/library';
import { extractBandcampMetadata, extractYouTubeMetadata } from 'hiddenite/playback-event';
import { config } from '../config';

/** A library folder as exposed to clients, with a display name derived from its path. */
export interface LibraryFolder {
  /** Display name for the folder, unique among the configured folders. */
  name: string;
  /** Absolute filesystem path of the folder. */
  path: string;
}

/**
 * Derives a unique display name for a folder from its path's basename,
 * appending a numeric suffix (`-2`, `-3`, ...) if the name is already taken.
 * @param path the folder's filesystem path.
 * @param used set of names already assigned to other folders; the chosen name is added to it.
 * @returns a name not already present in `used`.
 */
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

/**
 * Provides library operations backed by the sqlite database configured via
 * `config.database.path`, validating folder arguments against the
 * configured library folders where relevant.
 */
@Injectable()
export class LibraryService {
  /**
   * Rescans a library folder on disk and updates the database accordingly.
   * @param folder path of the folder to rescan; must be one of the configured library folders.
   * @returns the number of songs found in the folder after rescanning.
   */
  rescan(folder: string): Promise<number> {
    if (!config.library.folders.some((f) => f.path === folder)) {
      throw new BadRequestException(`Unknown library folder: ${folder}`);
    }
    return library.rescanLibrary(config.database.path, [folder]);
  }

  /**
   * Lists the configured library folders with unique display names.
   * @returns the configured folders, each with a de-duplicated display name.
   */
  listFolders(): LibraryFolder[] {
    const usedNames = new Set<string>();
    return config.library.folders.map((folder) => ({
      name: uniqueFolderName(folder.path, usedNames),
      path: folder.path,
    }));
  }

  /**
   * Lists every song stored in the library database.
   * @returns all library songs.
   */
  listSongs(): Promise<LibrarySong[]> {
    return library.listLibrarySongs(config.database.path);
  }

  /**
   * Looks up a single library song by id.
   * @param id the song's id.
   * @returns the song, or null if no song with that id exists.
   */
  findSong(id: string): LibrarySong | null {
    return library.getLibrarySong(config.database.path, id);
  }

  /**
   * Adds a song to the library sourced from an external URL, fetching its
   * metadata (tags, duration) according to the given kind.
   * @param kind the source kind of the URL (`bandcamp` or `youtube`); unrecognized kinds get empty metadata.
   * @param url the external URL to fetch metadata from and store as the song's source.
   * @param folder library folder path to file the song under; must be one of the configured library folders.
   * @returns the newly added library song.
   */
  async addSongByUrl(kind: string, url: string, folder: string): Promise<LibrarySong> {
    if (!config.library.folders.some((f) => f.path === folder)) {
      throw new BadRequestException(`Unknown library folder: ${folder}`);
    }

    const metadata = kind === 'bandcamp' ? await extractBandcampMetadata(url)
      : kind === 'youtube' ? await extractYouTubeMetadata(url)
      : { tags: {}, duration: null };

    return library.addUrlSong(config.database.path, kind, url, folder, metadata);
  }

  /**
   * Removes a song from the library database.
   * @param id id of the song to remove.
   */
  removeSong(id: string): void {
    library.removeLibrarySong(config.database.path, id);
  }

  /**
   * Sets a tag value on a library song.
   * @param id id of the song to tag.
   * @param key the tag key.
   * @param value the value to store.
   */
  setTag(id: string, key: string, value: string): void {
    library.setSongTag(config.database.path, id, key, value);
  }

  /**
   * Lists the tag keys configured as columns for a folder.
   * @param folder path of the library folder.
   * @returns the configured column keys.
   */
  listColumns(folder: string): string[] {
    return library.listColumns(config.database.path, folder);
  }

  /**
   * Adds a tag column to a folder's configuration.
   * @param folder path of the library folder.
   * @param key the tag key to add as a column.
   */
  addColumn(folder: string, key: string): void {
    library.addColumn(config.database.path, folder, key);
  }

  /**
   * Removes a tag column from a folder's configuration.
   * @param folder path of the library folder.
   * @param key the tag key to remove as a column.
   */
  removeColumn(folder: string, key: string): void {
    library.removeColumn(config.database.path, folder, key);
  }
}
