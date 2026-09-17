export interface ExtractedMetadata {
  tags: Record<string, string>;
  duration: number | null;
}

export interface PlaybackEvent {
  event: 'play' | 'pause' | 'new';
  songId: string | null;
}

export interface PlayPlaybackEvent extends PlaybackEvent {
  event: 'play';
  elapsed: number;
}

export interface PausePlaybackEvent extends PlaybackEvent {
  event: 'pause';
}

export interface NewPlaybackEvent extends PlaybackEvent {
  event: 'new';
  queueId: string;
  metadata: ExtractedMetadata;
  elapsed: number;
}
