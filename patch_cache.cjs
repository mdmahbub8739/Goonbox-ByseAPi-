const fs = require('fs');
let file = fs.readFileSync('src/lib/mlRecommender.ts', 'utf8');

file = file.replace(
  "let CANDIDATE_POOL_CACHE: Video[] | null = null;",
  "let CANDIDATE_POOL_CACHE: Video[] | null = null;\nlet CURRENT_POOL_ORIENTATION: string | null = null;"
);

file = file.replace(
  "if (!forceRefresh && CANDIDATE_POOL_CACHE && (now - CANDIDATE_POOL_CACHE_TIME) < CANDIDATE_CACHE_TTL_MS) {",
  "if (!forceRefresh && CANDIDATE_POOL_CACHE && CURRENT_POOL_ORIENTATION === orientation && (now - CANDIDATE_POOL_CACHE_TIME) < CANDIDATE_CACHE_TTL_MS) {"
);

file = file.replace(
  "    CANDIDATE_POOL_CACHE = data;\n    CANDIDATE_POOL_CACHE_TIME = now;\n    return rankVideosByRelevance(CANDIDATE_POOL_CACHE);",
  "    CANDIDATE_POOL_CACHE = data;\n    CANDIDATE_POOL_CACHE_TIME = now;\n    CURRENT_POOL_ORIENTATION = orientation;\n    return rankVideosByRelevance(CANDIDATE_POOL_CACHE);"
);

fs.writeFileSync('src/lib/mlRecommender.ts', file);
