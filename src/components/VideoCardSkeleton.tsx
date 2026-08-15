interface VideoCardSkeletonProps {
  count?: number;
}

export function VideoCardSkeleton({ count = 1 }: VideoCardSkeletonProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="block mb-3.5 sm:mb-4 animate-pulse select-none">
          {/* Thumbnail Area Frame */}
          <div className="relative w-full aspect-video bg-[#151518] rounded-xl border border-white/[0.08] shadow-md shadow-black/40 overflow-hidden skeleton-shimmer">
            {/* Top Category Badge Placeholder */}
            <div className="absolute top-2 left-2 w-14 h-4 rounded-md bg-white/[0.09] backdrop-blur-md border border-white/10" />
            
            {/* Bottom Vignette */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />

            {/* Bottom Right Duration Badge Placeholder */}
            <div className="absolute bottom-2 right-2 flex items-center gap-1.5">
              <div className="w-10 h-4 rounded bg-black/75 border border-white/10" />
            </div>
          </div>

          {/* Meta Info Area */}
          <div className="flex gap-2.5 px-0.5 pt-2.5">
            {/* Creator / Channel Avatar */}
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#27272f] to-[#17171a] border border-white/10 shrink-0 skeleton-shimmer" />

            {/* Text Metadata Details */}
            <div className="flex-1 min-w-0 pt-0.5">
              {/* Title lines */}
              <div className="h-3 bg-[#23232a] rounded w-[90%] mb-1.5 skeleton-shimmer" />
              <div className="h-3 bg-[#23232a] rounded w-[60%] mb-2 skeleton-shimmer" />

              {/* Channel name, views, and timestamp */}
              <div className="flex items-center gap-1.5 text-[11px]">
                <div className="h-2.5 bg-[#1e1e24] rounded w-20 skeleton-shimmer" />
                <span className="text-white/20">•</span>
                <div className="h-2.5 bg-[#1e1e24] rounded w-12 skeleton-shimmer" />
                <span className="text-white/20">•</span>
                <div className="h-2.5 bg-[#1e1e24] rounded w-10 skeleton-shimmer" />
              </div>
            </div>

            {/* Context menu icon placeholder */}
            <div className="w-4 h-4 rounded-full bg-white/[0.04] shrink-0 mt-0.5" />
          </div>
        </div>
      ))}
    </>
  );
}
