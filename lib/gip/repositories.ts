import { liveBaseballRepository } from './live-baseball';
import { serverUserRepository } from './server-user';
import type { BaseballRepository, UserRepository } from './types';
// Single composition root: API/Supabase adapters can replace these without UI changes.
export const baseball: BaseballRepository = liveBaseballRepository;
export const users: UserRepository = serverUserRepository;
