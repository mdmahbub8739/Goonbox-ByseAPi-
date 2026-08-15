import { Video } from '../types';
import { recordDailyActivity } from './streakTracker';

export interface WatchHistoryEntry {
  video: Video;
  watchedAt: number; // timestamp
  progressSec?: number;
  durationSec?: number;
  completionRate?: number; // 0.0 to 1.0
  isCompleted?: boolean;
}

export interface UserActionLog {
  action: 'watch' | 'click' | 'like' | 'unlike' | 'share' | 'save' | 'unsave' | 'ignore' | 'unignore' | 'search' | 'category_click' | 'tag_click' | 'actor_click' | 'filter_change';
  targetType: 'video' | 'category' | 'tag' | 'actor' | 'query' | 'filter' | 'orientation';
  targetValue: string;
  timestamp: number;
  metadata?: {
    videoId?: string | number;
    categories?: string[];
    actor?: string;
    tags?: string[];
    durationSec?: number;
    completionRate?: number;
    orientation?: string;
  };
}

export interface ViewerAffinityProfile {
  topCategories: string[];
  topActors: string[];
  topTags: string[];
  topKeywords: string[];
  topTitlePhrases: string[];
  categoryScores: Record<string, number>;
  actorScores: Record<string, number>;
  tagScores: Record<string, number>;
  keywordScores: Record<string, number>;
  titleKeywordScores: Record<string, number>;
  preferredDuration: 'all' | 'short' | 'medium' | 'long';
  preferredOrientation: string;
  watchedIds: Set<string>;
  likedIds: Set<string>;
  savedIds: Set<string>;
  negativeVideoIds: Set<string>;
  totalActionsCount: number;
}

const STORAGE_KEY_HISTORY = 'pv_user_watch_history';
const STORAGE_KEY_SEARCHES = 'pv_user_recent_searches';
const STORAGE_KEY_LIKES = 'pv_user_liked_video_ids';
const STORAGE_KEY_SAVES = 'pv_user_saved_video_ids';
const STORAGE_KEY_ACTIONS = 'pv_user_action_telemetry';
const STORAGE_KEY_NEGATIVES = 'pv_user_negative_signals';

const MAX_HISTORY = 100;
const MAX_SEARCHES = 30;
const MAX_ACTIONS = 250;

// In-memory taste profile cache to ensure sub-millisecond calculation with zero DB load
let cachedProfile: ViewerAffinityProfile | null = null;
let cachedProfileTimestamp = 0;
const PROFILE_CACHE_TTL_MS = 3000;

export function invalidateProfileCache() {
  cachedProfile = null;
  cachedProfileTimestamp = 0;
}

/**
 * Retrieves the specific watch progress for a single video from local storage
 */
export function getVideoWatchProgress(videoId: string | number | undefined | null): WatchHistoryEntry | null {
  if (!videoId) return null;
  try {
    const history = getWatchHistory();
    const strId = String(videoId);
    const found = history.find(h => String(h.video.id) === strId);
    return found || null;
  } catch {
    return null;
  }
}

/**
 * Records a video watch event with duration and watch completion rate in local storage
 */
export function recordWatchHistory(video: Video, progressSec?: number, durationSec?: number): void {
  if (!video || !video.id) return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_HISTORY);
    let history: WatchHistoryEntry[] = raw ? JSON.parse(raw) : [];
    
    // Remove if already present so it moves to front
    history = history.filter(h => String(h.video.id) !== String(video.id));
    
    const actualDuration = durationSec || video.duration_sec || 0;
    const actualProgress = progressSec || 0;
    const completionRate = actualDuration > 0 ? Math.min(1, actualProgress / actualDuration) : 0.5;
    const isCompleted = completionRate >= 0.90;

    // Add to top
    history.unshift({
      video,
      watchedAt: Date.now(),
      progressSec: actualProgress,
      durationSec: actualDuration,
      completionRate,
      isCompleted,
    });

    if (history.length > MAX_HISTORY) {
      history = history.slice(0, MAX_HISTORY);
    }

    localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(history));

    // Also log action telemetry
    const cats = (video.categories || '').split(/[,/|;]+/).map(c => c.trim()).filter(Boolean);
    const tags = (video.tags || '').split(/[,/|;]+/).map(t => t.replace(/^#/, '').trim()).filter(Boolean);

    logUserAction({
      action: 'watch',
      targetType: 'video',
      targetValue: String(video.id),
      timestamp: Date.now(),
      metadata: {
        videoId: video.id,
        categories: cats,
        actor: video.actor && video.actor !== 'N/A' ? video.actor : undefined,
        tags,
        durationSec: actualDuration,
        completionRate,
      },
    });

    recordDailyActivity();
    invalidateProfileCache();
  } catch (e) {
    console.error('Failed to record watch history', e);
  }
}

