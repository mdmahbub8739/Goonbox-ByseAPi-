import React, { useState } from 'react';
import { Search, Zap, Clock, SunMedium } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { HarvesterModal } from './HarvesterModal';
import { CinematicSearchModal } from './CinematicSearchModal';
import { DailyStreakBadge } from './DailyStreakBadge';
import { useAmbientMode } from '../context/AmbientModeContext';
import clsx from 'clsx';

export function TopBar() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [harvesterOpen, setHarvesterOpen] = useState(false);
  const { ambientMode, toggleAmbientMode } = useAmbientMode();
  const navigate = useNavigate();

  return (
    <>
      <header className="fixed top-0 left-0 right-0 h-[48px] bg-[#0c0c0e]/95 backdrop-blur-xl flex items-center justify-between px-3 z-40 border-b border-white/[0.08] shadow-sm">
        <div className="flex items-center gap-2">
          <a href="/" className="flex items-center gap-1.5 font-black tracking-tight group">
            <div className="w-[28px] h-[20px] bg-gradient-to-tr from-[#ff0033] to-[#ff3366] rounded-lg flex items-center justify-center shadow-md shadow-red-600/30 group-hover:scale-105 transition-transform duration-200">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-white ml-0.5">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </div>
            <span className="font-extrabold tracking-tight text-[#f4f4f5] text-[16.5px]">
              porn<span className="text-[#ff0033] drop-shadow-[0_0_6px_rgba(255,0,51,0.4)]">void</span>
            </span>
          </a>
        </div>
        <div className="flex items-center gap-1">
          {/* Daily Streak Indicator */}
          <DailyStreakBadge />

          {/* Ambient Mode Quick Toggle */}
          <button
            onClick={toggleAmbientMode}
            title={ambientMode ? "Ambient Mode: On" : "Ambient Mode: Off"}
            className={clsx(
              "w-8 h-8 flex items-center justify-center rounded-full active:scale-90 border transition-all",
              ambientMode
                ? "bg-[#ff0033]/15 text-[#ff0033] border-[#ff0033]/30 shadow-[0_0_8px_rgba(255,0,51,0.2)]"
                : "bg-white/[0.04] hover:bg-white/[0.08] text-[#a1a1aa] border-white/5"
            )}
          >
            <SunMedium className={clsx("w-3.5 h-3.5", ambientMode && "animate-pulse")} />
          </button>

          {/* Live Ingestion / Sync Status Button */}
          <button
            onClick={() => setHarvesterOpen(true)}
            title="Live Video Harvester Engine"
            className="flex items-center gap-1 bg-white/[0.04] hover:bg-white/[0.08] text-white text-[10.5px] font-semibold px-2 py-1 rounded-full border border-white/10 active:scale-95 transition-all shadow-inner"
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
            </span>
            <Zap className="w-2.5 h-2.5 text-amber-400" />
            <span className="hidden sm:inline">Sync</span>
          </button>

          <button 
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/[0.04] hover:bg-white/[0.08] active:scale-90 text-[#e4e4e7] border border-white/5 transition-all" 
            onClick={() => setSearchOpen(true)}
            title="Search"
          >
            <Search className="w-3.5 h-3.5" />
          </button>
          <button 
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/[0.04] hover:bg-white/[0.08] active:scale-90 text-[#e4e4e7] border border-white/5 transition-all"
            onClick={() => navigate('/history')}
            title="Watch History"
          >
            <Clock className="w-3.5 h-3.5" />
          </button>
          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#ff0033] to-[#ff3366] flex items-center justify-center text-[10px] font-black text-white shadow-sm border border-white/20 ml-0.5">
            PV
          </div>
        </div>
      </header>

      {/* Harvester Sync Modal */}
      <HarvesterModal isOpen={harvesterOpen} onClose={() => setHarvesterOpen(false)} />

      {/* Cinematic Live Search Modal */}
      <CinematicSearchModal 
        isOpen={searchOpen} 
        onClose={() => setSearchOpen(false)} 
      />
    </>
  );
}
