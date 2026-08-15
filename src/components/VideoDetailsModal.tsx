import React, { useState } from 'react';
import { 
  X, 
  Folder, 
  Tag, 
  User, 
  Calendar, 
  Eye, 
  Clock, 
  ChevronDown, 
  ChevronUp, 
  Maximize2, 
  Minimize2, 
  Share2, 
  Copy, 
  Check, 
  Layers,
  Sparkles
} from 'lucide-react';
import { Video } from '../types';
import { getByseBackupSlot } from '../lib/byseResolver';
import { Server, ShieldCheck, Link2 } from 'lucide-react';
import clsx from 'clsx';

interface VideoDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  video: Video;
  views: string;
  ago: string;
  channel: string;
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  selectedTag: string;
  onSelectTag: (tag: string) => void;
  selectedActor: string;
  onSelectActor: (actor: string) => void;
}

export function VideoDetailsModal({
  isOpen,
  onClose,
  video,
  views,
  ago,
  channel,
  selectedCategory,
  onSelectCategory,
  selectedTag,
  onSelectTag,
  selectedActor,
  onSelectActor,
}: VideoDetailsModalProps) {
  const [isExpandedFull, setIsExpandedFull] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const categories = (video.categories || '')
    .split(/[,/|;]+/)
    .map(c => c.trim())
    .filter(c => c && c.toLowerCase() !== 'n/a');

  const tags = (video.tags || '')
    .split(/[,/|;]+/)
    .map(t => t.replace(/^#/, '').trim())
    .filter(t => t && t.toLowerCase() !== 'n/a' && t.toLowerCase() !== 'video');

  const formattedDate = video.published_date 
    ? new Date(video.published_date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    : ago;

  const durationMin = video.duration_sec ? Math.floor(video.duration_sec / 60) : null;
  const durationSec = video.duration_sec ? video.duration_sec % 60 : null;

  const handleCopyTitle = () => {
    navigator.clipboard.writeText(video.title);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div 
      id="video-details-modal-overlay"
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/80 backdrop-blur-md transition-all"
    >
      {/* Backdrop touch / click to dismiss / collapse */}
      <div 
        id="video-details-backdrop"
        className="flex-1 w-full cursor-pointer" 
        onClick={onClose} 
        aria-label="Close modal"
      />

      {/* Modal / Drawer Sheet */}
      <div 
        id="video-details-sheet"
        className={clsx(
          "bg-[#141416] text-[#f4f4f5] rounded-t-2xl border-t border-white/10 shadow-2xl flex flex-col transition-all duration-300 ease-out",
          isExpandedFull ? "h-[92vh]" : "max-h-[75vh]"
        )}
      >
        {/* Top Drag Handle & Bar */}
        <div className="flex flex-col items-center pt-2.5 pb-2 px-4 border-b border-white/10 shrink-0">
          <button 
            id="drag-handle-btn"
            onClick={() => setIsExpandedFull(!isExpandedFull)}
            className="w-14 h-1.5 rounded-full bg-white/25 hover:bg-white/40 mb-2.5 transition-colors cursor-grab active:cursor-grabbing"
            title={isExpandedFull ? "Collapse modal size" : "Expand modal size"}
            aria-label="Toggle size or drag"
          />
          
          <div className="w-full flex items-center justify-between py-1">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#ff0033]/15 flex items-center justify-center text-[#ff0033]">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-[16px] font-bold text-white leading-tight">Description & Tags</h2>
                <p className="text-[11px] text-[#888888]">Metadata, categories & performer info</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Expand / Collapse Size Button */}
              <button
                id="toggle-expand-modal-btn"
                onClick={() => setIsExpandedFull(!isExpandedFull)}
                className="w-9 h-9 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/15 text-[#aaaaaa] hover:text-white transition-colors active:scale-95"
                title={isExpandedFull ? "Collapse modal" : "Expand full"}
                aria-label="Toggle expand"
              >
                {isExpandedFull ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>

              {/* Close Button */}
              <button
                id="close-video-details-modal-btn"
                onClick={onClose}
                className="w-9 h-9 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 active:bg-white/30 text-white transition-all active:scale-95"
                title="Close"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable Modal Content */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1 hide-scrollbar">
          {/* Video Title Card */}
          <div className="bg-[#1c1c20] border border-white/5 rounded-2xl p-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <h1 className="text-[15px] font-bold text-white leading-snug">
                {video.title}
              </h1>
              <button
                id="copy-title-btn"
                onClick={handleCopyTitle}
                className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 text-[#aaaaaa] hover:text-white shrink-0 flex items-center justify-center transition-colors active:scale-95"
                title="Copy title"
                aria-label="Copy title"
              >
                {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            {/* Metric Pills */}
            <div className="grid grid-cols-3 gap-2 pt-2.5 border-t border-white/5 text-center">
              <div className="bg-black/30 rounded-xl p-2.5">
                <div className="flex items-center justify-center gap-1 text-[11px] font-semibold text-[#888888] mb-0.5">
                  <Eye className="w-3.5 h-3.5 text-[#ff0033]" /> Views
                </div>
                <div className="text-[13.5px] font-bold text-white">{views}</div>
              </div>

              <div className="bg-black/30 rounded-xl p-2.5">
                <div className="flex items-center justify-center gap-1 text-[11px] font-semibold text-[#888888] mb-0.5">
                  <Calendar className="w-3.5 h-3.5 text-[#ff0033]" /> Published
                </div>
                <div className="text-[12px] font-bold text-white truncate">{formattedDate}</div>
              </div>

              <div className="bg-black/30 rounded-xl p-2.5">
                <div className="flex items-center justify-center gap-1 text-[11px] font-semibold text-[#888888] mb-0.5">
                  <Clock className="w-3.5 h-3.5 text-[#ff0033]" /> Duration
                </div>
                <div className="text-[13.5px] font-bold text-white">
                  {durationMin !== null ? `${durationMin}m ${durationSec || 0}s` : '--'}
                </div>
              </div>
            </div>
          </div>

          {/* Model / Actor / Channel Section */}
          {((video.actor && video.actor !== 'N/A') || channel) && (
            <div className="bg-[#1c1c20] border border-white/5 rounded-2xl p-4">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#888888] mb-3 uppercase tracking-wider">
                <User className="w-3.5 h-3.5 text-[#ff0033]" /> Model / Creator
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-[#ff0033] flex items-center justify-center font-bold text-[16px] text-white shadow-md shadow-[#ff0033]/30 shrink-0">
                    {channel.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-[15px] font-bold text-white leading-tight">{channel}</div>
                    {video.actor && video.actor !== 'N/A' && video.actor !== channel && (
                      <div className="text-[12px] text-purple-400 font-semibold mt-0.5">Performer: {video.actor}</div>
                    )}
                  </div>
                </div>
                {video.actor && video.actor !== 'N/A' && (
                  <button
                    id="filter-by-actor-btn"
                    onClick={() => {
                      const next = selectedActor.toLowerCase() === video.actor!.toLowerCase() ? '' : video.actor!;
                      onSelectActor(next);
                      onClose();
                    }}
                    className={clsx(
                      "min-h-[38px] px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 shadow-sm",
                      selectedActor.toLowerCase() === video.actor.toLowerCase()
                        ? "bg-[#ff0033] text-white shadow-red-600/30"
                        : "bg-white/10 hover:bg-[#ff0033] text-[#f1f1f1]"
                    )}
                  >
                    {selectedActor.toLowerCase() === video.actor.toLowerCase() ? "Selected" : "Filter Videos"}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Categories Section */}
          {categories.length > 0 && (
            <div className="bg-[#1c1c20] border border-white/5 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#888888] uppercase tracking-wider">
                  <Folder className="w-3.5 h-3.5 text-[#ff0033]" /> Categories ({categories.length})
                </div>
                {selectedCategory && (
                  <button 
                    onClick={() => onSelectCategory('')}
                    className="text-[11px] text-[#ff7777] hover:underline font-semibold"
                  >
                    Clear selection
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {categories.map(cat => {
                  const isSelected = selectedCategory.toLowerCase() === cat.toLowerCase();
                  return (
                    <button
                      key={cat}
                      id={`modal-category-${cat}`}
                      onClick={() => {
                        onSelectCategory(isSelected ? '' : cat);
                        onClose();
                      }}
                      className={clsx(
                        "min-h-[42px] px-3.5 py-2 rounded-xl text-[13px] font-semibold transition-all active:scale-95 flex items-center gap-1.5",
                        isSelected
                          ? "bg-[#ff0033] text-white font-bold shadow-md shadow-[#ff0033]/30"
                          : "bg-white/5 hover:bg-white/15 text-[#e4e4e7] border border-white/5"
                      )}
                    >
                      <span>{cat}</span>
                      {isSelected && <Check className="w-3.5 h-3.5" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tags Section */}
          {tags.length > 0 && (
            <div className="bg-[#1c1c20] border border-white/5 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#888888] uppercase tracking-wider">
                  <Tag className="w-3.5 h-3.5 text-[#ff0033]" /> Tags ({tags.length})
                </div>
                {selectedTag && (
                  <button 
                    onClick={() => onSelectTag('')}
                    className="text-[11px] text-[#ff7777] hover:underline font-semibold"
                  >
                    Clear selection
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {tags.map(tag => {
                  const isSelected = selectedTag.toLowerCase() === tag.toLowerCase();
                  return (
                    <button
                      key={tag}
                      id={`modal-tag-${tag}`}
                      onClick={() => {
                        onSelectTag(isSelected ? '' : tag);
                        onClose();
                      }}
                      className={clsx(
                        "min-h-[38px] px-3 py-1.5 rounded-xl text-[12.5px] font-semibold transition-all active:scale-95 flex items-center gap-1",
                        isSelected
                          ? "bg-[#ff0033] text-white font-bold shadow-md shadow-[#ff0033]/30"
                          : "bg-white/5 hover:bg-white/10 text-sky-400 hover:text-sky-300 border border-white/5"
                      )}
                    >
                      {isSelected && <Check className="w-3 h-3" />}
                      <span>#{tag}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Embedded Links & Permanent Backup Slots Section */}
          <div className="bg-[#1c1c20] border border-white/5 rounded-2xl p-4">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#888888] mb-3 uppercase tracking-wider">
              <Link2 className="w-3.5 h-3.5 text-[#ff0033]" /> Embedded Links & Cloud Backup
            </div>

            <div className="space-y-2.5">
              {/* Primary Embed Link */}
              <div className="bg-black/30 rounded-xl p-3 border border-white/5 flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-white mb-0.5">
                    <Server className="w-3 h-3 text-[#ff0033]" />
                    <span>Primary Stream</span>
                    <span className="text-[9.5px] px-1.5 py-0.2 bg-white/10 text-gray-300 rounded font-semibold">Active Default</span>
                  </div>
                  <div className="text-[11.5px] text-[#888] truncate font-mono">
                    {video.embed_url}
                  </div>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(video.embed_url);
                  }}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-[#aaa] hover:text-white shrink-0 transition-colors"
                  title="Copy Primary Embed URL"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Byse Cloud Permanent Backup Slot */}
              {(() => {
                const slot = getByseBackupSlot(video.id);
                return (
                  <div className="bg-black/30 rounded-xl p-3 border border-white/5 flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-white mb-0.5">
                        <ShieldCheck className={clsx("w-3.5 h-3.5", slot?.status === 'ready' ? "text-emerald-400" : "text-amber-400")} />
                        <span>Byse Backup (bysewihe.com)</span>
                        {slot?.status === 'ready' ? (
                          <span className="text-[9.5px] px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 rounded font-bold">Secured & Active</span>
                        ) : slot?.status === 'uploading' ? (
                          <span className="text-[9.5px] px-1.5 py-0.2 bg-amber-500/20 text-amber-300 rounded font-bold animate-pulse">Securing...</span>
                        ) : (
                          <span className="text-[9.5px] px-1.5 py-0.2 bg-white/10 text-[#888] rounded font-semibold">Auto-Triggered</span>
                        )}
                      </div>
                      <div className="text-[11.5px] text-[#888] truncate font-mono">
                        {slot?.embedUrl || 'Queued for upload / Byse resolver active'}
                      </div>
                    </div>
                    {slot?.embedUrl && (
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(slot.embedUrl);
                        }}
                        className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-[#aaa] hover:text-white shrink-0 transition-colors"
                        title="Copy Byse Backup URL"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Footer with quick action to collapse / close */}
        <div className="p-4 pb-6 border-t border-white/10 bg-[#121214] flex items-center justify-between gap-3 shrink-0">
          <div className="text-[11.5px] text-[#888888] font-medium leading-tight">
            Tap any category or tag to filter feed
          </div>
          <button
            id="modal-done-btn"
            onClick={onClose}
            className="min-h-[44px] px-6 rounded-2xl bg-[#ff0033] hover:bg-[#e6002e] active:bg-[#cc0029] text-white text-[13px] font-bold transition-all shadow-lg shadow-[#ff0033]/30 active:scale-95"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
