import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  ArrowLeft, 
  Clock, 
  X, 
  Sparkles, 
  Tag as TagIcon, 
  Folder, 
  User, 
  Play, 
  Eye, 
  Flame,
  ArrowRight,
  SlidersHorizontal
} from 'lucide-react';
import { Video } from '../types';
import { useOrientation } from '../context/OrientationContext';
import { Orientation } from '../lib/orientation';
import { 
  fetchLiveSearchSuggestions, 
  SearchSuggestionsResult, 
  cleanSearchTokens 
} from '../lib/searchEngine';
import { 
  getRecentSearches, 
  recordRecentSearch, 
  removeRecentSearch, 
  clearRecentSearches,
  recordCategoryInteraction,
  recordTagInteraction,
  recordActorInteraction,
  recordVideoInteraction
} from '../lib/userHistory';
import { fmtDuration, fmtViews } from '../lib/utils';
import clsx from 'clsx';

interface CinematicSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialQuery?: string;
}

const TRENDING_SEARCHES = [
  'Rae Lil Black',
  'Eva Elfie',
  'Japanese',
  'OnlyFans',
  'Anal',
  'POV',
  'Latina',
  'MILF',
  'Blowjob',
  'Cosplay',
  'Hardcore',
  'Threesome'
];

export function CinematicSearchModal({ isOpen, onClose, initialQuery = '' }: CinematicSearchModalProps) {
  const [query, setQuery] = useState(initialQuery);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchSuggestionsResult>({
    videos: [],
    tags: [],
    categories: [],
    actors: [],
    querySuggestions: [],
  });

  const { orientation, setOrientation } = useOrientation();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<any>(null);

  // Load recent searches on open
  useEffect(() => {
    if (isOpen) {
      setRecentSearches(getRecentSearches());
      if (initialQuery) {
        setQuery(initialQuery);
      }
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, initialQuery]);

  // Live suggestions query with debounce
  useEffect(() => {
    if (!isOpen) return;

    const trimmed = query.trim();
    if (!trimmed) {
      setSuggestions({
        videos: [],
        tags: [],
        categories: [],
        actors: [],
        querySuggestions: [],
      });
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetchLiveSearchSuggestions(trimmed, orientation);
        setSuggestions(res);
      } catch (err) {
        console.error("Live suggestions error:", err);
      } finally {
        setIsLoading(false);
      }
    }, 180);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [query, orientation, isOpen]);

  // Handle Full Search Submission
  const handleFullSearch = useCallback((targetQuery: string) => {
    const clean = targetQuery.trim();
    if (!clean) return;

    recordRecentSearch(clean);
    onClose();
    navigate(`/search?q=${encodeURIComponent(clean)}`);
  }, [navigate, onClose]);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleFullSearch(query);
  };

  const handleSelectVideo = (video: Video) => {
    if (query.trim()) {
      recordRecentSearch(query.trim());
    }
    recordVideoInteraction('click', video);
    onClose();
    navigate(`/watch/${video.id}`, { state: { video } });
  };

  const handleSelectTag = (tag: string) => {
    recordTagInteraction(tag);
    handleFullSearch(tag);
  };

  const handleSelectCategory = (cat: string) => {
    recordCategoryInteraction(cat);
    onClose();
    navigate(`/?category=${encodeURIComponent(cat)}`);
  };

  const handleSelectActor = (actor: string) => {
    recordActorInteraction(actor);
    handleFullSearch(actor);
  };

  const handleRemoveRecent = (e: React.MouseEvent, term: string) => {
    e.stopPropagation();
    removeRecentSearch(term);
    setRecentSearches(getRecentSearches());
  };

  const handleClearAllHistory = () => {
    clearRecentSearches();
    setRecentSearches([]);
  };

  if (!isOpen) return null;

  const hasQuery = query.trim().length > 0;
  const hasResults = suggestions.videos.length > 0 || suggestions.tags.length > 0 || suggestions.categories.length > 0;

  return (
    <div 
      id="cinematic-search-modal"
      className="fixed inset-0 z-50 bg-[#09090b]/98 backdrop-blur-2xl flex flex-col animate-fadeIn overflow-hidden"
    >
      {/* Top Search Input Bar */}
      <div className="h-[68px] px-3 border-b border-white/[0.08] flex items-center gap-2.5 bg-[#101014]/90 shrink-0">
        <button
          id="close-search-modal-btn"
          onClick={onClose}
          className="w-11 h-11 rounded-full flex items-center justify-center text-[#a1a1aa] hover:text-white hover:bg-white/10 active:bg-white/20 active:scale-95 transition-all shrink-0"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <form onSubmit={handleFormSubmit} className="flex-1 flex items-center bg-[#18181c] hover:bg-[#202026] focus-within:bg-[#202026] focus-within:ring-2 focus-within:ring-[#ff0033]/60 rounded-full h-12 px-4 border border-white/10 transition-all">
          <Search className="w-4 h-4 text-[#71717a] mr-2.5 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search titles, models, categories, tags..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent border-none outline-none text-[#f4f4f5] text-[15px] font-medium placeholder:text-[#71717a]"
          />
          {query && (
            <button
              id="clear-search-query-btn"
              type="button"
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              className="w-8 h-8 flex items-center justify-center text-[#a1a1aa] hover:text-white bg-white/5 hover:bg-white/15 rounded-full transition-colors shrink-0 mr-0.5"
              aria-label="Clear input"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </form>

        <button
          id="submit-search-modal-btn"
          onClick={handleFormSubmit}
          disabled={!hasQuery}
          className={clsx(
            "h-12 px-5 rounded-full font-bold text-[13px] flex items-center gap-1.5 transition-all active:scale-95 shrink-0 shadow-lg",
            hasQuery
              ? "bg-gradient-to-tr from-[#ff0033] to-[#ff3366] text-white shadow-red-600/30"
              : "bg-white/10 text-white/40 cursor-not-allowed"
          )}
        >
          <span>Search</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Orientation Quick Selector in Search */}
      <div className="px-4 py-2.5 border-b border-white/[0.06] bg-[#0c0c0e] flex items-center justify-between gap-2 shrink-0">
        <span className="text-[12px] font-bold uppercase tracking-wider text-[#888888]">Orientation</span>
        <div className="flex items-center gap-1 bg-[#18181c] p-1.5 rounded-2xl border border-white/5">
          {(['all', 'straight', 'gay', 'trans'] as Orientation[]).map((opt) => (
            <button
              key={opt}
              id={`search-orientation-${opt}`}
              onClick={() => setOrientation(opt)}
              className={clsx(
                "min-h-[36px] px-3.5 py-1.5 rounded-xl text-[12px] font-semibold capitalize transition-all active:scale-95",
                orientation === opt
                  ? "bg-[#ff0033] text-white font-bold shadow-md shadow-[#ff0033]/30"
                  : "text-[#a1a1aa] hover:text-white hover:bg-white/5"
              )}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      {/* Dynamic Results & Suggestions Container */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6 hide-scrollbar">
        {/* If user is typing: Live Category & Tag Generator and Cinematic Video Cards */}
        {hasQuery ? (
          <>
            {/* Dynamic Tag & Category Generator Chips */}
            {(suggestions.tags.length > 0 || suggestions.categories.length > 0 || suggestions.actors.length > 0) && (
              <div className="space-y-3 pb-1">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-bold text-[#a1a1aa] uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-[#ff0033]" /> Instant Filters & Tags
                  </span>
                  <span className="text-[11px] text-[#71717a]">Tap to filter</span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {/* Matching Actors / Models */}
                  {suggestions.actors.map((actor) => (
                    <button
                      key={actor}
                      id={`suggested-actor-${actor}`}
                      onClick={() => handleSelectActor(actor)}
                      className="min-h-[42px] flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-purple-500/15 border border-purple-500/30 text-purple-300 hover:bg-purple-500/25 text-xs font-semibold active:scale-95 transition-all"
                    >
                      <User className="w-3.5 h-3.5 text-purple-400" />
                      <span>{actor}</span>
                    </button>
                  ))}

                  {/* Matching Categories */}
                  {suggestions.categories.map((cat) => (
                    <button
                      key={cat}
                      id={`suggested-cat-${cat}`}
                      onClick={() => handleSelectCategory(cat)}
                      className="min-h-[42px] flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-blue-500/15 border border-blue-500/30 text-blue-300 hover:bg-blue-500/25 text-xs font-semibold active:scale-95 transition-all"
                    >
                      <Folder className="w-3.5 h-3.5 text-blue-400" />
                      <span>{cat}</span>
                    </button>
                  ))}

                  {/* Matching Tags */}
                  {suggestions.tags.map((tag) => (
                    <button
                      key={tag}
                      id={`suggested-tag-${tag}`}
                      onClick={() => handleSelectTag(tag)}
                      className="min-h-[42px] flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-[#ff0033]/15 border border-[#ff0033]/30 text-[#ff7777] hover:bg-[#ff0033]/25 text-xs font-semibold active:scale-95 transition-all"
                    >
                      <TagIcon className="w-3.5 h-3.5 text-[#ff0033]" />
                      <span>#{tag}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Full Search Prompt Button */}
            <button
              id="full-search-query-btn"
              onClick={() => handleFullSearch(query)}
              className="w-full min-h-[52px] flex items-center justify-between p-3.5 rounded-2xl bg-[#18181c] border border-white/10 hover:border-[#ff0033]/50 hover:bg-[#202026] text-white active:scale-[0.99] transition-all group shadow-sm"
            >
              <div className="flex items-center gap-3 text-[14.5px] font-bold">
                <Search className="w-4 h-4 text-[#ff0033] group-hover:scale-110 transition-transform" />
                <span>Search all videos for <span className="text-[#ff0033]">"{query}"</span></span>
              </div>
              <ArrowRight className="w-4 h-4 text-[#71717a] group-hover:text-white group-hover:translate-x-0.5 transition-all" />
            </button>

            {/* Cinematic Live Video Preview Cards */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-bold text-[#a1a1aa] uppercase tracking-wider flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-[#ff0033]" /> Instant Results Preview
                </span>
                {isLoading && (
                  <span className="text-[11px] text-[#ff0033] animate-pulse font-semibold">Finding matches...</span>
                )}
              </div>

              {suggestions.videos.length > 0 ? (
                <div className="space-y-2.5">
                  {suggestions.videos.map((video) => (
                    <div
                      key={video.id}
                      id={`preview-video-${video.id}`}
                      onClick={() => handleSelectVideo(video)}
                      className="flex items-center gap-3 p-2.5 rounded-2xl bg-[#141418] hover:bg-[#1e1e24] active:bg-[#24242c] border border-white/[0.06] hover:border-white/15 cursor-pointer active:scale-[0.99] transition-all group"
                    >
                      {/* Video Poster Thumbnail */}
                      <div className="relative w-28 h-18 rounded-xl overflow-hidden bg-black/50 shrink-0 border border-white/10">
                        <img
                          src={video.poster}
                          alt={video.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-colors flex items-center justify-center">
                          <div className="w-7 h-7 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Play className="w-3.5 h-3.5 text-white fill-white ml-0.5" />
                          </div>
                        </div>
                        {video.duration_sec > 0 && (
                          <div className="absolute bottom-1 right-1 bg-black/80 text-[10px] font-bold text-white px-1.5 py-0.5 rounded">
                            {fmtDuration(video.duration_sec)}
                          </div>
                        )}
                      </div>

                      {/* Video Details */}
                      <div className="flex-1 min-w-0 pr-1">
                        <h4 className="text-[13.5px] font-bold text-[#f4f4f5] line-clamp-2 leading-snug group-hover:text-white transition-colors">
                          {video.title}
                        </h4>
                        <div className="flex items-center gap-2 mt-1.5 text-[11.5px] text-[#a1a1aa]">
                          {video.actor && video.actor !== 'N/A' && (
                            <span className="text-purple-400 font-semibold truncate max-w-[110px]">
                              {video.actor}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Eye className="w-3 h-3 text-[#71717a]" />
                            {fmtViews((video.real_views || 0) + (video.base_views || 0))}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : !isLoading ? (
                <div className="text-center py-8 text-[#71717a] space-y-1 bg-[#141418] rounded-2xl border border-white/5">
                  <p className="text-[13px] font-medium text-[#aaaaaa]">No instant previews for "{query}"</p>
                  <p className="text-[11px] text-[#71717a]">Tap Search to query all database records</p>
                </div>
              ) : null}
            </div>
          </>
        ) : (
          /* When Query is Empty: Show Recent Searches & Trending Topics */
          <>
            {/* Recent Searches Section */}
            {recentSearches.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-bold text-[#a1a1aa] uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-[#ff0033]" /> Recent Searches
                  </span>
                  <button
                    id="clear-all-recent-searches-btn"
                    onClick={handleClearAllHistory}
                    className="text-[12px] text-[#ff0033] hover:text-red-400 font-semibold px-2.5 py-1 rounded-lg hover:bg-white/5 active:bg-white/10 transition-colors"
                  >
                    Clear All
                  </button>
                </div>

                <div className="space-y-1.5">
                  {recentSearches.slice(0, 8).map((term) => (
                    <div
                      key={term}
                      id={`recent-search-${term}`}
                      onClick={() => handleFullSearch(term)}
                      className="min-h-[48px] flex items-center justify-between py-2 px-3.5 rounded-2xl bg-[#141418] hover:bg-[#1e1e24] active:bg-[#26262e] border border-white/5 cursor-pointer text-[14px] text-[#f4f4f5] transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <Clock className="w-4 h-4 text-[#71717a] group-hover:text-[#ff0033] transition-colors" />
                        <span className="font-medium">{term}</span>
                      </div>
                      <button
                        id={`delete-recent-${term}`}
                        onClick={(e) => handleRemoveRecent(e, term)}
                        className="w-8 h-8 flex items-center justify-center text-[#71717a] hover:text-[#ff0033] hover:bg-white/10 active:bg-white/20 rounded-full transition-all"
                        aria-label={`Remove ${term}`}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Trending Searches Section with Large Thumb Pills */}
            <div className="space-y-3 pt-1">
              <div className="flex items-center gap-1.5 text-[12px] font-bold text-[#a1a1aa] uppercase tracking-wider">
                <Flame className="w-4 h-4 text-[#ff0033]" /> Trending & Popular Searches
              </div>

              <div className="flex flex-wrap gap-2.5">
                {TRENDING_SEARCHES.map((tag) => (
                  <button
                    key={tag}
                    id={`trending-tag-${tag}`}
                    onClick={() => handleFullSearch(tag)}
                    className="min-h-[46px] flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#16161a] hover:bg-[#ff0033] hover:text-white active:bg-[#e6002e] border border-white/[0.08] text-[#d4d4d8] text-[13px] font-semibold active:scale-95 transition-all group shadow-sm"
                  >
                    <Search className="w-3.5 h-3.5 text-[#71717a] group-hover:text-white transition-colors" />
                    <span>{tag}</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
