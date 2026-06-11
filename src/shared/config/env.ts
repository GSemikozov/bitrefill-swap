import { z } from 'zod';

const envSchema = z.object({
  // The Uniswap key is intentionally NOT here: like the Bitrefill key it lives
  // server-side only (UNISWAP_API_KEY), injected by the /api/uniswap proxy —
  // the trade-api gateway blocks CORS for non-localhost origins anyway.
  VITE_WALLETCONNECT_PROJECT_ID: z.string().min(1, 'VITE_WALLETCONNECT_PROJECT_ID is required'),
  VITE_ALCHEMY_API_KEY: z.string().optional().default(''),
  // The Bitrefill key never appears here: requests go through the same-origin
  // /api/bitrefill proxy (Vite dev proxy / Netlify edge function) which injects auth.
  // v2 pinned: probed 2026-06-11 — v1 returns 404 for /products/test-gift-card-code,
  // v2 returns it fine (the PDF's v1 base URL is outdated; dashboard shows v2).
  VITE_BITREFILL_API_BASE: z.string().optional().default('/api/bitrefill/v2'),
  // Demo mode: 'balance' pays invoices from the Bitrefill test-account balance
  // (auto_pay, never charged — verified live 2026-06-12) and skips all on-chain
  // steps. Lets anyone run the full UX without crypto in the wallet.
  VITE_DEMO_PAYMENT: z.enum(['balance']).optional(),
});

// Explicit per-key access on purpose: passing the whole `import.meta.env`
// object makes Vite inline EVERY VITE_-prefixed variable into the bundle —
// including any stray secrets. Only keys referenced here get embedded.
const parsed = envSchema.safeParse({
  VITE_WALLETCONNECT_PROJECT_ID: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID,
  VITE_ALCHEMY_API_KEY: import.meta.env.VITE_ALCHEMY_API_KEY,
  VITE_BITREFILL_API_BASE: import.meta.env.VITE_BITREFILL_API_BASE,
  VITE_DEMO_PAYMENT: import.meta.env.VITE_DEMO_PAYMENT,
});

if (!parsed.success) {
  const missing = parsed.error.issues.map((i) => i.path.join('.')).join(', ');
  throw new Error(`Invalid environment configuration: ${missing}. Check your .env file.`);
}

export const env = parsed.data;
