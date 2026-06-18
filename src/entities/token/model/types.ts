import type { DiscoveredToken } from '@shared/api/tokens';
import { USDC_BASE_ADDRESS } from '@shared/config';
import type { Address } from 'viem';

export type { DiscoveredToken } from '@shared/api/tokens';

/** Serializable token selection — amounts are intentionally not stored here. */
export interface SelectedToken {
  address: Address;
  symbol: string;
  name: string;
  decimals: number;
  logoUrl?: string;
}

export function toSelectedToken(token: DiscoveredToken): SelectedToken {
  return {
    address: token.address,
    symbol: token.symbol,
    name: token.name,
    decimals: token.decimals,
    logoUrl: token.logoUrl,
  };
}

export function isUsdc(address: string): boolean {
  return address.toLowerCase() === USDC_BASE_ADDRESS.toLowerCase();
}
