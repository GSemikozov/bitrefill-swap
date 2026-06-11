/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_UNISWAP_API_KEY: string;
  readonly VITE_WALLETCONNECT_PROJECT_ID: string;
  readonly VITE_ALCHEMY_API_KEY?: string;
  readonly VITE_BITREFILL_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
