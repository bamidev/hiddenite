export interface Song {
  id: string;
  kind: string;
  getTags(): Promise<Record<string, string>>;
}

export class FileSong implements Song {
  readonly kind = 'file';
  id: string;
  path: string;

  constructor(id: string, path: string) {
    this.id = id;
    this.path = path;
  }

  async getTags(): Promise<Record<string, string>> {
    // TODO: read tags from the file at this.path
    return {};
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

  async getTags(): Promise<Record<string, string>> {
    // TODO: fetch tags from YouTube's metadata for this.url
    return {};
  }
}
