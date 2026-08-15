import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MoreVertical, User, Heart, Sparkles, Folder } from 'lucide-react';
import { Video } from '../types';
import { fmtDuration, fmtViews, timeAgo } from '../lib/utils';
import { getCleanCreatorName } from '../lib/videoAlgo';
import { ThumbnailImage } from './ThumbnailImage';
import { 
  recordVideoInteraction, 
  recordCategoryInteraction, 
  recordActorInteraction,
  toggleLikedVideo,
  isVideoLiked,
  getVideoWatchProgress
} from '../lib/userHistory';
import { emitTasteProfileUpdated } from '../lib/watchProgressTracker';
import clsx from 'clsx';

interface VideoCardProps {
  video: Video;
  key?: React.Key;
}

export function VideoCard({ video }: VideoCardProps) {
  const navigate = useNavigate();
  const [isLiked, setIsLiked] = useState<boolean>(() => isVideoLiked(video.id));
  const [feedbackText, setFeedbackText] = useState<string | null>(null);
  const [watchProgress, setWatchProgress] = useState<number>(() => {
    const p = getVideoWatchProgress(video.id);
    return p && p.completionRate ? Math.round(p.completionRate * 100) : 0;
  });

  useEffect(() => {
    setIsLiked(isVideoLiked(video.id));
    const p = getVideoWatchProgress(video.id);
    setWatchProgress(p && p.completionRate ? Math.round(p.completionRate * 100) : 0);
  }, [video.id]);

  const duration = fmtDuration(video.duration_sec);
  const views = fmtViews(video.total_views || ((video.base_views || 0) + (video.real_views || 0)));
  const ago = timeAgo(video.published_date || video.created_at);
  const channel = getCleanCreatorName(video);
  const initial = channel.charAt(0).toUpperCase();

  // Extract clean categories list
  const categoriesList = useMemo(() => {
    if (!video.categories) return [];
    return video.categories
      .split(/[,/|;]+/)
      .map(c => c.trim())
      .filter(c => c && c.toLowerCase() !== 'n/a' && c.toLowerCase() !== 'unknown' && c.length >= 2);
  }, [video.categories]);

  const primaryCat = categoriesList[0];

  const handleCardClick = () => {
    recordVideoInteraction('click', video);
  };

  const handleMetadataClick = (e: React.MouseEvent, type: 'category' | 'actor', value: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (type === 'category') {
      recordCategoryInteraction(value);
      navigate(`/home?category=${encodeURIComponent(value)}`);
    } else {
      recordActorInteraction(value);
      navigate(`/search?q=${encodeURIComponent(value)}`);
    }
  };

  const handleToggleLike = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const newLikedState = toggleLikedVideo(video.id, video);
    setIsLiked(newLikedState);
    emitTasteProfileUpdated({ videoId: video.id });
    
    setFeedbackText(newLikedState ? '+ Tuned For You' : 'Removed');
    setTimeout(() => setFeedbackText(null), 1800);
  };

  return (
    <div className="block mb-3.5 sm:mb-4 group relative">
      {/* Thumbnail Area with modern rounded frame & quick like button */}
      <div className="relative w-full aspect-video bg-[#151518] overflow-hidden rounded-xl border border-white/[0.08] shadow-md shadow-black/40 group-hover:border-white/20 transition-all duration-300">
        <Link 
          to={`/watch/${video.id}`} 
          onClick={handleCardClick}
          className="block w-full h-full"
        >
          <ThumbnailImage
            poster={video.poster}
            embedUrl={video.embed_url}
            title={video.title}
            category={video.categories}
            alt={video.title}
            aspectRatio="video"
            className="group-hover:scale-105 group-hover:brightness-105 transition-all duration-300 ease-out"
          />
          
          {/* Subtle bottom vignette to ensure duration & pills are always crisp */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none opacity-80 group-hover:opacity-90 transition-opacity" />
        </Link>

        {/* Category Pill Overlay */}
        {primaryCat && (
          <span 
            onClick={(e) => handleMetadataClick(e, 'category', primaryCat)}
            className="absolute top-2 left-2 bg-black/75 hover:bg-[#ff0033] text-white text-[10px] font-semibold px-2 py-0.5 rounded-md backdrop-blur-md border border-white/10 transition-all z-20 shadow-sm cursor-pointer"
          >
            {primaryCat}
          </span>
        )}

        {/* Direct Favorite Tuning Control */}
        <div className="absolute top-2 right-2 flex items-center gap-1 z-20">
          <button
            onClick={handleToggleLike}
            title={isLiked ? "Remove from favorites" : "Like (refines For You)"}
            aria-label="Like video"
            className={clsx(
              "w-6 h-6 rounded-full flex items-center justify-center backdrop-blur-md border transition-all duration-150 active:scale-90 shadow-sm",
              isLiked 
                ? "bg-[#ff0033] text-white border-red-400 shadow-[0_0_8px_rgba(255,0,51,0.5)]" 
                : "bg-black/60 hover:bg-black/90 text-white/80 hover:text-[#ff0033] border-white/15 opacity-80 hover:opacity-100 group-hover:opacity-100"
            )}
          >
            <Heart className={clsx("w-3 h-3 transition-transform", isLiked ? "fill-white" : "hover:scale-110")} />
          </button>
        </div>

        {/* Floating Real-Time Feedback Pill */}
        {feedbackText && (
          <div className="absolute inset-x-0 bottom-8 flex justify-center pointer-events-none z-30 animate-bounce">
            <div className="px-2 py-0.5 rounded-full bg-black/90 border border-white/20 text-white text-[10.5px] font-semibold backdrop-blur-md flex items-center gap-1 shadow-xl">
              <Sparkles className="w-2.5 h-2.5 text-[#ff0033]" />
              {feedbackText}
            </div>
          </div>
        )}

        {/* HD / Duration badge */}
        {duration && (
          <div className="absolute bottom-2 right-2 flex items-center gap-1 z-10 pointer-events-none">
            {video.duration_sec && video.duration_sec >= 1800 && (
              <span className="bg-red-600/90 text-white text-[9px] font-black px-1.5 py-0.5 rounded tracking-wider shadow-sm uppercase">
                30M+
              </span>
            )}
            <span className="bg-black/80 backdrop-blur-md text-[#f1f1f1] text-[10.5px] font-bold px-1.5 py-0.5 rounded border border-white/10 shadow-sm">
              {duration}
            </span>
          </div>
        )}

        {/* Watch Progress Bar from Local Storage */}
        {watchProgress > 0 && (
          <div className="absolute bottom-0 inset-x-0 h-0.5 bg-white/25 z-20 pointer-events-none">
            <div 
              className="h-full bg-[#ff0033] shadow-[0_0_4px_#ff0033] transition-all duration-200"
              style={{ width: `${Math.min(100, Math.max(4, watchProgress))}%` }} 
            />
          </div>
        )}
      </div>

      {/* Meta Info Area */}
      <div className="flex gap-2.5 px-0.5 pt-2.5">
        <Link 
          to={video.actor && video.actor !== 'N/A' ? `/search?q=${encodeURIComponent(video.actor)}` : `/watch/${video.id}`}
          onClick={() => {
            if (video.actor && video.actor !== 'N/A') recordActorInteraction(video.actor);
            else recordVideoInteraction('click', video);
          }}
          className="w-8 h-8 rounded-full bg-gradient-to-br from-[#27272f] to-[#17171a] hover:from-[#ff0033] hover:to-[#cc0029] transition-all duration-200 flex items-center justify-center text-[12px] font-extrabold text-white shrink-0 border border-white/10 shadow-sm mt-0.5"
        >
          {video.actor && video.actor !== 'N/A' ? (
            <User className="w-3.5 h-3.5 text-white" />
          ) : (
            initial
          )}
        </Link>
        
        <div className="flex-1 min-w-0">
          <Link to={`/watch/${video.id}`} onClick={handleCardClick} className="block">
            <h3 className="text-[12.5px] sm:text-[13px] font-semibold leading-snug mb-1 line-clamp-2 text-[#f1f1f5] group-hover:text-white transition-colors min-h-[34px]">
              {video.title}
            </h3>
          </Link>
          
          <div className="flex items-center flex-wrap gap-x-1.5 text-[11.5px] text-[#9ca3af] leading-[1.2]">
            {video.actor && video.actor !== 'N/A' ? (
              <span 
                onClick={(e) => handleMetadataClick(e, 'actor', video.actor)}
                className="text-[#e2e8f0] font-medium hover:text-[#ff0033] hover:underline cursor-pointer"
              >
                {video.actor}
              </span>
            ) : (
              <span className="text-[#cbd5e1] font-medium">{channel}</span>
            )}
            <span className="text-white/20">•</span>
            <span>{views}</span>
            <span className="text-white/20">•</span>
            <span>{ago}</span>
          </div>

          {/* Categories beneath the video tile */}
          {categoriesList.length > 0 && (
            <div className="flex items-center flex-wrap gap-1 mt-1.5 pt-0.5">
              {categoriesList.slice(0, 3).map((cat, idx) => (
                <span
                  key={`cat-${cat}-${idx}`}
                  onClick={(e) => handleMetadataClick(e, 'category', cat)}
                  className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#ff8095] hover:text-white bg-[#ff0033]/10 hover:bg-[#ff0033] px-1.5 py-0.5 rounded-md border border-[#ff0033]/20 hover:border-[#ff0033] transition-all cursor-pointer select-none active:scale-95 shadow-xs"
                  title={`Filter by ${cat}`}
                >
                  <Folder className="w-2.5 h-2.5 shrink-0 opacity-80" />
                  <span className="truncate max-w-[110px]">{cat}</span>
                </span>
              ))}
              {categoriesList.length > 3 && (
                <span 
                  onClick={(e) => handleMetadataClick(e, 'category', categoriesList[3])}
                  className="text-[9.5px] text-[#a1a1aa] hover:text-white font-semibold self-center bg-white/[0.05] hover:bg-white/[0.1] px-1.5 py-0.5 rounded border border-white/5 cursor-pointer transition-colors"
                  title={`+${categoriesList.length - 3} more categories`}
                >
                  +{categoriesList.length - 3}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="w-4 flex justify-end pt-0.5 shrink-0 text-[#6b7280] hover:text-white transition-colors">
          <MoreVertical className="w-3.5 h-3.5" />
        </div>
      </div>
    </div>
  );
}
