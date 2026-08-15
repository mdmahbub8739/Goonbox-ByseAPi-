import React, { useState, useMemo } from 'react';
import { Video } from '../types';
import { VideoCard } from './VideoCard';
import { 
  extractRawCategories, 
  extractRawTags, 
  getRelatedVideosByRawMetadata 
} from '../lib/relatedVideos';
import clsx from 'clsx';

interface RelatedVideosSectionProps {
  currentVideo: Video;
  candidatePool: Video[];
  onSelectTag?: (tag: string) => void;
  onSelectCategory?: (category: string) => void;
}

export function RelatedVideosSection({
  currentVideo,
  candidatePool,
  onSelectTag,
  onSelectCategory,
}: RelatedVideosSectionProps) {
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [visibleCount, setVisibleCount] = useState<number>(12);

  // Extract real categories & tags from the video
  const rawCategories = useMemo(() => extractRawCategories(currentVideo.categories), [currentVideo.categories]);
  const rawTags = useMemo(() => extractRawTags(currentVideo.tags), [currentVideo.tags]);

  // Topic filter pills
  const filterChips = useMemo(() => {
    const chips: { label: string; value: string; type: 'all' | 'category' | 'tag' }[] = [
      { label: 'All', value: 'all', type: 'all' }
    ];
    for (const cat of rawCategories) {
      chips.push({ label: cat, value: cat, type: 'category' });
    }
    for (const tag of rawTags) {
      chips.push({ label: `#${tag}`, value: tag, type: 'tag' });
    }
    return chips;
  }, [rawCategories, rawTags]);

  const activeChip = filterChips.find(c => c.value === selectedFilter) || filterChips[0];

  // Score & sort related videos
  const relatedItems = useMemo(() => {
    return getRelatedVideosByRawMetadata(currentVideo, candidatePool, {
      filterTag: activeChip.type === 'tag' ? activeChip.value : undefined,
      filterCategory: activeChip.type === 'category' ? activeChip.value : undefined,
      sortBy: 'relevance',
    });
  }, [currentVideo, candidatePool, activeChip]);

  const handleChipClick = (chip: { label: string; value: string; type: 'all' | 'category' | 'tag' }) => {
    setSelectedFilter(chip.value);
    setVisibleCount(12);
    if (chip.type === 'tag' && onSelectTag) onSelectTag(chip.value);
    if (chip.type === 'category' && onSelectCategory) onSelectCategory(chip.value);
  };

  const displayedVideos = relatedItems.slice(0, visibleCount);

  return (
    <div className="space-y-3.5">
      {/* Clean topic pills */}
      {filterChips.length > 1 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 hide-scrollbar">
          {filterChips.map((chip, idx) => {
            const isSelected = selectedFilter === chip.value;
            return (
              <button
                key={`rel-pill-${chip.value}-${idx}`}
                id={`rel-pill-${chip.value.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
                onClick={() => handleChipClick(chip)}
                className={clsx(
                  "h-[30px] px-3 rounded-full text-[12px] font-medium whitespace-nowrap transition-all select-none shrink-0",
                  isSelected
                    ? "bg-white text-black font-semibold shadow-sm"
                    : "bg-[#1c1c22] text-[#9ca3af] hover:text-white hover:bg-[#272730]"
                )}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Video Grid */}
      {displayedVideos.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {displayedVideos.map(({ video }, idx) => (
            <div key={`rel-item-${video.id}-${idx}`}>
              <VideoCard video={video} />
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-10 px-4 bg-[#141418] border border-white/[0.05] rounded-xl">
          <p className="text-xs text-[#9ca3af]">No related videos found for this topic</p>
          <button
            onClick={() => setSelectedFilter('all')}
            className="mt-2 text-xs text-[#ff0033] hover:underline font-medium"
          >
            View all related videos
          </button>
        </div>
      )}

      {/* Show more button */}
      {visibleCount < relatedItems.length && (
        <div className="py-4 flex justify-center">
          <button
            id="load-more-related-btn"
            onClick={() => setVisibleCount(prev => prev + 12)}
            className="bg-[#202026] hover:bg-[#2a2a34] active:bg-[#333340] text-[#f4f4f5] text-[12.5px] font-medium px-5 py-2 rounded-full transition-colors"
          >
            Show more
          </button>
        </div>
      )}
    </div>
  );
}
