import { envConfig } from '../../config/env';
import type { DataRepository } from './DataRepository';
import { LocalRepository } from './LocalRepository';
import { SupabaseRepository } from './SupabaseRepository';
import { getSupabaseClient } from './supabaseClient';

const localRepo = new LocalRepository();
let supabaseRepo: SupabaseRepository | null = null;

export function createDataRepository(): DataRepository {
  if (envConfig.hasSupabaseConfig) {
    const client = getSupabaseClient();
    if (client) {
      supabaseRepo ??= new SupabaseRepository(client);
      return supabaseRepo;
    }
  }
  return localRepo;
}

export { LocalRepository } from './LocalRepository';
export { SupabaseRepository } from './SupabaseRepository';
export type { DataRepository, RepoResult } from './DataRepository';
