import { Orientation } from './orientation';
import { Video } from '../types';

export type TimeFilter = 'all' | 'today' | 'week' | 'month' | 'year';

export interface TimeFilterOption {
  id: TimeFilter;
  label: string;
}

export const TIME_FILTER_OPTIONS: TimeFilterOption[] = [
  { id: 'all', label: 'All Time' },
  { id: 'today', label: 'Today / 24h' },
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' },
  { id: 'year', label: 'This Year' },
];

export type DurationFilter = 'all' | 'short' | 'medium' | 'long';

export interface DurationFilterOption {
  id: DurationFilter;
  label: string;
}

export const DURATION_FILTER_OPTIONS: DurationFilterOption[] = [
  { id: 'all', label: 'Any Duration' },
  { id: 'short', label: '< 10 min' },
  { id: 'medium', label: '10–30 min' },
  { id: 'long', label: '> 30 min' },
];

export type SortByOption = 'relevance' | 'newest' | 'views' | 'trending';

export interface SortOption {
  id: SortByOption;
  label: string;
}

export const SORT_OPTIONS: SortOption[] = [
  { id: 'newest', label: 'Newest' },
  { id: 'views', label: 'Most Viewed' },
  { id: 'trending', label: 'Trending' },
  { id: 'relevance', label: 'Best Match' },
];

/**
 * Calculates start ISO date string for a given time filter with global timezone buffer
 */
export function getTimeFilterDate(timeFilter: TimeFilter): string | null {
  if (timeFilter === 'all') return null;

  const now = new Date();
  if (timeFilter === 'today') {
    // 48 hours buffer to safely handle international timezones (UTC+6, UTC+8, etc.)
    const past = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    return past.toISOString().split('T')[0];
  }
  if (timeFilter === 'week') {
    // 8 days buffer
    const past = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);
    return past.toISOString().split('T')[0];
  }
  if (timeFilter === 'month') {
    // 32 days buffer
    const past = new Date(now.getTime() - 32 * 24 * 60 * 60 * 1000);
    return past.toISOString().split('T')[0];
  }
  if (timeFilter === 'year') {
    // 366 days buffer
    const past = new Date(now.getTime() - 366 * 24 * 60 * 60 * 1000);
    return past.toISOString().split('T')[0];
  }
  return null;
}

/**
 * Applies database-level time and duration filters to Supabase query safely
 */
export function applyTimeAndDurationFilter(
  query: any,
  timeFilter: TimeFilter = 'all',
  durationFilter: DurationFilter = 'all'
) {
  const startDate = getTimeFilterDate(timeFilter);
  if (startDate) {
    // published_date is formatted as YYYY-MM-DD
    query = query.gte('published_date', startDate);
  }

  if (durationFilter === 'short') {
    // < 10 mins (600 sec)
    query = query.gt('duration_sec', 0).lte('duration_sec', 600);
  } else if (durationFilter === 'medium') {
    // 10 to 30 mins (600 to 1800 sec)
    query = query.gt('duration_sec', 600).lte('duration_sec', 1800);
  } else if (durationFilter === 'long') {
    // > 30 mins (1800 sec)
    query = query.gt('duration_sec', 1800);
  }

  return query;
}

/**
 * In-memory fallback verification for time and duration filters
 */
export function isMatchingTimeAndDuration(
  video: { published_date?: string | null; created_at?: string | null; duration_sec?: number | string | null },
  timeFilter: TimeFilter = 'all',
  durationFilter: DurationFilter = 'all'
): boolean {
  // Time filter check
  if (timeFilter !== 'all') {
    const dateStr = video.published_date || video.created_at;
    if (!dateStr) return true; // Don't drop videos if date is unparsed
    const time = new Date(dateStr).getTime();
    if (!isNaN(time)) {
      const now = Date.now();
      const diffHours = (now - time) / (1000 * 60 * 60);

      if (timeFilter === 'today' && diffHours > 48) return false;
      if (timeFilter === 'week' && diffHours > 24 * 8) return false;
      if (timeFilter === 'month' && diffHours > 24 * 32) return false;
      if (timeFilter === 'year' && diffHours > 24 * 366) return false;
    }
  }

  // Duration check
  if (durationFilter !== 'all') {
    const sec = typeof video.duration_sec === 'number' 
      ? video.duration_sec 
      : Number(video.duration_sec) || 0;

    if (durationFilter === 'short' && (sec <= 0 || sec > 600)) return false;
    if (durationFilter === 'medium' && (sec <= 600 || sec > 1800)) return false;
    if (durationFilter === 'long' && sec <= 1800) return false;
  }

  return true;
}

/**
 * Sorts an array of videos in-memory according to the requested sort option
 */
export function sortVideosList(videos: Video[], sortBy: SortByOption): Video[] {
  if (!videos || videos.length === 0) return [];
  const list = [...videos];

  const getViews = (v: Video) => {
    return Number(v.total_views) || (Number(v.base_views) || 0) + (Number(v.real_views) || 0);
  };

  if (sortBy === 'views') {
    return list.sort((a, b) => getViews(b) - getViews(a));
  }
  if (sortBy === 'trending') {
    return list.sort((a, b) => (Number(b.real_views) || 0) - (Number(a.real_views) || 0));
  }
  if (sortBy === 'relevance') {
    return list.sort((a, b) => getViews(b) - getViews(a));
  }
  // Default 'newest': sort by ID descending (primary key / newest upload)
  return list.sort((a, b) => {
    const numA = Number(a.id);
    const numB = Number(b.id);
    if (!isNaN(numA) && !isNaN(numB)) {
      return numB - numA;
    }
    return String(b.id).localeCompare(String(a.id));
  });
}

