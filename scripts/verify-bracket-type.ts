import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

async function main() {
  // Query bracket_competitions selecting the column directly
  const { data, error } = await supabase
    .from('bracket_competitions')
    .select('bracket_type')
    .limit(1);
  if (error) {
    console.error('Selection failed, likely no column bracket_type:', error);
    process.exit(2);
  }
  console.log('bracket_type column is selectable on public.bracket_competitions');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
