import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Layers, Hash } from 'lucide-react';
import { useCategories } from '../lib/categories';
import { OrientationBar } from '../components/OrientationBar';
import { useOrientation } from '../context/OrientationContext';
import { ThumbnailImage } from '../components/ThumbnailImage';
import { fmtCount } from '../lib/utils';
import { EXCLUDED_STRAIGHT_KEYWORDS, GAY_REGEX, TRANS_REGEX } from '../lib/orientation';
import clsx from 'clsx';

export function CategoriesPage() {
  const { categoryItems, tagItems, loading } = useCategories();
  const { orientation } = useOrientation();
  const [activeTab, setActiveTab] = useState<'categories' | 'tags'>('categories');

  const rawItems = activeTab === 'categories' ? categoryItems : tagItems;

  const items = useMemo(() => {
    if (orientation === 'all') return rawItems;

    if (orientation === 'gay') {
      const matched = rawItems.filter(item => {
        const name = item.name.toLowerCase();
        return GAY_REGEX.test(name);
      });
      return matched;
    }

    if (orientation === 'trans') {
      const matched = rawItems.filter(item => {
        const name = item.name.toLowerCase();
        return TRANS_REGEX.test(name);
      });
      return matched;
    }

    if (orientation === 'straight') {
      const matched = rawItems.filter(item => {
        const name = item.name.toLowerCase();
        if (GAY_REGEX.test(name) || TRANS_REGEX.test(name)) return false;
        return !EXCLUDED_STRAIGHT_KEYWORDS.some(k => name.includes(k));
      });
      return matched;
    }

    return rawItems;
  }, [rawItems, orientation]);

  return (
    <div className="pt-[48px] px-2 sm:px-4 py-3 space-y-2.5 min-h-screen max-w-7xl mx-auto">
      {/* Header & Orientation Filter */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[16.5px] font-extrabold text-[#f4f4f5]">
              {activeTab === 'categories' ? 'All Categories' : 'Popular Tags'}
            </h2>
            <p className="text-[11px] text-[#a1a1aa]">Browse videos by topic and genre</p>
          </div>

          {/* Tab Pills */}
          <div className="flex bg-[#16161a] p-0.5 rounded-lg border border-white/[0.08]">
            <button
              onClick={() => setActiveTab('categories')}
              className={clsx(
                "px-2.5 py-1 text-[11px] font-bold rounded-md flex items-center gap-1 transition-all duration-200",
                activeTab === 'categories'
                  ? "bg-white text-black shadow-sm"
                  : "text-[#a1a1aa] hover:text-white"
              )}
            >
              <Layers className="w-3 h-3" />
              <span>Categories</span>
            </button>
            <button
              onClick={() => setActiveTab('tags')}
              className={clsx(
                "px-2.5 py-1 text-[11px] font-bold rounded-md flex items-center gap-1 transition-all duration-200",
                activeTab === 'tags'
                  ? "bg-white text-black shadow-sm"
                  : "text-[#a1a1aa] hover:text-white"
              )}
            >
              <Hash className="w-3 h-3" />
              <span>Tags</span>
            </button>
          </div>
        </div>

        {/* Orientation Filter */}
        <OrientationBar />
      </div>

      {/* Loading Skeletons */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5 sm:gap-3 animate-pulse">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="relative aspect-[16/10] bg-[#222] rounded-xl overflow-hidden"
            >
              <div className="absolute inset-0 bg-[#282828]" />
              <div className="absolute bottom-2 left-2.5 right-2.5 space-y-1">
                <div className="h-3.5 bg-[#333] rounded w-3/4" />
                <div className="h-2 bg-[#333] rounded w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-[#aaaaaa] text-[13px]">
          No {orientation !== 'all' ? orientation : ''} {activeTab} found.
        </div>
      ) : (
        /* Rich Image Cards Grid */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5 sm:gap-3">
          {items.map((item, idx) => {
            const targetUrl = activeTab === 'tags' 
              ? `/?tag=${encodeURIComponent(item.name)}`
              : `/?category=${encodeURIComponent(item.name)}`;

            return (
              <Link
                key={`${activeTab}-${item.name}-${idx}`}
                to={targetUrl}
                className="group relative aspect-[16/10] rounded-xl overflow-hidden bg-[#16161a] border border-white/[0.08] active:scale-[0.98] transition-all duration-200 shadow-md shadow-black/40 flex flex-col justify-end hover:border-white/20"
              >
                {/* Background Image / Poster */}
                <ThumbnailImage
                  poster={item.poster}
                  title={item.name}
                  category={activeTab === 'categories' ? item.name : undefined}
                  alt={item.name}
                  aspectRatio="card"
                  className="absolute inset-0 w-full h-full group-hover:scale-105 group-hover:brightness-105 transition-all duration-300 ease-out"
                />

                {/* Dark Gradient Overlay for optimal contrast */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none group-hover:opacity-90 transition-opacity" />

                {/* Content Overlay */}
                <div className="relative z-10 p-2 sm:p-2.5 flex flex-col justify-end pointer-events-none">
                  <div className="flex items-center gap-1 mb-0.5">
                    {activeTab === 'tags' && (
                      <span className="text-[#ff0033] text-[11.5px] font-extrabold">#</span>
                    )}
                    <span className="font-bold text-[13px] leading-tight text-[#f4f4f5] line-clamp-1 group-hover:text-white drop-shadow-sm transition-colors">
                      {item.name}
                    </span>
                  </div>
                  <span className="text-[10.5px] text-[#a1a1aa] font-medium">
                    {fmtCount(item.count)}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}



