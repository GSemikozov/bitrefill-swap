import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Button } from '@shared/ui';
import { Wallet } from 'lucide-react';

/** RainbowKit connect flow rendered with the app's own button styles. */
export function ConnectWalletButton() {
  return (
    <ConnectButton.Custom>
      {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
        const connected = mounted && account && chain;

        if (!mounted) return <Button variant="secondary" disabled aria-hidden />;

        if (!connected) {
          return (
            <Button onClick={openConnectModal}>
              <Wallet aria-hidden />
              Connect wallet
            </Button>
          );
        }

        if (chain.unsupported) {
          return (
            <Button variant="destructive" onClick={openChainModal}>
              Wrong network
            </Button>
          );
        }

        return (
          <Button variant="secondary" onClick={openAccountModal}>
            {account.displayName}
          </Button>
        );
      }}
    </ConnectButton.Custom>
  );
}
