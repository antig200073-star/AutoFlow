import { createClient } from 'npm:@supabase/supabase-js@2.116.0';
import { createHandler } from '../_shared/registration.mjs';

export const handler = createHandler({ createClient, getEnv: (name: string) => Deno.env.get(name) });
if (import.meta.main) Deno.serve(handler);
