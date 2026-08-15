import React, { useState, useEffect } from 'react';
import { Video } from '../types';
import { VideoCard } from '../components/VideoCard';
import { VideoCardSkeleton } from '../components/VideoCardSkeleton';
import { 
  getWatchHistory, 
  clearWatchHistory, 
  removeWatchHistoryItem,
  WatchHistoryEntry 
} from '../lib/userHistory';
import { getDailyStreakData, DailyStreakData } from '../lib/streakTracker';
import { DailyStreakModal } from '../components/DailyStreakModal';
import { History, Trash2, Clock, Sparkles, Flame, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export function HistoryPage() {
  const [history, setHistory] = useState<WatchHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [streakData, setStreakData] = useState<DailyStreakData>(() => getDailyStreakData());
  const [streakModalOpen, setStreakModalOpen] = useState(false);

  useEffect(() => {
    setHistory(getWatchHistory());
    setStreakData(getDailyStreakData());
    setLoading(false);
  }, []);

  const handleClearAll = () => {
    if (window.confirm('Are you sure you want to clear your entire watch history?')) {
      clearWatchHistory();
      setHistory([]);
    }
  };

  const handleRemove = (e: React.MouseEvent, videoId: string | number) => {
    e.preventDefault();
    e.stopPropagation();
    removeWatchHistoryItem(videoId);
    setHistory(prev => prev.filter(h => String(h.video.id) !== String(videoId)));
  };

  return (
    <div className="pt-[48px] min-h-screen max-w-7xl mx-auto px-2 sm:px-4 pb-16">
      {/* Header */}
      <div className="flex items-center justify-between py-2.5 border-b border-white/10 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-[#ff0000]/20 flex items-center justify-center text-[#ff0000]">
            <History className="w-3.5 h-3.5" />
          </div>
          <div>
            <h1 className="text-[16px] font-extrabold text-white leading-tight">Watch History</h1>
            <p className="text-[11px] text-[#888888]">Your viewing activity and progress</p>
          </div>
        </div>

        {history.length > 0 && (
          <button
            onClick={handleClearAll}
            className="flex items-center gap-1 bg-white/10 hover:bg-white/15 active:bg-white/20 text-white text-[11px] font-medium px-2.5 py-1 rounded-lg transition-colors"
          >
            <Trash2 className="w-3 h-3 text-[#ff0000]" />
            <span>Clear All</span>
          </button>
        )}
      </div>

      {/* Daily Streak Highlight Card */}
      <div 
        onClick={() => setStreakModalOpen(true)}
        className="mb-3 p-2.5 sm:p-3 rounded-xl bg-gradient-to-r from-[#1c1418] via-[#17141f] to-[#121217] border border-orange-500/20 shadow-md shadow-black/40 cursor-pointer hover:border-orange-500/40 transition-all flex items-center justify-between group"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-500 to-red-600 flex items-center justify-center text-white shadow-sm shadow-red-600/30 group-hover:scale-105 transition-transform">
            <Flame className="w-4 h-4 text-white animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[13px] font-bold text-white">
                {streakData.currentStreak > 0 ? `${streakData.currentStreak} Day Streak 🔥` : 'Daily Streak'}
              </span>
              <span className="text-[9.5px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {streakData.totalDaysActive} Days Active
              </span>
            </div>
            <p className="text-[11px] text-[#a1a1aa] mt-0.5">
              {streakData.currentStreak > 0 
                ? 'Keep your daily momentum alive by watching videos today!'
                : 'Watch a video today to start your daily streak!'}
            </p>
          </div>
        </div>

        <ChevronRight className="w-4 h-4 text-white/40 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
      </div>

      <DailyStreakModal isOpen={streakModalOpen} onClose={() => setStreakModalOpen(false)} />

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          <VideoCardSkeleton count={8} />
        </div>
      ) : history.length === 0 ? (
        <div className="text-center py-20 px-4">
          <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-3 text-[#888888]">
            <Clock className="w-6 h-6" />
          </div>
          <h2 className="text-[15px] font-bold text-white mb-1">No Watch History Yet</h2>
          <p className="text-[12px] text-[#888888] max-w-sm mx-auto mb-5">
            Videos you watch will appear here so you can easily replay your favorite scenes and continue where you left off.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 bg-[#ff0000] hover:bg-[#e60000] text-white text-[12px] font-bold px-4 py-2 rounded-xl shadow-md shadow-[#ff0000]/25 transition-transform active:scale-95"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Explore Videos</span>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {history.map((entry) => (
            <div key={entry.video.id} className="relative group">
              <VideoCard video={entry.video} />
              <button
                onClick={(e) => handleRemove(e, entry.video.id)}
                title="Remove from history"
                className="absolute top-2 right-2 z-20 bg-black/80 hover:bg-[#ff0000] text-white p-1 rounded-md backdrop-blur-md opacity-80 group-hover:opacity-100 transition-all"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
