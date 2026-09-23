import { liveBaseballRepository } from './live-baseball';
import { mockUserRepository } from './mock-user';
import type { BaseballRepository, UserRepository } from './types';
// Single composition root: API/Supabase adapters can replace these without UI changes.
export const baseball: BaseballRepository = liveBaseballRepository;
export const users: UserRepository = mockUserRepository;
