import React, { useState, useEffect } from 'react';
import { Flame } from 'lucide-react';
import { getDailyStreakData, DailyStreakData } from '../lib/streakTracker';
import { DailyStreakModal } from './DailyStreakModal';
import clsx from 'clsx';

interface DailyStreakBadgeProps {
  variant?: 'topbar' | 'compact' | 'card';
}

export function DailyStreakBadge({ variant = 'topbar' }: DailyStreakBadgeProps) {
  const [streakData, setStreakData] = useState<DailyStreakData>(() => getDailyStreakData());
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    const handleUpdate = () => {
      setStreakData(getDailyStreakData());
    };

    window.addEventListener('pv_daily_streak_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      window.removeEventListener('pv_daily_streak_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const streak = streakData.currentStreak;

  return (
    <>
      <button
        id="daily-streak-trigger-btn"
        onClick={() => setModalOpen(true)}
        title={streak > 0 ? `${streak} Day Daily Streak! Click to view progress` : `Start your Daily Streak!`}
        className={clsx(
          "flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border transition-all active:scale-95 select-none",
          streak > 0
            ? "bg-gradient-to-r from-[#ff3300]/20 via-[#ff0044]/15 to-transparent border-[#ff3300]/40 text-amber-300 shadow-[0_0_12px_rgba(255,69,0,0.25)] hover:border-[#ff3300]/70"
            : "bg-[#18181c] hover:bg-[#24242a] text-[#a1a1aa] border-white/5"
        )}
      >
        <Flame 
          className={clsx(
            "w-4 h-4 transition-transform",
            streak > 0 
              ? "text-[#ff3300] fill-[#ff3300] drop-shadow-[0_0_6px_rgba(255,69,0,0.8)] animate-pulse" 
              : "text-white/40"
          )} 
        />
        <span className={clsx("text-[12px] font-black tracking-tight", streak > 0 ? "text-white font-extrabold" : "text-white/60")}>
          {streak}
        </span>
      </button>

      <DailyStreakModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
