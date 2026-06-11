import type { Address } from 'viem';

export interface CuratedToken {
  address: Address;
  symbol: string;
  name: string;
  decimals: number;
}

/**
 * Top Base tokens by liquidity for the no-Alchemy fallback. Metadata is inlined
 * so the fallback only needs one multicall for balances.
 */
export const CURATED_BASE_TOKENS: CuratedToken[] = [
  {
    address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
  },
  {
    address: '0x4200000000000000000000000000000000000006',
    symbol: 'WETH',
    name: 'Wrapped Ether',
    decimals: 18,
  },
  {
    address: '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA',
    symbol: 'USDbC',
    name: 'USD Base Coin',
    decimals: 6,
  },
  {
    address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
    symbol: 'DAI',
    name: 'Dai Stablecoin',
    decimals: 18,
  },
  {
    address: '0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42',
    symbol: 'EURC',
    name: 'Euro Coin',
    decimals: 6,
  },
  {
    address: '0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22',
    symbol: 'cbETH',
    name: 'Coinbase Wrapped Staked ETH',
    decimals: 18,
  },
  {
    address: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf',
    symbol: 'cbBTC',
    name: 'Coinbase Wrapped BTC',
    decimals: 8,
  },
  {
    address: '0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452',
    symbol: 'wstETH',
    name: 'Wrapped liquid staked Ether',
    decimals: 18,
  },
  {
    address: '0x940181a94A35A4569E4529A3CDfB74e38FD98631',
    symbol: 'AERO',
    name: 'Aerodrome',
    decimals: 18,
  },
  {
    address: '0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed',
    symbol: 'DEGEN',
    name: 'Degen',
    decimals: 18,
  },
  {
    address: '0x532f27101965dd16442E59d40670FaF5eBB142E4',
    symbol: 'BRETT',
    name: 'Brett',
    decimals: 18,
  },
  {
    address: '0xAC1Bd2486aAf3B5C0fc3Fd868558b082a531B2B4',
    symbol: 'TOSHI',
    name: 'Toshi',
    decimals: 18,
  },
  {
    address: '0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b',
    symbol: 'VIRTUAL',
    name: 'Virtual Protocol',
    decimals: 18,
  },
  {
    address: '0x88Fb150BDc53A65fe94Dea0c9BA0a6dAf8C6e196',
    symbol: 'LINK',
    name: 'ChainLink Token',
    decimals: 18,
  },
];
