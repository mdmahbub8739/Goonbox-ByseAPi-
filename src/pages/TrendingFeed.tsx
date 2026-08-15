import React, { useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useInView } from 'react-intersection-observer';
import { VideoCard } from '../components/VideoCard';
import { VideoCardSkeleton } from '../components/VideoCardSkeleton';
import { OrientationBar } from '../components/OrientationBar';
import { CategoryChipsBar } from '../components/CategoryChipsBar';
import { FilterDrawer } from '../components/FilterDrawer';
import { useOrientation } from '../context/OrientationContext';
import { useFeedFilter } from '../context/FeedFilterContext';
import { 
  TIME_FILTER_OPTIONS,
  DURATION_FILTER_OPTIONS,
  SORT_OPTIONS
} from '../lib/filters';
import { useVideoFeed } from '../hooks/useVideoFeed';
import { SlidersHorizontal } from 'lucide-react';
import clsx from 'clsx';

export function TrendingFeed() {
  const [searchParams, setSearchParams] = useSearchParams();
  const catFilter = searchParams.get('category') || searchParams.get('tag') || 'All';
  const { orientation } = useOrientation();

  // Centralized Feed Filter Context with default sort as views
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

  const criteria = useMemo(() => {
    return getCriteria({
      orientation,
      category: catFilter,
      timeFilter,
      durationFilter,
      sortBy: sortBy === 'newest' ? 'views' : sortBy,
    });
  }, [getCriteria, orientation, catFilter, timeFilter, durationFilter, sortBy]);

  useEffect(() => {
    resetFeed();
    fetchPage(0, criteria, true);
  }, [criteria, resetFeed, fetchPage]);

  // Infinite scroll
  useEffect(() => {
    if (inView && hasMore && !isFetchingRef.current && !isInitialLoading && pageIndex > 0) {
      fetchPage(pageIndex, criteria, false);
    }
  }, [inView, hasMore, isInitialLoading, pageIndex, criteria, fetchPage, isFetchingRef]);

  return (
    <div className="pt-[48px] min-h-screen">
      <div className="px-2 sm:px-4 pt-2.5 pb-2 border-b border-white/[0.08] mb-1 space-y-2 bg-[#0c0c0e]/95 backdrop-blur-md">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div>
            <h2 className="text-[16.5px] font-extrabold text-[#f4f4f5] flex items-center gap-1.5">
              🔥 Trending Videos
            </h2>
            <p className="text-[11px] text-[#a1a1aa]">Most viewed and high engagement releases</p>
          </div>

          <button
            id="trending-open-filter-drawer-btn"
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

        <div className="max-w-7xl mx-auto">
          <OrientationBar />
        </div>

        {/* Category & Genre Chips Bar */}
        <div className="max-w-7xl mx-auto">
          <CategoryChipsBar
            selectedCategory={catFilter}
            onSelectCategory={(category) => {
              if (!category || category.toLowerCase() === 'all') {
                searchParams.delete('category');
                searchParams.delete('tag');
              } else {
                searchParams.set('category', category);
                searchParams.delete('tag');
              }
              setSearchParams(searchParams);
            }}
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
            {sortBy !== 'views' && (
              <span className="bg-white/15 border border-white/20 text-white px-2 py-0.5 rounded-md shrink-0 flex items-center gap-1 font-medium">
                Sort: {SORT_OPTIONS.find(s => s.id === sortBy)?.label}
                <button onClick={() => setSortBy('views')} className="hover:text-[#ff7777] font-bold p-0.5" aria-label="Clear sort filter">×</button>
              </span>
            )}
            <button 
              id="trending-clear-all-filters-btn"
              onClick={resetFilters}
              className="text-[#aaaaaa] hover:text-white underline text-[10.5px] ml-1 shrink-0 font-medium px-1 py-0.5"
            >
              Clear All
            </button>
          </div>
        )}
      </div>

      <div className="max-w-7xl mx-auto px-2 sm:px-4 py-2">
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
                  No trending videos match your selected {orientation !== 'all' ? `${orientation} ` : ''}filters.
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

      {/* Filter Drawer */}
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