export function getWatchHistory(): WatchHistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_HISTORY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function clearWatchHistory(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_HISTORY);
    invalidateProfileCache();
  } catch {
    // ignore
  }
}

export function removeWatchHistoryItem(videoId: string | number): void {
  try {
    const history = getWatchHistory().filter(h => String(h.video.id) !== String(videoId));
    localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(history));
    recordNegativeSignal(videoId, 'remove_history');
    invalidateProfileCache();
  } catch {
    // ignore
  }
}

/**
 * Telemetry logger for every user choice and action
 */
export function logUserAction(actionLog: UserActionLog): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ACTIONS);
    let actions: UserActionLog[] = raw ? JSON.parse(raw) : [];
    actions.unshift(actionLog);
    if (actions.length > MAX_ACTIONS) {
      actions = actions.slice(0, MAX_ACTIONS);
    }
    localStorage.setItem(STORAGE_KEY_ACTIONS, JSON.stringify(actions));
    invalidateProfileCache();
  } catch {
    // ignore storage quotas
  }
}

export function getUserActionLogs(): UserActionLog[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ACTIONS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Tracks high-signal video interactions: likes, un-likes, saves, shares, ignores, clicks
 */
export function recordVideoInteraction(
  action: 'click' | 'like' | 'unlike' | 'share' | 'save' | 'unsave' | 'ignore' | 'unignore',
  video: Video
): void {
  if (!video || !video.id) return;
  const cats = (video.categories || '').split(/[,/|;]+/).map(c => c.trim()).filter(Boolean);
  const tags = (video.tags || '').split(/[,/|;]+/).map(t => t.replace(/^#/, '').trim()).filter(Boolean);

  logUserAction({
    action,
    targetType: 'video',
    targetValue: String(video.id),
    timestamp: Date.now(),
    metadata: {
      videoId: video.id,
      categories: cats,
      actor: video.actor && video.actor !== 'N/A' ? video.actor : undefined,
      tags,
      durationSec: video.duration_sec,
    },
  });
}

/**
 * Explicit negative feedback tracking (deprioritize removed or skipped patterns)
 */
export function recordNegativeSignal(videoId: string | number, reason: 'skip' | 'remove_history' | 'ignore' = 'skip'): void {
  try {
    const strId = String(videoId);
    const raw = localStorage.getItem(STORAGE_KEY_NEGATIVES);
    const negatives: string[] = raw ? JSON.parse(raw) : [];
    if (!negatives.includes(strId)) {
      negatives.unshift(strId);
      if (negatives.length > 80) negatives.pop();
      localStorage.setItem(STORAGE_KEY_NEGATIVES, JSON.stringify(negatives));
    }
    invalidateProfileCache();
  } catch {
    // ignore
  }
}

/**
 * Marks a video as ignored directly from thumbnail or feed.
 * Instantly updates the For You algorithm weights with negative telemetry.
 */
export function recordIgnoreVideo(video: Video): void {
  if (!video || !video.id) return;
  recordNegativeSignal(video.id, 'ignore');
  recordVideoInteraction('ignore', video);
  
  // Also remove from liked or saved if present
  try {
    const strId = String(video.id);
    const rawLikes = localStorage.getItem(STORAGE_KEY_LIKES);
    if (rawLikes) {
      const set = new Set<string>(JSON.parse(rawLikes));
      if (set.has(strId)) {
        set.delete(strId);
        localStorage.setItem(STORAGE_KEY_LIKES, JSON.stringify(Array.from(set)));
      }
    }
  } catch {
    // ignore
  }
  
  invalidateProfileCache();
}

/**
 * Reverts an ignore action (undo ignore)
 */
export function removeIgnoreVideo(videoId: string | number, videoData?: Video): void {
  try {
    const strId = String(videoId);
    const raw = localStorage.getItem(STORAGE_KEY_NEGATIVES);
    let negatives: string[] = raw ? JSON.parse(raw) : [];
    negatives = negatives.filter(id => id !== strId);
    localStorage.setItem(STORAGE_KEY_NEGATIVES, JSON.stringify(negatives));
    
    if (videoData) {
      recordVideoInteraction('unignore', videoData);
    }
    invalidateProfileCache();
  } catch {
    // ignore
  }
}

export function isNegativeVideo(videoId: string | number): boolean {
  try {
    const strId = String(videoId);
    const raw = localStorage.getItem(STORAGE_KEY_NEGATIVES);
    const negatives: string[] = raw ? JSON.parse(raw) : [];
    return negatives.includes(strId);
  } catch {
    return false;
  }
}

export function getNegativeVideoIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_NEGATIVES);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

/**
 * Track category clicks and deliberate navigation
 */
export function recordCategoryInteraction(category: string): void {
  const clean = category.trim();
  if (!clean || clean.toLowerCase() === 'all' || clean.toLowerCase() === 'n/a') return;
  logUserAction({
    action: 'category_click',
    targetType: 'category',
    targetValue: clean,
    timestamp: Date.now(),
  });
}

/**
 * Track tag clicks and searches
 */
export function recordTagInteraction(tag: string): void {
  const clean = tag.replace(/^#/, '').trim();
  if (!clean || clean.toLowerCase() === 'video') return;
  logUserAction({
    action: 'tag_click',
    targetType: 'tag',
    targetValue: clean,
    timestamp: Date.now(),
  });
}

/**
 * Track actor / creator clicks and searches
 */
export function recordActorInteraction(actor: string | null | undefined): void {
  if (!actor) return;
  const clean = actor.trim();
  if (!clean || clean.toLowerCase() === 'n/a' || clean.toLowerCase() === 'unknown') return;
  logUserAction({
    action: 'actor_click',
    targetType: 'actor',
    targetValue: clean,
    timestamp: Date.now(),
  });
}

/**
 * Track filter & duration choices
 */
export function recordFilterChoice(filterType: string, value: string): void {
  if (!value || value === 'all') return;
  logUserAction({
    action: 'filter_change',
    targetType: 'filter',
    targetValue: `${filterType}:${value}`,
    timestamp: Date.now(),
  });
}

/**
 * Recent searches with intent weight
 */
export function recordRecentSearch(query: string): void {
  const clean = query.trim();
  if (!clean) return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SEARCHES);
    let searches: string[] = raw ? JSON.parse(raw) : [];
    searches = searches.filter(s => s.toLowerCase() !== clean.toLowerCase());
    searches.unshift(clean);
    if (searches.length > MAX_SEARCHES) {
      searches = searches.slice(0, MAX_SEARCHES);
    }
    localStorage.setItem(STORAGE_KEY_SEARCHES, JSON.stringify(searches));

    logUserAction({
      action: 'search',
      targetType: 'query',
      targetValue: clean,
      timestamp: Date.now(),
    });
    invalidateProfileCache();
  } catch {
    // ignore
  }
}

export function getRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SEARCHES);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function clearRecentSearches(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_SEARCHES);
    invalidateProfileCache();
  } catch {
    // ignore
  }
}

