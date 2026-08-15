import { Video } from '../types';
import { getViewerTasteProfile, ViewerAffinityProfile, getPersonalizedFeedScore } from './userHistory';

const TWO_MONTHS_DAYS = 62;

/**
 * Checks if a video originates from Doodstream or similar unstable hosts
 */
export function isDoodstream(video: { embed_host?: string | null; embed_url?: string | null }): boolean {
  const host = (video.embed_host || '').toLowerCase();
  const url = (video.embed_url || '').toLowerCase();
  return (
    host.includes('dood') ||
    url.includes('dood') ||
    url.includes('ds202') ||
    url.includes('d000d') ||
    url.includes('doods')
  );
}

/**
 * Clean display creator / channel name without exposing raw embed host domains
 */
export function getCleanCreatorName(video: { actor?: string | null; embed_host?: string | null; categories?: string | null; tags?: string | null }): string {
  if (video.actor && video.actor.trim() && video.actor !== 'N/A' && video.actor.toLowerCase() !== 'unknown') {
    return video.actor.trim();
  }

  // Look for prominent studio / producer tags or categories
  if (video.categories) {
    const cats = video.categories.split(/[,/|;]+/).map(c => c.trim()).filter(Boolean);
    const studio = cats.find(c => {
      const lower = c.toLowerCase();
      return (
        lower.includes('onlyfans') ||
        lower.includes('brazzers') ||
        lower.includes('naughty') ||
        lower.includes('reality') ||
        lower.includes('mofos') ||
        lower.includes('twistys') ||
        lower.includes('bang') ||
        lower.includes('evil') ||
        lower.includes('digital') ||
        lower.includes('vixen') ||
        lower.includes('blacked') ||
        lower.includes('tushy')
      );
    });
    if (studio) return studio;
  }

  // Fallback to stylized PornVoid Channel instead of raw host names like doodstream.com
  return 'PornVoid Premium';
}

/**
 * Checks if a video's timestamp falls within the specified number of days
 */
export function isWithinDays(dateStr: string | null | undefined, daysLimit: number = TWO_MONTHS_DAYS): boolean {
  if (!dateStr) return false;
  const time = new Date(dateStr).getTime();
  if (isNaN(time) || time <= 0) return false;
  const diffDays = (Date.now() - time) / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= daysLimit;
}

/**
 * Common stopwords for title tokenization
 */
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'in', 'on', 'at', 'to', 'for', 'with', 'by',
  'video', 'full', 'hd', 'new', 'best', 'official', '2023', '2024', '2025', '2026',
  'watch', 'free', 'online', 'clip', 'part', 'ep', 'episode', 'mp4', 'xxx', 'porn', 'porno'
]);

export function extractKeywords(text: string | null | undefined): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^\w\s\u0980-\u09FF]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));
}

/**
 * UPGRADED ADDICTIVE MULTI-VECTOR RECOMMENDATION ALGORITHM:
 * Multi-vector neural-style scoring combining:
 * 1. Direct Target Synergy (Title N-Grams, Keywords, Category, Tags, Actor)
 * 2. User Behavioral Vector (Continuously tracked actions: watched, liked, saved, searched, clicked)
 * 3. Duration & Habit alignment with watch progress telemetry
 * 4. Negative signal penalization
 * 5. Discovery freshness & quality boost
 * 6. Controlled stochastic shuffling for dynamic dopamine pacing
 */
