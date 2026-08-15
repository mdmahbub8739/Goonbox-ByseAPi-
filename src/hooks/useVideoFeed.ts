import { useCallback, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Video } from '../types';
import { Orientation, applyOrientationFilter } from '../lib/orientation';
import { applyTimeAndDurationFilter } from '../lib/filters';
import { FilterCriteria, selectFilteredVideos } from '../lib/videoSelectors';
import { cleanSearchTokens, buildSearchQueryClause } from '../lib/searchEngine';
import { getCachedVideos, setCachedVideos } from '../lib/feedCache';

const PAGE_SIZE = 24;

interface UseVideoFeedOptions {
  pageSize?: number;
}

export function useVideoFeed({ pageSize = PAGE_SIZE }: UseVideoFeedOptions = {}) {
  const [videos, setVideos] = useState<Video[]>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  const isFetchingRef = useRef(false);
  const requestIdRef = useRef(0);

  const fetchPage = useCallback(async (
    page: number,
    criteria: FilterCriteria,
    reset: boolean = false
  ) => {
    // If not a reset operation and currently fetching, avoid duplicate calls
    if (!reset && isFetchingRef.current) return;

    const currentRequestId = ++requestIdRef.current;
    isFetchingRef.current = true;

    if (reset) {
      setIsLoading(true);
    }

    // Build Cache Key
    const cacheKey = `${page}_${pageSize}_${criteria.orientation || 'all'}_${criteria.category || 'All'}_${criteria.tag || ''}_${criteria.searchQuery || ''}_${criteria.timeFilter || 'all'}_${criteria.durationFilter || 'all'}_${criteria.sortBy || 'default'}`;

    // Fast Memory Cache Hit Check (Sub-millisecond UI render with zero DB load)
    const cachedData = getCachedVideos(cacheKey);
    if (cachedData && cachedData.length > 0) {
      isFetchingRef.current = false;
      setIsLoading(false);
      setVideos(prev => {
        if (reset) return cachedData;
        const seen = new Set(prev.map(item => item.id));
        const uniqueNew = cachedData.filter(item => !seen.has(item.id));
        return [...prev, ...uniqueNew];
      });
      setPageIndex(page);
      setHasMore(cachedData.length >= pageSize);
      return;
    }

    const from = page * pageSize;
    const to = from + pageSize - 1;

    let data: Video[] | null = null;
    let error = null;

    const explicitSearch = criteria.searchQuery ? cleanSearchTokens(criteria.searchQuery) : [];
    const hasExplicitSearch = explicitSearch.length > 0;
    
    // Category or tag selection
    const isCategoryFilter = !hasExplicitSearch && criteria.category && criteria.category !== 'All';
    const isTagFilter = !hasExplicitSearch && criteria.tag;
    const isPureHomeFeed = !hasExplicitSearch && !isCategoryFilter && !isTagFilter && criteria.sortBy !== 'newest';

    if (isPureHomeFeed) {
      // ---------------------------------------------------------
      // Master Blueprint Architecture: Pure Home Feed
      // ---------------------------------------------------------
      try {
        const { getUserSegmentId, getEdgeCachePool, setEdgeCachePool } = await import('../lib/feedSegments');
        const { mixFeedPools } = await import('../lib/feedMixer');
        const { getViewerTasteProfile } = await import('../lib/userHistory');
        
        const segmentId = getUserSegmentId();
        let cachedPool = getEdgeCachePool(segmentId);
        
        if (!cachedPool) {
          // Fallback to building the pool locally in parallel (Simulating the background job)
          const profile = getViewerTasteProfile();
          const topCats = profile.topCategories.slice(0, 2);
          
          let affinityQuery = supabase.from('videos').select('*');
          if (topCats.length > 0) {
            const orClauses = topCats.map(c => `categories.ilike.%${c}%`);
            affinityQuery = affinityQuery.or(orClauses.join(','));
          } else {
            affinityQuery = affinityQuery.order('id', { ascending: false });
          }
          affinityQuery = applyOrientationFilter(affinityQuery, criteria.orientation || 'all');
          affinityQuery = applyTimeAndDurationFilter(affinityQuery, criteria.timeFilter || 'all', criteria.durationFilter || 'all');
          affinityQuery = affinityQuery.limit(40);

          let trendingQuery = supabase.from('videos').select('*')
            .order('total_views', { ascending: false })
            .limit(40);
          trendingQuery = applyOrientationFilter(trendingQuery, criteria.orientation || 'all');

          let recentQuery = supabase.from('videos').select('*')
            .order('id', { ascending: false })
            .limit(40);
          recentQuery = applyOrientationFilter(recentQuery, criteria.orientation || 'all');
            
          const randOffset = Math.floor(Math.random() * 8000);
          let discoveryQuery = supabase.from('videos').select('*')
            .order('id', { ascending: false })
            .range(randOffset, randOffset + 40);
          discoveryQuery = applyOrientationFilter(discoveryQuery, criteria.orientation || 'all');

          const [affRes, trendRes, recRes, discRes] = await Promise.all([
            affinityQuery, trendingQuery, recentQuery, discoveryQuery
          ]);

          const mixed = mixFeedPools(
            (affRes.data as Video[]) || [],
            (trendRes.data as Video[]) || [],
            (recRes.data as Video[]) || [],
            (discRes.data as Video[]) || [],
            page // Use page as seed so pagination is stable if we were fetching pages of mixed
          );
          
          cachedPool = mixed;
          setEdgeCachePool(segmentId, mixed);
        }

        // We paginate over the cached pool
        data = cachedPool.slice(from, to + 1) as Video[];
        
        // If we ran out of cached pool items, just append random items directly
        if (data.length === 0) {
          const randOffset = Math.floor(Math.random() * 10000);
          let fallback = supabase.from('videos').select('*').order('id', { ascending: false }).range(randOffset, randOffset + pageSize - 1);
          fallback = applyOrientationFilter(fallback, criteria.orientation || 'all');
          const fbRes = await fallback;
          data = fbRes.data as Video[];
        }
      } catch (err) {
        console.error("Home feed Master Blueprint error", err);
        // Fallback to standard
        let query = supabase.from('videos').select('*').order('id', { ascending: false }).range(from, to);
        query = applyOrientationFilter(query, criteria.orientation || 'all');
        const res = await query;
        data = res.data;
        error = res.error;
      }
    } else {
      // ---------------------------------------------------------
      // Standard Filter/Search Query Execution
      // ---------------------------------------------------------
      let query = supabase.from('videos').select('*');

      if (hasExplicitSearch) {
        const searchClause = buildSearchQueryClause(explicitSearch);
        query = query.or(searchClause);
        query = applyOrientationFilter(query, criteria.orientation || 'all');
      } else if (isCategoryFilter || isTagFilter) {
        const target = criteria.tag || criteria.category || '';
        const cleanTarget = target.replace(/[^a-zA-Z0-9 ]/g, '').trim();
        if (cleanTarget) {
          query = query.or(`categories.ilike.%${cleanTarget}%,tags.ilike.%${cleanTarget}%`);
        }
        query = applyOrientationFilter(query, criteria.orientation || 'all');
      }

      query = applyTimeAndDurationFilter(query, criteria.timeFilter || 'all', criteria.durationFilter || 'all');
      query = query.order('id', { ascending: false });
      query = query.range(from, to);

      const result = await query;
      data = result.data;
      error = result.error;
    }

    // Graceful fallback if any query error occurs
    if (error || !data) {
      console.warn("Feed query notice, running fallback query:", error);
      let fallbackQuery = supabase.from('videos').select('*');
      if (hasExplicitSearch) {
        const firstWord = explicitSearch[0];
        fallbackQuery = fallbackQuery.or(`title.ilike.%${firstWord}%,actor.ilike.%${firstWord}%,tags.ilike.%${firstWord}%,categories.ilike.%${firstWord}%`);
      } else if (isCategoryFilter || isTagFilter) {
        const target = criteria.tag || criteria.category || '';
        const cleanTarget = target.replace(/[^a-zA-Z0-9 ]/g, '').trim();
        if (cleanTarget) fallbackQuery = fallbackQuery.or(`categories.ilike.%${cleanTarget}%,tags.ilike.%${cleanTarget}%`);
      }
      fallbackQuery = applyOrientationFilter(fallbackQuery, criteria.orientation || 'all');
      fallbackQuery = applyTimeAndDurationFilter(fallbackQuery, criteria.timeFilter || 'all', criteria.durationFilter || 'all');
      fallbackQuery = fallbackQuery.order('id', { ascending: false }).range(from, to);
      const fallbackRes = await fallbackQuery;
      if (!fallbackRes.error && fallbackRes.data) {
        data = fallbackRes.data;
        error = null;
      }
    }

    // Check request concurrency
    if (currentRequestId !== requestIdRef.current) {
      return;
    }

    isFetchingRef.current = false;
    setIsLoading(false);

    if (error || !data || data.length === 0) {
      setHasMore(false);
      if (reset) setVideos([]);
      return;
    }

    // Apply central memoized / pure filter selector
    let filteredVideos = selectFilteredVideos(data as Video[], criteria);

    // Resilient fallback: if zero items matched multi-word search on reset, broaden with significant keywords
    if (hasExplicitSearch && filteredVideos.length === 0 && reset) {
      const sigTokens = explicitSearch.filter(t => t.length >= 3);
      const fallbackToken = sigTokens[0] || explicitSearch[0];
      if (fallbackToken) {
        let broadQuery = supabase
          .from('videos')
          .select('*')
          .or(`title.ilike.%${fallbackToken}%,actor.ilike.%${fallbackToken}%,tags.ilike.%${fallbackToken}%,categories.ilike.%${fallbackToken}%`);
        
        broadQuery = applyOrientationFilter(broadQuery, criteria.orientation || 'all');
        broadQuery = broadQuery.order('id', { ascending: false }).range(0, pageSize - 1);

        const broadRes = await broadQuery;
        if (broadRes.data && broadRes.data.length > 0) {
          filteredVideos = selectFilteredVideos(broadRes.data as Video[], {
            ...criteria,
            searchQuery: fallbackToken,
          });
        }
      }
    }

    // Cache the resolved filtered slice
    if (filteredVideos.length > 0) {
      setCachedVideos(cacheKey, filteredVideos);
    }

    setVideos(prev => {
      if (reset) return filteredVideos;
      const seen = new Set(prev.map(item => item.id));
      const uniqueNew = filteredVideos.filter(item => !seen.has(item.id));
      return [...prev, ...uniqueNew];
    });

    setPageIndex(page + 1);
    if (data.length < pageSize) {
      setHasMore(false);
    }
  }, [pageSize]);

  const resetFeed = useCallback(() => {
    setPageIndex(0);
    setHasMore(true);
    setVideos([]);
  }, []);

  return {
    videos,
    pageIndex,
    hasMore,
    isLoading,
    isFetchingRef,
    fetchPage,
    resetFeed,
    setVideos,
  };
}
