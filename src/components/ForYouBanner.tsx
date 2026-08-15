import React, { useMemo, useState, useEffect } from 'react';
import { getViewerTasteProfile, ViewerAffinityProfile } from '../lib/userHistory';
import { Sparkles, Flame, Compass, Heart, History, TrendingUp, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';

interface ForYouBannerProps {
  onCategoryClick?: (category: string) => void;
}

export function ForYouBanner({ onCategoryClick }: ForYouBannerProps) {
  const [profile, setProfile] = useState<ViewerAffinityProfile>(() => getViewerTasteProfile());
  const [dismissed, setDismissed] = useState(false);

  // Refresh profile on mount and periodically if user engages
  useEffect(() => {
    setProfile(getViewerTasteProfile());
    const interval = setInterval(() => {
      setProfile(getViewerTasteProfile());
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Compute dynamic personalized banner narrative
  const narrative = useMemo(() => {
    const totalActions = profile.totalActionsCount;
    const topCat = profile.topCategories && profile.topCategories[0];
    const secondCat = profile.topCategories && profile.topCategories[1];
    const topActor = profile.topActors && profile.topActors[0];
    const topPhrase = profile.topTitlePhrases && profile.topTitlePhrases[0];
    const likedCount = profile.likedIds.size;
    const watchedCount = profile.watchedIds.size;

    // Active Personalized Feed Highlight
    if (watchedCount > 3 || likedCount > 0) {
       return {
         icon: Sparkles,
         badge: 'For You',
         badgeColor: 'from-rose-500/20 to-red-500/20 text-rose-300 border-rose-500/30',
         headline: `Your Personalized Feed is Ready`,
         subtitle: `Curated recommendations based on your unique watch history and favorites.`,
         tag: 'Curated',
         isForYouLink: true,
       };
    }

    // Case 1: Active viewer with interest in specific actor/creator
    if (topActor && profile.actorScores[topActor] > 15) {
      const formattedActor = topActor.charAt(0).toUpperCase() + topActor.slice(1);
      return {
        icon: Heart,
        badge: 'Featured Star',
        badgeColor: 'from-pink-500/20 to-rose-500/20 text-pink-300 border-pink-500/30',
        headline: `Trending scenes with ${formattedActor}`,
        subtitle: `Hand-selected popular videos and highlights.`,
        tag: formattedActor,
        category: topCat,
      };
    }

    // Case 2: Genre interest with multiple categories
    if (topCat && secondCat && profile.categoryScores[topCat] > 18) {
      const f1 = topCat.charAt(0).toUpperCase() + topCat.slice(1);
      const f2 = secondCat.charAt(0).toUpperCase() + secondCat.slice(1);
      return {
        icon: Flame,
        badge: 'Featured Mix',
        badgeColor: 'from-orange-500/20 to-amber-500/20 text-amber-300 border-amber-500/30',
        headline: `Best of ${f1} & ${f2}`,
        subtitle: `Top-rated highlights and viral clips today.`,
        tag: f1,
        category: topCat,
      };
    }

    // Default: Fresh newcomer
    return {
      icon: Compass,
      badge: 'Discover',
      badgeColor: 'from-blue-500/20 to-cyan-500/20 text-cyan-300 border-cyan-500/30',
      headline: `Explore Endless Trending Videos`,
      subtitle: `Over 500,000 top quality scenes updated every hour.`,
      tag: '500k+ Videos',
      category: undefined,
    };
  }, [profile]);

  if (dismissed) return null;
  const IconComp = narrative.icon;

  return (
    <div 
      id="for-you-dynamic-banner"
      className="relative mb-2.5 p-2.5 sm:p-3 rounded-xl bg-gradient-to-r from-[#17141f] via-[#15151c] to-[#1a1215] border border-white/10 shadow-md shadow-black/40 overflow-hidden group transition-all duration-300"
    >
      <div className="absolute -top-10 -right-10 w-28 h-28 bg-red-600/10 rounded-full blur-2xl pointer-events-none group-hover:bg-red-600/20 transition-all duration-500" />
      <div className="absolute -bottom-10 -left-10 w-28 h-28 bg-rose-600/10 rounded-full blur-2xl pointer-events-none" />

      <div className="relative flex items-start justify-between gap-2.5">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-white/[0.06] border border-white/10 flex items-center justify-center shrink-0 shadow-inner mt-0.5">
            <IconComp className="w-4 h-4 text-[#ff2e56]" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
              <span className={clsx("text-[9.5px] font-bold px-1.5 py-0.2 rounded-md border bg-gradient-to-r uppercase tracking-wider", narrative.badgeColor)}>
                {narrative.badge}
              </span>
              {narrative.tag && (
                <span className="text-[10px] font-medium text-white/50 bg-white/[0.05] px-1.5 py-0.2 rounded border border-white/[0.06]">
                  {narrative.tag}
                </span>
              )}
            </div>
            
            <h3 className="text-[13.5px] font-bold text-white tracking-tight leading-snug line-clamp-1">
              {narrative.headline}
            </h3>
            
            <p className="text-[11px] text-[#a1a1aa] leading-relaxed mt-0.5 line-clamp-1">
              {narrative.subtitle}
            </p>
          </div>
        </div>

        <button
          onClick={() => setDismissed(true)}
          className="w-6 h-6 rounded-md bg-white/[0.04] hover:bg-white/[0.1] text-white/40 hover:text-white flex items-center justify-center shrink-0 transition-colors border border-white/[0.06]"
          aria-label="Dismiss banner"
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      {(narrative as any).isForYouLink ? (
        <div className="relative mt-2 pt-2 border-t border-white/[0.06] flex items-center justify-between text-[11px]">
          <span className="text-white/40 flex items-center gap-1 font-medium">
            <Sparkles className="w-2.5 h-2.5 text-[#ff2e56]" />
            Updated based on your activity
          </span>
          <Link
            to="/foryou"
            className="text-[#ff3b60] hover:text-[#ff6b87] font-bold flex items-center gap-1 transition-colors group-hover:underline"
          >
            Open For You →
          </Link>
        </div>
      ) : narrative.category && onCategoryClick && (
        <div className="relative mt-2 pt-2 border-t border-white/[0.06] flex items-center justify-between text-[11px]">
          <span className="text-white/40 flex items-center gap-1 font-medium">
            <Sparkles className="w-2.5 h-2.5 text-[#ff2e56]" />
            Updated with fresh releases
          </span>
          <button
            onClick={() => onCategoryClick(narrative.category!)}
            className="text-[#ff3b60] hover:text-[#ff6b87] font-semibold flex items-center gap-1 transition-colors group-hover:underline"
          >
            Explore {narrative.tag} →
          </button>
        </div>
      )}
    </div>
  );
}
