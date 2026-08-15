export type Orientation = 'all' | 'straight' | 'gay' | 'trans';

export interface OrientationOption {
  id: Orientation;
  label: string;
  badge?: string;
}

export const ORIENTATION_OPTIONS: OrientationOption[] = [
  { id: 'all', label: 'All' },
  { id: 'straight', label: 'Straight' },
  { id: 'gay', label: 'Gay' },
  { id: 'trans', label: 'Trans' },
];

export const TRANS_REGEX = /\b(trans|transgender|transsexual|trans-sexual|shemale|she-male|ladyboy|lady\s*boy|tgirl|t-girl|crossdress|crossdresser|cross-dresser|sissy|futanari|dickgirl|trap|tranny|transwoman|trans\s*woman|trans\s*female|trans\s*girl|mtf|ts)\b/i;
export const GAY_REGEX = /\b(gay|twink|bear|male\s*male|male-male|boy\s*on\s*boy|man\s*on\s*man|men\s*on\s*men|gay\s*sex|gay\s*porn|yaoi|bara|homo|bl|boys\s*love)\b/i;

export const EXCLUDED_STRAIGHT_KEYWORDS = [
  'gay',
  'trans',
  'transgender',
  'transsexual',
  'shemale',
  'ladyboy',
  'twink',
  'tgirl',
  'crossdress',
  'crossdresser',
  'sissy',
  'futanari',
  'tranny',
  'dickgirl',
  'yaoi',
  'bara',
  'homo',
  'male male',
  'boy on boy',
  'man on man',
  'boys love',
  'transwoman',
  'mtf'
];

/**
 * Checks in-memory if a video item matches the selected orientation
 */
export function isMatchingOrientation(
  video: { title?: string | null; categories?: string | null; tags?: string | null; actor?: string | null },
  orientation: Orientation
): boolean {
  if (!orientation || orientation === 'all') return true;

  const text = `${video.title || ''} ${video.categories || ''} ${video.tags || ''} ${video.actor || ''}`.toLowerCase();

  const isTrans = TRANS_REGEX.test(text);
  const isGay = GAY_REGEX.test(text);

  if (orientation === 'trans') {
    return isTrans;
  }

  if (orientation === 'gay') {
    return isGay;
  }

  if (orientation === 'straight') {
    if (isTrans || isGay) return false;
    // Extra safety keyword check
    return !EXCLUDED_STRAIGHT_KEYWORDS.some(kw => text.includes(kw));
  }

  return true;
}

/**
 * Applies strict, robust orientation filters to Supabase query builder
 * Tells the database to strictly exclude gay or trans keywords across categories, tags, and titles when straight is active
 */
export function applyOrientationFilter(query: any, orientation: Orientation) {
  if (!orientation || orientation === 'all') {
    return query;
  }

  if (orientation === 'trans') {
    return query.or(
      'categories.ilike.%trans%,' +
      'tags.ilike.%trans%,' +
      'title.ilike.%trans%,' +
      'categories.ilike.%transgender%,' +
      'categories.ilike.%shemale%,' +
      'tags.ilike.%shemale%,' +
      'categories.ilike.%ladyboy%,' +
      'categories.ilike.%tgirl%,' +
      'tags.ilike.%tgirl%,' +
      'categories.ilike.%crossdress%'
    );
  }

  if (orientation === 'gay') {
    return query.or(
      'categories.ilike.%gay%,' +
      'tags.ilike.%gay%,' +
      'title.ilike.%gay%,' +
      'categories.ilike.%twink%,' +
      'tags.ilike.%twink%,' +
      'categories.ilike.%bear%,' +
      'categories.ilike.%male male%,' +
      'categories.ilike.%yaoi%'
    );
  }

  if (orientation === 'straight') {
    let filteredQuery = query;
    const dbExcludeWords = [
      'gay',
      'trans',
      'transgender',
      'shemale',
      'ladyboy',
      'twink',
      'tgirl',
      'crossdress',
      'sissy',
      'futanari',
      'tranny',
      'yaoi',
      'male male',
      'boy on boy'
    ];

    for (const kw of dbExcludeWords) {
      filteredQuery = filteredQuery
        .not('categories', 'ilike', `%${kw}%`)
        .not('tags', 'ilike', `%${kw}%`)
        .not('title', 'ilike', `%${kw}%`);
    }

    return filteredQuery;
  }

  return query;
}
