import type { Address } from 'viem';

export const BASE_CHAIN_ID = 8453;

/** The swap always settles in USDC on Base (fixed by the assignment). */
export const USDC_BASE_ADDRESS: Address = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
export const USDC_DECIMALS = 6;

/** Sentinel address the Uniswap Trading API uses for native ETH input. */
export const NATIVE_TOKEN_ADDRESS: Address = '0x0000000000000000000000000000000000000000';

const BASE_EXPLORER_URL = 'https://basescan.org';

export function explorerTxUrl(hash: string): string {
  return `${BASE_EXPLORER_URL}/tx/${hash}`;
}
