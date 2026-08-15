const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://cvflardlfqpkbplyuzzk.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2ZmxhcmRsZnFwa2JwbHl1enprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3MDE2NTIsImV4cCI6MjEwMjI3NzY1Mn0.vNDS24T81vg0RljSGKqFJh2FtKD4dPSe8rB5lt05Rhs";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function testSafeQueryHelper() {
  console.log("=== TESTING SAFE QUERY HELPER FOR MULTIPLE FILTERS ===");

  async function executeMultiFilterQuery({
    category = 'All',
    searchQuery = '',
    orientation = 'straight',
    timeFilter = 'all',
    durationFilter = 'all',
    sortBy = 'newest',
    from = 0,
    to = 19
  }) {
    let query = supabase.from('videos').select('*');

    const hasTextFilter = (category && category !== 'All') || !!searchQuery;
    const textTerm = searchQuery || (category !== 'All' ? category.replace(/^#/, '') : '');

    // 1. Text Search / Category Filter
    if (hasTextFilter) {
      const clean = textTerm.trim();
      query = query.or(`categories.ilike.%${clean}%,tags.ilike.%${clean}%,title.ilike.%${clean}%`);
      if (orientation === 'straight') {
        query = query.not('categories', 'ilike', '%gay%').not('categories', 'ilike', '%trans%');
      }
    } else {
      if (orientation === 'straight') {
        query = query.not('categories', 'ilike', '%gay%').not('categories', 'ilike', '%trans%');
      } else if (orientation === 'gay') {
        query = query.or('categories.ilike.%gay%,tags.ilike.%gay%,title.ilike.%gay%');
      } else if (orientation === 'trans') {
        query = query.or('categories.ilike.%trans%,categories.ilike.%shemale%,tags.ilike.%trans%,tags.ilike.%shemale%,title.ilike.%trans%');
      }
    }

    // 2. Duration Filter
    if (durationFilter === 'short') {
      query = query.gt('duration_sec', 0).lte('duration_sec', 600);
    } else if (durationFilter === 'medium') {
      query = query.gt('duration_sec', 600).lte('duration_sec', 1800);
    } else if (durationFilter === 'long') {
      query = query.gt('duration_sec', 1800);
    }

    // 3. Time Filter
    if (timeFilter !== 'all') {
      const now = new Date();
      let days = 2; // 'today' allows 48h buffer for global timezones
      if (timeFilter === 'week') days = 7.5;
      else if (timeFilter === 'month') days = 31;
      else if (timeFilter === 'year') days = 366;
      const past = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      const startStr = past.toISOString().split('T')[0];
      query = query.gte('published_date', startStr);
    }

    // 4. Safe Sorting:
    // If text filter is active, PostgREST times out if ordering by base_views or real_views.
    // Order by ID (primary key) on DB, then sort in-memory.
    if (!hasTextFilter && sortBy === 'views') {
      query = query.order('base_views', { ascending: false }).order('id', { ascending: false });
    } else if (!hasTextFilter && sortBy === 'trending') {
      query = query.order('real_views', { ascending: false }).order('id', { ascending: false });
    } else {
      query = query.order('id', { ascending: false });
    }

    query = query.range(from, to);

    const t0 = Date.now();
    const { data, error } = await query;
    const elapsed = Date.now() - t0;

    if (error) {
      return { success: false, error: error.message, elapsed };
    }

    let finalVideos = data || [];
    if (hasTextFilter && (sortBy === 'views' || sortBy === 'trending')) {
      finalVideos = [...finalVideos].sort((a, b) => {
        if (sortBy === 'views') return (b.base_views || 0) - (a.base_views || 0);
        return (b.real_views || 0) - (a.real_views || 0);
      });
    }

    return { success: true, count: finalVideos.length, elapsed };
  }

  // Test 10 complex multi-filter permutations
  const permutations = [
    { category: 'Anal', durationFilter: 'long', sortBy: 'views', timeFilter: 'year' },
    { category: 'Milf', durationFilter: 'medium', sortBy: 'trending', timeFilter: 'month' },
    { category: 'Amateur', durationFilter: 'short', sortBy: 'views', timeFilter: 'all' },
    { searchQuery: 'blonde', durationFilter: 'long', sortBy: 'views', timeFilter: 'all' },
    { searchQuery: 'japanese', durationFilter: 'medium', sortBy: 'trending', timeFilter: 'year' },
    { category: 'All', orientation: 'straight', durationFilter: 'long', timeFilter: 'today', sortBy: 'newest' },
    { category: 'All', orientation: 'gay', durationFilter: 'medium', timeFilter: 'week', sortBy: 'views' },
    { category: 'All', orientation: 'trans', durationFilter: 'long', timeFilter: 'month', sortBy: 'trending' },
    { category: '#blowjob', durationFilter: 'short', timeFilter: 'all', sortBy: 'views' },
    { category: 'Hardcore', durationFilter: 'long', timeFilter: 'all', sortBy: 'views' }
  ];

  for (const p of permutations) {
    const res = await executeMultiFilterQuery(p);
    const pStr = JSON.stringify(p);
    if (res.success) {
      console.log(`✅ SUCCESS in ${res.elapsed}ms | Items: ${res.count} | Params: ${pStr}`);
    } else {
      console.log(`❌ FAILED in ${res.elapsed}ms | Error: ${res.error} | Params: ${pStr}`);
    }
  }
}

testSafeQueryHelper();
