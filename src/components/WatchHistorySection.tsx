import { VideoCard } from './VideoCard';
import { Sparkles } from 'lucide-react';
import { WatchHistoryEntry } from '../lib/userHistory';

interface WatchHistorySectionProps {
  history: WatchHistoryEntry[];
  onClear?: () => void;
}

export function WatchHistorySection({ history }: WatchHistorySectionProps) {
  if (!history || history.length === 0) return null;

  return (
    <div className="mb-3 bg-gradient-to-b from-[#1c1212] to-transparent p-2.5 rounded-xl border border-[#ff0000]/15">
      <div className="flex items-center justify-between mb-2 px-0.5">
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-[#ff0000] animate-pulse" />
          <h2 className="text-[12px] font-bold uppercase tracking-wider text-[#f1f1f1] flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-[#ff0033]" /> Jump Back In / History
          </h2>
        </div>
        <span className="text-[10.5px] text-[#888888] font-medium">
          {history.length} watched
        </span>
      </div>

      <div className="flex gap-2.5 overflow-x-auto hide-scrollbar pb-0.5 [&_.group]:mb-0">
        {history.slice(0, 8).map((item, idx) => (
          <div key={`${item.video.id}-${idx}`} className="w-[160px] shrink-0">
            <VideoCard video={item.video} />
          </div>
        ))}
      </div>
    </div>
  );
}