export function calculateRelevanceScore(
  target: Video, 
  candidate: Video, 
  customProfile?: ViewerAffinityProfile,
  stochastic: boolean = true
): number {
  if (!candidate || !candidate.id) return -99999;
  if (String(candidate.id) === String(target.id)) return -99999;

  const profile = customProfile || getViewerTasteProfile();
  const candIdStr = String(candidate.id);

  // Severe penalty if user marked this video as negative (e.g. removed from history or skipped)
  if (profile.negativeVideoIds && profile.negativeVideoIds.has(candIdStr)) {
    return -50000;
  }

  let score = 0;

  // Extract candidate tokens & metadata
  const candCats = (candidate.categories || '').toLowerCase().split(/[,/|;]+/).map(s => s.trim()).filter(Boolean);
  const candTags = (candidate.tags || '').toLowerCase().split(/[,/|;]+/).map(s => s.replace(/^#/, '').trim()).filter(Boolean);
  const candKeywords = extractKeywords(candidate.title);
  const candActor = candidate.actor && candidate.actor !== 'N/A' ? candidate.actor.trim().toLowerCase() : '';

  // Extract target tokens & metadata
  const targetCats = (target.categories || '').toLowerCase().split(/[,/|;]+/).map(s => s.trim()).filter(Boolean);
  const targetTags = (target.tags || '').toLowerCase().split(/[,/|;]+/).map(s => s.replace(/^#/, '').trim()).filter(Boolean);
  const targetKeywords = extractKeywords(target.title);
  const targetActor = target.actor && target.actor !== 'N/A' ? target.actor.trim().toLowerCase() : '';

  // ==========================================
  // FACTOR 1: DIRECT CONTENT SYNERGY & TITLE MATCHING
  // ==========================================

  // Exact Title Phrase Match (+150 for continuous 2+ word overlap)
  const candTitleClean = (candidate.title || '').toLowerCase();
  const targetTitleClean = (target.title || '').toLowerCase();

  for (let i = 0; i < targetKeywords.length - 1; i++) {
    const bigram = `${targetKeywords[i]} ${targetKeywords[i + 1]}`;
    if (candTitleClean.includes(bigram)) {
      score += 150;
      break;
    }
  }

  // Title Semantic Token Overlap (+40 per shared keyword)
  const targetKwSet = new Set(targetKeywords);
  let kwMatches = 0;
  for (const kw of candKeywords) {
    if (targetKwSet.has(kw)) {
      kwMatches++;
      score += (kwMatches === 1 ? 50 : 35);
    }
  }

  // Category Overlap (+90 for 1st match, +60 for subsequent)
  let catMatches = 0;
  for (const cat of candCats) {
    if (targetCats.includes(cat) && cat !== 'n/a') {
      catMatches++;
      score += (catMatches === 1 ? 90 : 60);
    }
  }

  // Tag Overlap (+55 per matching tag)
  for (const tag of candTags) {
    if (targetTags.includes(tag) && tag !== 'n/a' && tag !== 'video') {
      score += 55;
    }
  }

  // Actor Synergy (+150 for same creator/model)
  if (targetActor && candActor && targetActor === candActor) {
    score += 150;
  }

  // ==========================================
  // FACTOR 2: PERSONALIZED USER BEHAVIOR VECTORS (TITLE, CATEGORY, ACTOR, TAGS)
  // ==========================================

  // User's Top Watched & Liked Title Phrases (+110 pts)
  if (profile.topTitlePhrases) {
    for (const phrase of profile.topTitlePhrases) {
      if (candTitleClean.includes(phrase)) {
        score += 110;
      }
    }
  }

  // User's Top Title Keywords Affinity (+50 to +100 pts)
  if (profile.titleKeywordScores) {
    for (const [kw, aff] of Object.entries(profile.titleKeywordScores)) {
      if (candTitleClean.includes(kw)) {
        score += Math.min(95, aff * 8.0);
      }
    }
  }

  // Category Affinity from User Action Profile
  for (const cat of candCats) {
    const affinity = profile.categoryScores[cat] || 0;
    if (affinity > 0) {
      score += Math.min(130, affinity * 8.5);
    }
  }

  // Actor / Model Affinity from User Action Profile
  if (candActor) {
    const actorAffinity = profile.actorScores[candActor] || 0;
    if (actorAffinity > 0) {
      score += Math.min(150, actorAffinity * 10.0);
    }
  }

  // Tag Affinity from User Action Profile
  for (const tag of candTags) {
    const tagAffinity = profile.tagScores[tag] || 0;
    if (tagAffinity > 0) {
      score += Math.min(70, tagAffinity * 6.0);
    }
  }

  // Active Search Intent Overlap
  for (const kw of candKeywords) {
    const searchAffinity = profile.keywordScores[kw] || 0;
    if (searchAffinity > 0) {
      score += Math.min(80, searchAffinity * 7.0);
    }
  }

  // Duration Preference Alignment
  const candDuration = candidate.duration_sec || 0;
  if (profile.preferredDuration !== 'all' && candDuration > 0) {
    if (profile.preferredDuration === 'short' && candDuration < 600) {
      score += 35;
    } else if (profile.preferredDuration === 'medium' && candDuration >= 600 && candDuration < 1800) {
      score += 35;
    } else if (profile.preferredDuration === 'long' && candDuration >= 1800) {
      score += 40;
    }
  }

  // User Liked & Saved Boost
  if (profile.likedIds.has(candIdStr)) {
    score += 45;
  }
  if (profile.savedIds.has(candIdStr)) {
    score += 50;
  }

  // Discovery / Freshness Balance
  if (!profile.watchedIds.has(candIdStr)) {
    score += 30; // Bonus for un-watched videos
  } else {
    score -= 15;
  }

  // ==========================================
  // FACTOR 3: TIME DISTRIBUTION & QUALITY OPTIMIZATION (FOR NEWCOMERS & 3-YEAR CATALOG)
  // ==========================================
  const dateStr = candidate.created_at || candidate.published_date;
  const isNewUser = (profile.totalActionsCount || 0) < 6;
  let daysOld = 400;
  if (dateStr) {
    const time = new Date(dateStr).getTime();
    if (!isNaN(time)) {
      daysOld = (Date.now() - time) / (1000 * 60 * 60 * 24);
    }
  }

  const views = (candidate.total_views || 0) + (candidate.base_views || 0) + (candidate.real_views || 0);

  if (isNewUser) {
    // For new/low-activity users, prioritize proven top-quality 1st-year catalog hits at the top
    if (daysOld >= 365) {
      score += 115;
      if (views >= 15000) score += 30; // Extra quality boost
    } else if (daysOld <= 62) {
      // Recent content (< 2 months): Keep minimal (15-20%) and strictly high quality
      if (views >= 30000) {
        score += 35; // Only top-performing recent content passes through
      } else {
        score -= 20; // Suppress unproven recent videos for newcomers
      }
    } else {
      if (views >= 20000) score += 20;
    }
  } else {
    // For active users with established taste profile:
    if (daysOld <= 3) score += 40;
    else if (daysOld <= 7) score += 25;
    else if (daysOld <= 30) score += 15;
    else if (daysOld >= 365 && views > 20000) score += 20;
  }

  if (views > 100000) score += 35;
  else if (views > 25000) score += 18;

  // ==========================================
  // FACTOR 4: HOST RELIABILITY & DOODSTREAM RULES
  // ==========================================
  const isDood = isDoodstream(candidate);
  if (isDood) {
    const isRecent = isWithinDays(candidate.created_at || candidate.published_date, TWO_MONTHS_DAYS);
    if (!isRecent) {
      score -= 300;
    } else {
      score -= 10;
    }
  } else {
    score += 15;
  }

  // ==========================================
  // FACTOR 5: CONTROLLED STOCHASTIC JITTER (ADDICTIVE RANDOMIZATION)
  // ==========================================
  if (stochastic) {
    // Dynamic stochastic noise (±18 points) to shuffle videos within their respective scoring tier
    const randomJitter = (Math.random() * 36) - 18;
    score += randomJitter;
  }

  return score;
}

/**
 * Shuffles an array using Fisher-Yates with optional slice limit
 */
function fastShuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * ADDICTIVE FEED INTERLEAVING ENGINE:
 * Slots candidate videos into psychological dopamine pacing buckets:
 * 1. [Laser Personalized Hook] (High title/actor/category affinity)
 * 2. [Mega Viral Trending Magnet] (Top view count / viral traction)
 * 3. [Fresh Discovery Gem] (Unwatched semantic match from 500k database)
 * 4. [Wildcard Explorer] (Stochastically sampled unexpected category hit)
 * 
 * Interleaves them in an irresistible sequence that creates a continuous dopamine loop.
 */
export function interleaveAddictiveFeed(
  videos: Video[], 
  profile?: ViewerAffinityProfile,
  targetVideo?: Video
): Video[] {
  if (!videos || videos.length <= 2) return videos || [];

  const userProf = profile || getViewerTasteProfile();
  const seenIds = new Set<string>();
  if (targetVideo) {
    seenIds.add(String(targetVideo.id));
  }

  // Deduplicate input list
  const uniqueVideos: Video[] = [];
  for (const v of videos) {
    if (v && v.id && !seenIds.has(String(v.id))) {
      seenIds.add(String(v.id));
      uniqueVideos.push(v);
    }
  }

  if (uniqueVideos.length <= 4) return uniqueVideos;

  // Score all videos using multi-vector model
  const scored = uniqueVideos.map(v => ({
    video: v,
    score: targetVideo 
      ? calculateRelevanceScore(targetVideo, v, userProf, true)
      : getPersonalizedFeedScore(v, userProf, true),
    views: (v.total_views || 0) + (v.base_views || 0) + (v.real_views || 0),
    isWatched: userProf.watchedIds.has(String(v.id)),
  }));

  // Bucket 1: Laser Personalized Matches (Top 35% scores)
  scored.sort((a, b) => b.score - a.score);
  const topTierCount = Math.max(4, Math.floor(scored.length * 0.4));
  const personalizedBucket = fastShuffle(scored.slice(0, topTierCount).map(s => s.video));

  // Bucket 2: Mega Viral Trending Magnets (Sorted by views)
  const remaining = scored.slice(topTierCount);
  const viralBucket = fastShuffle(
    [...scored]
      .sort((a, b) => b.views - a.views)
      .slice(0, Math.max(4, Math.floor(scored.length * 0.35)))
      .map(s => s.video)
  );

  // Bucket 3: Fresh Unwatched Discoveries
  const freshBucket = fastShuffle(
    scored
      .filter(s => !s.isWatched)
      .map(s => s.video)
  );

  // Bucket 4: Wildcard Explorers (Remaining diverse gems)
  const wildcardBucket = fastShuffle(remaining.map(s => s.video));

  // Interleave with dopamine slot rhythm: [Personalized, Viral, Fresh, Personalized, Wildcard, Viral, Fresh...]
  const result: Video[] = [];
  const emittedIds = new Set<string>();

  const pushUnique = (v?: Video) => {
    if (v && v.id && !emittedIds.has(String(v.id))) {
      emittedIds.add(String(v.id));
      result.push(v);
      return true;
    }
    return false;
  };

  let pIdx = 0, vIdx = 0, fIdx = 0, wIdx = 0;
  const maxLen = uniqueVideos.length;

  while (result.length < maxLen && (pIdx < personalizedBucket.length || vIdx < viralBucket.length || fIdx < freshBucket.length || wIdx < wildcardBucket.length)) {
    // Slot 1: Personalized Hook
    if (pIdx < personalizedBucket.length) {
      pushUnique(personalizedBucket[pIdx++]);
    }
    // Slot 2: Mega Viral Magnet
    if (vIdx < viralBucket.length) {
      pushUnique(viralBucket[vIdx++]);
    }
    // Slot 3: Fresh Discovery
    if (fIdx < freshBucket.length) {
      pushUnique(freshBucket[fIdx++]);
    }
    // Slot 4: Another Personalized Hook
    if (pIdx < personalizedBucket.length) {
      pushUnique(personalizedBucket[pIdx++]);
    }
    // Slot 5: Wildcard Explorer
    if (wIdx < wildcardBucket.length) {
      pushUnique(wildcardBucket[wIdx++]);
    }

    // Safeguard against stall
    if (pIdx >= personalizedBucket.length && vIdx >= viralBucket.length && fIdx >= freshBucket.length && wIdx >= wildcardBucket.length) {
      break;
    }
  }

  // Append any remainder safely
  for (const item of uniqueVideos) {
    pushUnique(item);
  }

  return result;
}

/**
 * Filter and sort videos for general feeds prioritizing latest uploads and user engagement
 */
export function filterAndSortLatest(videos: Video[]): Video[] {
  return [...videos].sort((a, b) => {
    const numIdA = Number(a.id) || 0;
    const numIdB = Number(b.id) || 0;
    if (numIdA !== numIdB) {
      return numIdB - numIdA;
    }

    const timeA = new Date(a.published_date || a.created_at || 0).getTime();
    const timeB = new Date(b.published_date || b.created_at || 0).getTime();
    if (timeA !== timeB && !isNaN(timeA) && !isNaN(timeB)) {
      return timeB - timeA;
    }

    return 0;
  });
}

