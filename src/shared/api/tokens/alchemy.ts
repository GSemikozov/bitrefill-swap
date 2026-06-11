import { env, NATIVE_TOKEN_ADDRESS } from '@shared/config';
import type { Address } from 'viem';
import { hexToBigInt, isHex } from 'viem';
import { z } from 'zod';
import { apiRequest } from '../client';
import { basePublicClient } from './rpc';
import type { DiscoveredToken, TokenDiscovery } from './types';

const RPC_URL = () => `https://base-mainnet.g.alchemy.com/v2/${env.VITE_ALCHEMY_API_KEY}`;
const PRICES_URL = () => `https://api.g.alchemy.com/prices/v1/${env.VITE_ALCHEMY_API_KEY}`;

/** Cap metadata/price lookups — a wallet full of dust shouldn't fire 500 requests. */
const MAX_TOKENS = 40;

const tokenBalancesSchema = z.object({
  result: z.object({
    tokenBalances: z.array(
      z.object({
        contractAddress: z.string(),
        tokenBalance: z.string().nullable(),
      })
    ),
  }),
});

const tokenMetadataSchema = z.object({
  result: z.object({
    name: z.string().nullable(),
    symbol: z.string().nullable(),
    decimals: z.number().nullable(),
    logo: z.string().nullable(),
  }),
});

const pricesByAddressSchema = z.object({
  data: z.array(
    z.object({
      address: z.string(),
      prices: z.array(z.object({ currency: z.string(), value: z.string() })),
    })
  ),
});

const pricesBySymbolSchema = z.object({
  data: z.array(
    z.object({
      symbol: z.string(),
      prices: z.array(z.object({ currency: z.string(), value: z.string() })),
    })
  ),
});

async function rpcCall<T>(method: string, params: unknown[], schema: z.ZodType<T>): Promise<T> {
  return apiRequest(RPC_URL(), {
    method: 'POST',
    body: { jsonrpc: '2.0', id: 1, method, params },
    schema,
  });
}

interface RawBalance {
  address: Address;
  balance: bigint;
}

async function fetchErc20Balances(owner: Address): Promise<RawBalance[]> {
  const response = await rpcCall('alchemy_getTokenBalances', [owner, 'erc20'], tokenBalancesSchema);
  return response.result.tokenBalances
    .filter((entry) => entry.tokenBalance && isHex(entry.tokenBalance))
    .map((entry) => ({
      address: entry.contractAddress as Address,
      balance: hexToBigInt(entry.tokenBalance as `0x${string}`),
    }))
    .filter((entry) => entry.balance > 0n)
    .slice(0, MAX_TOKENS);
}

async function fetchMetadata(address: Address) {
  const response = await rpcCall('alchemy_getTokenMetadata', [address], tokenMetadataSchema);
  return response.result;
}

/** Prices are an enhancement — discovery still works if this call fails. */
async function fetchUsdPrices(addresses: Address[]): Promise<Map<string, number>> {
  const prices = new Map<string, number>();
  if (addresses.length === 0) return prices;
  try {
    const response = await apiRequest(`${PRICES_URL()}/tokens/by-address`, {
      method: 'POST',
      body: { addresses: addresses.map((address) => ({ network: 'base-mainnet', address })) },
      schema: pricesByAddressSchema,
    });
    for (const entry of response.data) {
      const usd = entry.prices.find((p) => p.currency === 'usd');
      if (usd) prices.set(entry.address.toLowerCase(), Number(usd.value));
    }
  } catch {
    // Tokens render without fiat values; sorting falls back to symbol order.
  }
  return prices;
}

async function fetchEthPriceUsd(): Promise<number | undefined> {
  try {
    const response = await apiRequest(`${PRICES_URL()}/tokens/by-symbol?symbols=ETH`, {
      schema: pricesBySymbolSchema,
    });
    const usd = response.data[0]?.prices.find((p) => p.currency === 'usd');
    return usd ? Number(usd.value) : undefined;
  } catch {
    return undefined;
  }
}

async function buildNativeToken(owner: Address): Promise<DiscoveredToken | null> {
  const [balance, priceUsd] = await Promise.all([
    basePublicClient.getBalance({ address: owner }),
    fetchEthPriceUsd(),
  ]);
  if (balance === 0n) return null;
  return {
    address: NATIVE_TOKEN_ADDRESS,
    symbol: 'ETH',
    name: 'Ether',
    decimals: 18,
    balance,
    priceUsd,
  };
}

async function buildErc20Tokens(owner: Address): Promise<DiscoveredToken[]> {
  const balances = await fetchErc20Balances(owner);
  const [metadata, prices] = await Promise.all([
    Promise.all(balances.map((entry) => fetchMetadata(entry.address))),
    fetchUsdPrices(balances.map((entry) => entry.address)),
  ]);

  const tokens: DiscoveredToken[] = [];
  balances.forEach((entry, index) => {
    const meta = metadata[index];
    // Tokens without symbol/decimals are unusable in the swap form — skip them.
    if (!meta?.symbol || meta.decimals === null) return;
    tokens.push({
      address: entry.address,
      symbol: meta.symbol,
      name: meta.name ?? meta.symbol,
      decimals: meta.decimals,
      logoUrl: meta.logo ?? undefined,
      balance: entry.balance,
      priceUsd: prices.get(entry.address.toLowerCase()),
    });
  });
  return tokens;
}

export const alchemyTokenDiscovery: TokenDiscovery = {
  async getHeldTokens(owner: Address): Promise<DiscoveredToken[]> {
    const [native, erc20s] = await Promise.all([buildNativeToken(owner), buildErc20Tokens(owner)]);
    return native ? [native, ...erc20s] : erc20s;
  },
};
