import React, { useRef } from 'react';
import { useCategories } from '../lib/categories';
import { ChipsSkeleton } from './ChipsSkeleton';
import { Sparkles, Compass, ChevronLeft, ChevronRight } from 'lucide-react';
import clsx from 'clsx';

interface CategoryChipsBarProps {
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  className?: string;
  showExploreLink?: boolean;
}

// Fallback high-frequency genres if DB is loading
const POPULAR_GENRES = [
  'All',
  'Amateur',
  'Anal',
  'Asian',
  'Blowjob',
  'Big Ass',
  'Big Tits',
  'Brunette',
  'Blonde',
  'Cosplay',
  'Compilation',
  'Ebony',
  'Hardcore',
  'Hentai',
  'Homemade',
  'Japanese',
  'Lesbian',
  'MILF',
  'OnlyFans',
  'POV',
  'Reality',
  'Solo',
  'Teen (18+)',
  'Threesome',
  'VR / 3D',
  'Verified Models'
];

export function CategoryChipsBar({
  selectedCategory,
  onSelectCategory,
  className,
}: CategoryChipsBarProps) {
  const { categories, loading } = useCategories();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Merge categories from DB with curated popular genres (deduplicated)
  const displayList = React.useMemo(() => {
    if (!categories || categories.length === 0) {
      return POPULAR_GENRES;
    }
    const combined = ['All', ...categories];
    const seen = new Set<string>();
    const result: string[] = [];
    for (const item of combined) {
      const lower = item.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        result.push(item);
      }
    }
    return result;
  }, [categories]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = direction === 'left' ? -240 : 240;
      scrollContainerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  if (loading && displayList.length === 0) {
    return <ChipsSkeleton />;
  }

  const isAllSelected = !selectedCategory || selectedCategory.toLowerCase() === 'all';

  return (
    <div className={clsx("relative flex items-center group/chips", className)}>
      {/* Left Scroll Button (Desktop/Tablet) */}
      <button
        type="button"
        onClick={() => scroll('left')}
        className="hidden md:flex absolute left-0 z-10 w-7 h-7 -ml-2 rounded-full bg-[#18181c]/90 border border-white/10 items-center justify-center text-white/80 hover:text-white shadow-lg backdrop-blur-md opacity-0 group-hover/chips:opacity-100 transition-opacity"
        aria-label="Scroll left"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {/* Horizontally Scrollable Container */}
      <div
        ref={scrollContainerRef}
        className="flex items-center gap-2 overflow-x-auto hide-scrollbar scroll-smooth py-1 w-full"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {displayList.map((cat) => {
          const isSelected =
            (cat === 'All' && isAllSelected) ||
            (!isAllSelected && selectedCategory.toLowerCase() === cat.toLowerCase());

          return (
            <button
              key={cat}
              id={`genre-chip-${cat.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`}
              onClick={() => onSelectCategory(cat === 'All' ? '' : cat)}
              className={clsx(
                "h-[30px] px-3 rounded-lg text-[11.5px] font-semibold whitespace-nowrap shrink-0 transition-all duration-150 active:scale-95 flex items-center gap-1 border",
                isSelected
                  ? "bg-white text-black border-white shadow-sm font-bold"
                  : "bg-[#18181c] text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-[#222228] border-white/[0.06]"
              )}
            >
              {cat === 'All' ? (
                <Compass className={clsx("w-3 h-3", isSelected ? "text-[#ff0033]" : "text-[#71717a]")} />
              ) : isSelected ? (
                <Sparkles className="w-2.5 h-2.5 text-[#ff0033]" />
              ) : null}
              <span>{cat}</span>
            </button>
          );
        })}
      </div>

      {/* Right Scroll Button (Desktop/Tablet) */}
      <button
        type="button"
        onClick={() => scroll('right')}
        className="hidden md:flex absolute right-0 z-10 w-7 h-7 -mr-2 rounded-full bg-[#18181c]/90 border border-white/10 items-center justify-center text-white/80 hover:text-white shadow-lg backdrop-blur-md opacity-0 group-hover/chips:opacity-100 transition-opacity"
        aria-label="Scroll right"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}
