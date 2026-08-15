const fs = require('fs');
let file = fs.readFileSync('src/lib/mlRecommender.ts', 'utf8');

file = file.replace(
  "import { supabase } from './supabase';",
  "import { supabase } from './supabase';\nimport { Orientation, applyOrientationFilter, isMatchingOrientation } from './orientation';"
);

file = file.replace(
  "export async function getPersonalizedFeed(forceRefresh = false): Promise<RecommendationScoreResult[]> {",
  "export async function getPersonalizedFeed(forceRefresh = false, orientation: Orientation = 'all'): Promise<RecommendationScoreResult[]> {"
);

file = file.replace(
  "    if (!forceRefresh && CANDIDATE_POOL_CACHE && (now - CANDIDATE_POOL_CACHE_TIME) < CANDIDATE_CACHE_TTL_MS) {",
  "    if (!forceRefresh && CANDIDATE_POOL_CACHE && (now - CANDIDATE_POOL_CACHE_TIME) < CANDIDATE_CACHE_TTL_MS) {\n      const cachedFiltered = CANDIDATE_POOL_CACHE.filter(v => isMatchingOrientation(v, orientation));\n      return rankVideosByRelevance(cachedFiltered);"
);

file = file.replace(
  "    return rankVideosByRelevance(CANDIDATE_POOL_CACHE);",
  "    // Replace in-memory return" // Placeholder to avoid multiple replacements
);

let fetchQueryTrending = `      applyOrientationFilter(
        supabase
          .from('videos')
          .select('*')
          .order('total_views', { ascending: false })
          .limit(150),
        orientation
      )`;

let fetchQueryRecent = `      applyOrientationFilter(
        supabase
          .from('videos')
          .select('*')
          .order('id', { ascending: false })
          .limit(300),
        orientation
      )`;

file = file.replace(
  "      supabase\n        .from('videos')\n        .select('*')\n        .order('total_views', { ascending: false })\n        .limit(150),",
  fetchQueryTrending + ","
);

file = file.replace(
  "      supabase\n        .from('videos')\n        .select('*')\n        .order('id', { ascending: false })\n        .limit(300)",
  fetchQueryRecent
);

file = file.replace(
  "    CANDIDATE_POOL_CACHE = data;\n    CANDIDATE_POOL_CACHE_TIME = now;\n    return rankVideosByRelevance(CANDIDATE_POOL_CACHE);",
  "    CANDIDATE_POOL_CACHE = data;\n    CANDIDATE_POOL_CACHE_TIME = now;\n    const validData = data.filter(v => isMatchingOrientation(v, orientation));\n    return rankVideosByRelevance(validData);"
);

file = file.replace(
  "      if (CANDIDATE_POOL_CACHE) {\n        return rankVideosByRelevance(CANDIDATE_POOL_CACHE);\n      }",
  "      if (CANDIDATE_POOL_CACHE) {\n        const validCached = CANDIDATE_POOL_CACHE.filter(v => isMatchingOrientation(v, orientation));\n        return rankVideosByRelevance(validCached);\n      }"
);

file = file.replace(
  "    if (CANDIDATE_POOL_CACHE) {\n      return rankVideosByRelevance(CANDIDATE_POOL_CACHE);\n    }",
  "    if (CANDIDATE_POOL_CACHE) {\n      const validCachedFallback = CANDIDATE_POOL_CACHE.filter(v => isMatchingOrientation(v, orientation));\n      return rankVideosByRelevance(validCachedFallback);\n    }"
);

fs.writeFileSync('src/lib/mlRecommender.ts', file);
