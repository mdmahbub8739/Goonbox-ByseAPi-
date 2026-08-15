const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://cvflardlfqpkbplyuzzk.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2ZmxhcmRsZnFwa2JwbHl1enprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3MDE2NTIsImV4cCI6MjEwMjI3NzY1Mn0.vNDS24T81vg0RljSGKqFJh2FtKD4dPSe8rB5lt05Rhs";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function runDiagnostics() {
  console.log("=================================================");
  console.log("🚀 STARTING DATABASE DURATION DIAGNOSTIC SCRIPT");
  console.log("=================================================\n");

  // 1. Total records in database
  console.log("Step 1: Querying total video records in 'videos' table...");
  const { count: totalVideos, error: totalErr } = await supabase
    .from('videos')
    .select('*', { count: 'exact', head: true });

  if (totalErr) {
    console.error("❌ Error fetching total videos:", totalErr);
  } else {
    console.log(`✅ Total videos in database: ${totalVideos?.toLocaleString()} records`);
  }

  // 2. Exact Raw Count for duration_sec > 1800 (> 30 minutes)
  console.log("\nStep 2: Querying raw count WHERE duration_sec > 1800 (> 30 minutes)...");
  const { count: longVideosCount, error: longErr } = await supabase
    .from('videos')
    .select('*', { count: 'exact', head: true })
    .gt('duration_sec', 1800);

  if (longErr) {
    console.error("❌ Error fetching long videos count:", longErr);
  } else {
    console.log(`✅ Raw database count for duration_sec > 1800: ${longVideosCount?.toLocaleString()} videos`);
    if (totalVideos && longVideosCount) {
      const pct = ((longVideosCount / totalVideos) * 100).toFixed(2);
      console.log(`   Percentage of database: ${pct}% of all videos`);
    }
  }

  // 3. Exact Raw Count for duration_sec between 600 and 1800 (10-30 minutes)
  console.log("\nStep 3: Querying raw count WHERE duration_sec > 600 AND <= 1800 (10 - 30 minutes)...");
  const { count: medVideosCount, error: medErr } = await supabase
    .from('videos')
    .select('*', { count: 'exact', head: true })
    .gt('duration_sec', 600)
    .lte('duration_sec', 1800);

  if (medErr) {
    console.error("❌ Error fetching medium videos count:", medErr);
  } else {
    console.log(`✅ Raw database count for 10-30 minutes: ${medVideosCount?.toLocaleString()} videos`);
  }

  // 4. Exact Raw Count for duration_sec <= 600 (< 10 minutes)
  console.log("\nStep 4: Querying raw count WHERE duration_sec <= 600 (< 10 minutes)...");
  const { count: shortVideosCount, error: shortErr } = await supabase
    .from('videos')
    .select('*', { count: 'exact', head: true })
    .gt('duration_sec', 0)
    .lte('duration_sec', 600);

  if (shortErr) {
    console.error("❌ Error fetching short videos count:", shortErr);
  } else {
    console.log(`✅ Raw database count for < 10 minutes: ${shortVideosCount?.toLocaleString()} videos`);
  }

  // 5. Check null or 0 duration_sec
  console.log("\nStep 5: Querying records with duration_sec = 0 or NULL...");
  const { count: zeroCount } = await supabase
    .from('videos')
    .select('*', { count: 'exact', head: true })
    .or('duration_sec.is.null,duration_sec.eq.0');
  console.log(`✅ Records with 0 or NULL duration_sec: ${zeroCount?.toLocaleString()} videos`);

  // 6. Test Frontend Counter & Query Logic Comparison
  console.log("\n=================================================");
  console.log("🔬 FRONTEND LOGIC COMPARISON & ISOLATION TEST");
  console.log("=================================================");

  // Test frontend query with orientation = straight vs orientation = all
  console.log("\nTesting Frontend Default Query (with orientation = straight & duration_sec > 1800):");
  
  let straightQuery = supabase
    .from('videos')
    .select('id, title, duration_sec, categories, tags', { count: 'exact' })
    .gt('duration_sec', 1800)
    .not('categories', 'ilike', '%gay%')
    .not('categories', 'ilike', '%trans%')
    .order('id', { ascending: false })
    .range(0, 23);

  const { data: straightData, count: straightCount, error: straightErr } = await straightQuery;
  
  if (straightErr) {
    console.error("❌ Error in straight query:", straightErr);
  } else {
    console.log(`✅ Straight + Duration > 1800 Total Matching Count in DB: ${straightCount?.toLocaleString()}`);
    console.log(`✅ Page 1 Items returned: ${straightData?.length} items`);
    if (straightData && straightData.length > 0) {
      console.log("\nSample 3 items returned by frontend query:");
      straightData.slice(0, 3).forEach((v, i) => {
        const mins = (v.duration_sec / 60).toFixed(1);
        console.log(`   ${i + 1}. [ID: ${v.id}] ${v.title.slice(0, 50)}... | Duration: ${v.duration_sec}s (${mins} min) | Cat: ${v.categories}`);
      });
    }
  }

  // Test pagination next page (Page 2: range 24 to 47)
  console.log("\nTesting Frontend Page 2 Fetch (range 24-47):");
  const { data: p2Data, error: p2Err } = await supabase
    .from('videos')
    .select('id, duration_sec')
    .gt('duration_sec', 1800)
    .not('categories', 'ilike', '%gay%')
    .not('categories', 'ilike', '%trans%')
    .order('id', { ascending: false })
    .range(24, 47);

  if (p2Err) {
    console.error("❌ Error in Page 2:", p2Err);
  } else {
    console.log(`✅ Page 2 fetched successfully: ${p2Data?.length} items`);
  }

  console.log("\n=================================================");
  console.log("🏁 DIAGNOSTIC COMPLETE");
  console.log("=================================================");
}

runDiagnostics();
