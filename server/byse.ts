import fetch from 'node-fetch';

const BYSE_API_BASE = 'https://api.byse.sx';

export function getByseApiKey(): string {
  return process.env.BYSE_API_KEY || '';
}

/**
 * Resolves current active embed domain from Byse API (/get/domain)
 * Configured active default: bysewihe.com
 */
export async function fetchByseActiveDomain(apiKey?: string): Promise<{ new_domain: string; old_domain: string }> {
  const key = apiKey || getByseApiKey();
  if (!key) {
    return { new_domain: 'bysewihe.com', old_domain: 'bysewihe.com' };
  }

  try {
    const res = await fetch(`${BYSE_API_BASE}/get/domain?key=${encodeURIComponent(key)}`);
    const data: any = await res.json();
    if (data && data.status === 200) {
      return {
        new_domain: data.new_domain || 'bysewihe.com',
        old_domain: data.old_domain || 'bysewihe.com'
      };
    }
  } catch (err) {
    console.error('[Byse] Failed to fetch domain:', err);
  }
  return { new_domain: 'bysewihe.com', old_domain: 'bysewihe.com' };
}

/**
 * Triggers remote upload for a source video URL (/remote/add) with custom title
 */
export async function addByseRemoteUploadServer(videoUrl: string, title?: string, apiKey?: string): Promise<{ filecode: string }> {
  const key = apiKey || getByseApiKey();
  if (!key) {
    throw new Error('BYSE_API_KEY is not configured in server environment');
  }

  let finalVideoUrl = videoUrl;
  if (title && title.trim()) {
    const separator = finalVideoUrl.includes('?') ? '&' : '?';
    finalVideoUrl = `${finalVideoUrl}${separator}title=${encodeURIComponent(title.trim())}`;
  }

  const url = `${BYSE_API_BASE}/remote/add?key=${encodeURIComponent(key)}&url=${encodeURIComponent(finalVideoUrl)}`;
  const res = await fetch(url);
  const data: any = await res.json();

  if (data && (data.status === 200 || data.msg === 'OK') && data.result?.filecode) {
    return { filecode: data.result.filecode };
  }

  throw new Error(data?.msg || data?.error || 'Failed to queue remote upload on Byse');
}

/**
 * Checks remote upload progress status (/remote/status)
 */
export async function checkByseRemoteStatusServer(filecode: string, apiKey?: string) {
  const key = apiKey || getByseApiKey();
  if (!key) {
    throw new Error('BYSE_API_KEY is not configured in server environment');
  }

  const url = `${BYSE_API_BASE}/remote/status?key=${encodeURIComponent(key)}&file_code=${encodeURIComponent(filecode)}`;
  const res = await fetch(url);
  const data: any = await res.json();

  return data;
}

/**
 * Inspects file info & readiness status (/file/info)
 */
export async function getByseFileInfoServer(filecode: string, apiKey?: string) {
  const key = apiKey || getByseApiKey();
  if (!key) {
    throw new Error('BYSE_API_KEY is not configured in server environment');
  }

  const url = `${BYSE_API_BASE}/file/info?key=${encodeURIComponent(key)}&file_code=${encodeURIComponent(filecode)}`;
  const res = await fetch(url);
  const data: any = await res.json();

  return data;
}
