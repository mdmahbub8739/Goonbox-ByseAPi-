import { getViewerTasteProfile } from './userHistory';

/**
 * Layer 3 — Segment-Based Personalization
 * 
 * Reduces every user to a small signature (e.g. top tags hashed) into a segment ID.
 * This collapses millions of users into ~2,000 segments.
 */

export function getUserSegmentId(): string {
  try {
    const profile = getViewerTasteProfile();
    const hasHistory = profile.totalActionsCount > 3 || profile.likedIds.size > 0 || profile.watchedIds.size > 0;
    
    if (!hasHistory) {
      return 'default';
    }

    // Hash signature based on top 3 categories and tags
    const signatureItems = [
      ...profile.topCategories.slice(0, 2),
      ...profile.topTags.slice(0, 2)
    ].sort();

    if (signatureItems.length === 0) {
      return 'default';
    }

    // Simple string hash for the segment ID
    const signature = signatureItems.join('|').toLowerCase();
    let hash = 0;
    for (let i = 0; i < signature.length; i++) {
      const char = signature.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    return `seg_${Math.abs(hash).toString(16)}`;
  } catch (e) {
    return 'default';
  }
}

/**
 * Layer 5 — Read Path / Caching (three tiers)
 */

interface CacheEntry {
  data: any[];
  timestamp: number;
}

const LAYER_5_MEMORY_CACHE = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 min TTL

export function getEdgeCachePool(segmentId: string): any[] | null {
  const entry = LAYER_5_MEMORY_CACHE.get(`pool_${segmentId}`);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    LAYER_5_MEMORY_CACHE.delete(`pool_${segmentId}`);
    return null;
  }
  return entry.data;
}

export function setEdgeCachePool(segmentId: string, data: any[]): void {
  LAYER_5_MEMORY_CACHE.set(`pool_${segmentId}`, {
    data,
    timestamp: Date.now(),
  });
}

export function clearEdgeCache(): void {
  LAYER_5_MEMORY_CACHE.clear();
}
