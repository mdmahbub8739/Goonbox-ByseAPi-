import React from 'react';
import { useOrientation } from '../context/OrientationContext';
import { ORIENTATION_OPTIONS, Orientation } from '../lib/orientation';
import clsx from 'clsx';
import { Heart, Users, Sparkles, Flame } from 'lucide-react';

interface OrientationBarProps {
  className?: string;
  onSelect?: (orientation: Orientation) => void;
}

export function OrientationBar({ className, onSelect }: OrientationBarProps) {
  const { orientation, setOrientation } = useOrientation();

  const handleSelect = (id: Orientation) => {
    setOrientation(id);
    if (onSelect) {
      onSelect(id);
    }
  };

  const getIcon = (id: Orientation) => {
    switch (id) {
      case 'straight':
        return <Heart className="w-3 h-3 text-sky-400" />;
      case 'gay':
        return <Flame className="w-3 h-3 text-purple-400" />;
      case 'trans':
        return <Sparkles className="w-3 h-3 text-pink-400" />;
      default:
        return <Users className="w-3 h-3 text-[#aaaaaa]" />;
    }
  };

  return (
    <div className={clsx("flex items-center gap-1 p-0.5 bg-[#131316]/90 border border-white/[0.08] rounded-xl overflow-x-auto hide-scrollbar backdrop-blur-md shadow-sm", className)}>
      {ORIENTATION_OPTIONS.map(opt => {
        const isActive = orientation === opt.id;
        return (
          <button
            key={opt.id}
            onClick={() => handleSelect(opt.id)}
            className={clsx(
              "flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all whitespace-nowrap active:scale-95",
              isActive
                ? opt.id === 'straight'
                  ? "bg-sky-500/20 text-sky-300 border border-sky-400/40 shadow-sm shadow-sky-500/20 font-bold"
                  : opt.id === 'gay'
                  ? "bg-purple-500/20 text-purple-300 border border-purple-400/40 shadow-sm shadow-purple-500/20 font-bold"
                  : opt.id === 'trans'
                  ? "bg-pink-500/20 text-pink-300 border border-pink-400/40 shadow-sm shadow-pink-500/20 font-bold"
                  : "bg-white/20 text-white border border-white/30 shadow-sm font-bold"
                : "text-[#a1a1aa] hover:text-white hover:bg-white/[0.04]"
            )}
          >
            {getIcon(opt.id)}
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
