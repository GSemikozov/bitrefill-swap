import { NATIVE_TOKEN_ADDRESS } from '@shared/config';
import type { Address } from 'viem';
import { describe, expect, it } from 'vitest';
import { type DiscoveredToken, filterDisplayableTokens } from './types';

function token(overrides: Partial<DiscoveredToken> & { address: Address }): DiscoveredToken {
  return {
    symbol: 'TKN',
    name: 'Token',
    decimals: 18,
    balance: 1_000000000000000000n,
    ...overrides,
  };
}

const WETH = '0x4200000000000000000000000000000000000006' as const; // curated
const SPAM = '0x1111111111111111111111111111111111111111' as const; // not curated

describe('filterDisplayableTokens', () => {
  it('always keeps native ETH, even unpriced', () => {
    const eth = token({ address: NATIVE_TOKEN_ADDRESS, symbol: 'ETH', priceUsd: undefined });
    expect(filterDisplayableTokens([eth], 0.01)).toEqual([eth]);
  });

  it('keeps a priced token above the dust threshold, drops it below', () => {
    const rich = token({ address: WETH, balance: 10n ** 18n, priceUsd: 2000 });
    const dust = token({ address: WETH, balance: 1n, priceUsd: 2000 });
    expect(filterDisplayableTokens([rich], 0.01)).toEqual([rich]);
    expect(filterDisplayableTokens([dust], 0.01)).toEqual([]);
  });

  it('drops unpriced spam airdrops (not on the curated whitelist)', () => {
    const spam = token({ address: SPAM, symbol: 'DISCOPUSSY', priceUsd: undefined });
    expect(filterDisplayableTokens([spam], 0.01)).toEqual([]);
  });

  it('keeps unpriced curated tokens (the no-Alchemy fallback path)', () => {
    const weth = token({ address: WETH, symbol: 'WETH', priceUsd: undefined });
    expect(filterDisplayableTokens([weth], 0.01)).toEqual([weth]);
  });

  it('matches curated addresses case-insensitively', () => {
    const weth = token({ address: WETH.toUpperCase() as Address, priceUsd: undefined });
    expect(filterDisplayableTokens([weth], 0.01)).toHaveLength(1);
  });
});