export function removeRecentSearch(query: string): void {
  try {
    const searches = getRecentSearches().filter(s => s.toLowerCase() !== query.toLowerCase());
    localStorage.setItem(STORAGE_KEY_SEARCHES, JSON.stringify(searches));
    invalidateProfileCache();
  } catch {
    // ignore
  }
}

/**
 * Likes management with telemetry
 */
export function toggleLikedVideo(videoId: string | number, videoData?: Video): boolean {
  try {
    const strId = String(videoId);
    const raw = localStorage.getItem(STORAGE_KEY_LIKES);
    const set = new Set<string>(raw ? JSON.parse(raw) : []);
    let isLiked = false;
    if (set.has(strId)) {
      set.delete(strId);
      isLiked = false;
      if (videoData) recordVideoInteraction('unlike', videoData);
    } else {
      set.add(strId);
      isLiked = true;
      if (videoData) recordVideoInteraction('like', videoData);
    }
    localStorage.setItem(STORAGE_KEY_LIKES, JSON.stringify(Array.from(set)));
    invalidateProfileCache();
    return isLiked;
  } catch {
    return false;
  }
}

export function isVideoLiked(videoId: string | number): boolean {
  try {
    const strId = String(videoId);
    const raw = localStorage.getItem(STORAGE_KEY_LIKES);
    const set = new Set<string>(raw ? JSON.parse(raw) : []);
    return set.has(strId);
  } catch {
    return false;
  }
}

