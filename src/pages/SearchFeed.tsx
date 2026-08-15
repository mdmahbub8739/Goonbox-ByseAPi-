import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useInView } from 'react-intersection-observer';
import { VideoCard } from '../components/VideoCard';
import { VideoCardSkeleton } from '../components/VideoCardSkeleton';
import { OrientationBar } from '../components/OrientationBar';
import { FilterDrawer } from '../components/FilterDrawer';
import { CinematicSearchModal } from '../components/CinematicSearchModal';
import { useOrientation } from '../context/OrientationContext';
import { useFeedFilter } from '../context/FeedFilterContext';
import { 
  TIME_FILTER_OPTIONS,
  DURATION_FILTER_OPTIONS,
  SORT_OPTIONS
} from '../lib/filters';
import { 
  fetchLiveSearchSuggestions, 
  SearchSuggestionsResult, 
  cleanSearchTokens 
} from '../lib/searchEngine';
import { 
  recordRecentSearch, 
  getRecentSearches, 
  removeRecentSearch, 
  clearRecentSearches,
  recordCategoryInteraction,
  recordTagInteraction,
  recordActorInteraction
} from '../lib/userHistory';
import { useVideoFeed } from '../hooks/useVideoFeed';
import { SlidersHorizontal, Clock, X, Search, Sparkles, Tag as TagIcon, Folder, User, Flame } from 'lucide-react';
import clsx from 'clsx';

