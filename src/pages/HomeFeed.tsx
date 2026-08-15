import React, { useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useInView } from 'react-intersection-observer';
import { VideoCard } from '../components/VideoCard';
import { VideoCardSkeleton } from '../components/VideoCardSkeleton';
import { ChipsSkeleton } from '../components/ChipsSkeleton';
import { OrientationBar } from '../components/OrientationBar';
import { CategoryChipsBar } from '../components/CategoryChipsBar';
import { FilterDrawer } from '../components/FilterDrawer';
import { WatchHistorySection } from '../components/WatchHistorySection';
import { ForYouBanner } from '../components/ForYouBanner';
import { useOrientation } from '../context/OrientationContext';
import { useFeedFilter } from '../context/FeedFilterContext';
import { useCategories } from '../lib/categories';
import { 
  TIME_FILTER_OPTIONS,
  DURATION_FILTER_OPTIONS,
  SORT_OPTIONS
} from '../lib/filters';
import { getWatchHistory, WatchHistoryEntry } from '../lib/userHistory';
import { useVideoFeed } from '../hooks/useVideoFeed';
import clsx from 'clsx';
import { RefreshCw, ArrowDown, SlidersHorizontal } from 'lucide-react';

const PULL_THRESHOLD = 55;

export function HomeFeed() {
  const [searchParams, setSearchParams] = useSearchParams();
  const catFilter = searchParams.get('category') || searchParams.get('tag') || 'All';
  const { orientation } = useOrientation();
  const { categories, loading: categoriesLoading } = useCategories();

  // Centralized Feed Filter Context
  const {
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
  } = useFeedFilter();

  const [watchHistory, setWatchHistory] = React.useState<WatchHistoryEntry[]>([]);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [pullDistance, setPullDistance] = React.useState(0);

  const touchStartRef = useRef<number | null>(null);
  const isPullingRef = useRef(false);

  const {
    videos,
    pageIndex,
    hasMore,
    isLoading: isInitialLoading,
    isFetchingRef,
    fetchPage,
    resetFeed,
  } = useVideoFeed();

  const { ref, inView } = useInView({
    rootMargin: '400px',
  });

  // Load history on mount
  useEffect(() => {
    setWatchHistory(getWatchHistory());
  }, []);

  // Compute criteria for current query
  const criteria = useMemo(() => {
    return getCriteria({
      orientation,
      category: catFilter,
      timeFilter,
      durationFilter,
      sortBy,
    });
  }, [getCriteria, orientation, catFilter, timeFilter, durationFilter, sortBy]);

  // Fetch or reset whenever filter criteria changes
  useEffect(() => {
    resetFeed();
    fetchPage(0, criteria, true);
  }, [criteria, resetFeed, fetchPage]);

  // Handle pull-to-refresh
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      fetch('/api/harvester/sync-latest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pages: 2 })
      }).catch(() => {});
    } catch {
      // ignore
    }
    setWatchHistory(getWatchHistory());
    resetFeed();
    await fetchPage(0, criteria, true);
    setIsRefreshing(false);
    setPullDistance(0);
  }, [resetFeed, fetchPage, criteria]);

  // Touch handlers for Pull-to-Refresh
  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY <= 2 && !isRefreshing) {
      touchStartRef.current = e.touches[0].clientY;
      isPullingRef.current = false;
    } else {
      touchStartRef.current = null;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartRef.current === null || isRefreshing) return;
    
    if (window.scrollY <= 2) {
      const currentY = e.touches[0].clientY;
      const diff = currentY - touchStartRef.current;
      
      if (diff > 0) {
        isPullingRef.current = true;
        const distance = Math.min(diff * 0.45, 85);
        setPullDistance(distance);
      } else {
        setPullDistance(0);
        isPullingRef.current = false;
      }
    }
  };

  const handleTouchEnd = () => {
    if (touchStartRef.current === null) return;
    
    if (pullDistance >= PULL_THRESHOLD && !isRefreshing) {
      setPullDistance(PULL_THRESHOLD);
      handleRefresh();
    } else {
      setPullDistance(0);
      isPullingRef.current = false;
    }
    touchStartRef.current = null;
  };

  // Infinite scroll
  useEffect(() => {
    if (inView && hasMore && !isFetchingRef.current && !isInitialLoading && !isRefreshing && pageIndex > 0) {
      fetchPage(pageIndex, criteria, false);
    }
  }, [inView, hasMore, isInitialLoading, isRefreshing, pageIndex, criteria, fetchPage, isFetchingRef]);

  const handleCategoryClick = (cat: string) => {
    const next = new URLSearchParams(searchParams);
    if (cat === 'All') {
      next.delete('category');
      next.delete('tag');
    } else {
      next.delete('tag');
      next.set('category', cat);
    }
    setSearchParams(next);
  };

  const chipList = ['All', ...categories];

  return (
    <div 
      className="pt-[48px] min-h-screen"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull To Refresh Indicator */}
      <div 
        className={clsx(
          "w-full flex items-center justify-center overflow-hidden transition-all duration-200 ease-out",
          isRefreshing ? "h-12 py-1.5 opacity-100" : pullDistance > 0 ? "opacity-100" : "h-0 py-0 opacity-0"
        )}
        style={{
          height: isRefreshing ? '48px' : `${pullDistance}px`
        }}
      >
        <div className="w-8 h-8 rounded-full bg-[#18181c] border border-white/15 shadow-xl flex items-center justify-center text-white transition-transform">
          {isRefreshing ? (
            <RefreshCw className="w-4 h-4 text-[#ff0033] animate-spin" />
          ) : (
            <ArrowDown 
              className="w-4 h-4 text-[#f1f1f1] transition-transform duration-150"
              style={{
                transform: `rotate(${pullDistance >= PULL_THRESHOLD ? 180 : (pullDistance / PULL_THRESHOLD) * 180}deg)`
              }}
            />
          )}
        </div>
      </div>

      {/* Sticky Header with Orientation & Category Filters */}
      <div className="sticky top-[48px] z-30 bg-[#0c0c0e]/95 backdrop-blur-xl border-b border-white/[0.08] space-y-1.5 px-2 sm:px-4 py-1.5 shadow-sm">
        {/* Orientation Filter and Filter Drawer Trigger */}
        <div className="flex items-center justify-between gap-2 max-w-7xl mx-auto">
          <OrientationBar />

          {/* Advanced Filter Button */}
          <button
            id="home-open-filter-drawer-btn"
            onClick={() => setIsFilterOpen(true)}
            className={clsx(
              "h-[30px] flex items-center gap-1.5 px-3 rounded-lg text-[11.5px] font-semibold shrink-0 border transition-all active:scale-95",
              activeFilterCount > 0
                ? "bg-[#ff0033] text-white border-[#ff0033] shadow-md shadow-red-600/30 font-bold"
                : "bg-white/[0.05] hover:bg-white/[0.1] text-[#f4f4f5] border-white/10"
            )}
          >
            <SlidersHorizontal className="w-3 h-3" />
            <span className="hidden xs:inline">Filter</span>
            {activeFilterCount > 0 && (
              <span className="w-3.5 h-3.5 rounded-full bg-white text-black text-[9px] font-black flex items-center justify-center ml-0.5">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Category & Genre Chips Bar */}
        <div className="max-w-7xl mx-auto">
          <CategoryChipsBar
            selectedCategory={catFilter}
            onSelectCategory={handleCategoryClick}
          />
        </div>

        {/* Active Filter Pills Indicator */}
        {activeFilterCount > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar pt-0.5 pb-0.5 text-[11px] max-w-7xl mx-auto">
            <span className="text-[#888888] font-semibold shrink-0">Active:</span>
            {timeFilter !== 'all' && (
              <span className="bg-[#ff0000]/20 border border-[#ff0000]/40 text-[#ff7777] px-2 py-0.5 rounded-md shrink-0 flex items-center gap-1 font-medium">
                {TIME_FILTER_OPTIONS.find(t => t.id === timeFilter)?.label}
                <button onClick={() => setTimeFilter('all')} className="hover:text-white font-bold p-0.5" aria-label="Clear time filter">×</button>
              </span>
            )}
            {durationFilter !== 'all' && (
              <span className="bg-[#ff0000]/20 border border-[#ff0000]/40 text-[#ff7777] px-2 py-0.5 rounded-md shrink-0 flex items-center gap-1 font-medium">
                {DURATION_FILTER_OPTIONS.find(d => d.id === durationFilter)?.label}
                <button onClick={() => setDurationFilter('all')} className="hover:text-white font-bold p-0.5" aria-label="Clear duration filter">×</button>
              </span>
            )}
            {sortBy !== 'newest' && (
              <span className="bg-white/15 border border-white/20 text-white px-2 py-0.5 rounded-md shrink-0 flex items-center gap-1 font-medium">
                Sort: {SORT_OPTIONS.find(s => s.id === sortBy)?.label}
                <button onClick={() => setSortBy('newest')} className="hover:text-[#ff7777] font-bold p-0.5" aria-label="Clear sort filter">×</button>
              </span>
            )}
            <button 
              id="home-clear-all-filters-btn"
              onClick={resetFilters}
              className="text-[#aaaaaa] hover:text-white underline text-[10.5px] ml-1 shrink-0 font-medium px-1 py-0.5"
            >
              Clear All
            </button>
          </div>
        )}
      </div>

      {/* Main Feed Content */}
      <div className="max-w-7xl mx-auto px-2 sm:px-4 py-2">
        {/* Dynamic 'For You' banner reflecting real-time viewer taste and habits */}
        {pageIndex <= 1 && catFilter === 'All' && timeFilter === 'all' && (
          <ForYouBanner onCategoryClick={handleCategoryClick} />
        )}

        {/* Personalized "Jump Back In" Reel from Watch History */}
        {!isInitialLoading && pageIndex <= 1 && catFilter === 'All' && timeFilter === 'all' && (
          <WatchHistorySection history={watchHistory} />
        )}

        {isInitialLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            <VideoCardSkeleton count={8} />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 transition-opacity duration-300 ease-out">
              {videos.map((v, idx) => (
                <VideoCard key={`${v.id}-${idx}`} video={v} />
              ))}
            </div>

            {/* Infinite Scroll Sentinel with Skeletons */}
            {hasMore && (
              <div ref={ref} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 pt-3">
                <VideoCardSkeleton count={4} />
              </div>
            )}

            {!hasMore && videos.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 px-4 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-white/[0.05] border border-white/10 flex items-center justify-center text-[#71717a]">
                  <SlidersHorizontal className="w-6 h-6" />
                </div>
                <h3 className="text-[16px] font-bold text-white">No Videos Found</h3>
                <p className="text-[13px] text-[#a1a1aa] max-w-xs">
                  Try adjusting or resetting some of your active filters to see more results.
                </p>
                <button
                  onClick={resetFilters}
                  className="mt-2 px-5 py-2 rounded-xl bg-gradient-to-tr from-[#ff0033] to-[#ff3366] text-white text-[13px] font-bold shadow-lg shadow-red-600/30 active:scale-95 transition-all"
                >
                  Reset All Filters
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Filter Drawer Modal */}
      <FilterDrawer
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        timeFilter={timeFilter}
        setTimeFilter={setTimeFilter}
        durationFilter={durationFilter}
        setDurationFilter={setDurationFilter}
        sortBy={sortBy}
        setSortBy={setSortBy}
        onReset={resetFilters}
        activeCount={activeFilterCount}
      />
    </div>
  );
}
