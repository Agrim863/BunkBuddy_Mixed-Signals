import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { envConfig } from '../../config/env';

let cachedClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!envConfig.hasSupabaseConfig) return null;
  if (!cachedClient) {
    cachedClient = createClient(envConfig.supabaseUrl, envConfig.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }
  return cachedClient;
}
