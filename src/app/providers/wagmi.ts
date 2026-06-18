import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { env } from '@shared/config';
import { http } from 'wagmi';
import { base } from 'wagmi/chains';

const baseRpcUrl = env.VITE_ALCHEMY_API_KEY
  ? `https://base-mainnet.g.alchemy.com/v2/${env.VITE_ALCHEMY_API_KEY}`
  : undefined;

export const wagmiConfig = getDefaultConfig({
  appName: 'Bitrefill Swap',
  projectId: env.VITE_WALLETCONNECT_PROJECT_ID,
  chains: [base],
  transports: {
    [base.id]: http(baseRpcUrl),
  },
});
