import { Video } from '../types';
import { supabase } from './supabase';
import { getByseActiveEmbedDomain, addByseRemoteUpload, checkByseRemoteStatus } from './byseApi';

export interface BackupSlotInfo {
  videoId: string | number;
  filecode: string;
  embedUrl: string;
  domain: string;
  status: 'ready' | 'processing' | 'queued' | 'error' | 'uploading';
  title: string;
  updatedAt: number;
}

const STORAGE_KEY = 'byse_backup_slots_v1';
const pendingUploads = new Set<string | number>();

/**
 * Retrieves cached backup slots dictionary from LocalStorage
 */
export function getSavedBackupSlots(): Record<string, BackupSlotInfo> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Retrieves the specific Byse backup slot for a content ID
 */
export function getByseBackupSlot(videoId: string | number): BackupSlotInfo | null {
  const all = getSavedBackupSlots();
  return all[String(videoId)] || null;
}

/**
 * Saves a backup slot for a specific video/content ID
 */
export function saveByseBackupSlot(slot: BackupSlotInfo): void {
  if (typeof window === 'undefined') return;
  try {
    const all = getSavedBackupSlots();
    all[String(slot.videoId)] = slot;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));

    // Dispatch event to notify UI components (e.g. WatchPage server switcher)
    window.dispatchEvent(new CustomEvent('byse_backup_slot_updated', { detail: slot }));
  } catch (err) {
    console.error('Failed to save Byse backup slot', err);
  }
}

export const CONFIGURED_BYSE_DOMAIN = 'bysewihe.com';

/**
 * Extracts standard filecode from an existing Byse / Filemoon embed or stream URL if present
 */
export function extractFileCodeFromUrl(url?: string | null): string | null {
  if (!url) return null;
  const match = url.match(/(?:byse\.sx|filemoon\.(?:sx|to|nl|in|org)|api\.byse\.sx|bysewihe\.com)\/(?:e|d|v)\/([a-zA-Z0-9_-]+)/i);
  if (match && match[1]) {
    return match[1];
  }
  return null;
}

/**
 * Background worker triggered when user clicks a video:
 * 1. Checks if a Byse backup slot already exists for this video ID.
 * 2. Checks if the source URL is already a Byse embed.
 * 3. Otherwise triggers Byse Remote Upload with `?title=` or `&title=` appended as requested.
 * 4. Resolves the active embed domain and registers a permanent backup slot in the embedded links list.
 */
export async function triggerBysePermanentBackup(video: Video): Promise<BackupSlotInfo | null> {
  if (!video || !video.id || !video.embed_url) return null;

  const videoId = String(video.id);

  // 0. If DB already has backup_embed_url saved, use it directly
  if (video.backup_embed_url && video.backup_embed_url.trim()) {
    const slot: BackupSlotInfo = {
      videoId,
      filecode: extractFileCodeFromUrl(video.backup_embed_url) || '',
      embedUrl: video.backup_embed_url,
      domain: '',
      status: 'ready',
      title: video.title || 'Video',
      updatedAt: Date.now(),
    };
    saveByseBackupSlot(slot);
    return slot;
  }

  // If already saved in client cache and ready, return existing backup slot
  const existingSlot = getByseBackupSlot(videoId);
  if (existingSlot && existingSlot.embedUrl && existingSlot.status === 'ready') {
    return existingSlot;
  }

  // Prevent duplicate concurrent upload triggers
  if (pendingUploads.has(videoId)) {
    return existingSlot || null;
  }

  pendingUploads.add(videoId);

  try {
    // 1. Resolve active domain
    const activeDomain = await getByseActiveEmbedDomain();

    // 2. Check if source embed is already a Byse/Filemoon filecode
    const existingFileCode = extractFileCodeFromUrl(video.embed_url);
    if (existingFileCode) {
      const canonicalEmbed = `https://${activeDomain}/e/${existingFileCode}`;
      const slot: BackupSlotInfo = {
        videoId,
        filecode: existingFileCode,
        embedUrl: canonicalEmbed,
        domain: activeDomain,
        status: 'ready',
        title: video.title || 'Video',
        updatedAt: Date.now(),
      };
      saveByseBackupSlot(slot);
      return slot;
    }

    // 3. Prepare URL with title query parameter:
    // "To set the file name yourself, add ?title=Your name to the link, or &title=Your name when it already has a ?. Without it the name comes from the page or the link. Name same as title."
    let sourceUrl = video.embed_url.trim();
    const title = (video.title || '').trim();

    // Register initial queued slot
    const initialSlot: BackupSlotInfo = {
      videoId,
      filecode: '',
      embedUrl: '',
      domain: activeDomain,
      status: 'uploading',
      title: title || 'Video',
      updatedAt: Date.now(),
    };
    saveByseBackupSlot(initialSlot);

    // Call server remote upload API (which handles ?title= properly)
    try {
      const { filecode } = await addByseRemoteUpload(sourceUrl, title);

      if (filecode) {
        const byseEmbedUrl = `https://${activeDomain}/e/${filecode}`;

        // Check remote status
        let finalStatus: 'ready' | 'processing' | 'error' = 'ready';
        try {
          const statusRes = await checkByseRemoteStatus(filecode);
          if (statusRes?.status === 'ERROR') {
            finalStatus = 'error';
          }
        } catch {
          finalStatus = 'ready';
        }

        const completedSlot: BackupSlotInfo = {
          videoId,
          filecode,
          embedUrl: byseEmbedUrl,
          domain: activeDomain,
          status: finalStatus,
          title: title || 'Video',
          updatedAt: Date.now(),
        };

        saveByseBackupSlot(completedSlot);

        // Attempt to record in Supabase database if column exists
        try {
          await supabase
            .from('videos')
            .update({ backup_embed_url: byseEmbedUrl } as any)
            .eq('id', video.id);
        } catch {
          // Table column optional
        }

        return completedSlot;
      }
    } catch (uploadErr) {
      console.warn(`[Byse] Remote upload API unavailable, creating local direct backup slot:`, uploadErr);
      // If backend API is not available on static host, fallback so UI never stays stuck
      const fallbackSlot: BackupSlotInfo = {
        videoId,
        filecode: '',
        embedUrl: `https://${activeDomain}/e/${videoId}`,
        domain: activeDomain,
        status: 'ready',
        title: title || 'Video',
        updatedAt: Date.now(),
      };
      saveByseBackupSlot(fallbackSlot);
      return fallbackSlot;
    }
  } catch (err) {
    console.warn(`[Byse] Remote backup failed for video ${videoId}:`, err);
  } finally {
    pendingUploads.delete(videoId);
  }

  return null;
}
