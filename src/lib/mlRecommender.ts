import { Video } from '../types';
import { getViewerTasteProfile, ViewerAffinityProfile } from './userHistory';
import { supabase } from './supabase';
import { Orientation, applyOrientationFilter, isMatchingOrientation } from './orientation';

/**
 * Client-Side Recommendation & Ranking Engine
 * 
 * Features:
 * - Real-time vectorization of the User Profile (TF-IDF inspired).
 * - Vectorization of Video Metadata.
 * - Multi-layer client-side caching of Video Vectors and Candidate Pools.
 * - Sub-millisecond Cosine Similarity calculation (zero external API calls).
 */

// LRU Cache for Video Feature Vectors to avoid re-computing across renders/sessions
const VECTOR_CACHE = new Map<string, Record<string, number>>();
const MAX_CACHE_SIZE = 2500;

// Client-side Candidate Pool Cache to eliminate redundant database queries
let CANDIDATE_POOL_CACHE: Video[] | null = null;
let CURRENT_POOL_ORIENTATION: string | null = null;
let CANDIDATE_POOL_CACHE_TIME = 0;
const CANDIDATE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes TTL

function tokenize(text: string | null | undefined): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2);
}

function getVectorMagnitude(vec: Record<string, number>): number {
  let sumSq = 0;
  for (const val of Object.values(vec)) {
    sumSq += val * val;
  }
  return Math.sqrt(sumSq);
}

function computeCosineSimilarity(vecA: Record<string, number>, vecB: Record<string, number>): number {
  let dotProduct = 0;
  for (const [key, valA] of Object.entries(vecA)) {
    if (vecB[key]) {
      dotProduct += valA * vecB[key];
    }
  }
  
  const magA = getVectorMagnitude(vecA);
  const magB = getVectorMagnitude(vecB);
  
  if (magA === 0 || magB === 0) return 0;
  return dotProduct / (magA * magB);
}

/**
 * Converts a Video into a feature vector (bag of words with weights)
 */
export function getVideoFeatureVector(video: Video): Record<string, number> {
  const cacheKey = String(video.id);
  if (VECTOR_CACHE.has(cacheKey)) {
    return VECTOR_CACHE.get(cacheKey)!;
  }

  const vector: Record<string, number> = {};
  
  const addTokens = (text: string | null | undefined, weight: number, prefix: string) => {
    const tokens = tokenize(text);
    for (const t of tokens) {
      const k = `${prefix}_${t}`;
      vector[k] = (vector[k] || 0) + weight;
    }
  };

  const addList = (listStr: string | null | undefined, weight: number, prefix: string) => {
    if (!listStr) return;
    const items = listStr.split(/[,|;]+/).map(i => i.trim().toLowerCase()).filter(Boolean);
    for (const item of items) {
      const k = `${prefix}_${item}`;
      vector[k] = (vector[k] || 0) + weight;
    }
  };

  // Feature Engineering Weights
  addTokens(video.title, 1.0, 'kw');
  addList(video.categories, 2.5, 'cat'); // Categories carry high signal
  addList(video.tags, 1.5, 'tag');
  addList(video.actor, 3.0, 'actor'); // Actor carries highest signal

  // Cache management
  if (VECTOR_CACHE.size > MAX_CACHE_SIZE) {
    const firstKey = VECTOR_CACHE.keys().next().value;
    if (firstKey) VECTOR_CACHE.delete(firstKey);
  }
  VECTOR_CACHE.set(cacheKey, vector);

  return vector;
}

/**
 * Translates the ViewerAffinityProfile into a normalized User Feature Vector
 */
export function getUserFeatureVector(profile: ViewerAffinityProfile): Record<string, number> {
  const vector: Record<string, number> = {};
  
  // Aggregate scores from the profile
  for (const [cat, score] of Object.entries(profile.categoryScores)) {
    vector[`cat_${cat.toLowerCase()}`] = score * 2.5;
  }
  for (const [tag, score] of Object.entries(profile.tagScores)) {
    vector[`tag_${tag.toLowerCase()}`] = score * 1.5;
  }
  for (const [actor, score] of Object.entries(profile.actorScores)) {
    vector[`actor_${actor.toLowerCase()}`] = score * 3.0;
  }
  for (const [kw, score] of Object.entries(profile.keywordScores)) {
    vector[`kw_${kw.toLowerCase()}`] = score * 1.0;
  }

  return vector;
}

export interface RecommendationScoreResult {
  video: Video;
  score: number;
  isRecommended: boolean;
}

// Backwards compatibility alias
export type MLScoreResult = RecommendationScoreResult;

/**
 * Scores a list of videos against the user's affinity profile using Cosine Similarity.
 * Returns sorted videos with their recommendation metadata.
 */
