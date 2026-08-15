import React, { useState } from 'react';
import { 
  X, 
  Server, 
  ShieldCheck, 
  Check, 
  Copy, 
  ExternalLink, 
  Play, 
  Radio, 
  RefreshCw 
} from 'lucide-react';
import { Video } from '../types';
import { BackupSlotInfo } from '../lib/byseResolver';
import clsx from 'clsx';

interface StreamSourcesModalProps {
  isOpen: boolean;
  onClose: () => void;
  video: Video;
  selectedServer: 'primary' | 'byse';
  onSelectServer: (server: 'primary' | 'byse') => void;
  byseSlot: BackupSlotInfo | null;
}

export function StreamSourcesModal({
  isOpen,
  onClose,
  video,
  selectedServer,
  onSelectServer,
  byseSlot,
}: StreamSourcesModalProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen) return null;

  const primaryUrl = video.embed_url;
  const byseUrl = byseSlot?.embedUrl || '';
  const primaryHost = video.embed_host || (() => {
    try {
      return new URL(primaryUrl).hostname;
    } catch {
      return 'Primary Server';
    }
  })();

  const handleCopy = (e: React.MouseEvent, text: string, key: string) => {
    e.stopPropagation();
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleOpenLink = (e: React.MouseEvent, url: string) => {
    e.stopPropagation();
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const isByseReady = byseSlot?.status === 'ready' && !!byseUrl;
  const isByseUploading = byseSlot?.status === 'uploading';

  return (
    <div 
      id="stream-sources-modal-overlay"
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/75 backdrop-blur-sm transition-opacity animate-fadeIn"
    >
      {/* Backdrop touch / click to dismiss */}
      <div 
        id="stream-sources-backdrop"
        className="flex-1 w-full cursor-pointer" 
        onClick={onClose} 
        aria-label="Close"
      />

      {/* Modal Sheet */}
      <div 
        id="stream-sources-sheet"
        className="w-full max-w-md mx-auto bg-[#141416] border-t border-x border-white/10 rounded-t-2xl shadow-2xl flex flex-col overflow-hidden pb-6 animate-slideUp"
      >
        {/* Handle */}
        <div className="w-full flex items-center justify-center pt-2.5 pb-1">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Modal Header */}
        <div className="px-4 py-2.5 border-b border-white/5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-[#ff0033]" />
            <h2 className="text-[14px] font-bold text-white tracking-wide">
              Select Stream Server
            </h2>
          </div>

          <button
            id="close-stream-sources-modal-btn"
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/15 text-[#aaaaaa] hover:text-white transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sources List */}
        <div className="p-3 space-y-2">
          
          {/* Server 1: Primary */}
          <div
            onClick={() => {
              onSelectServer('primary');
              onClose();
            }}
            className={clsx(
              "p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 active:scale-[0.99]",
              selectedServer === 'primary'
                ? "bg-[#ff0033]/10 border-[#ff0033]/50 shadow-sm"
                : "bg-white/[0.03] border-white/5 hover:bg-white/[0.06] hover:border-white/10"
            )}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className={clsx(
                "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0",
                selectedServer === 'primary' ? "bg-[#ff0033] text-white" : "bg-white/10 text-[#aaa]"
              )}>
                1
              </div>
              <div className="min-w-0">
                <div className="text-[13px] font-bold text-white flex items-center gap-1.5 truncate">
                  <span>Server 1 (Primary)</span>
                </div>
                <div className="text-[11px] text-[#888888] truncate font-mono">
                  {primaryHost}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={(e) => handleCopy(e, primaryUrl, 'primary')}
                className="p-1.5 rounded-md text-[#777] hover:text-white hover:bg-white/10 transition-colors"
                title="Copy Link"
              >
                {copiedKey === 'primary' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>

              <button
                onClick={(e) => handleOpenLink(e, primaryUrl)}
                className="p-1.5 rounded-md text-[#777] hover:text-white hover:bg-white/10 transition-colors"
                title="Open in new tab"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </button>

              {selectedServer === 'primary' ? (
                <div className="w-6 h-6 rounded-full bg-[#ff0033] text-white flex items-center justify-center ml-1">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
              ) : (
                <div className="w-6 h-6 rounded-full border border-white/20 ml-1" />
              )}
            </div>
          </div>

          {/* Server 2: Byse Backup (bysewihe.com) */}
          <div
            onClick={() => {
              if (isByseReady) {
                onSelectServer('byse');
                onClose();
              }
            }}
            className={clsx(
              "p-3 rounded-xl border transition-all flex items-center justify-between gap-3",
              isByseReady ? "cursor-pointer active:scale-[0.99]" : "cursor-default opacity-80",
              selectedServer === 'byse'
                ? "bg-emerald-500/10 border-emerald-500/50 shadow-sm"
                : "bg-white/[0.03] border-white/5 hover:bg-white/[0.06] hover:border-white/10"
            )}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className={clsx(
                "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0",
                selectedServer === 'byse' ? "bg-emerald-500 text-black" : "bg-white/10 text-[#aaa]"
              )}>
                2
              </div>
              <div className="min-w-0">
                <div className="text-[13px] font-bold text-white flex items-center gap-1.5 truncate">
                  <span>Server 2 (Backup)</span>
                  {isByseUploading && (
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 flex items-center gap-1 animate-pulse">
                      <RefreshCw className="w-2.5 h-2.5 animate-spin" /> Securing
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-[#888888] truncate font-mono">
                  bysewihe.com
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {byseUrl && (
                <>
                  <button
                    onClick={(e) => handleCopy(e, byseUrl, 'byse')}
                    className="p-1.5 rounded-md text-[#777] hover:text-white hover:bg-white/10 transition-colors"
                    title="Copy Link"
                  >
                    {copiedKey === 'byse' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>

                  <button
                    onClick={(e) => handleOpenLink(e, byseUrl)}
                    className="p-1.5 rounded-md text-[#777] hover:text-white hover:bg-white/10 transition-colors"
                    title="Open in new tab"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </>
              )}

              {selectedServer === 'byse' ? (
                <div className="w-6 h-6 rounded-full bg-emerald-500 text-black flex items-center justify-center ml-1">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
              ) : (
                <div className="w-6 h-6 rounded-full border border-white/20 ml-1" />
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
