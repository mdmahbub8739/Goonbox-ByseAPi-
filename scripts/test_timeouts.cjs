const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://cvflardlfqpkbplyuzzk.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2ZmxhcmRsZnFwa2JwbHl1enprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3MDE2NTIsImV4cCI6MjEwMjI3NzY1Mn0.vNDS24T81vg0RljSGKqFJh2FtKD4dPSe8rB5lt05Rhs";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function testTimeoutsAndSolutions() {
  console.log("=================================================");
  console.log("🔬 TESTING TIMEOUTS AND SOLUTIONS");
  console.log("=================================================\n");

  // Problem query 1: Category ILIKE + ORDER BY base_views
  console.log("1. Testing why Category + Views times out:");
  const t0 = Date.now();
  const res1 = await supabase
    .from('videos')
    .select('id, title, base_views, categories')
    .or('categories.ilike.%milf%,tags.ilike.%milf%')
    .order('base_views', { ascending: false })
    .range(0, 19);
  console.log(`   Result 1 (${Date.now() - t0}ms):`, res1.error ? `❌ ${res1.error.message}` : `✅ ${res1.data?.length} videos`);

  // Solution 1: When filtering by Category / Search query, ordering by ID DESC (primary key index) is instant!
  console.log("\n2. Testing Category ILIKE + ORDER BY ID DESC (Instant):");
  const t1 = Date.now();
  const res2 = await supabase
    .from('videos')
    .select('id, title, base_views, categories')
    .or('categories.ilike.%milf%,tags.ilike.%milf%')
    .order('id', { ascending: false })
    .range(0, 19);
  console.log(`   Result 2 (${Date.now() - t1}ms):`, res2.error ? `❌ ${res2.error.message}` : `✅ ${res2.data?.length} videos`);

  // Solution 2: What if we query recent videos matching category (e.g. ID > recent_id or fetch larger batch and sort client side)?
  console.log("\n3. Testing Category + Duration + Sort Views fallback strategy:");
  const t2 = Date.now();
  const res3 = await supabase
    .from('videos')
    .select('id, title, base_views, real_views, duration_sec, categories')
    .or('categories.ilike.%milf%,tags.ilike.%milf%')
    .gt('duration_sec', 1800)
    .order('id', { ascending: false })
    .range(0, 49);
  
  if (res3.data) {
    // In-memory sort by views
    const sortedByViews = [...res3.data].sort((a, b) => (b.base_views || 0) - (a.base_views || 0));
    console.log(`   Result 3 (${Date.now() - t2}ms): ✅ Successfully fetched ${res3.data.length} videos and client-sorted top view: ${sortedByViews[0]?.base_views}`);
  } else {
    console.log(`   Result 3 (${Date.now() - t2}ms): ❌ ${res3.error?.message}`);
  }

  // Test Time Filter: 'today'
  console.log("\n4. Testing 'today' time filter when timezone is different:");
  const todayStr = new Date().toISOString().split('T')[0];
  console.log(`   Today UTC string: ${todayStr}`);
  const { data: todayVideos } = await supabase
    .from('videos')
    .select('id, published_date')
    .gte('published_date', todayStr)
    .limit(5);
  console.log(`   Videos found with published_date >= ${todayStr}: ${todayVideos?.length || 0}`);
}

testTimeoutsAndSolutions();