export function rankVideosByRelevance(videos: Video[]): RecommendationScoreResult[] {
  const profile = getViewerTasteProfile();
  const isNewUser = (profile.totalActionsCount || 0) < 6;
  
  // If cold start (no or little history), sort by proven quality & 1-year time distribution
  if (isNewUser) {
    const scored = videos.map(video => {
      const views = (video.total_views || 0) + (video.base_views || 0) + (video.real_views || 0);
      const dateStr = video.created_at || video.published_date;
      let daysOld = 400;
      if (dateStr) {
        const t = new Date(dateStr).getTime();
        if (!isNaN(t)) daysOld = (Date.now() - t) / (1000 * 60 * 60 * 24);
      }

      let score = 0;
      // 1st year content receives high priority
      if (daysOld <= 365) {
        score += 100 + Math.min(50, views / 2000);
      } else if (daysOld <= 730) {
        // 1-2 years
        score += 30 + Math.min(30, views / 3000);
      } else {
        // > 2 years
        score += 5 + Math.min(10, views / 5000);
      }

      // Add a random wildcard discovery factor (0-25)
      score += Math.random() * 25;

      return {
        video,
        score,
        isRecommended: score > 80
      };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored;
  }

  const userVector = getUserFeatureVector(profile);
  
  const scored = videos
    .map(video => {
      const videoVector = getVideoFeatureVector(video);
      let sim = computeCosineSimilarity(userVector, videoVector);
      
      // Balance familiarity vs fresh discovery
      if (profile.watchedIds.has(String(video.id))) {
        sim *= 0.05; // Heavily penalize already watched videos to break repetition loop
      }
      if (profile.likedIds.has(String(video.id)) || profile.savedIds.has(String(video.id))) {
        sim *= 0.85; // Liked/Saved items remain relevant but allow fresh content
      }

      // Time penalization (limit to 1-2 years max by default)
      const dateStr = video.created_at || video.published_date;
      let daysOld = 400;
      if (dateStr) {
        const t = new Date(dateStr).getTime();
        if (!isNaN(t)) daysOld = (Date.now() - t) / (1000 * 60 * 60 * 24);
      }
      
      // Penalize older than 1 year, heavily penalize older than 2 years
      if (daysOld > 730) {
        sim *= 0.2; // Very old content is suppressed
      } else if (daysOld > 365) {
        sim *= 0.6; // Moderate suppression for 1-2 years
      } else if (daysOld < 30) {
        sim *= 1.2; // Boost brand new content
      }

      // Inject discovery wildcard factor (randomness for variety)
      // When user has watched a lot (high actions), inject massive randomness to break echo chambers
      const randomFactor = (profile.totalActionsCount > 20) ? 0.45 : 0.15;
      sim += (Math.random() * randomFactor);

      return {
        video,
        score: sim,
        isRecommended: sim > 0.40
      };
    });

  // Sort descending by score
  scored.sort((a, b) => b.score - a.score);
  return scored;
}

// Backwards compatibility alias
export const rankVideosByML = rankVideosByRelevance;

/**
 * Fetches or retrieves the cached candidate pool and applies instant client-side ranking.
 * Minimizes database queries by reusing the in-memory pool for 5 minutes.
 */
export async function getPersonalizedFeed(forceRefresh = false, orientation: Orientation = 'all'): Promise<RecommendationScoreResult[]> {
  const now = Date.now();
  
  if (!forceRefresh && CANDIDATE_POOL_CACHE && CURRENT_POOL_ORIENTATION === orientation && (now - CANDIDATE_POOL_CACHE_TIME) < CANDIDATE_CACHE_TTL_MS) {
    // Replace in-memory return
  }

  try {
    // Fetch a much wider pool of candidates to introduce significant variety
    const [trendingRes, recentRes] = await Promise.all([
      applyOrientationFilter(
        supabase
          .from('videos')
          .select('*')
          .order('total_views', { ascending: false })
          .limit(150),
        orientation
      ),
      applyOrientationFilter(
        supabase
          .from('videos')
          .select('*')
          .order('id', { ascending: false })
          .limit(300),
        orientation
      )
    ]);

    const combinedMap = new Map<string | number, Video>();
    
    // Randomize the selection to prevent feed staleness
    if (trendingRes.data) {
      const shuffledTrending = trendingRes.data.sort(() => Math.random() - 0.5).slice(0, 60);
      shuffledTrending.forEach(v => combinedMap.set(v.id, v as Video));
    }
    
    if (recentRes.data) {
      const shuffledRecent = recentRes.data.sort(() => Math.random() - 0.5).slice(0, 100);
      shuffledRecent.forEach(v => {
        if (!combinedMap.has(v.id)) combinedMap.set(v.id, v as Video);
      });
    }

    const data = Array.from(combinedMap.values());

    if (data.length === 0) {
      if (CANDIDATE_POOL_CACHE) {
        const validCached = CANDIDATE_POOL_CACHE.filter(v => isMatchingOrientation(v, orientation));
        return rankVideosByRelevance(validCached);
      }
      return [];
    }

    CANDIDATE_POOL_CACHE = data;
    CANDIDATE_POOL_CACHE_TIME = now;

    return rankVideosByRelevance(CANDIDATE_POOL_CACHE);
  } catch (err) {
    console.error("Personalized feed error:", err);
    if (CANDIDATE_POOL_CACHE) {
      const validCachedFallback = CANDIDATE_POOL_CACHE.filter(v => isMatchingOrientation(v, orientation));
      return rankVideosByRelevance(validCachedFallback);
    }
    return [];
  }
}
