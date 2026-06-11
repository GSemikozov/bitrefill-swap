import type { Address } from 'viem';

export interface DiscoveredToken {
  /** NATIVE_TOKEN_ADDRESS sentinel for ETH (matches the Uniswap Trading API). */
  address: Address;
  symbol: string;
  name: string;
  decimals: number;
  logoUrl?: string;
  /** Raw balance in base units; discovery only returns tokens with balance > 0. */
  balance: bigint;
  priceUsd?: number;
}

/**
 * "Tokens the user actually holds" abstraction. Two implementations:
 * Alchemy (preferred, full discovery + USD prices) and a curated-list
 * multicall fallback used automatically when no Alchemy key is configured.
 */
export interface TokenDiscovery {
  getHeldTokens(owner: Address): Promise<DiscoveredToken[]>;
}

export function tokenValueUsd(token: DiscoveredToken): number | undefined {
  if (token.priceUsd === undefined) return undefined;
  return (Number(token.balance) / 10 ** token.decimals) * token.priceUsd;
}

/** Highest USD value first; unpriced tokens after priced ones, by symbol. */
export function sortByValue(tokens: DiscoveredToken[]): DiscoveredToken[] {
  return [...tokens].sort((a, b) => {
    const aValue = tokenValueUsd(a);
    const bValue = tokenValueUsd(b);
    if (aValue !== undefined && bValue !== undefined) return bValue - aValue;
    if (aValue !== undefined) return -1;
    if (bValue !== undefined) return 1;
    return a.symbol.localeCompare(b.symbol);
  });
}