/**
 * Saves / Bookmarks management with telemetry
 */
export function toggleSavedVideo(videoId: string | number, videoData?: Video): boolean {
  try {
    const strId = String(videoId);
    const raw = localStorage.getItem(STORAGE_KEY_SAVES);
    const set = new Set<string>(raw ? JSON.parse(raw) : []);
    let isSaved = false;
    if (set.has(strId)) {
      set.delete(strId);
      isSaved = false;
      if (videoData) recordVideoInteraction('unsave', videoData);
    } else {
      set.add(strId);
      isSaved = true;
      if (videoData) recordVideoInteraction('save', videoData);
    }
    localStorage.setItem(STORAGE_KEY_SAVES, JSON.stringify(Array.from(set)));
    invalidateProfileCache();
    return isSaved;
  } catch {
    return false;
  }
}

export function isVideoSaved(videoId: string | number): boolean {
  try {
    const strId = String(videoId);
    const raw = localStorage.getItem(STORAGE_KEY_SAVES);
    const set = new Set<string>(raw ? JSON.parse(raw) : []);
    return set.has(strId);
  } catch {
    return false;
  }
}

/**
 * Extracts high-signal title keywords and bigram phrases for semantic preference matching
 */
export function extractTitleNgrams(title: string | null | undefined): { words: string[]; phrases: string[] } {
  if (!title) return { words: [], phrases: [] };
  const clean = title
    .toLowerCase()
    .replace(/&#\d+;|&amp;|&quot;|[^\w\s\u0980-\u09FF]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  const tokens = clean.split(' ').filter(w => w.length > 2);
  const stopWords = new Set([
    'video', 'full', 'hd', 'new', 'best', 'official', '2023', '2024', '2025', '2026',
    'watch', 'free', 'online', 'clip', 'part', 'episode', 'mp4', 'xxx', 'porn', 'porno',
    'and', 'the', 'for', 'with', 'from', 'this', 'that', 'her', 'his', 'they', 'them',
    'was', 'are', 'were', 'have', 'has', 'had', 'been', 'out', 'all'
  ]);

  const words = tokens.filter(t => !stopWords.has(t) && t.length >= 3);
  const phrases: string[] = [];
  for (let i = 0; i < tokens.length - 1; i++) {
    const p = `${tokens[i]} ${tokens[i + 1]}`;
    if (p.length >= 7 && (!stopWords.has(tokens[i]) || !stopWords.has(tokens[i + 1]))) {
      phrases.push(p);
    }
  }

  return { words, phrases };
}

/**
 * Updates active watch progress and completion telemetry dynamically while viewing
 */
export function recordWatchProgress(video: Video, elapsedSeconds: number, durationSec?: number): void {
  if (!video || !video.id || elapsedSeconds <= 0) return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_HISTORY);
    let history: WatchHistoryEntry[] = raw ? JSON.parse(raw) : [];
    const index = history.findIndex(h => String(h.video.id) === String(video.id));
    const totalDuration = durationSec || video.duration_sec || 0;
    const completionRate = totalDuration > 0 ? Math.min(1, elapsedSeconds / totalDuration) : 0.5;

    if (index >= 0) {
      history[index].progressSec = Math.max(history[index].progressSec || 0, elapsedSeconds);
      history[index].completionRate = Math.max(history[index].completionRate || 0, completionRate);
      history[index].durationSec = totalDuration;
      history[index].watchedAt = Date.now();
      localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(history));
    } else {
      recordWatchHistory(video, elapsedSeconds, totalDuration);
    }
    invalidateProfileCache();
  } catch {
    // ignore
  }
}

