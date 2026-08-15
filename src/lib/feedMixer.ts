import { Video } from '../types';
import { getViewerTasteProfile } from './userHistory';

/**
 * Layer 6 — Feed Mixing (Happens in application code, NOT SQL)
 * 
 * Mixes the three candidate pools (trending / affinity / discovery)
 * deterministically. 
 * 
 * Target Ratios:
 * - 45% affinity pool
 * - 25% trending pool
 * - 15% co-occurrence/related pool
 * - 10% recency-boosted
 * - 5% discovery/random
 */

// A simple deterministic random number generator (Linear Congruential Generator)
function mulberry32(a: number) {
  return function() {
    var t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

export function mixFeedPools(
  affinityPool: Video[],
  trendingPool: Video[],
  recentPool: Video[],
  discoveryPool: Video[],
  pageSeed: number
): Video[] {
  const mixed: Video[] = [];
  const seenIds = new Set<string | number>();
  const profile = getViewerTasteProfile();
  const isNewUser = (profile.totalActionsCount || 0) < 6;
  
  // Filter recent pool for new users so only high quality videos pass through
  const filteredRecentPool = isNewUser
    ? recentPool.filter(v => {
        const views = (v.total_views || 0) + (v.base_views || 0) + (v.real_views || 0);
        return views >= 20000 || (v.duration_sec && v.duration_sec >= 600);
      })
    : recentPool;

  // Create copies of the pools so we can shift from them
  const pAffinity = [...affinityPool];
  const pTrending = [...trendingPool];
  const pRecent = [...filteredRecentPool];
  const pDiscovery = [...discoveryPool];

  // We simulate the co-occurrence pool using affinity pool items for this frontend implementation
  const pRelated = [...affinityPool].reverse();

  const rng = mulberry32(pageSeed);

  const popItem = (pool: Video[]) => {
    while (pool.length > 0) {
      const idx = Math.floor(rng() * Math.min(pool.length, 5));
      const item = pool.splice(idx, 1)[0];
      if (!seenIds.has(item.id)) {
        seenIds.add(item.id);
        return item;
      }
    }
    return null;
  };

  // Build a bucket of 20 items for the page
  // For new users: ~50% Trending/Classic + 30% Proven Affinity/Related + 15% High-Quality Recent + 5% Discovery
  for (let i = 0; i < 20; i++) {
    let item = null;
    
    if (isNewUser) {
      if (i % 20 < 10) {
        // High-view / classic trending hits from the 1st year
        item = popItem(pTrending);
      } else if (i % 20 < 16) {
        // Proven affinity / category leaders
        item = popItem(pAffinity) || popItem(pRelated);
      } else if (i % 20 < 19) {
        // Minimal (15%) high-quality recent uploads
        item = popItem(pRecent);
      } else {
        // Discovery wildcard
        item = popItem(pDiscovery);
      }
    } else {
      // Active user standard distribution
      if (i % 20 < 9) {
        item = popItem(pAffinity);
      } else if (i % 20 < 14) {
        item = popItem(pTrending);
      } else if (i % 20 < 17) {
        item = popItem(pRelated);
      } else if (i % 20 < 19) {
        item = popItem(pRecent);
      } else {
        item = popItem(pDiscovery);
      }
    }

    // Fallbacks if a pool is empty
    if (!item) item = popItem(pTrending);
    if (!item) item = popItem(pAffinity);
    if (!item) item = popItem(pRelated);
    if (!item) item = popItem(pRecent);
    if (!item) item = popItem(pDiscovery);

    if (item) {
      mixed.push(item);
    }
  }

  // Session-level personalization (Layer 6 boost)
  // Bring items matching the last 3 clicked tags slightly up in this 20-item bucket
  const topTags = profile.topTags.slice(0, 3);
  
  if (topTags.length > 0) {
    mixed.sort((a, b) => {
      let aScore = 0;
      let bScore = 0;
      topTags.forEach(t => {
        if (a.tags?.toLowerCase().includes(t)) aScore++;
        if (b.tags?.toLowerCase().includes(t)) bScore++;
      });
      // Stable sort fallback
      if (aScore === bScore) return 0;
      return bScore - aScore;
    });
  }

  return mixed;
}
