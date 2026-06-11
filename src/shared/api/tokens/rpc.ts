import { env } from '@shared/config';
import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';

const rpcUrl = env.VITE_ALCHEMY_API_KEY
  ? `https://base-mainnet.g.alchemy.com/v2/${env.VITE_ALCHEMY_API_KEY}`
  : undefined;

/** Standalone read-only client for the shared layer (wagmi's lives in app). */
export const basePublicClient = createPublicClient({
  chain: base,
  transport: http(rpcUrl),
});
