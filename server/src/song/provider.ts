/**
 * Concrete `Song` implementations for each supported source kind: local
 * files, YouTube, and Bandcamp. Each stores an id plus a `path`, whose
 * meaning depends on the kind (a filesystem path for files, a URL for the
 * others).
 */
import type { Song } from 'hiddenite';

/** A song sourced from a local audio file. `path` is the file's filesystem path. */
export class FileSong implements Song {
  readonly kind = 'file';
  id: string;
  path: string;

  /**
   * @param id unique id for the song.
   * @param path filesystem path to the audio file.
   */
  constructor(id: string, path: string) {
    this.id = id;
    this.path = path;
  }
}

/** A song sourced from YouTube. `path` is the YouTube URL. */
export class YouTubeSong implements Song {
  readonly kind = 'youtube';
  id: string;
  path: string;

  /**
   * @param id unique id for the song.
   * @param path the YouTube URL.
   */
  constructor(id: string, path: string) {
    this.id = id;
    this.path = path;
  }
}

/** A song sourced from Bandcamp. `path` is the Bandcamp URL. */
export class BandcampSong implements Song {
  readonly kind = 'bandcamp';
  id: string;
  path: string;

  /**
   * @param id unique id for the song.
   * @param path the Bandcamp URL.
   */
  constructor(id: string, path: string) {
    this.id = id;
    this.path = path;
  }
}
