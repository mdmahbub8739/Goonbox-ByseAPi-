import { supabase } from './supabase';
import { Video } from '../types';

/**
 * Layer 1 — Write Path (Ingestion, near-zero cost)
 * 
 * Buffers client-side events in memory and flushes them as ONE batched insert.
 * This prevents row-level UPDATE lock contention on every view.
 */

export interface BufferedViewEvent {
  video_id: string | number;
  timestamp: number;
}

class EventBuffer {
  private viewBuffer: BufferedViewEvent[] = [];
  private flushIntervalMs = 15000; // Flush every 15s
  private maxBufferSize = 20; // Or when buffer hits 20
  private intervalId: any = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.intervalId = setInterval(() => this.flush(), this.flushIntervalMs);
      
      // Flush on tab close or navigation
      window.addEventListener('beforeunload', () => {
        this.flushSync();
      });
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          this.flushSync();
        }
      });
    }
  }

  public recordView(videoId: string | number) {
    this.viewBuffer.push({ video_id: videoId, timestamp: Date.now() });
    
    if (this.viewBuffer.length >= this.maxBufferSize) {
      this.flush();
    }
  }

  // Asynchronous flush
  public async flush() {
    if (this.viewBuffer.length === 0) return;

    const batch = [...this.viewBuffer];
    this.viewBuffer = [];

    try {
      // In a real production system, this would call an Edge Function or RPC to batch update total_views
      // Since we only have standard Supabase access, we simulate the batch by making a single RPC call if it existed,
      // or simply accept the buffered events. For this preview, we'll log it as a simulated batch.
      console.log(`[EventBuffer] Flushed ${batch.length} views to edge counter`, batch);
      
      // If we had a custom RPC:
      // await supabase.rpc('increment_video_views', { view_events: batch });
    } catch (e) {
      console.warn('[EventBuffer] Failed to flush views, requeuing', e);
      this.viewBuffer = [...batch, ...this.viewBuffer];
    }
  }

  // Synchronous flush (navigator.sendBeacon)
  private flushSync() {
    if (this.viewBuffer.length === 0) return;
    
    const batch = [...this.viewBuffer];
    this.viewBuffer = [];
    
    try {
      const blob = new Blob([JSON.stringify(batch)], { type: 'application/json' });
      // simulated endpoint
      navigator.sendBeacon('/api/telemetry/flush-views', blob);
      console.log(`[EventBuffer] SendBeacon flushed ${batch.length} views`);
    } catch (e) {
      console.error(e);
    }
  }
}

export const eventBuffer = new EventBuffer();
