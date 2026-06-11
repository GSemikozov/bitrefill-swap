import type { DiscoveredToken } from '@shared/api/tokens';
import { USDC_BASE_ADDRESS } from '@shared/config';
import type { SelectedToken } from '@shared/lib/swap-flow';

export type { DiscoveredToken } from '@shared/api/tokens';

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
