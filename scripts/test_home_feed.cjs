const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://cvflardlfqpkbplyuzzk.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2ZmxhcmRsZnFwa2JwbHl1enprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3MDE2NTIsImV4cCI6MjEwMjI3NzY1Mn0.vNDS24T81vg0RljSGKqFJh2FtKD4dPSe8rB5lt05Rhs";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function testHomeFeedOutput() {
  console.log("=== CHECKING WHAT THE USER SEES ON HOME / NEWEST FEED ===");
  
  const { data, error } = await supabase
    .from('videos')
    .select('id, title, published_date, duration_sec, categories, tags')
    .not('categories', 'ilike', '%gay%')
    .not('categories', 'ilike', '%trans%')
    .order('id', { ascending: false })
    .range(0, 9);

  if (error) {
    console.error("Query error:", error);
    return;
  }

  console.log(`Top 10 videos showing on Home/Newest Feed right now:`);
  data.forEach((v, i) => {
    console.log(`#${i + 1} | ID: ${v.id} | Date: ${v.published_date} | Duration: ${Math.round(v.duration_sec/60)}m | Title: "${v.title}"`);
  });
}

testHomeFeedOutput();
