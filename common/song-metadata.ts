/**
 * Extracts song metadata (tags and duration) from three kinds of sources: local audio
 * files (via node-taglib-sharp), Bandcamp track pages (by scraping URL structure and
 * embedded JSON-LD), and YouTube videos (via the oEmbed API and watch-page scraping).
 */

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ExtractedMetadata } from './playback-event.js';
import { APP_NAME } from './main.js';

/**
 * Derives basic tags (artist, title) from the structure of a Bandcamp URL alone,
 * without making a network request. Used as a quick fallback/seed before or instead
 * of the fuller {@link extractBandcampMetadata} scrape.
 *
 * @param url Bandcamp track URL, e.g. `https://artist.bandcamp.com/track/song-name`.
 * @returns Tags parsed from the URL: `artist` from the subdomain and `title` from the
 * last path segment, when present.
 */
export function extractBandcampTags(url: string): Record<string, string> {
  const tags: Record<string, string> = {};
  try {
    const { hostname, pathname } = new URL(url);
    const subdomain = hostname.split('.')[0];
    if (subdomain) tags.artist = subdomain;

    const segments = pathname.split('/').filter(Boolean);
    const track = segments[segments.length - 1];
    if (track) tags.title = track;
  } catch {
    // ignore malformed URL
  }
  return tags;
}

/**
 * Parses an ISO 8601 duration string (as used in Bandcamp's JSON-LD, e.g. `PT3M45S`)
 * into a duration in milliseconds.
 *
 * @param iso ISO 8601 duration string to parse.
 * @returns Duration in milliseconds, or `null` if the string doesn't match the expected format.
 */
function parseBandcampDuration(iso: string): number | null {
  const match = iso.match(/P(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/i);
  if (!match) return null;
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);
  return Math.round((hours * 3600 + minutes * 60 + seconds) * 1000);
}

/**
 * Fetches a Bandcamp track page and scrapes its embedded JSON-LD block for full metadata
 * (title, artist, album, duration), falling back to the URL-derived tags from
 * {@link extractBandcampTags} for any fields the scrape can't fill in. Network or parsing
 * failures are logged and swallowed, so partial/URL-derived data is returned rather than throwing.
 *
 * @param url Bandcamp track URL to fetch and scrape.
 * @returns Extracted tags and duration (duration is `null` if it couldn't be determined).
 */
export async function extractBandcampMetadata(url: string): Promise<ExtractedMetadata> {
  const tags = extractBandcampTags(url);
  let duration: number | null = null;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch Bandcamp page (status ${response.status})`);
    }
    const html = await response.text();
    const match = html.match(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/);
    if (!match) {
      throw new Error('Could not find JSON-LD metadata on Bandcamp page');
    }
    const data = JSON.parse(match[1]);
    if (data.name) tags.title = data.name;
    if (data.byArtist?.name) tags.artist = data.byArtist.name;
    if (data.inAlbum?.name) tags.album = data.inAlbum.name;
    if (typeof data.duration === 'string') {
      const parsed = parseBandcampDuration(data.duration);
      if (parsed !== null) duration = parsed;
    }
  } catch (err) {
    console.warn(`Failed to scrape Bandcamp metadata for ${url}:`, err);
  }

  return { tags, duration };
}

/**
 * Extracts the video id from a YouTube URL, handling the `youtu.be` short form, the
 * `?v=` query parameter form, and `/embed/` and `/shorts/` path forms.
 *
 * @param url YouTube URL of any of the supported forms.
 * @returns The video id, or `null` if it could not be parsed from the URL.
 */
export function extractYouTubeVideoId(url: string): string | null {
  try {
    const { hostname, pathname, searchParams } = new URL(url);
    if (hostname.endsWith('youtu.be')) {
      return pathname.slice(1) || null;
    }
    const v = searchParams.get('v');
    if (v) return v;
    const match = pathname.match(/\/(?:embed|shorts)\/([^/?]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * Fetches title and author tags for a YouTube video via its public oEmbed endpoint.
 * The video id (used as a fallback title) is derived from the URL first, then
 * overwritten by the oEmbed response if the request succeeds; failures are logged
 * and swallowed so a partial tag set is still returned.
 *
 * @param url YouTube video URL.
 * @returns Tags with `title` and, when available, `artist` (the channel/author name).
 */
export async function extractYouTubeTags(url: string): Promise<Record<string, string>> {
  const tags: Record<string, string> = {};
  const videoId = extractYouTubeVideoId(url);
  if (videoId) tags.title = videoId;

  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    const response = await fetch(oembedUrl);
    if (!response.ok) {
      throw new Error(`oEmbed request failed with status ${response.status}`);
    }
    const data = await response.json();
    if (data.title) tags.title = data.title;
    if (data.author_name) tags.artist = data.author_name;
  } catch (err) {
    console.warn(`Failed to enrich YouTube metadata via oEmbed for ${url}:`, err);
  }

  return tags;
}

/**
 * Fetches a YouTube watch page and scrapes the video's duration out of its embedded
 * player data, since the oEmbed API used by {@link extractYouTubeTags} doesn't expose it.
 *
 * @param videoId YouTube video id to look up.
 * @returns Duration of the video in milliseconds.
 */
export async function scrapeYouTubeDuration(videoId: string): Promise<number> {
  const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch YouTube watch page for ${videoId} (status ${response.status})`,
    );
  }
  const html = await response.text();
  const match = html.match(/"lengthSeconds":"(\d+)"/);
  if (!match) {
    throw new Error(`Could not find video duration for YouTube video ${videoId}`);
  }
  return Number(match[1]) * 1000;
}

