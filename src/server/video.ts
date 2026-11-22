import type { VideoProvider } from '../types/index.js';

export function normalizeYouTubeEmbedUrl(url?: string): string {
  if (!url || typeof url !== 'string' || !url.trim()) return '';
  const trimmed = url.trim();

  try {
    // 1. Shorts or Live: youtube.com/shorts/VIDEO_ID or youtube.com/live/VIDEO_ID
    const pathMatch = trimmed.match(/(?:youtube\.com\/(?:shorts|live)\/)([a-zA-Z0-9_-]{11})/i);
    if (pathMatch && pathMatch[1]) {
      return `https://www.youtube-nocookie.com/embed/${pathMatch[1]}?rel=0&modestbranding=1`;
    }

    // 2. Short URL: youtu.be/VIDEO_ID
    const youtuBeMatch = trimmed.match(/(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
    if (youtuBeMatch && youtuBeMatch[1]) {
      return `https://www.youtube-nocookie.com/embed/${youtuBeMatch[1]}?rel=0&modestbranding=1`;
    }

    // 3. Standard watch URL: youtube.com/watch?v=VIDEO_ID (supports m.youtube.com and extra params)
    const watchMatch = trimmed.match(/(?:youtube\.com\/watch\?.*v=)([a-zA-Z0-9_-]{11})/i);
    if (watchMatch && watchMatch[1]) {
      return `https://www.youtube-nocookie.com/embed/${watchMatch[1]}?rel=0&modestbranding=1`;
    }

    // 4. Already embed URL: youtube.com/embed/VIDEO_ID or youtube-nocookie.com/embed/VIDEO_ID
    const embedMatch = trimmed.match(/(?:youtube(?:-nocookie)?\.com\/embed\/)([a-zA-Z0-9_-]{11})/i);
    if (embedMatch && embedMatch[1]) {
      return `https://www.youtube-nocookie.com/embed/${embedMatch[1]}?rel=0&modestbranding=1`;
    }

    // 5. General URL fallback using URL parser
    if (/^https?:\/\//i.test(trimmed)) {
      const parsed = new URL(trimmed);
      if (parsed.hostname.includes('youtube.com')) {
        const v = parsed.searchParams.get('v');
        if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) {
          return `https://www.youtube-nocookie.com/embed/${v}?rel=0&modestbranding=1`;
        }
      }
    }

    // 6. Bare 11-char ID
    if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
      return `https://www.youtube-nocookie.com/embed/${trimmed}?rel=0&modestbranding=1`;
    }
  } catch (err) {
    console.error('Error normalizing YouTube URL:', err);
  }

  return '';
}

export function normalizeDailymotionEmbedUrl(url?: string): string {
  if (!url || typeof url !== 'string' || !url.trim()) return '';
  const trimmed = url.trim();

  try {
    // 1. Standard Dailymotion URL: dailymotion.com/video/VIDEO_ID or /embed/video/VIDEO_ID
    const dmMatch = trimmed.match(/dailymotion\.com\/(?:embed\/)?video\/([a-zA-Z0-9]+)/i);
    if (dmMatch && dmMatch[1]) {
      return `https://www.dailymotion.com/embed/video/${dmMatch[1]}?queue-enable=false&sharing-enable=false`;
    }

    // 2. Geo player URL: geo.dailymotion.com/player.html?video=VIDEO_ID
    const geoMatch = trimmed.match(/dailymotion\.com\/player\.html\?.*video=([a-zA-Z0-9]+)/i);
    if (geoMatch && geoMatch[1]) {
      return `https://www.dailymotion.com/embed/video/${geoMatch[1]}?queue-enable=false&sharing-enable=false`;
    }

    // 3. Short link: dai.ly/VIDEO_ID
    const shortMatch = trimmed.match(/dai\.ly\/([a-zA-Z0-9]+)/i);
    if (shortMatch && shortMatch[1]) {
      return `https://www.dailymotion.com/embed/video/${shortMatch[1]}?queue-enable=false&sharing-enable=false`;
    }

    // 4. Bare alphanumeric ID (typically 6-10 chars starting with x, e.g., x8abcd1)
    if (/^[a-zA-Z0-9]{5,12}$/.test(trimmed)) {
      return `https://www.dailymotion.com/embed/video/${trimmed}?queue-enable=false&sharing-enable=false`;
    }
  } catch (err) {
    console.error('Error normalizing Dailymotion URL:', err);
  }

  return '';
}

export function normalizeLessonVideoEmbedUrl(provider: VideoProvider | undefined, url?: string): string {
  if (!url || !url.trim()) return '';
  if (provider === 'dailymotion') {
    return normalizeDailymotionEmbedUrl(url) || normalizeYouTubeEmbedUrl(url);
  }
  return normalizeYouTubeEmbedUrl(url) || normalizeDailymotionEmbedUrl(url);
}
