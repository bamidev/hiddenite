export interface Song {
  id: string;
  kind: string;
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
  url: string;

  constructor(id: string, url: string) {
    this.id = id;
    this.url = url;
  }
}
