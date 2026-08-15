import React, { createContext, useContext, useState, useMemo, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useOrientation } from './OrientationContext';
import { 
  TimeFilter, 
  DurationFilter, 
  SortByOption 
} from '../lib/filters';
import { Video } from '../types';
import { FilterCriteria, selectFilteredVideos } from '../lib/videoSelectors';

export interface FeedFilterState {
  timeFilter: TimeFilter;
  setTimeFilter: (val: TimeFilter) => void;
  durationFilter: DurationFilter;
  setDurationFilter: (val: DurationFilter) => void;
  sortBy: SortByOption;
  setSortBy: (val: SortByOption) => void;
  isFilterOpen: boolean;
  setIsFilterOpen: (val: boolean) => void;
  activeFilterCount: number;
  resetFilters: () => void;
  getCriteria: (extra?: Partial<FilterCriteria>) => FilterCriteria;
  filterVideos: (videos: Video[], extra?: Partial<FilterCriteria>) => Video[];
}

const FeedFilterContext = createContext<FeedFilterState | undefined>(undefined);

export function FeedFilterProvider({ 
  children,
  defaultSort = 'newest'
}: { 
  children: React.ReactNode;
  defaultSort?: SortByOption;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { orientation } = useOrientation();

  // Primary filter state initialized from URL search params or defaults
  const [timeFilter, setTimeFilterState] = useState<TimeFilter>(() => {
    const p = searchParams.get('time');
    return (p === 'today' || p === 'week' || p === 'month' || p === 'all') ? p : 'year';
  });

  const [durationFilter, setDurationFilterState] = useState<DurationFilter>(() => {
    const p = searchParams.get('duration');
    return (p === 'short' || p === 'medium' || p === 'long') ? p : 'all';
  });

  const [sortBy, setSortByState] = useState<SortByOption>(() => {
    const p = searchParams.get('sort');
    return (p === 'views' || p === 'trending' || p === 'relevance' || p === 'newest') ? p : defaultSort;
  });

  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Sync internal state whenever searchParams change externally (back/forward navigation, direct link, tab switch)
  useEffect(() => {
    const pTime = searchParams.get('time');
    const validTime = (pTime === 'today' || pTime === 'week' || pTime === 'month' || pTime === 'all') ? pTime : 'year';
    setTimeFilterState(validTime);

    const pDur = searchParams.get('duration');
    const validDur = (pDur === 'short' || pDur === 'medium' || pDur === 'long') ? pDur : 'all';
    setDurationFilterState(validDur);

    const pSort = searchParams.get('sort');
    const validSort = (pSort === 'views' || pSort === 'trending' || pSort === 'relevance' || pSort === 'newest') ? pSort : defaultSort;
    setSortByState(validSort);
  }, [searchParams, defaultSort]);

  // Sync setters with URL query params
  const setTimeFilter = useCallback((val: TimeFilter) => {
    setTimeFilterState(val);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (val === 'year') next.delete('time');
      else next.set('time', val);
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const setDurationFilter = useCallback((val: DurationFilter) => {
    setDurationFilterState(val);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (val === 'all') next.delete('duration');
      else next.set('duration', val);
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const setSortBy = useCallback((val: SortByOption) => {
    setSortByState(val);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (val === defaultSort) next.delete('sort');
      else next.set('sort', val);
      return next;
    }, { replace: true });
  }, [setSearchParams, defaultSort]);

  const resetFilters = useCallback(() => {
    setTimeFilterState('year');
    setDurationFilterState('all');
    setSortByState(defaultSort);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.delete('time');
      next.delete('duration');
      next.delete('sort');
      return next;
    }, { replace: true });
  }, [defaultSort, setSearchParams]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (timeFilter !== 'year') count++;
    if (durationFilter !== 'all') count++;
    if (sortBy !== defaultSort) count++;
    return count;
  }, [timeFilter, durationFilter, sortBy, defaultSort]);

  const getCriteria = useCallback((extra?: Partial<FilterCriteria>): FilterCriteria => {
    return {
      orientation,
      timeFilter,
      durationFilter,
      sortBy,
      ...extra,
    };
  }, [orientation, timeFilter, durationFilter, sortBy]);

  const filterVideos = useCallback((videos: Video[], extra?: Partial<FilterCriteria>): Video[] => {
    const criteria = getCriteria(extra);
    return selectFilteredVideos(videos, criteria);
  }, [getCriteria]);

  const value = useMemo<FeedFilterState>(() => ({
    timeFilter,
    setTimeFilter,
    durationFilter,
    setDurationFilter,
    sortBy,
    setSortBy,
    isFilterOpen,
    setIsFilterOpen,
    activeFilterCount,
    resetFilters,
    getCriteria,
    filterVideos,
  }), [
    timeFilter,
    setTimeFilter,
    durationFilter,
    setDurationFilter,
    sortBy,
    setSortBy,
    isFilterOpen,
    activeFilterCount,
    resetFilters,
    getCriteria,
    filterVideos,
  ]);

  return (
    <FeedFilterContext.Provider value={value}>
      {children}
    </FeedFilterContext.Provider>
  );
}

export function useFeedFilter() {
  const context = useContext(FeedFilterContext);
  if (!context) {
    throw new Error('useFeedFilter must be used within a FeedFilterProvider');
  }
  return context;
}
