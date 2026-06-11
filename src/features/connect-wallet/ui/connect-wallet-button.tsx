import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Button } from '@shared/ui';
import { Wallet } from 'lucide-react';

interface ConnectWalletButtonProps {
  /** Header use: collapse to an icon below xs to save row space. Default keeps the label. */
  collapseLabel?: boolean;
}

/** RainbowKit connect flow rendered with the app's own button styles. */
export function ConnectWalletButton({ collapseLabel = false }: ConnectWalletButtonProps = {}) {
  return (
    <ConnectButton.Custom>
      {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
        const connected = mounted && account && chain;

        if (!mounted) return <Button variant="secondary" disabled aria-hidden />;

        if (!connected) {
          return (
            <Button onClick={openConnectModal} aria-label="Connect wallet">
              <Wallet aria-hidden />
              <span className={collapseLabel ? 'hidden xs:inline' : undefined}>Connect wallet</span>
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
