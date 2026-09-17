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