/**
 * Extracts full metadata (tags and duration) for a YouTube video by combining
 * {@link extractYouTubeTags} and {@link scrapeYouTubeDuration}.
 *
 * @param url YouTube video URL.
 * @returns Extracted tags and duration.
 * @throws If the video id can't be parsed from `url`, or if fetching the duration fails.
 */
export async function extractYouTubeMetadata(url: string): Promise<ExtractedMetadata> {
  const videoId = extractYouTubeVideoId(url);
  if (!videoId) {
    throw new Error(`Could not extract YouTube video ID from URL: ${url}`);
  }

  const tags = await extractYouTubeTags(url);
  const duration = await scrapeYouTubeDuration(videoId);

  return { tags, duration };
}

// ReplayGain fields use NaN as their "no value set" sentinel rather than the 0 that most other
// numeric taglib fields use, but readTagValue's NaN-safe check below covers both cases.
const REPLAY_GAIN_TAG_ALIASES: Record<string, string> = {
  replaygain_track_gain: 'replayGainTrackGain',
  replaygain_track_peak: 'replayGainTrackPeak',
  replaygain_album_gain: 'replayGainAlbumGain',
  replaygain_album_peak: 'replayGainAlbumPeak',
};

// Renames applied to a handful of taglib fields so they match the names used
// elsewhere in the app (e.g. the "artist" tag predates this generic extraction).
const TAG_FIELD_ALIASES: Record<string, string> = {
  artist: 'performers',
  ...REPLAY_GAIN_TAG_ALIASES,
};

/**
 * Converts a single node-taglib-sharp tag property value into a display string,
 * treating each type's "unset" sentinel (empty array, `NaN`/`0` for numbers, empty
 * string, `false`) as no value.
 *
 * @param tag Tag object to read the property from.
 * @param propertyName Name of the property on `tag` to read.
 * @returns String representation of the value, or `null` if the property is absent or unset.
 */
function readTagValue(tag: Record<string, unknown>, propertyName: string): string | null {
  const value = tag[propertyName];
  if (Array.isArray(value)) return value.length > 0 ? value.join('; ') : null;
  if (typeof value === 'number') return !Number.isNaN(value) && value !== 0 ? String(value) : null;
  if (typeof value === 'string') return value || null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'boolean') return value ? 'true' : null;
  return null;
}

// Only reads the tag fields that are actually configured to be shown as columns,
// so scanning doesn't do the work of extracting data nobody will see.
/**
 * Reads only the given set of tag fields from a file's tag object, applying
 * {@link TAG_FIELD_ALIASES} so caller-facing keys map onto the corresponding
 * node-taglib-sharp property names.
 *
 * @param tag node-taglib-sharp tag object for the file.
 * @param columns Tag keys to extract (e.g. the folder's display columns plus implicit keys).
 * @returns Extracted tags keyed by the requested column names; keys with no value are omitted.
 */
function extractRequestedTagFields(tag: object, columns: string[]): Record<string, string> {
  const tags: Record<string, string> = {};
  for (const key of columns) {
    const propertyName = TAG_FIELD_ALIASES[key] ?? key;
    if (!(propertyName in tag)) continue;
    const text = readTagValue(tag as Record<string, unknown>, propertyName);
    if (text) tags[key] = text;
  }
  return tags;
}

/**
 * Reads the standard tag fields (artist/album/title plus ReplayGain fields) from a
 * file's tag object. Used when no specific column list is given, i.e. the default
 * set of tags shown for a song.
 *
 * @param tag node-taglib-sharp tag object, narrowed to the fields this function reads.
 * @returns Extracted tags; keys with no value are omitted.
 */
function extractDefaultTagFields(tag: { firstPerformer: string, album: string, title: string }): Record<string, string> {
  const tags: Record<string, string> = {};
  if (tag.firstPerformer) tags.artist = tag.firstPerformer;
  if (tag.album) tags.album = tag.album;
  if (tag.title) tags.title = tag.title;
  for (const [key, propertyName] of Object.entries(REPLAY_GAIN_TAG_ALIASES)) {
    const text = readTagValue(tag as unknown as Record<string, unknown>, propertyName);
    if (text) tags[key] = text;
  }
  return tags;
}

/**
 * Opens a local audio file with node-taglib-sharp and extracts its tags and duration.
 *
 * @param filePath Path to the audio file to read.
 * @param columns If given, only these tag keys are extracted (via {@link extractRequestedTagFields});
 * otherwise the standard default fields are extracted (via {@link extractDefaultTagFields}).
 * @returns Extracted tags and duration (duration is `null` if not present in the file's properties).
 */
export async function extractFileMetadata(filePath: string, columns?: string[]): Promise<ExtractedMetadata> {
  const TagLib = await import('node-taglib-sharp');
  const file = TagLib.File.createFromPath(filePath);
  try {
    const tags = columns ? extractRequestedTagFields(file.tag, columns) : extractDefaultTagFields(file.tag);
    const duration = file.properties.durationMilliseconds || null;
    return { tags, duration };
  } finally {
    file.dispose();
  }
}

/**
 * Extracts metadata from in-memory audio data by writing it to a temporary file and
 * delegating to {@link extractFileMetadata}, since node-taglib-sharp reads from disk.
 * The temporary directory is always cleaned up afterwards.
 *
 * @param data Raw audio file bytes.
 * @param extension File extension (including the leading dot, e.g. `.mp3`) used so
 * taglib can identify the file format.
 * @returns Extracted tags and duration.
 */
export async function extractFileMetadataFromBuffer(
  data: Buffer,
  extension: string,
): Promise<ExtractedMetadata> {
  const dir = await mkdtemp(join(tmpdir(), `${APP_NAME}-`));
  const tmpPath = join(dir, `song${extension}`);
  try {
    await writeFile(tmpPath, data);
    return await extractFileMetadata(tmpPath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
