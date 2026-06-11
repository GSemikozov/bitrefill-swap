import { QUERY_KEYS } from '@shared/api/query-keys';
import {
  CURATED_BASE_TOKENS,
  type DiscoveredToken,
  filterDisplayableTokens,
  getTokenDiscovery,
  sortByValue,
} from '@shared/api/tokens';
import { DUST_THRESHOLD_USD, useIsDemoPayment } from '@shared/config';
import { useQuery } from '@tanstack/react-query';
import type { Address } from 'viem';

/**
 * Tokens the connected wallet actually holds on Base: zero balances are
 * excluded by discovery, dust and spam airdrops are dropped (see
 * filterDisplayableTokens). Demo mode is part of the query key so flipping it
 * re-derives the list (it injects a curated fallback).
 */
export function useHeldTokens(owner: Address | undefined) {
  const demo = useIsDemoPayment();
  return useQuery({
    queryKey: QUERY_KEYS.tokens.held(owner, demo),
    queryFn: async () => {
      if (!owner) return [];
      const tokens = await getTokenDiscovery().getHeldTokens(owner);
      const sorted = sortByValue(filterDisplayableTokens(tokens, DUST_THRESHOLD_USD));
      // Demo mode pays nothing on-chain — an empty wallet still gets a list
      // to pick from so the full flow stays walkable.
      if (sorted.length === 0 && demo) {
        return CURATED_BASE_TOKENS.map((token): DiscoveredToken => ({ ...token, balance: 0n }));
      }
      return sorted;
    },
    enabled: Boolean(owner),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}
