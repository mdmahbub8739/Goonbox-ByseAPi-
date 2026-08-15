const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://cvflardlfqpkbplyuzzk.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2ZmxhcmRsZnFwa2JwbHl1enprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3MDE2NTIsImV4cCI6MjEwMjI3NzY1Mn0.vNDS24T81vg0RljSGKqFJh2FtKD4dPSe8rB5lt05Rhs";
const REMOTE_API = "https://pornx.to/wp-json/wp/v2/posts?per_page=10&_embed=true";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function compareRemoteAndDatabase() {
  console.log("=================================================");
  console.log("🔍 COMPARING REMOTE SERVER VS SUPABASE DATABASE");
  console.log("=================================================\n");

  // 1. Fetch latest videos from Supabase
  console.log("1. Fetching top 5 latest IDs from your Supabase Database:");
  const { data: dbVideos, error: dbErr } = await supabase
    .from('videos')
    .select('id, title, published_date, created_at')
    .order('id', { ascending: false })
    .limit(5);

  if (dbErr) {
    console.error("❌ DB Error:", dbErr);
  } else {
    dbVideos.forEach((v, idx) => {
      console.log(`   [DB #${idx + 1}] ID: ${v.id} | Date: ${v.published_date || v.created_at} | Title: "${v.title}"`);
    });
  }

  // 2. Fetch latest videos from Remote Server API
  console.log("\n2. Fetching top 5 latest IDs from Remote Source (pornx.to API):");
  try {
    const res = await fetch(REMOTE_API, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!res.ok) {
      console.error(`❌ Remote server responded with HTTP status ${res.status} ${res.statusText}`);
    } else {
      const remotePosts = await res.json();
      if (Array.isArray(remotePosts)) {
        console.log(`   Total remote posts in batch: ${remotePosts.length}`);
        remotePosts.slice(0, 5).forEach((p, idx) => {
          console.log(`   [Remote #${idx + 1}] ID: ${p.id} | Date: ${p.date_gmt || p.date} | Title: "${p.title?.rendered || ''}"`);
        });

        // 3. Compare difference
        const latestDbId = dbVideos && dbVideos[0] ? dbVideos[0].id : 0;
        const latestRemoteId = remotePosts && remotePosts[0] ? remotePosts[0].id : 0;

        console.log("\n3. ID Comparison:");
        console.log(`   👉 Latest DB Video ID:     ${latestDbId}`);
        console.log(`   👉 Latest Remote Video ID: ${latestRemoteId}`);

        if (latestRemoteId > latestDbId) {
          console.log(`   ⚠️ Remote server has NEWER posts! Gap: ${latestRemoteId - latestDbId} ID units.`);
        } else if (latestRemoteId === latestDbId) {
          console.log(`   ✅ DB is 100% up-to-date with Remote server (Exact Match)!`);
        } else {
          console.log(`   ℹ️ DB latest ID (${latestDbId}) is equal or ahead of Remote default feed.`);
        }
      }
    }
  } catch (err) {
    console.error("❌ Remote fetch error:", err.message);
  }

  // 4. Check sync_state table
  console.log("\n4. Checking 'sync_state' table in Supabase:");
  const { data: syncData, error: syncErr } = await supabase
    .from('sync_state')
    .select('*');

  if (syncErr) {
    console.log("   ❌ Error reading sync_state:", syncErr);
  } else {
    console.log("   👉 sync_state records:", syncData);
  }

  console.log("\n=================================================");
  console.log("🏁 COMPARISON COMPLETE");
  console.log("=================================================");
}

compareRemoteAndDatabase();
