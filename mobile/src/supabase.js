import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://tohlfwbzmkjlivcpssbe.supabase.co";
const SUPABASE_KEY = "sb_publishable_mhjRE7bumaGkOBsmv9TpBw_TwC49j6D";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});