import { NATIVE_TOKEN_ADDRESS } from '@shared/config';
import type { Address } from 'viem';
import { erc20Abi } from 'viem';
import { CURATED_BASE_TOKENS } from './curated-list';
import { basePublicClient } from './rpc';
import type { DiscoveredToken, TokenDiscovery } from './types';

/**
 * No-Alchemy fallback: balanceOf over a curated top-liquidity Base list via one
 * multicall. No USD prices in this mode — the UI degrades gracefully.
 */
export const fallbackTokenDiscovery: TokenDiscovery = {
  async getHeldTokens(owner: Address): Promise<DiscoveredToken[]> {
    const [nativeBalance, results] = await Promise.all([
      basePublicClient.getBalance({ address: owner }),
      basePublicClient.multicall({
        contracts: CURATED_BASE_TOKENS.map((token) => ({
          address: token.address,
          abi: erc20Abi,
          functionName: 'balanceOf' as const,
          args: [owner] as const,
        })),
      }),
    ]);

    const tokens: DiscoveredToken[] = [];
    if (nativeBalance > 0n) {
      tokens.push({
        address: NATIVE_TOKEN_ADDRESS,
        symbol: 'ETH',
        name: 'Ether',
        decimals: 18,
        balance: nativeBalance,
      });
    }

    CURATED_BASE_TOKENS.forEach((token, index) => {
      const result = results[index];
      if (result?.status !== 'success') return;
      const balance = result.result as bigint;
      if (balance === 0n) return;
      tokens.push({ ...token, balance });
    });

    return tokens;
  },
};
