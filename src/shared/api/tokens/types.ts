import { NATIVE_TOKEN_ADDRESS } from '@shared/config';
import type { Address } from 'viem';
import { CURATED_BASE_TOKENS } from './curated-list';

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

const CURATED_ADDRESSES = new Set(CURATED_BASE_TOKENS.map((t) => t.address.toLowerCase()));

/**
 * Drops spam airdrops from the held-token list. Any active address accumulates
 * unsolicited ERC-20s; Alchemy returns them all, and they have no USD price
 * (no market). Rule: native ETH always shows; a priced token shows unless it's
 * dust; an UNPRICED token shows only if it's on the curated whitelist — that
 * keeps the no-Alchemy fallback (curated, unpriced) working while filtering the
 * junk (which is unpriced and, lacking a Uniswap route, couldn't be swapped
 * anyway).
 */
export function filterDisplayableTokens(
  tokens: DiscoveredToken[],
  dustThresholdUsd: number
): DiscoveredToken[] {
  return tokens.filter((token) => {
    if (token.address === NATIVE_TOKEN_ADDRESS) return true;
    const value = tokenValueUsd(token);
    if (value === undefined) return CURATED_ADDRESSES.has(token.address.toLowerCase());
    return value >= dustThresholdUsd;
  });
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
