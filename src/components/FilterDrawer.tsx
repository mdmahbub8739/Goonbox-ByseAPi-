import React from 'react';
import { Filter, Calendar, Clock, ArrowUpDown, X } from 'lucide-react';
import { 
  TimeFilter, 
  TIME_FILTER_OPTIONS, 
  DurationFilter, 
  DURATION_FILTER_OPTIONS, 
  SortByOption, 
  SORT_OPTIONS 
} from '../lib/filters';
import clsx from 'clsx';

interface FilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  timeFilter: TimeFilter;
  setTimeFilter: (val: TimeFilter) => void;
  durationFilter: DurationFilter;
  setDurationFilter: (val: DurationFilter) => void;
  sortBy: SortByOption;
  setSortBy: (val: SortByOption) => void;
  onReset: () => void;
  activeCount: number;
}

export function FilterDrawer({
  isOpen,
  onClose,
  timeFilter,
  setTimeFilter,
  durationFilter,
  setDurationFilter,
  sortBy,
  setSortBy,
  onReset,
  activeCount,
}: FilterDrawerProps) {
  if (!isOpen) return null;

  return (
    <div 
      id="filter-drawer-modal"
      className="fixed inset-0 z-[100] flex flex-col justify-end bg-black/85 backdrop-blur-md animate-fadeIn"
    >
      {/* Backdrop touch to close */}
      <div 
        id="filter-drawer-backdrop"
        className="flex-1 w-full cursor-pointer" 
        onClick={onClose} 
        aria-label="Close filter drawer"
      />

      <div 
        id="filter-drawer-content"
        className="bg-[#161619] rounded-t-3xl border-t border-white/15 max-h-[85dvh] flex flex-col shadow-2xl overflow-hidden"
      >
        {/* Top Drag Handle & Header */}
        <div className="flex flex-col items-center pt-2.5 pb-2 px-4 border-b border-white/10 shrink-0 bg-[#161619]">
          <button 
            onClick={onClose}
            className="w-12 h-1 rounded-full bg-white/25 hover:bg-white/40 mb-1.5 transition-colors cursor-grab active:cursor-grabbing"
            aria-label="Drag down to close"
          />
          <div className="w-full flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#ff0033]/15 flex items-center justify-center text-[#ff0033]">
                <Filter className="w-3.5 h-3.5" />
              </div>
              <div>
                <h2 className="text-[14px] font-bold text-white leading-tight">Filter & Sort Videos</h2>
                <p className="text-[10.5px] text-[#888888]">Customize feed view & algorithm</p>
              </div>
              {activeCount > 0 && (
                <span className="bg-[#ff0033] text-white text-[10px] font-bold px-2 py-0.5 rounded-full ml-1 shadow-sm">
                  {activeCount} active
                </span>
              )}
            </div>
            <button 
              id="close-filter-drawer-btn"
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 text-white transition-all active:scale-95"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Filter Options */}
        <div className="p-3.5 overflow-y-auto space-y-4 flex-1 hide-scrollbar overscroll-contain">
          {/* 1. Time / Upload Date Filter */}
          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#999] mb-1.5 uppercase tracking-wider">
              <Calendar className="w-3 h-3 text-[#ff0033]" /> Upload Time / Date
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {TIME_FILTER_OPTIONS.map(opt => (
                <button
                  key={opt.id}
                  id={`filter-time-${opt.id}`}
                  onClick={() => setTimeFilter(opt.id)}
                  className={clsx(
                    "h-9 px-2.5 rounded-xl text-xs font-medium transition-all text-center border active:scale-[0.97] flex items-center justify-center",
                    timeFilter === opt.id
                      ? "bg-[#ff0033] text-white border-[#ff0033] font-bold shadow-sm"
                      : "bg-[#202024] text-[#d4d4d8] border-white/5 hover:bg-[#28282e] hover:text-white"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 2. Duration Filter */}
          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#999] mb-1.5 uppercase tracking-wider">
              <Clock className="w-3 h-3 text-[#ff0033]" /> Video Duration
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {DURATION_FILTER_OPTIONS.map(opt => (
                <button
                  key={opt.id}
                  id={`filter-dur-${opt.id}`}
                  onClick={() => setDurationFilter(opt.id)}
                  className={clsx(
                    "h-9 px-3 rounded-xl text-xs font-medium transition-all text-center border active:scale-[0.97] flex items-center justify-center",
                    durationFilter === opt.id
                      ? "bg-[#ff0033] text-white border-[#ff0033] font-bold shadow-sm"
                      : "bg-[#202024] text-[#d4d4d8] border-white/5 hover:bg-[#28282e] hover:text-white"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Sort Order */}
          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#999] mb-1.5 uppercase tracking-wider">
              <ArrowUpDown className="w-3 h-3 text-[#ff0033]" /> Sort Order
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {SORT_OPTIONS.map(opt => (
                <button
                  key={opt.id}
                  id={`filter-sort-${opt.id}`}
                  onClick={() => setSortBy(opt.id)}
                  className={clsx(
                    "h-9 px-3 rounded-xl text-xs font-medium transition-all text-center border active:scale-[0.97] flex items-center justify-center",
                    sortBy === opt.id
                      ? "bg-white text-black border-white font-bold shadow-sm"
                      : "bg-[#202024] text-[#d4d4d8] border-white/5 hover:bg-[#28282e] hover:text-white"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Sticky Action Buttons */}
        <div className="sticky bottom-0 z-20 px-4 py-3 pb-[max(1.25rem,calc(env(safe-area-inset-bottom)+14px))] bg-[#121215] border-t border-white/10 flex items-center gap-3 shrink-0 shadow-[0_-8px_30px_rgba(0,0,0,0.9)]">
          <button
            id="reset-filter-drawer-btn"
            onClick={onReset}
            className="flex-1 h-11 rounded-xl bg-white/10 hover:bg-white/15 active:bg-white/25 text-white text-[13px] font-semibold transition-all active:scale-[0.98] flex items-center justify-center border border-white/5"
          >
            Reset Filters
          </button>
          <button
            id="apply-filter-drawer-btn"
            onClick={onClose}
            className="flex-[1.6] h-11 rounded-xl bg-[#ff0033] hover:bg-[#e6002e] active:bg-[#cc0029] text-white text-[13px] font-bold transition-all shadow-lg shadow-[#ff0033]/30 active:scale-[0.98] flex items-center justify-center gap-1.5"
          >
            <span>Apply Filters</span>
            {activeCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-white text-[#ff0033] text-[11px] font-black flex items-center justify-center ml-1">
                {activeCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
