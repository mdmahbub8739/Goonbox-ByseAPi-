import React, { useState, useEffect, useRef } from 'react';
import { getThumbnailCandidates, generatePlaceholderSvg } from '../lib/utils';
import clsx from 'clsx';

interface ThumbnailImageProps {
  poster?: string | null;
  embedUrl?: string | null;
  title?: string;
  category?: string;
  alt: string;
  className?: string;
  aspectRatio?: 'video' | 'card' | 'custom';
}

export function ThumbnailImage({
  poster,
  embedUrl,
  title,
  category,
  alt,
  className = '',
  aspectRatio = 'video'
}: ThumbnailImageProps) {
  const candidatesRef = useRef<string[]>([]);
  const currentIndexRef = useRef<number>(0);

  const [currentSrc, setCurrentSrc] = useState<string>('');
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  useEffect(() => {
    const list = getThumbnailCandidates(poster, embedUrl, title, category);
    candidatesRef.current = list;
    currentIndexRef.current = 0;
    setCurrentSrc(list[0] || generatePlaceholderSvg(title, category));
    setIsLoaded(false);
  }, [poster, embedUrl, title, category]);

  const handleError = () => {
    const nextIndex = currentIndexRef.current + 1;
    if (nextIndex < candidatesRef.current.length) {
      currentIndexRef.current = nextIndex;
      setCurrentSrc(candidatesRef.current[nextIndex]);
    } else {
      const finalSvg = generatePlaceholderSvg(title, category);
      setCurrentSrc(finalSvg);
      setIsLoaded(true);
    }
  };

  const handleLoad = () => {
    setIsLoaded(true);
  };

  return (
    <div className={clsx(
      "relative w-full overflow-hidden bg-[#181818]",
      aspectRatio === 'video' && 'aspect-video',
      aspectRatio === 'card' && 'aspect-[16/10]',
      className
    )}>
      {/* Background Skeleton Shimmer while image is loading */}
      {!isLoaded && (
        <div className="absolute inset-0 bg-[#202020] animate-pulse pointer-events-none" />
      )}

      {currentSrc && (
        <img
          src={currentSrc}
          alt={alt}
          loading="lazy"
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
          onLoad={handleLoad}
          onError={handleError}
          className={clsx(
            "w-full h-full object-cover transition-opacity duration-200",
            isLoaded ? "opacity-100" : "opacity-0"
          )}
        />
      )}
    </div>
  );
}
