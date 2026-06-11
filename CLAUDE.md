# Bitrefill Swap — Project Memory

Single-page app: swap any token held on Base for a Bitrefill Balance gift card (USD), ending
with a redeemable code, without leaving the page.

## Commands

```bash
nvm use 22          # Node >= 22 required (system default may be 16!)
npm run dev         # Vite dev server → http://localhost:3000
npm run build       # tsc -b && vite build → dist/
npm run test:run    # Vitest single run
npm run lint        # biome check ./src
npm run deadcode    # knip — unused files/exports/deps
npm run typecheck   # tsc -b --noEmit
```

## Product constraints

- Gift card product is fixed: `test-gift-card-code` (free on Bitrefill's side, returns a
  real-looking code).
- Swap always settles in USDC on Base: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (6 decimals).
- Token list must reflect what the user actually holds.
- Both API keys (Bitrefill, Uniswap) are server-side only, injected by same-origin proxies —
  never shipped in the bundle (CI enforces this).

## Conventions

- FSD layers `app/pages/widgets/features/entities/shared`; kebab-case slices;
  `features/<name>/ui/<component>.tsx` + `index.ts` barrels; `entities/<name>/model/types.ts`.
- Barrels export only the consumed public surface; tests import implementation files directly.
- Aliases `@app @pages @widgets @features @entities @shared` (+ `@/`) in vite + tsconfig.
- Biome 2: single quotes, semicolons, lineWidth 100, organize imports, cognitive-complexity error.
- Tailwind v4 via `@tailwindcss/vite`; design tokens in `@theme` (`--color-card`,
  `--color-muted-foreground`, `--color-border`…); dark navy/blue palette (NOT default shadcn).
- Zustand: `devtools(persist(...))` with `partialize`; tests reset via `useStore.setState`.
- TanStack Query: `QUERY_KEYS` factory in `shared/api/query-keys.ts` (lives in shared on
  purpose — lower layers importing @app would violate FSD direction), one-hook-per-domain,
  explicit `staleTime`/`refetchInterval`.
- Typed API client: `ApiError { message, code, details }`, timeout, zod-parse ALL external
  responses at the `shared/api` boundary.
- Vitest + Testing Library, jsdom, globals, colocated `*.test.ts(x)`, setup `src/test/setup.ts`.
  Tests are hermetic — no `.env` required (`test.env` in vite.config.ts).

## Architecture decisions

- Swap-flow is a Zustand FSM (discriminated union on `status`):
  `idle → selecting → quoting → review → creating_invoice → approving? → swapping? → paying →
  polling_invoice → success | failed(recoverable, step, reason)`.
- Invoice created only on user confirm; then re-quote EXACT_OUTPUT for `payment.price` USDC.
- Payment = two separate on-chain steps with separate tx hashes: Uniswap swap → ERC-20 transfer
  of `payment.price` USDC to `payment.address`.
- Skips: token IS USDC → straight to `paying`; sufficient allowance → skip `approving`.
- Persist to sessionStorage (partialize): `invoiceId`, `paymentAddress`, `paymentPrice`,
  tx hashes, `status` — reload mid-flow must resume polling.
- Purchase history: ids only in localStorage (per-wallet, capped); codes never stored at rest —
  re-fetched on demand via the order endpoint.
- Token discovery behind a `TokenDiscovery` interface: Alchemy impl + curated-list/multicall
  fallback (auto when no `VITE_ALCHEMY_API_KEY`).

## Env / API quirks

- System Node is 16 — always `nvm use 22` (`.nvmrc` present). Use
  `export PATH=~/.nvm/versions/node/v22.22.2/bin:$PATH` in non-interactive shells.
- Bitrefill API is CORS-blocked for browsers and the key must stay out of the bundle:
  client always calls same-origin `/api/bitrefill/*`; Vite dev proxy (vite.config.ts) and a
  Netlify Edge Function (netlify/edge-functions/bitrefill-proxy.ts) inject
  `Authorization: Bearer $BITREFILL_API_KEY` server-side. `BITREFILL_API_KEY` has no `VITE_`
  prefix on purpose (a bare `import.meta.env` reference in any dep inlines ALL VITE_ vars).
