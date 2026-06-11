import type { ReactNode } from 'react';
import { AppErrorBoundary } from './error-boundary';
import { QueryProvider } from './query-provider';
import { Web3Provider } from './web3-provider';

// Wagmi requires a QueryClientProvider above it; Web3Provider sits inside QueryProvider.
// The error boundary wraps everything so even wallet-library render crashes get a UI.
export function AppProvider({ children }: { children: ReactNode }) {
  return (
    <AppErrorBoundary>
      <QueryProvider>
        <Web3Provider>{children}</Web3Provider>
      </QueryProvider>
    </AppErrorBoundary>
  );
}
