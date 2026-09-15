export interface Song {
  id: string;
  kind: string;
  path: string;
}

export class FileSong implements Song {
  readonly kind = 'file';
  id: string;
  path: string;

  constructor(id: string, path: string) {
    this.id = id;
    this.path = path;
  }
}

export class YouTubeSong implements Song {
  readonly kind = 'youtube';
  id: string;
  path: string;

  constructor(id: string, path: string) {
    this.id = id;
    this.path = path;
  }
}
