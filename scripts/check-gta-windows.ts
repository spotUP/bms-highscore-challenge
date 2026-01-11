#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

console.log('Checking specific GTA V Windows entry (ID: -29048)...');

const { data, error } = await supabase
  .from('games_database')
  .select('id, name, platform_name, logo_base64')
  .eq('id', -29048)
  .single();

if (error) {
  console.error('Error:', error);
} else {
  console.log('GTA V Windows entry:', {
    id: data.id,
    name: data.name,
    platform: data.platform_name,
    hasLogo: !!data.logo_base64,
    logoLength: data.logo_base64?.length || 0
  });

  if (data.logo_base64) {
    const logoStart = data.logo_base64.substring(0, 50);
    console.log('Logo starts with:', logoStart);
  }
}