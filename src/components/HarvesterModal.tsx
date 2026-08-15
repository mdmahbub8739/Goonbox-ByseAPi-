import { useState, useEffect } from 'react';
import { RotateCw, CheckCircle2, AlertCircle, Zap, Play, Pause, X, Database, Clock, Radio } from 'lucide-react';
import clsx from 'clsx';

interface HarvesterTelemetry {
  status: 'IDLE' | 'SYNCING' | 'AUTO_RUNNING';
  isAutoSyncEnabled: boolean;
  autoSyncIntervalMinutes: number;
  lastSyncTime: string | null;
  lastSyncSummary: {
    syncMode: 'TWO_STEP_NEWEST_MATCHING' | 'STANDARD_REST';
    newestScrapedIdsCount: number;
    pagesChecked: number;
    fetchedPosts: number;
    newPostsAdded: number;
    updatedPosts: number;
  } | null;
  totalSyncedOverall: number;
  targetNewestPath: string;
  logs: Array<{ time: string; msg: string; level: 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR' }>;
}

interface HarvesterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HarvesterModal({ isOpen, onClose }: HarvesterModalProps) {
  const [telemetry, setTelemetry] = useState<HarvesterTelemetry | null>(null);
  const [isSyncingManual, setIsSyncingManual] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/harvester/status');
      if (res.ok) {
        const data = await res.json();
        setTelemetry(data);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStatus();
      const timer = setInterval(fetchStatus, 2000);
      return () => clearInterval(timer);
    }
  }, [isOpen]);

  const handleManualSync = async () => {
    setIsSyncingManual(true);
    setSyncMessage('Executing 2-Step Matching from https://pornx.to/newest...');
    try {
      const res = await fetch('/api/harvester/sync-newest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pages: 2 }),
      });
      const data = await res.json();
      if (data.success) {
        setSyncMessage(`2-Step Sync Success! Scraped ${data.newestScrapedIdsCount || 0} newest IDs, saved ${data.newPostsAdded} new videos, ${data.updatedPosts} refreshed.`);
      } else {
        setSyncMessage(`Sync result: ${data.error || 'No new posts found'}`);
      }
      fetchStatus();
    } catch (err: any) {
      setSyncMessage('Failed to send request to harvester service.');
    } finally {
      setIsSyncingManual(false);
      setTimeout(() => setSyncMessage(null), 6000);
    }
  };

  const handleToggleAuto = async () => {
    if (!telemetry) return;
    try {
      const res = await fetch('/api/harvester/toggle-auto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !telemetry.isAutoSyncEnabled, intervalMinutes: 3 }),
      });
      if (res.ok) {
        fetchStatus();
      }
    } catch {
      // ignore
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 animate-fade-in">
      <div className="bg-[#121212] border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-[#181818]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#ff0000]/20 text-[#ff0000] flex items-center justify-center font-bold">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-white flex items-center gap-2">
                2-Step Live Harvester Engine
                <span className={clsx(
                  "text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1",
                  telemetry?.isAutoSyncEnabled
                    ? "bg-emerald-950 text-emerald-400 border border-emerald-800 animate-pulse"
                    : "bg-amber-950 text-amber-300 border border-amber-800"
                )}>
                  <Radio className="w-2.5 h-2.5" />
                  {telemetry?.isAutoSyncEnabled ? 'Auto-Sync Active' : 'Paused'}
                </span>
              </h2>
              <p className="text-[11px] text-[#888888]">
                Two-step matching: Scrapes /newest IDs + WP REST API video hydration
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-[#aaaaaa] hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* Path Target Box */}
          <div className="bg-[#18181b] border border-white/10 p-3 rounded-xl space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[#a1a1aa] font-semibold">Newest Ingestion Path</span>
              <span className="text-[10px] text-emerald-400 font-mono bg-emerald-950/60 border border-emerald-800 px-1.5 py-0.5 rounded">2-Step Protocol Active</span>
            </div>
            <div className="flex items-center gap-2 font-mono text-[12px] text-white bg-black/60 px-2.5 py-1.5 rounded-lg border border-white/5 truncate">
              <span className="text-[#ff4444] font-bold shrink-0">GET</span>
              <span className="truncate">{telemetry?.targetNewestPath || 'https://pornx.to/newest'}</span>
            </div>
            <div className="text-[10.5px] text-[#71717a] flex items-center gap-1">
              <span>Step 1: Scrapes newest IDs</span>
              <span>→</span>
              <span>Step 2: Hydrates real video metadata via WP REST</span>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="bg-[#1a1a1a] border border-white/5 p-3 rounded-xl">
              <div className="flex items-center gap-1.5 text-[#888888] font-medium mb-1">
                <Database className="w-3.5 h-3.5 text-[#ff0000]" /> Total Ingested
              </div>
              <div className="text-[18px] font-extrabold text-white">
                {telemetry?.totalSyncedOverall || 0} <span className="text-[11px] font-normal text-[#888888]">new posts</span>
              </div>
            </div>

            <div className="bg-[#1a1a1a] border border-white/5 p-3 rounded-xl">
              <div className="flex items-center gap-1.5 text-[#888888] font-medium mb-1">
                <Clock className="w-3.5 h-3.5 text-cyan-400" /> Auto-Sync Routine
              </div>
              <div className="text-[14px] font-bold text-[#f1f1f1]">
                Every 3 minutes
              </div>
            </div>
          </div>

          {/* Duplicate Safety Info Box */}
          <div className="bg-emerald-950/30 border border-emerald-800/40 p-3 rounded-xl text-emerald-300 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-[12px] text-emerald-400">
              <CheckCircle2 className="w-4 h-4" /> Zero-Duplicate Database Protection Active
            </div>
            <p className="text-[11px] text-emerald-200/80 leading-relaxed">
              Supabase primary key (<code className="bg-emerald-900/50 px-1 py-0.5 rounded font-mono">id</code>) and <strong>ON CONFLICT UPSERT</strong> guarantee that newly discovered IDs from <code className="bg-emerald-900/50 px-1 py-0.5 rounded font-mono">/newest</code> never duplicate existing entries.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleManualSync}
              disabled={isSyncingManual}
              className="flex-1 bg-[#ff0000] hover:bg-[#cc0000] disabled:bg-[#555555] text-white font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            >
              <RotateCw className={clsx("w-4 h-4", isSyncingManual && "animate-spin")} />
              <span>{isSyncingManual ? 'Syncing /newest...' : 'Sync /newest Path Now'}</span>
            </button>

            <button
              onClick={handleToggleAuto}
              className={clsx(
                "py-2.5 px-4 rounded-xl font-bold flex items-center justify-center gap-1.5 border transition-all",
                telemetry?.isAutoSyncEnabled
                  ? "bg-[#252525] border-white/10 text-amber-300 hover:bg-[#303030]"
                  : "bg-emerald-600 text-white border-transparent hover:bg-emerald-500"
              )}
            >
              {telemetry?.isAutoSyncEnabled ? (
                <>
                  <Pause className="w-3.5 h-3.5" /> Pause
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" /> Enable Auto-Sync
                </>
              )}
            </button>
          </div>

          {/* Sync Message Alert */}
          {syncMessage && (
            <div className="bg-[#222222] border border-white/10 p-2.5 rounded-lg text-center font-medium text-white text-[12px] animate-fade-in">
              {syncMessage}
            </div>
          )}

          {/* Live Ingestion Logs */}
          <div className="space-y-1.5">
            <div className="text-[12px] font-bold text-[#aaaaaa] flex items-center justify-between">
              <span>Live Activity Log</span>
              <span className="font-mono text-[10px] text-[#666666]">Real-Time</span>
            </div>
            <div className="bg-[#0a0a0a] border border-white/5 rounded-xl p-2.5 max-h-44 overflow-y-auto font-mono text-[11px] space-y-1">
              {telemetry?.logs && telemetry.logs.length > 0 ? (
                telemetry.logs.map((log, idx) => (
                  <div
                    key={idx}
                    className={clsx(
                      "flex items-start gap-1.5 leading-snug",
                      log.level === 'SUCCESS' && "text-emerald-400",
                      log.level === 'ERROR' && "text-rose-400",
                      log.level === 'WARN' && "text-amber-300",
                      log.level === 'INFO' && "text-[#aaaaaa]"
                    )}
                  >
                    <span className="text-[#555555] shrink-0">[{log.time}]</span>
                    <span>{log.msg}</span>
                  </div>
                ))
              ) : (
                <div className="text-center py-4 text-[#555555]">No recent activity logs</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
