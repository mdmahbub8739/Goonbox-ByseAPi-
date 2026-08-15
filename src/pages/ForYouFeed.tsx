import { useEffect, useState, useRef, useCallback } from 'react';
import { VideoCard } from '../components/VideoCard';
import { VideoCardSkeleton } from '../components/VideoCardSkeleton';
import { Video } from '../types';
import { getPersonalizedFeed, rankVideosByRelevance, RecommendationScoreResult } from '../lib/mlRecommender';
import { Sparkles, RefreshCw } from 'lucide-react';
import { getViewerTasteProfile } from '../lib/userHistory';
import { useOrientation } from '../context/OrientationContext';
import { isMatchingOrientation } from '../lib/orientation';
import { subscribeToTasteProfileUpdates } from '../lib/watchProgressTracker';

export function ForYouFeed() {
  const { orientation } = useOrientation();
  const [results, setResults] = useState<RecommendationScoreResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [isColdStart, setIsColdStart] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const loadedRef = useRef(false);

  const loadFeed = useCallback(async (forceRefresh = false) => {
    if (forceRefresh) setIsRefreshing(true);
    else setLoading(true);

    const profile = getViewerTasteProfile();
    setIsColdStart(profile.totalActionsCount < 2);

    try {
      const ranked = await getPersonalizedFeed(forceRefresh, orientation);
      setResults(ranked);
    } catch (err) {
      console.error("Failed to load feed", err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [orientation]);

  useEffect(() => {
    if (!loadedRef.current) {
      loadedRef.current = true;
      loadFeed();
    }

    // Subscribe to real-time watch progress and preferences updates
    const unsubscribe = subscribeToTasteProfileUpdates(() => {
      // Re-rank in-memory instantly without making network requests
      setResults(prev => {
        if (prev.length === 0) return prev;
        const rawVideos = prev.map(p => p.video).filter(v => isMatchingOrientation(v, orientation));
        return rankVideosByRelevance(rawVideos);
      });
      const profile = getViewerTasteProfile();
      setIsColdStart(profile.totalActionsCount < 2);
    });

    return () => {
      unsubscribe();
    };
  }, [loadFeed, orientation]);

  return (
    <div className="w-full max-w-7xl mx-auto px-2 sm:px-4 pt-[48px] pb-16 min-h-screen">
      <div className="flex flex-col items-center justify-center text-center my-4">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-rose-500/20 to-red-600/20 border border-red-500/30 flex items-center justify-center mb-1.5 shadow-sm">
          <Sparkles className="w-4 h-4 text-[#ff0033]" />
        </div>
        <div className="flex items-center gap-1.5">
          <h1 className="text-[18px] font-extrabold text-white tracking-tight">
            For You Feed
          </h1>
          <button
            onClick={() => loadFeed(true)}
            disabled={isRefreshing || loading}
            title="Refresh recommendations"
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-red-500' : ''}`} />
          </button>
        </div>
        <p className="text-[11.5px] text-[#a1a1aa] max-w-sm mt-0.5">
          {isColdStart 
            ? "Videos curated for you. Watch and like more videos to personalize your feed."
            : "Personalized feed curated in real-time based on your watch history and favorites."}
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          <VideoCardSkeleton count={8} />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {results.map((res, index) => (
            <div key={res.video.id} className="relative">
              <VideoCard video={res.video} />
              
              {/* Subtle Recommended Badge */}
              {res.isRecommended && index < 4 && (
                <div className="absolute top-2 left-2 z-10 px-1.5 py-0.5 rounded-md bg-black/75 backdrop-blur-md border border-white/15 flex items-center gap-1 shadow-sm pointer-events-none">
                  <Sparkles className="w-2.5 h-2.5 text-[#ff0033]" />
                  <span className="text-[10px] font-semibold text-white tracking-tight">For You</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
