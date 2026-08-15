export function ChipsSkeleton() {
  return (
    <div className="flex gap-2 overflow-x-auto px-3 py-2 hide-scrollbar animate-pulse">
      <div className="w-12 h-7 bg-white/20 rounded-lg shrink-0" />
      <div className="w-16 h-7 bg-white/10 rounded-lg shrink-0" />
      <div className="w-20 h-7 bg-white/10 rounded-lg shrink-0" />
      <div className="w-14 h-7 bg-white/10 rounded-lg shrink-0" />
      <div className="w-18 h-7 bg-white/10 rounded-lg shrink-0" />
      <div className="w-16 h-7 bg-white/10 rounded-lg shrink-0" />
    </div>
  );
}
