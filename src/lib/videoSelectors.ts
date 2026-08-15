import { Video } from '../types';
import { Orientation, isMatchingOrientation } from './orientation';
import { 
  TimeFilter, 
  DurationFilter, 
  SortByOption, 
  isMatchingTimeAndDuration, 
  sortVideosList 
} from './filters';
import { 
  cleanSearchTokens, 
  getSignificantTokens, 
  normalizeSearchText, 
  scoreVideoForQuery 
} from './searchEngine';
import { getViewerTasteProfile } from './userHistory';
import { interleaveAddictiveFeed } from './videoAlgo';

export interface FilterCriteria {
  orientation?: Orientation;
  category?: string;
  tag?: string;
  searchQuery?: string;
  timeFilter?: TimeFilter;
  durationFilter?: DurationFilter;
  sortBy?: SortByOption;
}

/**
 * Pure filter predicate to test if an individual video matches the specified criteria
 */
export function matchVideoFilters(video: Video, criteria: FilterCriteria): boolean {
  if (!video) return false;

  // 1. Orientation filter
  if (criteria.orientation && criteria.orientation !== 'all') {
    if (!isMatchingOrientation(video, criteria.orientation)) {
      return false;
    }
  }

  // 2. Category filter
  if (criteria.category && criteria.category !== 'All') {
    const cleanCat = criteria.category.trim().toLowerCase().replace(/^#/, '');
    const inCat = (video.categories || '').toLowerCase().includes(cleanCat);
    const inTags = (video.tags || '').toLowerCase().includes(cleanCat);
    const inTitle = (video.title || '').toLowerCase().includes(cleanCat);
    if (!inCat && !inTags && !inTitle) {
      return false;
    }
  }

  // 3. Tag filter
  if (criteria.tag) {
    const cleanTag = criteria.tag.trim().toLowerCase().replace(/^#/, '');
    const inTags = (video.tags || '').toLowerCase().includes(cleanTag);
    const inCat = (video.categories || '').toLowerCase().includes(cleanTag);
    const inTitle = (video.title || '').toLowerCase().includes(cleanTag);
    if (!inTags && !inCat && !inTitle) {
      return false;
    }
  }

  // 4. Accurate search query filter
  if (criteria.searchQuery && criteria.searchQuery.trim()) {
    const tokens = cleanSearchTokens(criteria.searchQuery);
    if (tokens.length > 0) {
      const normQuery = normalizeSearchText(criteria.searchQuery);
      const combined = `${video.title || ''} ${video.actor || ''} ${video.tags || ''} ${video.categories || ''}`
        .replace(/[._\-+,/\\#@!?:;()\[\]{}'"`]/g, ' ')
        .toLowerCase();

      // If exact phrase matches, keep
      if (combined.includes(normQuery)) {
        return true;
      }

      // Check significant search tokens
      const sigTokens = getSignificantTokens(tokens);
      const matchedTokens = sigTokens.filter(t => combined.includes(t));

      // For 1-2 keywords, require at least one match. For 3+ keywords, require at least 2
      const minRequired = sigTokens.length <= 2 ? 1 : Math.min(2, sigTokens.length);
      if (matchedTokens.length < minRequired) {
        return false;
      }
    }
  }

  // 5. Time & Duration filter
  if (!isMatchingTimeAndDuration(video, criteria.timeFilter || 'all', criteria.durationFilter || 'all')) {
    return false;
  }

  return true;
}

/**
 * Centralized memoized selector to filter and sort video arrays seamlessly
 */
export function selectFilteredVideos(videos: Video[], criteria: FilterCriteria): Video[] {
  if (!videos || videos.length === 0) return [];

  // Filter video items using pure predicate
  const filtered = videos.filter(video => matchVideoFilters(video, criteria));

  // If search query is active, rank strictly by relevance score
  if (criteria.searchQuery && criteria.searchQuery.trim()) {
    const tokens = cleanSearchTokens(criteria.searchQuery);
    const sortBy = criteria.sortBy;
    if (!sortBy || sortBy === 'newest') {
      return [...filtered].sort((a, b) => 
        scoreVideoForQuery(b, criteria.searchQuery!, tokens) - scoreVideoForQuery(a, criteria.searchQuery!, tokens)
      );
    }
  }

  // If no search query and user selected newest or default, apply light taste interleaving
  if (!criteria.searchQuery && (!criteria.sortBy || criteria.sortBy === 'newest' || criteria.sortBy === 'relevance')) {
    const profile = getViewerTasteProfile();
    if (profile.totalActionsCount > 0) {
      return interleaveAddictiveFeed(filtered, profile);
    }
  }

  // Sort video items
  const sortBy = criteria.sortBy || 'newest';
  return sortVideosList(filtered, sortBy);
}
