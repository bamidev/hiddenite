import type { ExtractedMetadata } from './playback-event';

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

function parseBandcampDuration(iso: string): number | null {
  const match = iso.match(/P(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/i);
  if (!match) return null;
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);
  return Math.round((hours * 3600 + minutes * 60 + seconds) * 1000);
}

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
