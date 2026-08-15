export function fmtViews(n: number | null | undefined): string {
  const num = Number(n) || 0;
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M views';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K views';
  return num.toLocaleString() + ' views';
}

export function fmtCount(n: number | null | undefined): string {
  const num = Number(n) || 0;
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M+ videos';
  if (num >= 1000) return Math.round(num / 1000) + 'K+ videos';
  if (num > 0) return num.toLocaleString() + ' videos';
  return 'Explore';
}

export function fmtDuration(sec: number | null | undefined): string {
  const seconds = Number(sec) || 0;
  if (seconds <= 0) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

/**
 * Generates a high-quality SVG data URI placeholder with title, category, and theme branding
 */
export function generatePlaceholderSvg(title?: string, category?: string): string {
  const cleanTitle = (title || category || 'Video')
    .replace(/[<>&"']/g, '')
    .slice(0, 36);
  
  const initial = cleanTitle.charAt(0).toUpperCase() || 'V';
  
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 270" width="480" height="270">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#262626" />
        <stop offset="50%" stop-color="#181818" />
        <stop offset="100%" stop-color="#0d0d0d" />
      </linearGradient>
      <radialGradient id="glow" cx="50%" cy="45%" r="60%">
        <stop offset="0%" stop-color="#ff0000" stop-opacity="0.18" />
        <stop offset="100%" stop-color="#000000" stop-opacity="0" />
      </radialGradient>
    </defs>
    <rect width="480" height="270" fill="url(#bg)" />
    <rect width="480" height="270" fill="url(#glow)" />
    
    <!-- Central Play Button / Logo Badge -->
    <circle cx="240" cy="115" r="34" fill="#ff0000" opacity="0.95" />
    <polygon points="234,101 254,115 234,129" fill="#ffffff" />
    
    <!-- Video Title Pill -->
    <rect x="24" y="210" width="432" height="38" rx="8" fill="#000000" opacity="0.65" />
    <text x="240" y="234" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="600" fill="#f1f1f1" text-anchor="middle">${cleanTitle}</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const DEFAULT_POSTER = generatePlaceholderSvg('Video');

/**
 * Sanitizes and normalizes raw image URLs
 */
export function sanitizeImageUrl(url: string | null | undefined): string {
  if (!url) return '';
  let clean = url.trim().replace(/^["']|["']$/g, '');
  if (!clean || clean === 'N/A' || clean === 'null' || clean === 'undefined') return '';
  
  if (clean.startsWith('//')) {
    clean = 'https:' + clean;
  } else if (clean.startsWith('http://')) {
    clean = clean.replace(/^http:\/\//i, 'https://');
  }
  
  return clean;
}

/**
 * Robust URL transformer for video thumbnails across different hosts & embed formats.
 * Extracts direct CDN images without loading heavy iframes.
 */
export function getThumbnailCandidates(
  poster?: string | null,
  embedUrl?: string | null,
  title?: string,
  category?: string
): string[] {
  const candidates: string[] = [];
  const cleanPoster = sanitizeImageUrl(poster);
  const cleanEmbed = (embedUrl || '').trim();

  // 1. Direct poster if present
  if (cleanPoster && cleanPoster.startsWith('https://')) {
    candidates.push(cleanPoster);
    // Add wsrv.nl proxy as backup in case of 403 Forbidden / hotlinking blocks
    candidates.push(`https://wsrv.nl/?url=${encodeURIComponent(cleanPoster)}&w=480&output=webp`);
  }

  // 2. Extract direct CDN thumbnail from embedUrl
  if (cleanEmbed) {
    // YouTube (standard, shorts, embed, shortlink)
    const ytMatch = cleanEmbed.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|shorts\/))([a-zA-Z0-9_-]{10,12})/i);
    if (ytMatch && ytMatch[1]) {
      const id = ytMatch[1];
      candidates.push(`https://i.ytimg.com/vi/${id}/hqdefault.jpg`);
      candidates.push(`https://img.youtube.com/vi/${id}/mqdefault.jpg`);
    }

    // Dailymotion
    const dmMatch = cleanEmbed.match(/(?:dailymotion\.com\/(?:video|embed\/video)\/|dai\.ly\/)([a-zA-Z0-9]+)/i);
    if (dmMatch && dmMatch[1]) {
      candidates.push(`https://www.dailymotion.com/thumbnail/video/${dmMatch[1]}`);
    }

    // Vimeo
    const vimeoMatch = cleanEmbed.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
    if (vimeoMatch && vimeoMatch[1]) {
      candidates.push(`https://vumbnail.com/${vimeoMatch[1]}.jpg`);
    }

    // SpankBang
    const spankMatch = cleanEmbed.match(/spankbang\.com\/([a-zA-Z0-9]+)\/embed/i);
    if (spankMatch && spankMatch[1]) {
      candidates.push(`https://sb-cd.spankbang.com/${spankMatch[1]}/preview.jpg`);
    }

    // Pornhub
    const phMatch = cleanEmbed.match(/pornhub\.com\/(?:embed\/|view_video\.php\?viewkey=)([a-zA-Z0-9]+)/i);
    if (phMatch && phMatch[1]) {
      candidates.push(`https://ci.phncdn.com/videos/${phMatch[1]}/original/(m=eaSaaWaaa)(mh=500).jpg`);
    }

    // OK.ru
    const okMatch = cleanEmbed.match(/ok\.ru\/videoembed\/(\d+)/i);
    if (okMatch && okMatch[1]) {
      candidates.push(`https://i.mycdn.me/image?id=${okMatch[1]}&t=3`);
    }

    // VK
    const vkMatch = cleanEmbed.match(/vk\.com\/video_ext\.php\?oid=(-?\d+)&id=(\d+)/i);
    if (vkMatch && vkMatch[1] && vkMatch[2]) {
      candidates.push(`https://sun9-34.userapi.com/video_${vkMatch[1]}_${vkMatch[2]}.jpg`);
    }
  }

  // 3. Fallback to high-definition dynamic SVG
  candidates.push(generatePlaceholderSvg(title, category));

  // Deduplicate
  return Array.from(new Set(candidates.filter(Boolean)));
}

export function resolveThumbnailUrl(
  poster?: string | null,
  embedUrl?: string | null,
  title?: string,
  category?: string
): { primary: string; fallback: string } {
  const candidates = getThumbnailCandidates(poster, embedUrl, title, category);
  return {
    primary: candidates[0] || generatePlaceholderSvg(title, category),
    fallback: candidates[1] || generatePlaceholderSvg(title, category)
  };
}

export const ACTIVE_BYSE_DOMAIN = 'bysewihe.com';

export function toEmbedSrc(rawUrl: string | null | undefined): string {
  if (!rawUrl) return '';
  let url = rawUrl.trim();

  // Rewrite Byse / Filemoon URLs to the active configured domain bysewihe.com with Adblock & Antivirus
  const byseMatch = url.match(/(?:https?:\/\/)?(?:byse\.sx|filemoon\.(?:sx|to|nl|in|org)|api\.byse\.sx|bysewihe\.com)\/(?:e|d|v)\/([a-zA-Z0-9_-]+)/i);
  if (byseMatch && byseMatch[1]) {
    return `https://${ACTIVE_BYSE_DOMAIN}/e/${byseMatch[1]}`;
  }

  if (url.includes('youtube.com/embed/')) return url;
  const m = url.match(/(?:youtu\.be\/|watch\?v=|shorts\/)([a-zA-Z0-9_-]{10,12})/);
  if (m) return `https://www.youtube.com/embed/${m[1]}?autoplay=1`;
  return url;
}

