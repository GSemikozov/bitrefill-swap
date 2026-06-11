import { SwapPage } from '@pages/swap';
import { AppProvider } from './providers';

export function App() {
  return (
    <AppProvider>
      <SwapPage />
    </AppProvider>
  );
}
