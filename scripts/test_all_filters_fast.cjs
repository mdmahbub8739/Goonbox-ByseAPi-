const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://cvflardlfqpkbplyuzzk.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2ZmxhcmRsZnFwa2JwbHl1enprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3MDE2NTIsImV4cCI6MjEwMjI3NzY1Mn0.vNDS24T81vg0RljSGKqFJh2FtKD4dPSe8rB5lt05Rhs";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function applyOrientationFilter(query, orientation) {
  if (!orientation || orientation === 'all') return query;

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
    return query
      .not('categories', 'ilike', '%gay%')
      .not('categories', 'ilike', '%trans%')
      .not('categories', 'ilike', '%shemale%')
      .not('categories', 'ilike', '%twink%')
      .not('categories', 'ilike', '%ladyboy%')
      .not('categories', 'ilike', '%crossdress%');
  }

  return query;
}

function getTimeFilterDate(timeFilter) {
  if (timeFilter === 'all') return null;
  const now = new Date();
  if (timeFilter === 'today') {
    const past = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    return past.toISOString().split('T')[0];
  }
  if (timeFilter === 'week') {
    const past = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);
    return past.toISOString().split('T')[0];
  }
  if (timeFilter === 'month') {
    const past = new Date(now.getTime() - 32 * 24 * 60 * 60 * 1000);
    return past.toISOString().split('T')[0];
  }
  if (timeFilter === 'year') {
    const past = new Date(now.getTime() - 366 * 24 * 60 * 60 * 1000);
    return past.toISOString().split('T')[0];
  }
  return null;
}

function applyTimeAndDurationFilter(query, timeFilter = 'all', durationFilter = 'all') {
  const startDate = getTimeFilterDate(timeFilter);
  if (startDate) {
    query = query.gte('published_date', startDate);
  }

  if (durationFilter === 'short') {
    query = query.gt('duration_sec', 0).lte('duration_sec', 600);
  } else if (durationFilter === 'medium') {
    query = query.gt('duration_sec', 600).lte('duration_sec', 1800);
  } else if (durationFilter === 'long') {
    query = query.gt('duration_sec', 1800);
  }

  return query;
}

function cleanSearchTokens(str) {
  if (!str) return [];
  return str
    .toLowerCase()
    .replace(/[._\-+,/\\#@!?:;()\[\]{}'"`]/g, ' ')
    .split(/\s+/)
    .map(t => t.trim())
    .filter(t => t.length > 0);
}

function buildSearchQueryClause(tokens) {
  if (!tokens || tokens.length === 0) return '';
  if (tokens.length === 1) {
    const t = tokens[0];
    return `title.ilike.%${t}%,actor.ilike.%${t}%,tags.ilike.%${t}%,categories.ilike.%${t}%`;
  }
  const wildcardPhrase = `%${tokens.join('%')}%`;
  const spacePhrase = `%${tokens.join(' ')}%`;
  const firstWord = `%${tokens[0]}%`;
  return `title.ilike.${wildcardPhrase},title.ilike.${spacePhrase},actor.ilike.${wildcardPhrase},tags.ilike.${wildcardPhrase},categories.ilike.${wildcardPhrase},title.ilike.${firstWord}`;
}

async function testAllFilters() {
  console.log("=================================================");
  console.log("🧪 TESTING ALL UPDATED FILTER COMBINATIONS");
  console.log("=================================================\n");

  const testCases = [
    { cat: 'Anal', orient: 'straight', dur: 'long', time: 'all', sort: 'newest' },
    { cat: 'Blowjob', orient: 'straight', dur: 'short', time: 'all', sort: 'newest' },
    { cat: 'Hardcore', orient: 'straight', dur: 'medium', time: 'month', sort: 'newest' },
    { cat: 'Blowjob', orient: 'gay', dur: 'long', time: 'all', sort: 'newest' },
    { cat: 'Anal', orient: 'trans', dur: 'long', time: 'all', sort: 'newest' },
    { cat: 'Milf', orient: 'straight', dur: 'long', time: 'all', sort: 'views' },
    { cat: 'Amateur', orient: 'straight', dur: 'long', time: 'all', sort: 'trending' },
    { cat: 'All', orient: 'straight', dur: 'long', time: 'today', sort: 'newest' },
    { cat: 'All', orient: 'straight', dur: 'short', time: 'week', sort: 'newest' },
    { cat: 'All', orient: 'straight', dur: 'long', time: 'month', sort: 'views' },
    { cat: '#milf', orient: 'straight', dur: 'medium', time: 'all', sort: 'newest' },
    { cat: 'VR', orient: 'all', dur: 'all', time: 'all', sort: 'newest' },
    { cat: 'POV', orient: 'straight', dur: 'long', time: 'month', sort: 'trending' },
  ];

  for (const tc of testCases) {
    const t0 = Date.now();
    let q = supabase.from('videos').select('id, title, published_date, duration_sec, categories, tags, base_views, real_views, total_views');

    const searchTarget = tc.cat !== 'All' ? tc.cat : '';
    const tokens = cleanSearchTokens(searchTarget);
    const hasTextSearch = tokens.length > 0;

    if (hasTextSearch) {
      const searchClause = buildSearchQueryClause(tokens);
      q = q.or(searchClause);

      if (tc.orient === 'straight') {
        q = q.not('categories', 'ilike', '%gay%').not('categories', 'ilike', '%trans%').not('categories', 'ilike', '%shemale%');
      }
    } else {
      q = applyOrientationFilter(q, tc.orient);
    }

    q = applyTimeAndDurationFilter(q, tc.time, tc.dur);
    q = q.order('id', { ascending: false }).range(0, 19);

    const { data, error } = await q;
    const ms = Date.now() - t0;

    if (error) {
      console.log(`❌ FAIL [Cat: ${tc.cat}, Orient: ${tc.orient}, Dur: ${tc.dur}, Time: ${tc.time}, Sort: ${tc.sort}] in ${ms}ms -> Error: ${error.message} (${error.code})`);
    } else {
      console.log(`✅ OK [Cat: ${tc.cat}, Orient: ${tc.orient}, Dur: ${tc.dur}, Time: ${tc.time}, Sort: ${tc.sort}] in ${ms}ms -> Returned: ${data?.length || 0} videos`);
    }
  }

  console.log("\n=================================================");
  console.log("🎉 ALL FILTER TESTS COMPLETED");
  console.log("=================================================");
}

testAllFilters();
