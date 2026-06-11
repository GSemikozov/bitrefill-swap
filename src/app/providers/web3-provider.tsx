import { darkTheme, RainbowKitProvider } from '@rainbow-me/rainbowkit';
import type { ReactNode } from 'react';
import { WagmiProvider } from 'wagmi';
import { wagmiConfig } from '../config/wagmi';
import '@rainbow-me/rainbowkit/styles.css';

const rainbowKitTheme = darkTheme({
  accentColor: '#3b82f6',
  accentColorForeground: '#f4f6f8',
  borderRadius: 'medium',
  overlayBlur: 'small',
});

// Align RainbowKit's modal surfaces with the app's design tokens.
rainbowKitTheme.colors.modalBackground = '#131a24';
rainbowKitTheme.colors.modalBorder = '#1f2733';
rainbowKitTheme.colors.modalText = '#f4f6f8';
rainbowKitTheme.colors.modalTextSecondary = '#8b95a5';

export function Web3Provider({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <RainbowKitProvider theme={rainbowKitTheme} modalSize="compact">
        {children}
      </RainbowKitProvider>
    </WagmiProvider>
  );
}
