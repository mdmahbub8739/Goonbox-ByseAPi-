const { createClient } = require('@supabase/supabase-js');
const https = require('https');

const SUPABASE_URL = "https://cvflardlfqpkbplyuzzk.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2ZmxhcmRsZnFwa2JwbHl1enprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3MDE2NTIsImV4cCI6MjEwMjI3NzY1Mn0.vNDS24T81vg0RljSGKqFJh2FtKD4dPSe8rB5lt05Rhs";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function testSync() {
  console.log("=== 1. SUPABASE DATABASE LATEST IDS ===");
  const { data: dbData } = await supabase
    .from('videos')
    .select('id, title, published_date, created_at')
    .order('id', { ascending: false })
    .limit(5);

  if (dbData) {
    dbData.forEach(v => console.log(`DB Video ID: ${v.id} | Date: ${v.published_date || v.created_at} | Title: "${v.title}"`));
  }

  console.log("\n=== 2. TESTING REMOTE API: https://pornx.to/wp-json/wp/v2/posts ===");
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);

    const res = await fetch("https://pornx.to/wp-json/wp/v2/posts?per_page=5&_fields=id,date,title,slug", {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      }
    });
    clearTimeout(timeout);

    console.log("Remote HTTP Status:", res.status, res.statusText);
    if (res.ok) {
      const posts = await res.json();
      console.log(`Fetched ${posts.length} remote posts:`);
      posts.forEach(p => console.log(`Remote Video ID: ${p.id} | Date: ${p.date} | Title: "${p.title?.rendered || ''}"`));
      
      const dbMax = dbData?.[0]?.id || 0;
      const remoteMax = posts?.[0]?.id || 0;
      console.log(`\nComparison: DB Max = ${dbMax} vs Remote Max = ${remoteMax}`);
      if (remoteMax > dbMax) {
        console.log(`Difference: Remote has ${remoteMax - dbMax} ID gap to sync.`);
      } else {
        console.log(`DB already has ID >= Remote.`);
      }
    } else {
      const text = await res.text();
      console.log("Remote response snippet:", text.slice(0, 300));
    }
  } catch (err) {
    console.error("Remote Request Error / Timeout:", err.name, err.message);
  }
}

testSync();
