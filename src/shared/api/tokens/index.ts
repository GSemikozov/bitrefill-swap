import { env } from '@shared/config';
import { alchemyTokenDiscovery } from './alchemy';
import { fallbackTokenDiscovery } from './fallback';
import type { TokenDiscovery } from './types';

/** Alchemy when a key is configured, curated-list multicall otherwise. */
export function getTokenDiscovery(): TokenDiscovery {
  return env.VITE_ALCHEMY_API_KEY ? alchemyTokenDiscovery : fallbackTokenDiscovery;
}

export { CURATED_BASE_TOKENS } from './curated-list';
export {
  type DiscoveredToken,
  filterDisplayableTokens,
  sortByValue,
  tokenValueUsd,
} from './types';
