import { VideoCardSkeleton } from './VideoCardSkeleton';

export function WatchPageSkeleton() {
  return (
    <div className="pt-[48px] animate-pulse">
      {/* Sticky Player Skeleton */}
      <div className="sticky top-[48px] z-30 w-full aspect-video bg-[#272727] flex items-center justify-center">
        <div className="w-12 h-12 rounded-full bg-[#333333] flex items-center justify-center opacity-40">
          <div className="w-0 h-0 border-t-[8px] border-t-transparent border-b-[8px] border-b-transparent border-l-[12px] border-l-white/60 ml-1" />
        </div>
      </div>

      <div className="p-3">
        {/* Title skeleton */}
        <div className="h-5 bg-[#272727] rounded-sm w-[92%] mb-2" />
        <div className="h-4 bg-[#272727] rounded-sm w-[60%] mb-3" />

        {/* Views / Date skeleton */}
        <div className="h-3 bg-[#222222] rounded-sm w-[35%] mb-4" />

        {/* Channel Card Skeleton */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-[#272727]" />
            <div>
              <div className="h-3.5 bg-[#272727] rounded-sm w-24 mb-1.5" />
              <div className="h-2.5 bg-[#222222] rounded-sm w-16" />
            </div>
          </div>
          <div className="w-24 h-8 rounded-full bg-[#272727]" />
        </div>

        {/* Action Pills Skeleton */}
        <div className="flex gap-2 overflow-x-auto pb-3 mb-3.5 border-b border-[#252525] hide-scrollbar">
          <div className="w-20 h-8 rounded-full bg-[#222222] shrink-0" />
          <div className="w-20 h-8 rounded-full bg-[#222222] shrink-0" />
          <div className="w-20 h-8 rounded-full bg-[#222222] shrink-0" />
        </div>

        {/* Description box skeleton */}
        <div className="bg-[#212121] rounded-[10px] p-3 mb-5 space-y-2">
          <div className="h-3.5 bg-[#272727] rounded-sm w-32" />
          <div className="h-3 bg-[#222222] rounded-sm w-44" />
        </div>

        {/* Up Next Heading Skeleton */}
        <div className="h-4 bg-[#272727] rounded-sm w-36 mb-3" />

        {/* Related Videos Skeletons */}
        <VideoCardSkeleton count={3} />
      </div>
    </div>
  );
}
