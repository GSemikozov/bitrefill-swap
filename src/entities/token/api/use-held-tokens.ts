import { QUERY_KEYS } from '@shared/api/query-keys';
import {
  CURATED_BASE_TOKENS,
  type DiscoveredToken,
  getTokenDiscovery,
  sortByValue,
  tokenValueUsd,
} from '@shared/api/tokens';
import { DUST_THRESHOLD_USD, isDemoPayment } from '@shared/config';
import { useQuery } from '@tanstack/react-query';
import type { Address } from 'viem';

/**
 * Tokens the connected wallet actually holds on Base: zero balances are
 * already excluded by discovery; dust is dropped only when a USD price is
 * known (we never hide a token we cannot value).
 */
export function useHeldTokens(owner: Address | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.tokens.held(owner),
    queryFn: async () => {
      if (!owner) return [];
      const tokens = await getTokenDiscovery().getHeldTokens(owner);
      const withoutDust = tokens.filter((token) => {
        const value = tokenValueUsd(token);
        return value === undefined || value >= DUST_THRESHOLD_USD;
      });
      const sorted = sortByValue(withoutDust);
      // Demo mode pays nothing on-chain — an empty wallet still gets a list
      // to pick from so the full flow stays walkable.
      if (sorted.length === 0 && isDemoPayment()) {
        return CURATED_BASE_TOKENS.map((token): DiscoveredToken => ({ ...token, balance: 0n }));
      }
      return sorted;
    },
    enabled: Boolean(owner),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}
