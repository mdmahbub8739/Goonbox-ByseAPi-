import { supabase } from './supabase';
import { Video } from '../types';
import { Orientation, applyOrientationFilter } from './orientation';

const SEARCH_STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'of', 'from',
  'is', 'it', 'all', 'this', 'that', 'so', 'as'
]);

/**
 * Normalizes any search text by stripping noisy punctuation, hyphens, dots,
 * quotes, underscores, and extra whitespace.
 */
export function normalizeSearchText(text: string): string {
  if (!text) return '';
  return text
    .replace(/[._\-+,/\\#@!?:;()\[\]{}'"`~*&^%$]/g, ' ')
    .toLowerCase()
    .trim();
}

/**
 * Extracts clean searchable keyword tokens from user input.
 * Example: "Look at her now" -> ["look", "at", "her", "now"]
 */
export function cleanSearchTokens(rawQuery: string): string[] {
  if (!rawQuery) return [];
  const normalized = normalizeSearchText(rawQuery);
  return normalized.split(/\s+/).filter(token => token.length > 0);
}

/**
 * Extracts significant keyword tokens (filtering out short boilerplate stopwords).
 */
export function getSignificantTokens(tokens: string[]): string[] {
  const sig = tokens.filter(t => t.length >= 3 && !SEARCH_STOP_WORDS.has(t));
  return sig.length > 0 ? sig : tokens;
}

/**
 * Builds an optimal Supabase ILIKE filter clause for text search across multiple fields.
 * If multiple words are typed, matches them accurately without pulling unrelated content.
 */
export function buildSearchQueryClause(tokens: string[]): string {
  if (!tokens || tokens.length === 0) return '';

  const cleanPhrase = tokens.join(' ');
  const clauses: string[] = [];

  // 1. Exact phrase match across all searchable metadata fields
  clauses.push(`title.ilike.%${cleanPhrase}%`);
  clauses.push(`actor.ilike.%${cleanPhrase}%`);
  clauses.push(`tags.ilike.%${cleanPhrase}%`);
  clauses.push(`categories.ilike.%${cleanPhrase}%`);

  // 2. Sequential multi-word wildcard (e.g. "eva%elfie")
  if (tokens.length > 1) {
    const wildcardPhrase = `%${tokens.join('%')}%`;
    clauses.push(`title.ilike.${wildcardPhrase}`);
    clauses.push(`tags.ilike.${wildcardPhrase}`);
    clauses.push(`actor.ilike.${wildcardPhrase}`);
  }

  // 3. Match the first primary/distinctive search token across title & actor
  const sigTokens = getSignificantTokens(tokens);
  if (sigTokens.length > 0) {
    const primaryToken = sigTokens[0];
    if (primaryToken.length >= 3) {
      clauses.push(`title.ilike.%${primaryToken}%`);
      clauses.push(`actor.ilike.%${primaryToken}%`);
      clauses.push(`tags.ilike.%${primaryToken}%`);
    }
  }

  // Deduplicate and join with comma for Supabase .or()
  return Array.from(new Set(clauses)).join(',');
}

export interface SearchSuggestionsResult {
  videos: Video[];
  tags: string[];
  categories: string[];
  actors: string[];
  querySuggestions: string[];
}

/**
 * Calculates a search relevance match score for ranking search results accurately
 */
export function scoreVideoForQuery(video: Video, query: string, tokens: string[]): number {
  if (!video) return 0;
  const normQuery = normalizeSearchText(query);
  const title = (video.title || '').toLowerCase();
  const actor = (video.actor || '').toLowerCase();
  const tags = (video.tags || '').toLowerCase();
  const cats = (video.categories || '').toLowerCase();
  const fullMeta = `${title} ${actor} ${tags} ${cats}`;

  let score = 0;

  // Exact phrase matches rank highest
  if (title.includes(normQuery)) {
    score += 600;
  } else if (actor.includes(normQuery)) {
    score += 500;
  } else if (tags.includes(normQuery) || cats.includes(normQuery)) {
    score += 300;
  } else if (fullMeta.includes(normQuery)) {
    score += 200;
  }

  // Check token coverage
  const sigTokens = getSignificantTokens(tokens);
  let matchedSigCount = 0;
  for (const t of sigTokens) {
    if (title.includes(t)) {
      score += 120;
      matchedSigCount++;
    } else if (actor.includes(t)) {
      score += 100;
      matchedSigCount++;
    } else if (tags.includes(t)) {
      score += 60;
      matchedSigCount++;
    } else if (cats.includes(t)) {
      score += 40;
      matchedSigCount++;
    }
  }

  // Substantial bonus if all search tokens match
  if (sigTokens.length > 0 && matchedSigCount === sigTokens.length) {
    score += 250;
  }

  // Modest view count boost for high quality matches
  const views = (video.real_views || 0) + (video.base_views || 0);
  if (views > 10000) score += 10;

  return score;
}

/**
 * Fast database-optimized live suggestion generator.
 */
export async function fetchLiveSearchSuggestions(
  rawQuery: string,
  orientation: Orientation = 'all'
): Promise<SearchSuggestionsResult> {
  const tokens = cleanSearchTokens(rawQuery);
  if (tokens.length === 0) {
    return {
      videos: [],
      tags: [],
      categories: [],
      actors: [],
      querySuggestions: [],
    };
  }

  const clause = buildSearchQueryClause(tokens);
  let query = supabase
    .from('videos')
    .select('id, title, poster, duration_sec, actor, categories, tags, base_views, real_views, created_at, published_date')
    .or(clause);

  query = applyOrientationFilter(query, orientation);
  query = query.order('id', { ascending: false }).limit(20);

  let { data } = await query;

  if (!data || data.length === 0) {
    return {
      videos: [],
      tags: [],
      categories: [],
      actors: [],
      querySuggestions: [],
    };
  }

  const rawVideos = data as Video[];
  rawVideos.sort((a, b) => scoreVideoForQuery(b, rawQuery, tokens) - scoreVideoForQuery(a, rawQuery, tokens));

  const matchedCategories = new Set<string>();
  const matchedTags = new Set<string>();
  const matchedActors = new Set<string>();
  const querySuggestionsSet = new Set<string>();

  for (const v of rawVideos) {
    if (v.actor && v.actor.trim() && v.actor.trim() !== 'N/A' && v.actor.toLowerCase() !== 'unknown') {
      matchedActors.add(v.actor.trim());
    }

    if (v.categories) {
      v.categories.split(/[,/|;]+/).forEach(c => {
        const clean = c.trim();
        if (clean && clean.toLowerCase() !== 'n/a' && clean.length > 2) {
          const normCat = clean.toLowerCase();
          if (tokens.some(t => normCat.includes(t))) {
            matchedCategories.add(clean);
          }
        }
      });
    }

    if (v.tags) {
      v.tags.split(/[,/|;]+/).forEach(t => {
        const clean = t.replace(/^#/, '').trim();
        if (clean && clean.toLowerCase() !== 'n/a' && clean.length > 2) {
          const normTag = clean.toLowerCase();
          if (tokens.some(tok => normTag.includes(tok))) {
            matchedTags.add(clean);
          }
        }
      });
    }

    if (v.title) {
      const cleanTitle = v.title.replace(/&#\d+;|&amp;|&quot;/g, '').trim();
      querySuggestionsSet.add(cleanTitle);
    }
  }

  return {
    videos: rawVideos.slice(0, 8),
    tags: Array.from(matchedTags).slice(0, 6),
    categories: Array.from(matchedCategories).slice(0, 5),
    actors: Array.from(matchedActors).slice(0, 4),
    querySuggestions: Array.from(querySuggestionsSet).slice(0, 4),
  };
}
