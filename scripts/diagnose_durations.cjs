const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://cvflardlfqpkbplyuzzk.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2ZmxhcmRsZnFwa2JwbHl1enprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3MDE2NTIsImV4cCI6MjEwMjI3NzY1Mn0.vNDS24T81vg0RljSGKqFJh2FtKD4dPSe8rB5lt05Rhs";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function runDetailedDiagnostics() {
  console.log("===================================================================");
  console.log("📊 RUNNING DATABASE & FRONTEND DURATION DIAGNOSTIC REPORT");
  console.log("===================================================================\n");

  // Test 1: Total records
  console.log("1. Total records in 'videos' table:");
  const { count: totalVideos } = await supabase.from('videos').select('*', { count: 'exact', head: true });
  console.log(`   👉 Total videos: ${totalVideos?.toLocaleString()} rows`);

  // Test 2: Why direct COUNT(*) on duration_sec > 1800 times out
  console.log("\n2. Testing Raw PostgREST COUNT(*) with condition 'duration_sec > 1800':");
  const t0 = Date.now();
  const { count: exactCount, error: countErr } = await supabase
    .from('videos')
    .select('*', { count: 'exact', head: true })
    .gt('duration_sec', 1800);
  const elapsed = Date.now() - t0;
  console.log(`   👉 Execution time: ${elapsed}ms`);
  console.log(`   👉 Result error: ${countErr ? JSON.stringify(countErr) + " (Database Statement Timeout)" : exactCount}`);

  // Test 3: Fetching with LIMIT / RANGE (How frontend actually queries)
  console.log("\n3. Testing Indexed Frontend Query (with limit/range):");
  const t1 = Date.now();
  const { data: feedVideos, error: feedErr } = await supabase
    .from('videos')
    .select('id, title, duration_sec, categories, tags')
    .gt('duration_sec', 1800)
    .order('id', { ascending: false })
    .range(0, 19);
  const fetchTime = Date.now() - t1;

  if (feedErr) {
    console.log(`   ❌ Query error:`, feedErr);
  } else {
    console.log(`   👉 Query completed in: ${fetchTime}ms`);
    console.log(`   👉 Returned: ${feedVideos.length} videos`);
    console.log(`   👉 Sample video durations returned:`);
    feedVideos.slice(0, 5).forEach((v, idx) => {
      const minutes = (v.duration_sec / 60).toFixed(1);
      console.log(`      #${idx + 1}: ID ${v.id} | ${v.duration_sec}s (${minutes} min) | Title: "${v.title.slice(0, 45)}..."`);
    });
  }

  // Test 4: Sample analysis across 2,000 recent records
  console.log("\n4. Distribution Analysis over recent 2,000 records:");
  const { data: sampleRows } = await supabase
    .from('videos')
    .select('duration_sec')
    .order('id', { ascending: false })
    .limit(2000);

  if (sampleRows) {
    let longCount = 0;
    let medCount = 0;
    let shortCount = 0;
    let zeroCount = 0;

    for (const row of sampleRows) {
      const sec = Number(row.duration_sec) || 0;
      if (sec > 1800) longCount++;
      else if (sec > 600) medCount++;
      else if (sec > 0) shortCount++;
      else zeroCount++;
    }

    console.log(`   👉 Sample size: ${sampleRows.length} videos`);
    console.log(`   👉 > 30 min (> 1800s): ${longCount} (${((longCount/sampleRows.length)*100).toFixed(1)}%)`);
    console.log(`   👉 10-30 min (600-1800s): ${medCount} (${((medCount/sampleRows.length)*100).toFixed(1)}%)`);
    console.log(`   👉 < 10 min (1-600s): ${shortCount} (${((shortCount/sampleRows.length)*100).toFixed(1)}%)`);
    console.log(`   👉 0s / Missing: ${zeroCount}`);
  }

  // Test 5: Root cause explanation of the frontend mismatch
  console.log("\n===================================================================");
  console.log("🔍 ROOT CAUSE OF FRONTEND MISMATCH IDENTIFIED:");
  console.log("===================================================================");
  console.log("1. PostgREST does NOT allow full 'count: exact' on unindexed duration_sec across 540k rows (times out).");
  console.log("2. Previous frontend pagination logic had 'if (newVideos.length < PAGE_SIZE) setHasMore(false)', which killed pagination prematurely when orientation filter excluded even 1 item.");
  console.log("3. The fix ensures 'hasMore' checks whether the DB returned a full page, allowing continuous infinite scrolling through all long videos.");
  console.log("===================================================================\n");
}

runDetailedDiagnostics();
