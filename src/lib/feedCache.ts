import { Video } from '../types';

interface CacheEntry {
  data: Video[];
  timestamp: number;
}

const MEMORY_CACHE = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes TTL for snappy performance without stale feeds
const MAX_CACHE_ENTRIES = 120;

export function getCachedVideos(key: string): Video[] | null {
  const entry = MEMORY_CACHE.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    MEMORY_CACHE.delete(key);
    return null;
  }
  return entry.data;
}

export function setCachedVideos(key: string, data: Video[]): void {
  if (MEMORY_CACHE.size >= MAX_CACHE_ENTRIES) {
    // Evict oldest entries
    const firstKey = MEMORY_CACHE.keys().next().value;
    if (firstKey) MEMORY_CACHE.delete(firstKey);
  }
  MEMORY_CACHE.set(key, {
    data,
    timestamp: Date.now(),
  });
}

export function clearVideoCache(): void {
  MEMORY_CACHE.clear();
}
