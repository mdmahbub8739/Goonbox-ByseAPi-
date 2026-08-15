const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://cvflardlfqpkbplyuzzk.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2ZmxhcmRsZnFwa2JwbHl1enprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3MDE2NTIsImV4cCI6MjEwMjI3NzY1Mn0.vNDS24T81vg0RljSGKqFJh2FtKD4dPSe8rB5lt05Rhs";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function testAllFilterCombinations() {
  console.log("=================================================");
  console.log("🧪 TESTING ALL FILTER COMBINATIONS ON SUPABASE");
  console.log("=================================================\n");

  const orientations = ['all', 'straight', 'gay', 'trans'];
  const categories = ['All', 'Anal', 'Blowjob', 'Hardcore', 'Amateur', 'Milf', 'Teen'];
  const durations = ['all', 'short', 'medium', 'long'];
  const timeFilters = ['all', 'today', 'week', 'month', 'year'];
  const sorts = ['newest', 'views', 'trending'];

  // Test 1: Published date null count
  const { count: nullDateCount } = await supabase
    .from('videos')
    .select('*', { count: 'exact', head: true })
    .is('published_date', null);
  console.log(`ℹ️ Videos with NULL published_date: ${nullDateCount}`);

  // Test 2: Combinations matrix
  console.log("\nTesting various multiple filter combinations:\n");

  const testCases = [
    // Case 1: Category + Orientation + Duration Long
    { cat: 'Anal', orient: 'straight', dur: 'long', time: 'all', sort: 'newest' },
    // Case 2: Category + Orientation + Duration Short
    { cat: 'Blowjob', orient: 'straight', dur: 'short', time: 'all', sort: 'newest' },
    // Case 3: Category + Orientation + Duration Medium + Time Month
    { cat: 'Hardcore', orient: 'straight', dur: 'medium', time: 'month', sort: 'newest' },
    // Case 4: Category + Gay + Duration Long
    { cat: 'Blowjob', orient: 'gay', dur: 'long', time: 'all', sort: 'newest' },
    // Case 5: Category + Trans + Duration Long
    { cat: 'Anal', orient: 'trans', dur: 'long', time: 'all', sort: 'newest' },
    // Case 6: Category + Duration Long + Sort Views (Most Viewed)
    { cat: 'Milf', orient: 'straight', dur: 'long', time: 'all', sort: 'views' },
    // Case 7: Category + Duration Long + Sort Trending
    { cat: 'Amateur', orient: 'straight', dur: 'long', time: 'all', sort: 'trending' },
    // Case 8: No Cat + Straight + Time Today + Duration Long
    { cat: 'All', orient: 'straight', dur: 'long', time: 'today', sort: 'newest' },
    // Case 9: No Cat + Straight + Time Week + Duration Short
    { cat: 'All', orient: 'straight', dur: 'short', time: 'week', sort: 'newest' },
    // Case 10: No Cat + Straight + Time Month + Duration Long + Sort Views
    { cat: 'All', orient: 'straight', dur: 'long', time: 'month', sort: 'views' },
    // Case 11: Tag search (#milf) + Duration Medium
    { cat: '#milf', orient: 'straight', dur: 'medium', time: 'all', sort: 'newest' },
    // Case 12: Time Year + Duration Long + Sort Views
    { cat: 'All', orient: 'straight', dur: 'long', time: 'year', sort: 'views' },
  ];

  for (const tc of testCases) {
    let query = supabase.from('videos').select('id, title, duration_sec, categories, published_date, base_views, real_views');

    // 1. Category / Tag
    if (tc.cat && tc.cat !== 'All') {
      const clean = tc.cat.trim().replace(/^#/, '');
      query = query.or(`categories.ilike.%${clean}%,tags.ilike.%${clean}%,title.ilike.%${clean}%`);
      if (tc.orient === 'straight') {
        query = query.not('categories', 'ilike', '%gay%').not('categories', 'ilike', '%trans%');
      }
    } else {
      if (tc.orient === 'straight') {
        query = query.not('categories', 'ilike', '%gay%').not('categories', 'ilike', '%trans%');
      } else if (tc.orient === 'gay') {
        query = query.or('categories.ilike.%gay%,tags.ilike.%gay%,title.ilike.%gay%');
      } else if (tc.orient === 'trans') {
        query = query.or('categories.ilike.%trans%,categories.ilike.%shemale%,tags.ilike.%trans%,tags.ilike.%shemale%,title.ilike.%trans%');
      }
    }

    // 2. Duration
    if (tc.dur === 'short') {
      query = query.gt('duration_sec', 0).lte('duration_sec', 600);
    } else if (tc.dur === 'medium') {
      query = query.gt('duration_sec', 600).lte('duration_sec', 1800);
    } else if (tc.dur === 'long') {
      query = query.gt('duration_sec', 1800);
    }

    // 3. Time
    if (tc.time !== 'all') {
      const now = new Date();
      let days = 1;
      if (tc.time === 'today') days = 2; // generous
      else if (tc.time === 'week') days = 7;
      else if (tc.time === 'month') days = 30;
      else if (tc.time === 'year') days = 365;
      const past = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      const startStr = past.toISOString().split('T')[0];
      query = query.gte('published_date', startStr);
    }

    // 4. Sort
    if (tc.sort === 'views') {
      query = query.order('base_views', { ascending: false }).order('id', { ascending: false });
    } else if (tc.sort === 'trending') {
      query = query.order('real_views', { ascending: false }).order('id', { ascending: false });
    } else {
      query = query.order('id', { ascending: false });
    }

    // Range
    query = query.range(0, 19);

    const t0 = Date.now();
    const { data, error } = await query;
    const durationMs = Date.now() - t0;

    const label = `[Cat: ${tc.cat}, Orient: ${tc.orient}, Dur: ${tc.dur}, Time: ${tc.time}, Sort: ${tc.sort}]`;
    if (error) {
      console.log(`❌ FAIL ${label} in ${durationMs}ms -> Error: ${error.message} (${error.code})`);
    } else {
      console.log(`✅ OK ${label} in ${durationMs}ms -> Returned: ${data?.length} videos`);
      if (data?.length === 0) {
        console.log(`   ⚠️ ZERO RESULTS RETURNED for this combination!`);
      }
    }
  }

  console.log("\n=================================================");
  console.log("🏁 FILTER MATRIX TEST COMPLETE");
  console.log("=================================================");
}

testAllFilterCombinations();
