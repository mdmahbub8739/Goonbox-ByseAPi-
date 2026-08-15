import { useEffect, useRef, useCallback } from 'react';
import { Video } from '../types';
import { recordWatchProgress, recordWatchHistory, invalidateProfileCache } from './userHistory';
import { eventBuffer } from './eventBuffer';

export interface WatchProgressState {
  videoId: string | number;
  progressSec: number;
  durationSec: number;
  completionPercentage: number;
  isCompleted: boolean;
}

const TASTE_UPDATE_EVENT = 'pv_taste_profile_updated';

export function emitTasteProfileUpdated(detail?: Partial<WatchProgressState>): void {
  if (typeof window === 'undefined') return;
  invalidateProfileCache();
  window.dispatchEvent(new CustomEvent(TASTE_UPDATE_EVENT, { detail }));
}

export function subscribeToTasteProfileUpdates(callback: (detail?: WatchProgressState) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = (e: Event) => {
    const customEvent = e as CustomEvent<WatchProgressState>;
    callback(customEvent.detail);
  };
  window.addEventListener(TASTE_UPDATE_EVENT, handler);
  return () => {
    window.removeEventListener(TASTE_UPDATE_EVENT, handler);
  };
}

/**
 * Enhanced watch progress hook supporting Byse `byse-progress` postMessage events,
 * standard player.js events, and active viewing ticker.
 */
export function useWatchProgressTracker(video: Video | null) {
  const progressRef = useRef<number>(0);
  const durationRef = useRef<number>(0);
  const lastLoggedSecRef = useRef<number>(0);
  const milestonesReachedRef = useRef<Set<number>>(new Set());
  const activeTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!video || !video.id) return;
    
    const initialDuration = video.duration_sec || 600;
    durationRef.current = initialDuration;
    progressRef.current = 0;
    lastLoggedSecRef.current = 0;
    milestonesReachedRef.current.clear();

    recordWatchHistory(video, 0, initialDuration);
    eventBuffer.recordView(video.id);
    emitTasteProfileUpdated({ videoId: video.id, progressSec: 0, durationSec: initialDuration, completionPercentage: 0, isCompleted: false });

    // Handle iframe message events (Byse player progress and standard HTML5 player messages)
    const handleMessage = (event: MessageEvent) => {
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (!data) return;

        // 1. Byse Player Official Event (type === 'byse-progress')
        if (data.type === 'byse-progress') {
          const timestamp = typeof data.timestamp === 'number' ? data.timestamp : parseFloat(data.timestamp);
          const duration = typeof data.duration === 'number' ? data.duration : parseFloat(data.duration);
          
          if (!isNaN(duration) && duration > 0) {
            durationRef.current = duration;
          }
          if (!isNaN(timestamp) && timestamp >= 0) {
            progressRef.current = timestamp;
            checkAndFlushProgress(video);
          }
          return;
        }

        // 2. Generic player timeupdate format support (Player.js, YouTube, Vimeo)
        const currentTime = data.currentTime || data.seconds || data.progress || (data.info && data.info.currentTime);
        const duration = data.duration || (data.info && data.info.duration);

        if (typeof duration === 'number' && duration > 0) {
          durationRef.current = duration;
        }

        if (typeof currentTime === 'number' && currentTime > 0) {
          progressRef.current = Math.max(progressRef.current, currentTime);
          checkAndFlushProgress(video);
        }
      } catch {
        // Non-JSON iframe message; safely ignore
      }
    };

    window.addEventListener('message', handleMessage);

    // Active viewing heartbeat ticker
    activeTimerRef.current = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        progressRef.current += 1;
        checkAndFlushProgress(video);
      }
    }, 1000);

    return () => {
      window.removeEventListener('message', handleMessage);
      if (activeTimerRef.current) {
        clearInterval(activeTimerRef.current);
        activeTimerRef.current = null;
      }
      flushFinalProgress(video);
    };
  }, [video?.id]);

  const checkAndFlushProgress = useCallback((currentVideo: Video) => {
    const elapsed = progressRef.current;
    const duration = durationRef.current || currentVideo.duration_sec || 600;
    const completionRate = duration > 0 ? elapsed / duration : 0;
    const completionPercentage = Math.min(100, Math.round(completionRate * 100));

    const milestones = [25, 50, 75, 90, 100];
    let hitNewMilestone = false;
    for (const m of milestones) {
      if (completionPercentage >= m && !milestonesReachedRef.current.has(m)) {
        milestonesReachedRef.current.add(m);
        hitNewMilestone = true;
      }
    }

    if (hitNewMilestone || elapsed - lastLoggedSecRef.current >= 5) {
      lastLoggedSecRef.current = elapsed;
      recordWatchProgress(currentVideo, elapsed, duration);
      emitTasteProfileUpdated({
        videoId: currentVideo.id,
        progressSec: elapsed,
        durationSec: duration,
        completionPercentage,
        isCompleted: completionPercentage >= 90,
      });
    }
  }, []);

  const flushFinalProgress = useCallback((currentVideo: Video) => {
    const elapsed = progressRef.current;
    const duration = durationRef.current || currentVideo.duration_sec || 600;
    if (elapsed > 0) {
      recordWatchProgress(currentVideo, elapsed, duration);
      const completionPercentage = Math.min(100, Math.round((elapsed / duration) * 100));
      emitTasteProfileUpdated({
        videoId: currentVideo.id,
        progressSec: elapsed,
        durationSec: duration,
        completionPercentage,
        isCompleted: completionPercentage >= 90,
      });
    }
  }, []);

  return {
    getCurrentProgress: () => ({
      progressSec: progressRef.current,
      durationSec: durationRef.current,
      completionPercentage: durationRef.current > 0 ? Math.min(100, Math.round((progressRef.current / durationRef.current) * 100)) : 0
    })
  };
}