/**
 * UPGRADED ALGORITHM ENGINE: Multi-vector taste profile calculator.
 * Aggregates all user actions with exponential time-decay weighting (recent actions carry higher impact).
 */
export function getViewerTasteProfile(): ViewerAffinityProfile {
  const now = Date.now();
  if (cachedProfile && (now - cachedProfileTimestamp) < PROFILE_CACHE_TTL_MS) {
    return cachedProfile;
  }

  const history = getWatchHistory();
  const actions = getUserActionLogs();
  const searches = getRecentSearches();
  const negatives = getNegativeVideoIds();

  const rawLikes = localStorage.getItem(STORAGE_KEY_LIKES);
  const likedIds = new Set<string>(rawLikes ? JSON.parse(rawLikes) : []);

  const rawSaves = localStorage.getItem(STORAGE_KEY_SAVES);
  const savedIds = new Set<string>(rawSaves ? JSON.parse(rawSaves) : []);

  const watchedIds = new Set<string>(history.map(h => String(h.video.id)));

  const catScores: Record<string, number> = {};
  const actorScores: Record<string, number> = {};
  const tagScores: Record<string, number> = {};
  const kwScores: Record<string, number> = {};
  const titleKwScores: Record<string, number> = {};
  const phraseScores: Record<string, number> = {};
  const durationScores = { short: 0, medium: 0, long: 0 };
  const orientationCounts: Record<string, number> = { all: 0, straight: 0, gay: 0, trans: 0 };

  // Helper for exponential time decay: 1.0 for now, ~0.7 at 3 days, ~0.4 at 14 days
  const computeDecay = (timestamp: number) => {
    const ageDays = Math.max(0, (now - timestamp) / (1000 * 60 * 60 * 24));
    return Math.exp(-0.08 * ageDays); // smooth exponential decay
  };

  // 1. Process Watch History (Weights based on completion rate & recency)
  for (const entry of history) {
    const v = entry.video;
    const decay = computeDecay(entry.watchedAt);
    const cr = entry.completionRate ?? 0.5;
    // Granular completion rate weighting:
    // >= 85%: 2.2x bonus (high engagement, highly finished)
    // >= 50%: 1.6x bonus
    // >= 25%: 1.2x bonus
    // < 10% (skipped after a few seconds): 0.4x penalty (accidental click or disliked)
    let completionBonus = 1.0;
    if (cr >= 0.85) completionBonus = 2.2;
    else if (cr >= 0.50) completionBonus = 1.6;
    else if (cr >= 0.25) completionBonus = 1.2;
    else if (cr < 0.10 && (entry.progressSec || 0) < 15) completionBonus = 0.4;

    const baseWeight = 4.5 * decay * completionBonus;

    // Track duration habits
    const duration = entry.durationSec || v.duration_sec || 0;
    if (duration > 0) {
      if (duration < 600) durationScores.short += 1.2 * decay;
      else if (duration < 1800) durationScores.medium += 1.2 * decay;
      else durationScores.long += 1.2 * decay;
    }

    if (v.categories) {
      const cats = v.categories.split(/[,/|;]+/).map(c => c.trim()).filter(Boolean);
      for (const c of cats) {
        if (c.toLowerCase() !== 'n/a') {
          const norm = c.toLowerCase();
          catScores[norm] = (catScores[norm] || 0) + baseWeight;
          if (norm.includes('gay')) orientationCounts.gay += baseWeight;
          else if (norm.includes('trans') || norm.includes('shemale')) orientationCounts.trans += baseWeight;
          else orientationCounts.straight += baseWeight * 0.5;
        }
      }
    }

    if (v.actor && v.actor !== 'N/A') {
      const act = v.actor.trim().toLowerCase();
      actorScores[act] = (actorScores[act] || 0) + baseWeight * 1.8;
    }

    if (v.tags) {
      const tags = v.tags.split(/[,/|;]+/).map(t => t.replace(/^#/, '').trim().toLowerCase()).filter(Boolean);
      for (const t of tags) {
        if (t !== 'n/a' && t !== 'video') {
          tagScores[t] = (tagScores[t] || 0) + baseWeight * 0.9;
        }
      }
    }

    // Deep title keyword and phrase tracking
    if (v.title) {
      const { words, phrases } = extractTitleNgrams(v.title);
      for (const w of words) {
        titleKwScores[w] = (titleKwScores[w] || 0) + baseWeight * 0.8;
        kwScores[w] = (kwScores[w] || 0) + baseWeight * 0.5;
      }
      for (const p of phrases) {
        phraseScores[p] = (phraseScores[p] || 0) + baseWeight * 1.2;
      }
    }
  }

  // 2. Process Action Telemetry (Likes +10, Shares +12, Saves +9, Clicks +3)
  for (const act of actions) {
    const decay = computeDecay(act.timestamp);
    let actionMultiplier = 1.0;

    if (act.action === 'like') actionMultiplier = 10.0;
    else if (act.action === 'unlike') actionMultiplier = -6.0;
    else if (act.action === 'ignore') actionMultiplier = -8.5; // Strong negative weight for ignored categories/actors/tags
    else if (act.action === 'unignore') actionMultiplier = 4.0;
    else if (act.action === 'share') actionMultiplier = 12.0;
    else if (act.action === 'save') actionMultiplier = 9.0;
    else if (act.action === 'unsave') actionMultiplier = -4.0;
    else if (act.action === 'category_click') actionMultiplier = 5.5;
    else if (act.action === 'actor_click') actionMultiplier = 8.0;
    else if (act.action === 'tag_click') actionMultiplier = 4.5;
    else if (act.action === 'click') actionMultiplier = 3.0;

    const weightedScore = actionMultiplier * decay;

    if (act.targetType === 'category') {
      const norm = act.targetValue.toLowerCase();
      catScores[norm] = (catScores[norm] || 0) + weightedScore;
    } else if (act.targetType === 'actor') {
      const norm = act.targetValue.toLowerCase();
      actorScores[norm] = (actorScores[norm] || 0) + weightedScore;
    } else if (act.targetType === 'tag') {
      const norm = act.targetValue.toLowerCase();
      tagScores[norm] = (tagScores[norm] || 0) + weightedScore;
    }

    if (act.metadata?.categories) {
      for (const c of act.metadata.categories) {
        const norm = c.toLowerCase();
        catScores[norm] = (catScores[norm] || 0) + weightedScore * 0.6;
      }
    }

    if (act.metadata?.actor) {
      const norm = act.metadata.actor.toLowerCase();
      actorScores[norm] = (actorScores[norm] || 0) + weightedScore * 0.9;
    }

    if (act.metadata?.tags) {
      for (const t of act.metadata.tags) {
        const norm = t.toLowerCase();
        tagScores[norm] = (tagScores[norm] || 0) + weightedScore * 0.6;
      }
    }
  }

  // 3. Process Intent from Recent Searches (High Weight +7)
  for (let idx = 0; idx < searches.length; idx++) {
    const search = searches[idx].trim().toLowerCase();
    const rankWeight = Math.max(1.5, 7.0 - idx * 0.25);
    kwScores[search] = (kwScores[search] || 0) + rankWeight;
    titleKwScores[search] = (titleKwScores[search] || 0) + rankWeight * 1.2;
    tagScores[search] = (tagScores[search] || 0) + rankWeight * 0.8;
    actorScores[search] = (actorScores[search] || 0) + rankWeight * 0.9;
    catScores[search] = (catScores[search] || 0) + rankWeight * 0.8;

    const { words, phrases } = extractTitleNgrams(search);
    for (const w of words) {
      titleKwScores[w] = (titleKwScores[w] || 0) + rankWeight * 0.8;
    }
    for (const p of phrases) {
      phraseScores[p] = (phraseScores[p] || 0) + rankWeight * 1.5;
    }
  }

  // Clean up non-positive scores
  const positiveCatScores: Record<string, number> = {};
  for (const [k, v] of Object.entries(catScores)) {
    if (v > 0.1) positiveCatScores[k] = v;
  }
  const positiveActorScores: Record<string, number> = {};
  for (const [k, v] of Object.entries(actorScores)) {
    if (v > 0.1) positiveActorScores[k] = v;
  }
  const positiveTagScores: Record<string, number> = {};
  for (const [k, v] of Object.entries(tagScores)) {
    if (v > 0.1) positiveTagScores[k] = v;
  }
  const positiveKwScores: Record<string, number> = {};
  for (const [k, v] of Object.entries(kwScores)) {
    if (v > 0.1) positiveKwScores[k] = v;
  }
  const positiveTitleKwScores: Record<string, number> = {};
  for (const [k, v] of Object.entries(titleKwScores)) {
    if (v > 0.1) positiveTitleKwScores[k] = v;
  }

  // Determine top ranked items
  const topCategories = Object.entries(positiveCatScores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(e => e[0]);

  const topActors = Object.entries(positiveActorScores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(e => e[0]);

  const topTags = Object.entries(positiveTagScores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(e => e[0]);

  const topKeywords = Object.entries(positiveTitleKwScores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(e => e[0]);

  const topTitlePhrases = Object.entries(phraseScores)
    .filter(e => e[1] > 0.1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(e => e[0]);

  // Determine preferred duration bucket
  let preferredDuration: 'all' | 'short' | 'medium' | 'long' = 'all';
  if (durationScores.short > durationScores.medium && durationScores.short > durationScores.long && durationScores.short >= 3) {
    preferredDuration = 'short';
  } else if (durationScores.medium > durationScores.short && durationScores.medium > durationScores.long && durationScores.medium >= 3) {
    preferredDuration = 'medium';
  } else if (durationScores.long > durationScores.short && durationScores.long > durationScores.medium && durationScores.long >= 3) {
    preferredDuration = 'long';
  }

  // Determine preferred orientation
  let preferredOrientation = 'all';
  if (orientationCounts.gay > orientationCounts.straight * 1.5 && orientationCounts.gay > orientationCounts.trans) {
    preferredOrientation = 'gay';
  } else if (orientationCounts.trans > orientationCounts.straight * 1.5 && orientationCounts.trans > orientationCounts.gay) {
    preferredOrientation = 'trans';
  }

  const profile: ViewerAffinityProfile = {
    topCategories,
    topActors,
    topTags,
    topKeywords,
    topTitlePhrases,
    categoryScores: positiveCatScores,
    actorScores: positiveActorScores,
    tagScores: positiveTagScores,
    keywordScores: positiveKwScores,
    titleKeywordScores: positiveTitleKwScores,
    preferredDuration,
    preferredOrientation,
    watchedIds,
    likedIds,
    savedIds,
    negativeVideoIds: negatives,
    totalActionsCount: actions.length + history.length + searches.length,
  };

  cachedProfile = profile;
  cachedProfileTimestamp = now;

  return profile;
}

/**
 * Calculates a standalone personalized recommendation score for general feeds (Home / Discover)
 * Combines title affinities, category affinities, actor preferences, and viral velocity.
 */
export function getPersonalizedFeedScore(video: Video, customProfile?: ViewerAffinityProfile, stochastic: boolean = true): number {
  if (!video || !video.id) return -99999;
  const profile = customProfile || getViewerTasteProfile();
  const idStr = String(video.id);

  if (profile.negativeVideoIds.has(idStr)) {
    return -50000;
  }

  let score = 0;
  const title = (video.title || '').toLowerCase();
  const cats = (video.categories || '').toLowerCase().split(/[,/|;]+/).map(s => s.trim()).filter(Boolean);
  const tags = (video.tags || '').toLowerCase().split(/[,/|;]+/).map(s => s.replace(/^#/, '').trim()).filter(Boolean);
  const actor = video.actor && video.actor !== 'N/A' ? video.actor.trim().toLowerCase() : '';

  // 1. Title Keyword & Phrase Affinity
  for (const phrase of profile.topTitlePhrases) {
    if (title.includes(phrase)) {
      score += 95;
    }
  }

  for (const [kw, aff] of Object.entries(profile.titleKeywordScores)) {
    if (title.includes(kw)) {
      score += Math.min(65, aff * 7.0);
    }
  }

  // 2. Category Affinity
  for (const cat of cats) {
    const aff = profile.categoryScores[cat] || 0;
    if (aff > 0) {
      score += Math.min(85, aff * 5.5);
    }
  }

  // 3. Actor Affinity
  if (actor) {
    const actAff = profile.actorScores[actor] || 0;
    if (actAff > 0) {
      score += Math.min(105, actAff * 7.5);
    }
  }

  // 4. Tag Affinity
  for (const tag of tags) {
    const tagAff = profile.tagScores[tag] || 0;
    if (tagAff > 0) {
      score += Math.min(50, tagAff * 4.0);
    }
  }

  // 5. User Duration Preference
  const duration = video.duration_sec || 0;
  if (profile.preferredDuration !== 'all' && duration > 0) {
    if (profile.preferredDuration === 'short' && duration < 600) score += 28;
    else if (profile.preferredDuration === 'medium' && duration >= 600 && duration < 1800) score += 28;
    else if (profile.preferredDuration === 'long' && duration >= 1800) score += 32;
  }

  // 6. User Favorites
  if (profile.likedIds.has(idStr)) score += 38;
  if (profile.savedIds.has(idStr)) score += 42;

  // 7. Fresh Discovery vs Repeat
  if (!profile.watchedIds.has(idStr)) {
    score += 25; // Unwatched bonus
  } else {
    score -= 15; // Watched penalty
  }

  // 8. Viral Velocity / Views (Random Trending Mix)
  const views = (video.total_views || 0) + (video.base_views || 0) + (video.real_views || 0);
  if (views > 100000) score += 32;
  else if (views > 30000) score += 20;
  else if (views > 10000) score += 10;

  // 9. Time Distribution & Cold-Start Quality Optimization for New Users
  const isNewUser = (profile.totalActionsCount || 0) < 6;
  const dateStr = video.created_at || video.published_date;
  let daysOld = 400; // Default to mature evergreen
  if (dateStr) {
    const t = new Date(dateStr).getTime();
    if (!isNaN(t)) {
      daysOld = (Date.now() - t) / (1000 * 60 * 60 * 24);
    }
  }

  if (isNewUser) {
    // For users with little or no activity:
    // Prioritize high-quality proven content from the 1st year of the 3-year catalog at the top (~75-80%)
    if (daysOld >= 365) {
      // First year evergreen catalog hit
      score += 125;
      if (views >= 15000) score += 35; // Top-tier quality boost
    } else if (daysOld <= 62) {
      // Recent content (< 2 months): Keep minimal (15-20%) and strictly high quality
      if (views >= 30000) {
        score += 45; // Only top-performing recent content passes through
      } else {
        score -= 25; // Suppress unproven/low-quality recent uploads for newcomers
      }
    } else {
      // Intermediate (Year 2)
      if (views >= 20000) score += 25;
    }
  } else {
    // For experienced users with rich taste profiles:
    if (daysOld <= 7) score += 25;
    else if (daysOld <= 30) score += 15;
    else if (daysOld >= 365 && views > 20000) score += 20;
  }

  // 10. Dynamic Stochastic Temperature Jitter (Addictive Shuffling)
  if (stochastic) {
    const randomJitter = (Math.random() * 30) - 15;
    score += randomJitter;
  } else {
    const numId = Number(video.id) || 0;
    score += (numId % 13);
  }

  return score;
}

