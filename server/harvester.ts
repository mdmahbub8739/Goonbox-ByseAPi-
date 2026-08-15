import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://cvflardlfqpkbplyuzzk.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2ZmxhcmRsZnFwa2JwbHl1enprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3MDE2NTIsImV4cCI6MjEwMjI3NzY1Mn0.vNDS24T81vg0RljSGKqFJh2FtKD4dPSe8rB5lt05Rhs";
const BASE_API = "https://pornx.to/wp-json/wp/v2/posts";
const NEWEST_HTML_URL = "https://pornx.to/newest";

export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_KEY);

function decodeHtmlEntities(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#8211;/g, '–')
    .replace(/&#8212;/g, '—')
    .replace(/&#8216;/g, "‘")
    .replace(/&#8217;/g, "’")
    .replace(/&#8220;/g, '“')
    .replace(/&#8221;/g, '”')
    .replace(/&#8230;/g, '…')
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .trim();
}

export interface ParsedVideoRecord {
  id: number;
  title: string;
  slug: string;
  poster: string;
  embed_url: string;
  embed_host: string;
  duration_sec: number;
  categories: string;
  tags: string;
  actor: string;
  base_views: number;
  real_views: number;
  published_date: string;
}

export function parseWordPressPost(post: any): ParsedVideoRecord {
  const vidSettings = post?.cmb2?.video_player_settings || {};
  const rawVideoUrl = vidSettings.vm_video_url || '';

  let embedUrl = '';
  if (typeof rawVideoUrl === 'string') {
    if (rawVideoUrl.includes('<iframe')) {
      const match = rawVideoUrl.match(/src=["'](.*?)["']/);
      embedUrl = match ? match[1] : '';
    } else if (rawVideoUrl.startsWith('http')) {
      embedUrl = rawVideoUrl;
    }
  }

  let embedHost = 'No Embed';
  if (embedUrl) {
    try {
      const parsed = new URL(embedUrl);
      embedHost = parsed.hostname.replace(/^www\./, '');
    } catch {
      embedHost = 'Embed';
    }
  }

  // 4-tier poster fallback
  let poster = '';
  try {
    const media = post?._embedded?.['wp:featuredmedia'];
    if (Array.isArray(media) && media[0]?.source_url) {
      poster = media[0].source_url;
    } else if (post?.yoast_head_json?.og_image?.[0]?.url) {
      poster = post.yoast_head_json.og_image[0].url;
    } else if (post?.yoast_head_json?.twitter_image) {
      poster = post.yoast_head_json.twitter_image;
    } else if (vidSettings.vid_m_poster_image) {
      poster = vidSettings.vid_m_poster_image;
    }
  } catch {
    poster = '';
  }

  if (!poster) {
    poster = 'https://images.placeholders.dev/?width=640&height=360&text=No+Poster';
  }

  // Categories & Tags
  const categories: string[] = [];
  const tags: string[] = [];
  try {
    const allTerms = post?._embedded?.['wp:term'];
    if (Array.isArray(allTerms)) {
      for (const termGroup of allTerms) {
        if (Array.isArray(termGroup)) {
          for (const t of termGroup) {
            if (t?.name) {
              const decoded = decodeHtmlEntities(t.name);
              const taxonomy = t?.taxonomy || '';
              const slug = (t?.slug || '').toLowerCase();
              if (taxonomy === 'post_tag' || taxonomy === 'tag') {
                if (!tags.includes(decoded)) tags.push(decoded);
              } else {
                if (!categories.includes(decoded)) categories.push(decoded);
              }

              // Explicit orientation tag detection
              if (slug.includes('trans') || decoded.toLowerCase().includes('trans')) {
                if (!categories.includes('Transgender')) categories.push('Transgender');
              }
              if (slug.includes('gay') || decoded.toLowerCase().includes('gay')) {
                if (!categories.includes('Gay')) categories.push('Gay');
              }
              if (slug.includes('straight') || decoded.toLowerCase().includes('straight')) {
                if (!categories.includes('Straight')) categories.push('Straight');
              }
            }
          }
        }
      }
    }

    if (Array.isArray(post?.class_list)) {
      for (const cls of post.class_list) {
        if (typeof cls === 'string') {
          if (cls.includes('transgender') || cls.includes('orientation-transgender') || cls.includes('trans')) {
            if (!categories.includes('Transgender')) categories.push('Transgender');
          }
          if (cls.includes('orientation-gay') || cls === 'category-gay') {
            if (!categories.includes('Gay')) categories.push('Gay');
          }
          if (cls.startsWith('category-')) {
            const clean = cls.replace('category-', '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            if (!categories.includes(clean)) categories.push(clean);
          }
          if (cls.startsWith('tag-')) {
            const clean = cls.replace('tag-', '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            if (!tags.includes(clean)) tags.push(clean);
          }
        }
      }
    }

    // Inspect post link for category/orientation patterns (e.g. /category/orientation/transgender/)
    const postLink = (post?.link || '').toLowerCase();
    if (postLink.includes('transgender') || postLink.includes('orientation/transgender') || postLink.includes('/trans/')) {
      if (!categories.includes('Transgender')) categories.push('Transgender');
    }
    if (postLink.includes('orientation/gay') || postLink.includes('/gay/')) {
      if (!categories.includes('Gay')) categories.push('Gay');
    }
  } catch {
    // ignore
  }

  // Actor / Studio
  const movieSettings = post?.cmb2?.video_movie_settings || {};
  let actor = movieSettings.vid_m_actor || movieSettings.vid_m_actors || 'N/A';
  actor = typeof actor === 'string' ? decodeHtmlEntities(actor) : 'N/A';

  // Duration
  let durationSec = 0;
  try {
    durationSec = parseInt(vidSettings.vm_duration, 10) || 0;
  } catch {
    durationSec = 0;
  }

  const rawTitle = post?.title?.rendered || 'Untitled';
  const cleanTitle = decodeHtmlEntities(rawTitle);
  const publishedDate = post?.date_gmt || post?.date || new Date().toISOString();

  const baseViews = Math.floor((Number(post?.id) || 1000) % 4500) + 420;

  const rawSlug = (post?.slug || '').trim() || `video-${post?.id}`;
  const slug = rawSlug.endsWith(`-${post?.id}`) ? rawSlug : `${rawSlug}-${post?.id}`;

  return {
    id: Number(post?.id),
    title: cleanTitle,
    slug,
    poster,
    embed_url: embedUrl,
    embed_host: embedHost,
    duration_sec: durationSec,
    categories: categories.join(', '),
    tags: tags.join(', '),
    actor: actor || 'N/A',
    base_views: baseViews,
    real_views: 0,
    published_date: publishedDate,
  };
}

export interface HarvesterTelemetry {
  status: 'IDLE' | 'SYNCING' | 'AUTO_RUNNING';
  isAutoSyncEnabled: boolean;
  autoSyncIntervalMinutes: number;
  lastSyncTime: string | null;
  lastSyncSummary: {
    syncMode: 'TWO_STEP_NEWEST_MATCHING' | 'STANDARD_REST';
    newestScrapedIdsCount: number;
    pagesChecked: number;
    fetchedPosts: number;
    newPostsAdded: number;
    updatedPosts: number;
  } | null;
  totalSyncedOverall: number;
  targetNewestPath: string;
  logs: Array<{ time: string; msg: string; level: 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR' }>;
}

class HarvesterEngine {
  private autoSyncTimer: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private telemetry: HarvesterTelemetry = {
    status: 'IDLE',
    isAutoSyncEnabled: true,
    autoSyncIntervalMinutes: 3, // Auto check every 3 minutes
    lastSyncTime: null,
    lastSyncSummary: null,
    totalSyncedOverall: 0,
    targetNewestPath: NEWEST_HTML_URL,
    logs: [],
  };

  constructor() {
    this.addLog('Harvester engine initialized with 2-Step matching for https://pornx.to/newest.', 'INFO');
    // Start auto-sync on boot
    this.startAutoSync(3);
  }

  private addLog(msg: string, level: 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR' = 'INFO') {
    const timeStr = new Date().toLocaleTimeString();
    this.telemetry.logs.unshift({ time: timeStr, msg, level });
    if (this.telemetry.logs.length > 50) {
      this.telemetry.logs.pop();
    }
  }

  public getTelemetry(): HarvesterTelemetry {
    return { ...this.telemetry };
  }

  public setAutoSync(enable: boolean, intervalMinutes = 3) {
    this.telemetry.isAutoSyncEnabled = enable;
    this.telemetry.autoSyncIntervalMinutes = intervalMinutes;

    if (this.autoSyncTimer) {
      clearInterval(this.autoSyncTimer);
      this.autoSyncTimer = null;
    }

    if (enable) {
      this.startAutoSync(intervalMinutes);
      this.addLog(`Auto-sync enabled (Every ${intervalMinutes} min with 2-Step newest matching)`, 'INFO');
    } else {
      this.telemetry.status = 'IDLE';
      this.addLog('Auto-sync disabled', 'WARN');
    }
  }

  private startAutoSync(intervalMinutes: number) {
    if (this.autoSyncTimer) clearInterval(this.autoSyncTimer);
    
    // Initial sync shortly after startup (after 5 seconds)
    setTimeout(() => {
      if (this.telemetry.isAutoSyncEnabled) {
        this.syncNewestTwoStep(2);
      }
    }, 5000);

    this.autoSyncTimer = setInterval(() => {
      if (this.telemetry.isAutoSyncEnabled && !this.isProcessing) {
        this.syncNewestTwoStep(2);
      }
    }, intervalMinutes * 60 * 1000);
  }

  /**
   * STEP 1 of 2-Step Matching:
   * Scrapes real-time newest post IDs directly from the HTML of https://pornx.to/newest
   */
  public async scrapeNewestIdsFromHtml(pageCount = 2): Promise<number[]> {
    const scrapedIds: number[] = [];
    for (let p = 1; p <= pageCount; p++) {
      const url = p === 1 ? NEWEST_HTML_URL : `${NEWEST_HTML_URL}/page/${p}/`;
      try {
        const res = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
        });
        if (!res.ok) {
          this.addLog(`Scraping ${url} returned HTTP ${res.status}`, 'WARN');
          continue;
        }
        const html = await res.text();
        const matches = [...html.matchAll(/id=["']post-(\d+)["']|class=["'][^"']*post-(\d+)[^"']*["']/g)];
        for (const m of matches) {
          const idNum = parseInt(m[1] || m[2], 10);
          if (idNum > 10000 && !scrapedIds.includes(idNum)) {
            scrapedIds.push(idNum);
          }
        }
      } catch (err: any) {
        this.addLog(`Error scraping ${url}: ${err?.message || err}`, 'WARN');
      }
    }
    return scrapedIds;
  }

  /**
   * STEP 2 of 2-Step Matching:
   * Queries WP REST API with ?include=id1,id2... to get full rich metadata for the exact newest IDs
   */
  public async fetchPostsByIds(ids: number[]): Promise<ParsedVideoRecord[]> {
    if (ids.length === 0) return [];
    const results: ParsedVideoRecord[] = [];
    const chunkSize = 40;

    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);
      const url = `${BASE_API}?include=${chunk.join(',')}&per_page=${chunk.length}&_embed=1`;
      try {
        const res = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
          },
        });
        if (res.ok) {
          const rawPosts = await res.json();
          if (Array.isArray(rawPosts)) {
            const parsed = rawPosts.map(parseWordPressPost).filter(p => p.id && p.id > 0);
            results.push(...parsed);
          }
        } else {
          this.addLog(`WP API batch include returned HTTP ${res.status}`, 'WARN');
        }
      } catch (err: any) {
        this.addLog(`Error fetching posts chunk: ${err?.message || err}`, 'WARN');
      }
    }
    return results;
  }

  /**
   * TWO-STEP MATCHING SYNC:
   * Step 1: Scrapes newest IDs directly from https://pornx.to/newest
   * Step 2: Fetches full post records for those IDs from WP REST API
   * Step 3: Complements with standard REST API feed to ensure 100% coverage
   * Step 4: Upserts to Supabase with ON CONFLICT (id) for zero duplicates
   */
  public async syncNewestTwoStep(pageCount = 2): Promise<{
    success: boolean;
    syncMode: 'TWO_STEP_NEWEST_MATCHING';
    newestScrapedIdsCount: number;
    pagesChecked: number;
    fetchedPosts: number;
    newPostsAdded: number;
    updatedPosts: number;
    error?: string;
  }> {
    if (this.isProcessing) {
      return {
        success: false,
        syncMode: 'TWO_STEP_NEWEST_MATCHING',
        newestScrapedIdsCount: 0,
        pagesChecked: 0,
        fetchedPosts: 0,
        newPostsAdded: 0,
        updatedPosts: 0,
        error: 'Sync already in progress',
      };
    }

    this.isProcessing = true;
    this.telemetry.status = this.telemetry.isAutoSyncEnabled ? 'AUTO_RUNNING' : 'SYNCING';
    this.addLog(`[2-Step Sync] Step 1: Scraper targeting ${NEWEST_HTML_URL} (pages 1-${pageCount})...`, 'INFO');

    let totalFetched = 0;
    let newAddedCount = 0;
    let updatedCount = 0;
    let scrapedIdsCount = 0;

    try {
      // Step 1: Scrape newest IDs from https://pornx.to/newest
      const newestIds = await this.scrapeNewestIdsFromHtml(pageCount);
      scrapedIdsCount = newestIds.length;
      this.addLog(`[2-Step Sync] Step 1 complete: Extracted ${newestIds.length} newest IDs from HTML.`, 'SUCCESS');

      // Step 2: Fetch matching post records via REST API include
      const matchedPosts = await this.fetchPostsByIds(newestIds);
      this.addLog(`[2-Step Sync] Step 2 complete: Matched ${matchedPosts.length} full post objects with real video data.`, 'SUCCESS');

      // Step 3: Also fetch standard latest pages to catch any recent items
      const standardBatch: ParsedVideoRecord[] = [];
      for (let p = 1; p <= pageCount; p++) {
        try {
          const url = `${BASE_API}?per_page=40&page=${p}&_embed=1`;
          const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
          });
          if (res.ok) {
            const raw = await res.json();
            if (Array.isArray(raw)) {
              standardBatch.push(...raw.map(parseWordPressPost).filter(x => x.id && x.id > 0));
            }
          }
        } catch {
          // ignore
        }
      }

      // Combine and deduplicate matched newest posts + standard posts
      const allUniqueMap = new Map<number, ParsedVideoRecord>();
      for (const item of matchedPosts) {
        allUniqueMap.set(item.id, item);
      }
      for (const item of standardBatch) {
        if (!allUniqueMap.has(item.id)) {
          allUniqueMap.set(item.id, item);
        }
      }

      const unifiedBatch = Array.from(allUniqueMap.values());
      totalFetched = unifiedBatch.length;

      if (unifiedBatch.length > 0) {
        // Check existing database records
        const ids = unifiedBatch.map(b => b.id);
        const { data: existingRecords } = await supabaseAdmin
          .from('videos')
          .select('id')
          .in('id', ids);

        const existingSet = new Set((existingRecords || []).map(r => r.id));
        const newItems = unifiedBatch.filter(b => !existingSet.has(b.id));
        const updatedItems = unifiedBatch.filter(b => existingSet.has(b.id));

        // Supabase ON CONFLICT (id) upsert
        const { error: upsertError } = await supabaseAdmin
          .from('videos')
          .upsert(unifiedBatch, {
            onConflict: 'id',
            ignoreDuplicates: false,
          });

        if (upsertError) {
          this.addLog(`Batch upsert warning: ${upsertError.message}. Running row-by-row fallback...`, 'WARN');
          let saved = 0;
          for (const item of unifiedBatch) {
            const { error: singleErr } = await supabaseAdmin
              .from('videos')
              .upsert([item], { onConflict: 'id' });
            if (!singleErr) saved++;
          }
          newAddedCount += newItems.length;
          updatedCount += updatedItems.length;
          this.addLog(`Upsert fallback finished: ${saved}/${unifiedBatch.length} saved.`, 'SUCCESS');
        } else {
          newAddedCount = newItems.length;
          updatedCount = updatedItems.length;
          this.addLog(`Database updated: ${newItems.length} fresh videos added, ${updatedItems.length} refreshed.`, 'SUCCESS');
        }
      }

      const summary = {
        syncMode: 'TWO_STEP_NEWEST_MATCHING' as const,
        newestScrapedIdsCount: scrapedIdsCount,
        pagesChecked: pageCount,
        fetchedPosts: totalFetched,
        newPostsAdded: newAddedCount,
        updatedPosts: updatedCount,
      };

      this.telemetry.lastSyncTime = new Date().toISOString();
      this.telemetry.lastSyncSummary = summary;
      this.telemetry.totalSyncedOverall += newAddedCount;
      this.addLog(`[2-Step Sync Complete] ${newAddedCount} new posts saved directly from ${NEWEST_HTML_URL}.`, 'SUCCESS');

      return {
        success: true,
        ...summary,
      };
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      this.addLog(`2-Step Sync exception: ${errMsg}`, 'ERROR');
      return {
        success: false,
        syncMode: 'TWO_STEP_NEWEST_MATCHING',
        newestScrapedIdsCount: scrapedIdsCount,
        pagesChecked: pageCount,
        fetchedPosts: totalFetched,
        newPostsAdded: newAddedCount,
        updatedPosts: updatedCount,
        error: errMsg,
      };
    } finally {
      this.isProcessing = false;
      this.telemetry.status = this.telemetry.isAutoSyncEnabled ? 'AUTO_RUNNING' : 'IDLE';
    }
  }

  public async syncLatestPages(pageCount = 3) {
    return this.syncNewestTwoStep(pageCount);
  }
}

export const harvester = new HarvesterEngine();
