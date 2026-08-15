import { Video } from '../types';
import { extractKeywords, isDoodstream, isWithinDays } from './videoAlgo';

export interface RawMatchDetails {
  matchedCategories: string[];
  matchedTags: string[];
  isActorMatch: boolean;
  matchedKeywords: string[];
  totalMatchScore: number;
}

const NOISE_TAGS = new Set([
  'video', 'videos', 'hd', '1080p', '720p', '4k', 'mp4', 'free', 'online', 'watch',
  'n/a', 'unknown', 'xxx', 'porn', 'porno', 'full', 'new', 'official'
]);

/**
 * Extracts and cleans raw categories from a video
 */
export function extractRawCategories(categoriesStr?: string | null): string[] {
  if (!categoriesStr) return [];
  const list = categoriesStr
    .split(/[,/|;]+/)
    .map(c => c.trim())
    .filter(c => c && c.toLowerCase() !== 'n/a' && c.toLowerCase() !== 'unknown');
  
  // Deduplicate case-insensitively while preserving original casing
  const seen = new Set<string>();
  const result: string[] = [];
  for (const c of list) {
    const lower = c.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      result.push(c);
    }
  }
  return result;
}

/**
 * Extracts and cleans raw tags from a video
 */
export function extractRawTags(tagsStr?: string | null): string[] {
  if (!tagsStr) return [];
  const list = tagsStr
    .split(/[,/|;]+/)
    .map(t => t.replace(/^#/, '').trim())
    .filter(t => t && !NOISE_TAGS.has(t.toLowerCase()) && t.length >= 2);

  // Deduplicate case-insensitively while preserving original casing
  const seen = new Set<string>();
  const result: string[] = [];
  for (const t of list) {
    const lower = t.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      result.push(t);
    }
  }
  return result;
}

/**
 * Calculates raw tag and category match details between target video and candidate video
 */
export function calculateRawMetadataMatch(target: Video, candidate: Video): RawMatchDetails {
  if (!candidate || !candidate.id || String(candidate.id) === String(target.id)) {
    return {
      matchedCategories: [],
      matchedTags: [],
      isActorMatch: false,
      matchedKeywords: [],
      totalMatchScore: -99999,
    };
  }

  const targetCats = extractRawCategories(target.categories);
  const targetTags = extractRawTags(target.tags);
  const targetKeywords = extractKeywords(target.title);
  const targetActor = target.actor && target.actor !== 'N/A' ? target.actor.trim().toLowerCase() : '';

  const candCats = extractRawCategories(candidate.categories);
  const candTags = extractRawTags(candidate.tags);
  const candKeywords = extractKeywords(candidate.title);
  const candActor = candidate.actor && candidate.actor !== 'N/A' ? candidate.actor.trim().toLowerCase() : '';

  const targetCatLowerSet = new Set(targetCats.map(c => c.toLowerCase()));
  const targetTagLowerSet = new Set(targetTags.map(t => t.toLowerCase()));
  const targetKwLowerSet = new Set(targetKeywords.map(k => k.toLowerCase()));

  // 1. Matched Categories
  const matchedCategories: string[] = [];
  for (const c of candCats) {
    const lower = c.toLowerCase();
    if (targetCatLowerSet.has(lower)) {
      matchedCategories.push(c);
    } else {
      // Check partial substring match (e.g. "Amateur" in "Amateur Teen")
      for (const tCat of targetCats) {
        const tLower = tCat.toLowerCase();
        if ((lower.length > 3 && tLower.includes(lower)) || (tLower.length > 3 && lower.includes(tLower))) {
          if (!matchedCategories.includes(c)) {
            matchedCategories.push(c);
          }
          break;
        }
      }
    }
  }

  // 2. Matched Tags
  const matchedTags: string[] = [];
  for (const t of candTags) {
    const lower = t.toLowerCase();
    if (targetTagLowerSet.has(lower)) {
      matchedTags.push(t);
    } else {
      // Check partial substring match
      for (const tTag of targetTags) {
        const tLower = tTag.toLowerCase();
        if ((lower.length > 3 && tLower.includes(lower)) || (tLower.length > 3 && lower.includes(tLower))) {
          if (!matchedTags.includes(t)) {
            matchedTags.push(t);
          }
          break;
        }
      }
    }
  }

  // 3. Matched Actor
  const isActorMatch = Boolean(targetActor && candActor && (targetActor === candActor || targetActor.includes(candActor) || candActor.includes(targetActor)));

  // 4. Matched Title Keywords
  const matchedKeywords: string[] = [];
  for (const k of candKeywords) {
    const lower = k.toLowerCase();
    if (targetKwLowerSet.has(lower) && !matchedKeywords.includes(k)) {
      matchedKeywords.push(k);
    }
  }

  // 5. Compute Weighted Match Score
  let score = 0;

  // Category Matches: 50 pts each + 30 bonus for multiple
  score += matchedCategories.length * 50;
  if (matchedCategories.length > 1) {
    score += (matchedCategories.length - 1) * 25;
  }

  // Tag Matches: 35 pts each + 20 bonus for multiple
  score += matchedTags.length * 35;
  if (matchedTags.length > 1) {
    score += (matchedTags.length - 1) * 15;
  }

  // Actor Match: 75 pts
  if (isActorMatch) {
    score += 75;
  }

  // Title Keywords Match: 20 pts each
  score += matchedKeywords.length * 20;

  // Exact phrase match in title
  const candTitleClean = (candidate.title || '').toLowerCase();
  for (let i = 0; i < targetKeywords.length - 1; i++) {
    const bigram = `${targetKeywords[i]} ${targetKeywords[i + 1]}`;
    if (candTitleClean.includes(bigram)) {
      score += 60;
      break;
    }
  }

  // Quality & Host Reliability checks
  if (isDoodstream(candidate)) {
    if (!isWithinDays(candidate.created_at || candidate.published_date, 62)) {
      score -= 150;
    }
  }

  // Slight popularity tiebreaker
  const views = (candidate.total_views || 0) + (candidate.base_views || 0) + (candidate.real_views || 0);
  if (views > 50000) score += 12;
  else if (views > 10000) score += 6;

  return {
    matchedCategories,
    matchedTags,
    isActorMatch,
    matchedKeywords,
    totalMatchScore: score,
  };
}

export interface RelatedVideoItem {
  video: Video;
  matchDetails: RawMatchDetails;
}

/**
 * Filter and sort related videos specifically by raw tags and categories
 */
export function getRelatedVideosByRawMetadata(
  target: Video,
  candidatePool: Video[],
  options?: {
    filterTag?: string;
    filterCategory?: string;
    sortBy?: 'relevance' | 'views' | 'newest' | 'duration';
    minMatchCount?: number;
  }
): RelatedVideoItem[] {
  if (!target || !candidatePool || candidatePool.length === 0) return [];

  const filterTag = options?.filterTag?.toLowerCase().trim();
  const filterCat = options?.filterCategory?.toLowerCase().trim();
  const sortBy = options?.sortBy || 'relevance';

  const seenIds = new Set<string>();
  seenIds.add(String(target.id));

  const scoredList: RelatedVideoItem[] = [];

  for (const candidate of candidatePool) {
    if (!candidate || !candidate.id) continue;
    const candIdStr = String(candidate.id);
    if (seenIds.has(candIdStr)) continue;
    seenIds.add(candIdStr);

    const matchDetails = calculateRawMetadataMatch(target, candidate);

    // Apply specific tag or category filter if selected
    if (filterTag) {
      const candTags = (candidate.tags || '').toLowerCase();
      if (!candTags.includes(filterTag)) continue;
    }

    if (filterCat) {
      const candCats = (candidate.categories || '').toLowerCase();
      if (!candCats.includes(filterCat)) continue;
    }

    scoredList.push({
      video: candidate,
      matchDetails,
    });
  }

  // Sort according to chosen option
  if (sortBy === 'relevance') {
    scoredList.sort((a, b) => b.matchDetails.totalMatchScore - a.matchDetails.totalMatchScore);
  } else if (sortBy === 'views') {
    scoredList.sort((a, b) => {
      const vA = (a.video.total_views || 0) + (a.video.base_views || 0) + (a.video.real_views || 0);
      const vB = (b.video.total_views || 0) + (b.video.base_views || 0) + (b.video.real_views || 0);
      return vB - vA;
    });
  } else if (sortBy === 'newest') {
    scoredList.sort((a, b) => {
      const dateA = new Date(a.video.published_date || a.video.created_at || 0).getTime();
      const dateB = new Date(b.video.published_date || b.video.created_at || 0).getTime();
      if (dateB !== dateA) return dateB - dateA;
      return Number(b.video.id) - Number(a.video.id);
    });
  } else if (sortBy === 'duration') {
    scoredList.sort((a, b) => (b.video.duration_sec || 0) - (a.video.duration_sec || 0));
  }

  return scoredList;
}
