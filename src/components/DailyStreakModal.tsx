import React, { useState, useEffect } from 'react';
import { Flame, Trophy, Award, CheckCircle2, Circle, X, Zap, Crown, Sparkles, ChevronRight } from 'lucide-react';
import { getDailyStreakData, getWeekDaysStatus, STREAK_MILESTONES, DailyStreakData } from '../lib/streakTracker';
import clsx from 'clsx';

interface DailyStreakModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DailyStreakModal({ isOpen, onClose }: DailyStreakModalProps) {
  const [streakData, setStreakData] = useState<DailyStreakData>(() => getDailyStreakData());
  const [weekDays, setWeekDays] = useState(() => getWeekDaysStatus());

  useEffect(() => {
    if (isOpen) {
      setStreakData(getDailyStreakData());
      setWeekDays(getWeekDaysStatus());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentStreak = streakData.currentStreak;
  const nextMilestone = STREAK_MILESTONES.find(m => m.days > currentStreak) || STREAK_MILESTONES[STREAK_MILESTONES.length - 1];
  const prevMilestoneDays = STREAK_MILESTONES.filter(m => m.days <= currentStreak).pop()?.days || 0;
  const progressPercent = nextMilestone 
    ? Math.min(100, Math.max(10, ((currentStreak - prevMilestoneDays) / Math.max(1, nextMilestone.days - prevMilestoneDays)) * 100))
    : 100;

  return (
    <div 
      id="daily-streak-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        id="daily-streak-modal-container"
        className="relative w-full max-w-[420px] bg-[#121217] rounded-3xl border border-white/10 shadow-2xl shadow-red-950/40 p-6 overflow-hidden text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow backdrop effects */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-64 bg-gradient-to-b from-orange-500/20 via-red-600/15 to-transparent rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 right-0 w-48 h-48 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

        {/* Close Button */}
        <button 
          id="close-streak-modal-btn"
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-white/60 hover:text-white flex items-center justify-center transition-colors border border-white/5"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Big Animated Flame Hero */}
        <div className="flex flex-col items-center text-center mt-2 mb-6">
          <div className="relative mb-3 group">
            <div className="absolute inset-0 bg-gradient-to-tr from-amber-500 to-red-600 rounded-3xl blur-xl opacity-60 animate-pulse" />
            <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-tr from-[#ff3300] via-[#ff0044] to-[#ff6600] flex items-center justify-center shadow-xl border border-white/20">
              <Flame className="w-11 h-11 text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.7)]" />
            </div>
            <div className="absolute -bottom-2 -right-2 px-2 py-0.5 rounded-full bg-black/90 border border-amber-500/40 text-[11px] font-black text-amber-400 shadow-md">
              LVL {Math.max(1, Math.floor(currentStreak / 3) + 1)}
            </div>
          </div>

          <h2 className="text-[26px] font-black tracking-tight text-white flex items-center justify-center gap-2">
            {currentStreak > 0 ? (
              <>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-orange-400 to-red-500 font-extrabold">
                  {currentStreak} Day
                </span>
                <span>Streak!</span>
              </>
            ) : (
              <span>Start Your Daily Streak</span>
            )}
          </h2>

          <p className="text-[13px] text-[#a1a1aa] mt-1 max-w-[280px]">
            {currentStreak > 0
              ? 'Watch daily to keep your flame burning and unlock VIP badges.'
              : 'Watch any video today to ignite your daily explorer streak.'}
          </p>
        </div>

        {/* 7-Day Weekly Calendar Tracker */}
        <div className="bg-[#181820]/90 rounded-2xl p-4 border border-white/[0.08] mb-5 shadow-inner">
          <div className="flex items-center justify-between text-[11.5px] font-semibold text-white/50 mb-3 px-1">
            <span>This Week's Activity</span>
            <span className="text-amber-400/90 font-bold flex items-center gap-1">
              <Zap className="w-3 h-3 text-amber-400" />
              {streakData.totalDaysActive} Days Total
            </span>
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {weekDays.map((item, idx) => (
              <div key={idx} className="flex flex-col items-center gap-1.5">
                <span className="text-[10px] font-medium text-white/40">{item.dayLabel}</span>
                <div 
                  className={clsx(
                    "w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 relative",
                    item.isActive 
                      ? "bg-gradient-to-tr from-amber-500 to-red-600 text-white shadow-md shadow-red-600/30 border border-white/20 font-black scale-105" 
                      : item.isToday
                        ? "bg-white/10 text-white/90 border border-amber-400/50 animate-pulse"
                        : "bg-white/[0.03] text-white/20 border border-white/[0.04]"
                  )}
                >
                  {item.isActive ? (
                    <Flame className="w-4 h-4 text-white" />
                  ) : item.isToday ? (
                    <span className="text-[11px] font-bold text-amber-300">Today</span>
                  ) : (
                    <Circle className="w-3 h-3" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Milestone Progress Bar */}
        {nextMilestone && (
          <div className="bg-[#181820]/60 rounded-2xl p-3.5 border border-white/[0.06] mb-5">
            <div className="flex items-center justify-between text-[12px] mb-2">
              <span className="text-white/70 font-medium flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                Next Goal: <strong className="text-white">{nextMilestone.title}</strong> ({nextMilestone.days} Days)
              </span>
              <span className="text-amber-400 font-bold text-[11px]">
                {Math.max(0, nextMilestone.days - currentStreak)} days left
              </span>
            </div>

            {/* Progress line */}
            <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Milestones Showcase */}
        <div className="space-y-2 mb-5 max-h-[160px] overflow-y-auto pr-1">
          <div className="text-[11px] font-bold text-white/40 uppercase tracking-wider px-1 mb-1.5">
            Streak Badges & Milestones
          </div>
          {STREAK_MILESTONES.map((m) => {
            const isUnlocked = streakData.milestonesUnlocked.includes(m.days) || currentStreak >= m.days;
            return (
              <div 
                key={m.days}
                className={clsx(
                  "flex items-center justify-between p-2.5 rounded-xl border transition-all text-[12px]",
                  isUnlocked 
                    ? "bg-amber-500/10 border-amber-500/30 text-white" 
                    : "bg-white/[0.02] border-white/[0.04] text-white/40 opacity-70"
                )}
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-[18px]">{m.badge}</span>
                  <div>
                    <div className="font-bold flex items-center gap-1.5">
                      <span className={isUnlocked ? "text-amber-300" : "text-white/60"}>{m.title}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/5 text-white/50">{m.days} Days</span>
                    </div>
                    <div className="text-[10.5px] text-white/40">{m.perk}</div>
                  </div>
                </div>

                {isUnlocked ? (
                  <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Unlocked
                  </span>
                ) : (
                  <span className="text-[10.5px] text-white/30 font-medium">Locked</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer / Continue CTA */}
        <button
          id="continue-streak-btn"
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-[#ff0033] to-[#ff3366] text-white font-bold text-[14px] shadow-lg shadow-red-600/30 hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
        >
          <span>Keep Watching & Grow Streak</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
