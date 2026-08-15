import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { CategoryItem, TagItem } from '../types';
import { sanitizeImageUrl, resolveThumbnailUrl } from './utils';

interface CachedData {
  categories: string[];
  categoryItems: CategoryItem[];
  tags: string[];
  tagItems: TagItem[];
}

let cachedData: CachedData | null = null;
let fetchPromise: Promise<CachedData> | null = null;

function sanitizeName(raw: string | null | undefined): string {
  if (!raw || typeof raw !== 'string') return '';
  const s = raw.trim()
    .replace(/&amp;/g, '&')
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#8211;/g, '-')
    .replace(/^[-_.,;:#\s]+|[-_.,;:#\s]+$/g, '');

  if (s.length < 2 || s.length > 35) return '';
  if (/^https?:\/\//i.test(s) || s.includes('www.') || s.includes('.com') || s.includes('.net')) return '';
  if (/^\d+p?$/i.test(s)) return ''; // Filter out 1080p, 720p, pure numbers
  if (/^(n\/a|null|undefined|video|videos|porn|xxx|hd|free|full|clip|movie|trailer|unknown)$/i.test(s)) return '';

  return s.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

export async function fetchDynamicCategoriesAndTags(): Promise<CachedData> {
  if (cachedData) {
    return cachedData;
  }

  if (fetchPromise) {
    return fetchPromise;
  }

  fetchPromise = (async () => {
    const categoryMap = new Map<string, { poster: string; count: number }>();
    const tagMap = new Map<string, { poster: string; count: number }>();

    try {
      // Fetch sample of videos to extract real categories and tags with valid posters
      const { data: videoData, error: videoError } = await supabase
        .from('videos')
        .select('title, categories, tags, poster, embed_url')
        .order('id', { ascending: false })
        .limit(1000);

      if (!videoError && videoData && videoData.length > 0) {
        for (const v of videoData) {
          const resolved = resolveThumbnailUrl(v.poster, v.embed_url, v.title);
          const posterUrl = resolved.primary || '';

          // Process categories
          if (v.categories && typeof v.categories === 'string') {
            const parts = v.categories.split(/[,/|;]+/).map((s: string) => s.trim());
            for (const part of parts) {
              const clean = sanitizeName(part);
              if (clean) {
                const existing = categoryMap.get(clean);
                if (existing) {
                  existing.count += 1;
                  if (!existing.poster && posterUrl) {
                    existing.poster = posterUrl;
                  }
                } else {
                  categoryMap.set(clean, {
                    poster: posterUrl,
                    count: 1
                  });
                }
              }
            }
          }

          // Process tags
          if (v.tags && typeof v.tags === 'string') {
            const tagParts = v.tags.split(/[,/|;]+/).map((s: string) => s.trim());
            for (const tag of tagParts) {
              const cleanTag = sanitizeName(tag.replace(/^#/, ''));
              if (cleanTag) {
                const existing = tagMap.get(cleanTag);
                if (existing) {
                  existing.count += 1;
                  if (!existing.poster && posterUrl) {
                    existing.poster = posterUrl;
                  }
                } else {
                  tagMap.set(cleanTag, {
                    poster: posterUrl,
                    count: 1
                  });
                }
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn('Safe category extraction notice:', e);
    }

    const sampleMultiplier = 540; // Scale from sample to database volume (~540k videos)

    const categoryItems: CategoryItem[] = Array.from(categoryMap.entries())
      .filter(([_, info]) => info.count >= 1)
      .map(([name, info]) => ({
        name,
        poster: info.poster || '',
        count: Math.round(info.count * sampleMultiplier)
      }))
      .sort((a, b) => (b.count || 0) - (a.count || 0) || a.name.localeCompare(b.name));

    const categories = categoryItems.map(c => c.name);

    const tagItems: TagItem[] = Array.from(tagMap.entries())
      .filter(([_, info]) => info.count >= 1)
      .map(([name, info]) => ({
        name,
        poster: info.poster || '',
        count: Math.round(info.count * sampleMultiplier)
      }))
      .sort((a, b) => (b.count || 0) - (a.count || 0) || a.name.localeCompare(b.name));

    const tags = tagItems.map(t => t.name);

    const result: CachedData = {
      categories,
      categoryItems,
      tags,
      tagItems
    };

    cachedData = result;
    return result;
  })();

  return fetchPromise;
}


export function useCategories() {
  const [data, setData] = useState<CachedData>(cachedData || {
    categories: [],
    categoryItems: [],
    tags: [],
    tagItems: []
  });
  const [loading, setLoading] = useState<boolean>(!cachedData);

  useEffect(() => {
    let isMounted = true;
    fetchDynamicCategoriesAndTags().then((res) => {
      if (isMounted) {
        setData(res);
        setLoading(false);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  return {
    categories: data.categories,
    categoryItems: data.categoryItems,
    tags: data.tags,
    tagItems: data.tagItems,
    loading
  };
}

