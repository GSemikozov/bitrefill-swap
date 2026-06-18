import { darkTheme, RainbowKitProvider } from '@rainbow-me/rainbowkit';
import type { ReactNode } from 'react';
import { WagmiProvider } from 'wagmi';
import { wagmiConfig } from './wagmi';
import '@rainbow-me/rainbowkit/styles.css';

// Bind RainbowKit's theme to the app's Tailwind @theme tokens (app/styles/index.css)
// instead of duplicating hex literals. RainbowKit emits every theme color as a
// `--rk-colors-*` custom property that its components read via var(), so handing it
// `var(--color-*)` lets CSS resolve our tokens transitively — change the palette in
// one place and the wallet modal follows, with no silent drift.
const rainbowKitTheme = darkTheme({
  accentColor: 'var(--color-primary)',
  accentColorForeground: 'var(--color-primary-foreground)',
  borderRadius: 'medium',
  overlayBlur: 'small',
});

rainbowKitTheme.colors.modalBackground = 'var(--color-popover)';
rainbowKitTheme.colors.modalBorder = 'var(--color-border)';
rainbowKitTheme.colors.modalText = 'var(--color-popover-foreground)';
rainbowKitTheme.colors.modalTextSecondary = 'var(--color-muted-foreground)';

export function Web3Provider({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <RainbowKitProvider theme={rainbowKitTheme} modalSize="compact">
        {children}
      </RainbowKitProvider>
    </WagmiProvider>
  );
}
