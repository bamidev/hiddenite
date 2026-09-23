/**
 * Shared types for describing playback state changes (play/pause/new-song events) that
 * are sent between the desktop app and server, plus the metadata shapes those events carry.
 * Also re-exports `Song` and the metadata-extraction functions from `song-metadata.ts` so
 * consumers of this module have a single place to import playback-related types and helpers.
 */

import type { Song } from './song.js';

export type { Song };
export {
  extractBandcampTags,
  extractBandcampMetadata,
  extractYouTubeVideoId,
  extractYouTubeTags,
  scrapeYouTubeDuration,
  extractYouTubeMetadata,
  extractFileMetadata,
  extractFileMetadataFromBuffer,
} from './song-metadata.js';

/**
 * Metadata extracted for a song, either from local file tags or scraped from a
 * streaming source (Bandcamp/YouTube).
 */
export interface ExtractedMetadata {
  /** Extracted tag values keyed by tag name (e.g. `artist`, `album`, `title`). */
  tags: Record<string, string>;
  /** Duration of the song in milliseconds, or `null` if it could not be determined. */
  duration: number | null;
}

/**
 * Base shape for a playback event broadcast when the player's state changes.
 * Concrete events narrow `event` to a specific literal and add fields relevant to it.
 */
export interface PlaybackEvent {
  /** Which kind of playback change occurred. */
  event: 'play' | 'pause' | 'new';
  /** Id of the song the event pertains to, or `null` if there is no current song. */
  songId: string | null;
}

/** Event emitted when playback resumes or starts on the current song. */
export interface PlayPlaybackEvent extends PlaybackEvent {
  event: 'play';
  /** Playback position, in milliseconds, at the time playback started. */
  elapsed: number;
}

/** Event emitted when playback of the current song is paused. */
export interface PausePlaybackEvent extends PlaybackEvent {
  event: 'pause';
}

/** A `Song` combined with its extracted metadata, as needed to display and play it. */
export type SongInfo = Song & { metadata: ExtractedMetadata };

/** Event emitted when a new song becomes the active song in the queue. */
export interface NewPlaybackEvent extends PlaybackEvent {
  event: 'new';
  /** Identifier of the queue entry this song corresponds to. */
  queueId: string;
  /** Full song details, including its metadata, for the new active song. */
  song: SongInfo;
  /** Playback position, in milliseconds, at which the new song starts. */
  elapsed: number;
}