export function SearchFeed() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryText = searchParams.get('q') || '';
  const { orientation } = useOrientation();
  const navigate = useNavigate();

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

  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [relatedSuggestions, setRelatedSuggestions] = useState<SearchSuggestionsResult>({
    videos: [],
    tags: [],
    categories: [],
    actors: [],
    querySuggestions: [],
  });

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

  useEffect(() => {
    setRecentSearches(getRecentSearches());
  }, []);

  // Fetch dynamic related tags/categories whenever query changes
  useEffect(() => {
    if (queryText.trim()) {
      fetchLiveSearchSuggestions(queryText, orientation)
        .then(res => setRelatedSuggestions(res))
        .catch(() => {});
    } else {
      setRelatedSuggestions({
        videos: [],
        tags: [],
        categories: [],
        actors: [],
        querySuggestions: [],
      });
    }
  }, [queryText, orientation]);

  const criteria = useMemo(() => {
    return getCriteria({
      orientation,
      searchQuery: queryText,
      timeFilter,
      durationFilter,
      sortBy,
    });
  }, [getCriteria, orientation, queryText, timeFilter, durationFilter, sortBy]);

  useEffect(() => {
    resetFeed();
    if (queryText) {
      recordRecentSearch(queryText);
      setRecentSearches(getRecentSearches());
      fetchPage(0, criteria, true);
    }
  }, [queryText, criteria, resetFeed, fetchPage]);

  // Infinite scroll
  useEffect(() => {
    if (inView && hasMore && !isFetchingRef.current && !isInitialLoading && pageIndex > 0 && queryText) {
      fetchPage(pageIndex, criteria, false);
    }
  }, [inView, hasMore, isInitialLoading, pageIndex, queryText, criteria, fetchPage, isFetchingRef]);

  const handleSelectRecent = (term: string) => {
    searchParams.set('q', term);
    setSearchParams(searchParams);
  };

  const handleRemoveRecent = (e: React.MouseEvent, term: string) => {
    e.stopPropagation();
    removeRecentSearch(term);
    setRecentSearches(getRecentSearches());
  };

  const cleanTokensList = cleanSearchTokens(queryText);

  return (
    <div className="pt-[48px] min-h-screen">
      {/* Sticky Top Header with Quick Search Bar & Filters */}
      <div className="px-2 sm:px-4 pt-2.5 pb-2 border-b border-white/[0.08] mb-1 space-y-2 bg-[#0c0c0e]/95 backdrop-blur-md">
        {/* Search Bar Input Pill */}
        <div className="max-w-7xl mx-auto">
          <div 
            onClick={() => setIsSearchModalOpen(true)}
            className="flex items-center bg-[#18181c] hover:bg-[#202026] rounded-xl h-9 px-3 border border-white/10 cursor-pointer transition-all active:scale-[0.99] group shadow-inner"
          >
            <Search className="w-3.5 h-3.5 text-[#ff0033] mr-2 shrink-0 group-hover:scale-110 transition-transform" />
            <span className={clsx(
              "text-[13px] flex-1 truncate font-medium",
              queryText ? "text-white font-semibold" : "text-[#71717a]"
            )}>
              {queryText ? queryText : "Search titles, models, categories, tags..."}
            </span>
            <div className="flex items-center gap-1 shrink-0">
              {queryText && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-[#a1a1aa] font-semibold">
                  Edit
                </span>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsFilterOpen(true);
                }}
                className={clsx(
                  "flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold shrink-0 border transition-all",
                  activeFilterCount > 0
                    ? "bg-[#ff0033] text-white border-[#ff0033] shadow-md shadow-red-600/30"
                    : "bg-white/5 hover:bg-white/10 text-[#f4f4f5] border-white/10"
                )}
              >
                <SlidersHorizontal className="w-3 h-3" />
                {activeFilterCount > 0 && (
                  <span className="w-3.5 h-3.5 rounded-full bg-white text-black text-[9px] font-black flex items-center justify-center">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto">
          <OrientationBar />
        </div>

        {/* Dynamic Category & Tag Generator Chips directly under search header */}
        {queryText && (relatedSuggestions.tags.length > 0 || relatedSuggestions.categories.length > 0 || relatedSuggestions.actors.length > 0) && (
          <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar pt-0.5 max-w-7xl mx-auto">
            <span className="text-[10.5px] font-bold text-[#71717a] flex items-center gap-1 shrink-0">
              <Sparkles className="w-2.5 h-2.5 text-[#ff0033]" /> Generated:
            </span>

            {/* Models */}
            {relatedSuggestions.actors.map((actor) => (
              <button
                key={actor}
                onClick={() => {
                  recordActorInteraction(actor);
                  handleSelectRecent(actor);
                }}
                className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-300 text-[11px] font-semibold whitespace-nowrap shrink-0 hover:bg-purple-500/25 active:scale-95 transition-all"
              >
                <User className="w-2.5 h-2.5 text-purple-400" />
                <span>{actor}</span>
              </button>
            ))}

            {/* Categories */}
            {relatedSuggestions.categories.map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  recordCategoryInteraction(cat);
                  navigate(`/?category=${encodeURIComponent(cat)}`);
                }}
                className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-300 text-[11px] font-semibold whitespace-nowrap shrink-0 hover:bg-blue-500/25 active:scale-95 transition-all"
              >
                <Folder className="w-2.5 h-2.5 text-blue-400" />
                <span>{cat}</span>
              </button>
            ))}

            {/* Tags */}
            {relatedSuggestions.tags.map((tag) => (
              <button
                key={tag}
                onClick={() => {
                  recordTagInteraction(tag);
                  handleSelectRecent(tag);
                }}
                className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#ff0033]/15 border border-[#ff0033]/30 text-[#ff7777] text-[11px] font-semibold whitespace-nowrap shrink-0 hover:bg-[#ff0033]/25 active:scale-95 transition-all"
              >
                <TagIcon className="w-2.5 h-2.5 text-[#ff0033]" />
                <span>#{tag}</span>
              </button>
            ))}
          </div>
        )}

        {/* Active Filter Pills Indicator */}
        {activeFilterCount > 0 && queryText && (
          <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar pt-0.5 text-[11px] max-w-7xl mx-auto">
            <span className="text-[#888888] font-medium shrink-0">Active:</span>
            {timeFilter !== 'all' && (
              <span className="bg-[#ff0000]/20 border border-[#ff0000]/40 text-[#ff7777] px-2 py-0.5 rounded-md shrink-0 flex items-center gap-1">
                {TIME_FILTER_OPTIONS.find(t => t.id === timeFilter)?.label}
                <button onClick={() => setTimeFilter('all')} className="hover:text-white font-bold ml-0.5">×</button>
              </span>
            )}
            {durationFilter !== 'all' && (
              <span className="bg-[#ff0000]/20 border border-[#ff0000]/40 text-[#ff7777] px-2 py-0.5 rounded-md shrink-0 flex items-center gap-1">
                {DURATION_FILTER_OPTIONS.find(d => d.id === durationFilter)?.label}
                <button onClick={() => setDurationFilter('all')} className="hover:text-white font-bold ml-0.5">×</button>
              </span>
            )}
            {sortBy !== 'newest' && (
              <span className="bg-white/15 border border-white/20 text-white px-2 py-0.5 rounded-md shrink-0 flex items-center gap-1">
                Sort: {SORT_OPTIONS.find(s => s.id === sortBy)?.label}
                <button onClick={() => setSortBy('newest')} className="hover:text-[#ff7777] font-bold ml-0.5">×</button>
              </span>
            )}
            <button 
              onClick={resetFilters}
              className="text-[#aaaaaa] hover:text-white underline text-[10px] ml-1 shrink-0"
            >
              Clear All
            </button>
          </div>
        )}
      </div>

      {/* If empty query, show Recent Searches & Popular Tags */}
      {!queryText && (
        <div className="max-w-7xl mx-auto p-3 sm:p-4 space-y-5">
          {recentSearches.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-bold text-[#aaaaaa] uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3 h-3" /> Recent Searches
                </span>
                <button
                  onClick={() => {
                    clearRecentSearches();
                    setRecentSearches([]);
                  }}
                  className="text-[10.5px] text-[#ff0033] hover:underline"
                >
                  Clear history
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {recentSearches.map(term => (
                  <div
                    key={term}
                    onClick={() => handleSelectRecent(term)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#1a1a1e] border border-white/10 text-white text-[11.5px] font-medium cursor-pointer hover:bg-white/10 active:scale-95 transition-all"
                  >
                    <span>{term}</span>
                    <button
                      onClick={(e) => handleRemoveRecent(e, term)}
                      className="text-white/40 hover:text-white p-0.5 rounded-full"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Trending Suggestions */}
          <div className="space-y-2">
            <span className="text-[12px] font-bold text-[#aaaaaa] uppercase tracking-wider flex items-center gap-1.5">
              <Flame className="w-3 h-3 text-[#ff0033]" /> Popular Searches
            </span>
            <div className="flex flex-wrap gap-1.5">
              {['Rae Lil Black', 'Eva Elfie', 'Japanese', 'Milf', 'Amateur', 'Anal', 'Blowjob', 'Big Ass', 'Lesbian', 'POV', 'VR', 'Threesome', 'Cosplay', 'Hardcore'].map(tag => (
                <button
                  key={tag}
                  onClick={() => handleSelectRecent(tag)}
                  className="px-2.5 py-1 rounded-lg bg-[#16161a] border border-white/[0.08] text-[#cccccc] hover:text-white hover:border-[#ff0033]/50 text-[11.5px] font-medium transition-all active:scale-95"
                >
                  #{tag}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Results Feed */}
      <div className="max-w-7xl mx-auto px-2 sm:px-4 py-2">
        {isInitialLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            <VideoCardSkeleton count={8} />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {videos.map((v, idx) => (
                <VideoCard key={`${v.id}-${idx}`} video={v} />
              ))}
            </div>

            {hasMore && !!queryText && (
              <div ref={ref} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 pt-3">
                <VideoCardSkeleton count={4} />
              </div>
            )}

            {!hasMore && videos.length === 0 && !!queryText && (
              <div className="flex flex-col items-center justify-center py-20 px-4 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-white/[0.05] border border-white/10 flex items-center justify-center text-[#71717a]">
                  <SlidersHorizontal className="w-6 h-6" />
                </div>
                <h3 className="text-[16px] font-bold text-white">No Results Found</h3>
                <p className="text-[13px] text-[#a1a1aa] max-w-xs">
                  No videos match "{queryText}" with your current orientation or duration filters.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                  <button
                    onClick={resetFilters}
                    className="px-4 py-1.5 rounded-xl bg-gradient-to-tr from-[#ff0033] to-[#ff3366] text-white text-[12px] font-bold shadow-lg shadow-red-600/30 active:scale-95 transition-all"
                  >
                    Reset All Filters
                  </button>
                  <button
                    onClick={() => setIsSearchModalOpen(true)}
                    className="px-4 py-1.5 rounded-xl bg-[#18181c] border border-white/10 text-white text-[12px] font-bold hover:bg-[#222228] active:scale-95 transition-all"
                  >
                    Try Another Search
                  </button>
                </div>
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

      {/* Cinematic Live Search Modal */}
      <CinematicSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        initialQuery={queryText}
      />
    </div>
  );
}
