import type { DataPersistenceMode } from '../types/domain';

export interface EnvConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  hasSupabaseConfig: boolean;
  persistenceMode: DataPersistenceMode;
}

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL ?? '').trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim();

const hasValidUrl =
  supabaseUrl.length > 0 &&
  (supabaseUrl.startsWith('https://') || supabaseUrl.startsWith('http://'));

const hasSupabaseConfig = hasValidUrl && supabaseAnonKey.length > 0;

export const envConfig: EnvConfig = {
  supabaseUrl,
  supabaseAnonKey,
  hasSupabaseConfig,
  persistenceMode: hasSupabaseConfig ? 'supabase' : 'local',
};
