import React from 'react';
import { useAmbientMode } from '../context/AmbientModeContext';
import clsx from 'clsx';

interface AmbientVideoGlowProps {
  posterUrl?: string;
  className?: string;
}

export function AmbientVideoGlow({ posterUrl, className }: AmbientVideoGlowProps) {
  const { ambientMode, ambientIntensity } = useAmbientMode();

  if (!ambientMode) return null;

  const opacityClass = {
    subtle: 'opacity-25',
    vibrant: 'opacity-55',
    cinema: 'opacity-75',
  }[ambientIntensity] || 'opacity-55';

  return (
    <div 
      aria-hidden="true" 
      className={clsx(
        "absolute -inset-4 sm:-inset-8 pointer-events-none -z-10 overflow-hidden select-none transition-all duration-700 ease-out",
        className
      )}
    >
      {/* Background Poster Blurred Glow */}
      {posterUrl ? (
        <div 
          className={clsx(
            "w-full h-full scale-125 filter blur-3xl transform transition-opacity duration-700",
            opacityClass
          )}
          style={{
            backgroundImage: `url(${posterUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(45px) saturate(180%) brightness(1.2)',
          }}
        />
      ) : (
        /* Fallback Ambient Glow */
        <div 
          className={clsx(
            "w-full h-full scale-125 filter blur-3xl transform transition-opacity duration-700 bg-gradient-to-tr from-[#ff0033]/40 via-[#8b00ff]/30 to-[#ff0055]/30",
            opacityClass
          )}
        />
      )}

      {/* Radial soft vignette overlay so it blends into the dark UI */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-[#0c0c0e]/80 pointer-events-none" />
    </div>
  );
}
