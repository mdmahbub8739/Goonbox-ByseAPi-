import { supabase } from './supabase';

export interface ByseRemoteUploadStatus {
  url?: string;
  progress?: string;
  status?: string;
  created?: string;
  updated?: string;
  error_msg?: string;
}

export interface ByseDomainResult {
  old_domain?: string;
  new_domain?: string;
  status?: number;
  server_time?: string;
}

export interface ByseUploadResult {
  filecode: string;
  embed_url?: string;
  status?: string;
}

/**
 * Client helper to interface with Byse API proxy endpoints on our Express backend.
 */
export async function getByseActiveEmbedDomain(): Promise<string> {
  try {
    const res = await fetch('/api/byse/domain');
    if (!res.ok) throw new Error(`Failed to fetch domain: ${res.statusText}`);
    const data: ByseDomainResult = await res.json();
    return data.new_domain || data.old_domain || 'bysewihe.com';
  } catch (err) {
    console.warn('Using fallback Byse embed domain', err);
    return 'bysewihe.com';
  }
}

export async function addByseRemoteUpload(videoUrl: string, title?: string): Promise<{ filecode: string }> {
  const res = await fetch('/api/byse/remote/add', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: videoUrl, title }),
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error || 'Failed to submit remote upload');
  }
  return { filecode: data.filecode || data.result?.filecode };
}

export async function checkByseRemoteStatus(filecode: string): Promise<ByseRemoteUploadStatus> {
  const res = await fetch(`/api/byse/remote/status?filecode=${encodeURIComponent(filecode)}`);
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error || 'Failed to check remote upload status');
  }
  return data.result || data;
}

export async function getByseFileInfo(filecode: string) {
  const res = await fetch(`/api/byse/file/info?filecode=${encodeURIComponent(filecode)}`);
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error || 'Failed to get file info');
  }
  return data.result?.[0] || data.result;
}