- **Uniswap is proxied the same way** (`/api/uniswap/*`, key `UNISWAP_API_KEY` with
  `VITE_UNISWAP_API_KEY` fallback): probed 2026-06-12 — trade-api gateway serves CORS ONLY for
  localhost origins; production browser calls are blocked. Direct curl (no Origin) works.
- **Never mutate the Uniswap quote object** — it round-trips to `/swap` verbatim, and the API
  flips numeric fields (gasFeeUSD etc.) between number and string across calls. No z.coerce
  inside the quote; convert at read time.
- Bitrefill API version: older docs reference `/v1`, but live probes (2026-06-11) show
  **v1 → 404, v2 → 200**. Pinned `/api/bitrefill/v2` (default in `shared/config/env.ts`).
- v2 response envelope is `{ meta, data }` — actual payload lives under `data`.
- Product endpoint: `currency` query param is ignored; `packages[].amount` is the USD
  denomination, `packages[].price` is in the account display currency (satoshis) — do NOT use it.
  Exact USDC cost comes only from the invoice: `payment.price` in USDC base units (6 decimals,
  e.g. 10500000 = 10.5 USDC for a $10 card — ~5% premium over face value).
- Invoice statuses observed: pre-payment invoice `not_delivered` / payment `unpaid` / order
  `created`. A PAID invoice reports **`all_delivered`** + payment `complete` (live-verified
  2026-06-12); `isInvoicePaid` also accepts `payment_received`/`complete` + payment.status
  fallback. Balance-paid invoices have NO `payment.address`.
- **Free full Bitrefill-flow run** (no real money): `POST /invoices` with
  `payment_method: "balance", auto_pay: true` → completes in seconds, deducts nothing
  (balance stays 0), order delivers a real-looking code. Verified delivered shape:
  `redemption_info: { code, instructions, other, extra_fields }` (no link field).
- This is exposed as **demo mode**: runtime toggle in the header (localStorage override,
  reloads on switch, blocked mid-purchase); `VITE_DEMO_PAYMENT=balance` only sets the default.
  On-chain steps skipped, invoice auto-pays, empty wallets get the curated token list.
- Bitrefill MCP (`api.bitrefill.com/mcp`, accepts the same Bearer key) is connected as a local
  dev tool for this project (`claude mcp list`) — handy for inspecting invoices.
  Deliberately NOT used in the app itself (agent-as-buyer surface; rationale in WRITEUP).
- On-chain half has NO free path: Uniswap Trading API has no testnet quotes (Base Sepolia →
  404 "No quotes available", probed 2026-06-12); Bitrefill `usdc_base` is mainnet-only.
  Options: anvil fork of Base (chainId 8453, real calldata executes; Bitrefill won't see the
  payment) or a real ~10.5 USDC run.
- Explicit `gas: 100_000n` on the USDC transfer: right after the swap the wallet's RPC can lag
  a block, estimation reverts against the pre-swap balance and some wallets submit an absurd
  fallback gas limit that Base rejects.

## Deployment / verification status

- Live: https://bitrefill-swap.netlify.app (badge in README). Env vars set in Netlify;
  `UNISWAP_API_KEY` must stay un-prefixed there (see VITE_ inlining note above).
- GitHub Actions CI: biome → tsc → vitest → build → bundle key-leak scan; hermetic (no .env).
- End-to-end verified on live systems (2026-06-12): demo path, native-ETH swap path, and
  ERC-20 path with approve + Permit2 (production) — details in docs/WRITEUP.md.
- Rainbow's extension may hang on its tx-confirm screen (their simulation bug) — MetaMask works.

## Process rules

- Never add skills, agents, or CLAUDE.md sections beyond this scope silently — propose first.
- Work in increments; report status after each milestone.
- Conventional commits.
