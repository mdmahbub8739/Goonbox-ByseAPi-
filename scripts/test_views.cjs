const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://cvflardlfqpkbplyuzzk.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2ZmxhcmRsZnFwa2JwbHl1enprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3MDE2NTIsImV4cCI6MjEwMjI3NzY1Mn0.vNDS24T81vg0RljSGKqFJh2FtKD4dPSe8rB5lt05Rhs";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function testViewsSort() {
  for (const s of ['base_views', 'real_views', 'total_views']) {
    const t0 = Date.now();
    const { data, error } = await supabase.from('videos').select('id, ' + s).order(s, { ascending: false }).limit(20);
    const ms = Date.now() - t0;
    if (error) {
      console.log(`Sort by ${s}: ❌ ERROR (${ms}ms) -> ${error.message}`);
    } else {
      console.log(`Sort by ${s}: ✅ OK (${ms}ms) -> top value: ${data[0]?.[s]}`);
    }
  }
}

testViewsSort();
