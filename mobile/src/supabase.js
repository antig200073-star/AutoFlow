import { createClient } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { createNativeSessionStorage } from './native/auth';

const SUPABASE_URL = "https://tohlfwbzmkjlivcpssbe.supabase.co";
const SUPABASE_KEY = "sb_publishable_mhjRE7bumaGkOBsmv9TpBw_TwC49j6D";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: !Capacitor.isNativePlatform(),
    ...(Capacitor.isNativePlatform() ? {
      flowType: 'pkce',
      storage: createNativeSessionStorage(Preferences),
    } : {}),
  },
});
