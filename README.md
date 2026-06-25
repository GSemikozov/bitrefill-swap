# Bitrefill Swap

[![Netlify Status](https://api.netlify.com/api/v1/badges/b54312a2-0cbf-4a13-9dd7-192ea75f4488/deploy-status)](https://app.netlify.com/projects/bitrefill-swap/deploys)

Swap any token you hold on Base for a **Bitrefill Balance gift card (USD)** and walk away with a
redeemable code — all on one page.

> **Live:** [bitrefill-swap.netlify.app](https://bitrefill-swap.netlify.app/)

Connect a wallet → pick a token you actually hold → pick a card amount → confirm. The app creates
a Bitrefill invoice, swaps your token to the exact USDC amount via the Uniswap Trading API,
transfers it to the invoice address, polls until payment is confirmed, and reveals the redemption
code. Paying directly with USDC skips the swap entirely.

## Tech stack

| Layer | Choice |
| --- | --- |
| Core | React 19 · TypeScript (strict) · Vite 7 |
| Web3 | wagmi v2 · viem · RainbowKit (Base only) |
| Server state | TanStack Query v5 (polling, quote TTL, caching) |
| Client state | Zustand v5 — the swap flow as a finite state machine, persisted to sessionStorage |
| Forms / validation | React Hook Form + zod v4 (zod also validates every external API response) |
| Styling | Tailwind CSS v4 (design tokens via `@theme`) · CVA · shadcn-style primitives |
| Quality | Biome 2 (lint + format) · Vitest 4 + Testing Library (78 tests) · knip (dead code) · GitHub Actions |
| Hosting | Netlify (static + edge-function proxies; [not locked in](#deployment-netlify)) |

Decision rationale (why Zustand-FSM over RTK, why RainbowKit, why polling, etc.) lives in
[docs/WRITEUP.md](docs/WRITEUP.md).

## Quick start

```bash
# Prerequisites: Node >= 22
nvm use 22

npm install

# Configure environment
cp .env.example .env
# Fill in BITREFILL_API_KEY, UNISWAP_API_KEY, VITE_WALLETCONNECT_PROJECT_ID
# (VITE_ALCHEMY_API_KEY is optional — without it, token discovery uses a curated list)

npm run dev        # → http://localhost:3000
```

### Demo mode (no crypto needed)

Click **"Try demo"** in the page header to walk the entire flow without spending anything:
the invoice is paid from the Bitrefill test-account balance (`auto_pay` — the test product
never charges it), all on-chain steps are skipped, and a real-looking redemption code is
delivered. The amber **"Demo on"** badge and step-by-step copy make the mode unmissable, and
an empty wallet still gets a token list to pick from. The toggle is disabled mid-purchase.

`VITE_DEMO_PAYMENT=balance` in `.env` only sets the default — the header toggle
(persisted in localStorage) always wins.

### Scripts

```bash
npm run build      # tsc -b && vite build → dist/
npm run preview    # Preview the production build
npm run test       # Vitest watch mode
npm run test:run   # Single run (67 tests)
npm run lint       # Biome check
npm run lint:fix   # Biome auto-fix
npm run typecheck  # tsc -b --noEmit
```

## Architecture

Feature-Sliced Design with strict layering (`app → pages → widgets → features → entities → shared`):

```
src/
├── app/            # entry (main.tsx), providers (wagmi + RainbowKit, TanStack Query), theme
├── pages/swap/     # the single page, switches widgets by flow phase
├── widgets/
│   ├── swap-card/        # token + denomination selection, review with quote countdown
│   ├── checkout-status/  # vertical step indicator (approve → swap → pay → confirm)
│   └── redemption-card/  # masked code reveal/copy, order ids
├── features/       # connect-wallet, select-token, select-denomination,
│                   # get-quote, execute-swap, pay-invoice (in execute), poll-invoice
├── entities/       # swap-flow (purchase FSM + error mapping), token (discovery + rows),
│                   # gift-card (denominations), invoice (polling)
└── shared/
    ├── api/        # typed clients: bitrefill/ (zod-validated v2), uniswap/, tokens/
    ├── lib/        # monitoring (Sentry facade), formatting, classnames
    ├── config/     # addresses, domain constants (bitrefill/invoice/quote/tokens), validated env
    └── ui/         # themed shadcn-style primitives (button, dialog, command, …)
```

### `shared/ui` is an extractable design system

The primitives layer is deliberately self-contained: no business imports, theming only through
the design tokens in [app/styles](src/app/styles/index.css), variants via CVA. It could be
lifted into a standalone ui-kit package as-is. The natural next step there is **Storybook** —
documenting the dynamic states that currently only show up mid-flow (button loading, skeleton
placeholders, command-list empty/error states, step-indicator phases) as isolated, reviewable
stories.

**Motion** is wired via `tw-animate-css`: modals animate open/close (Radix keeps the node mounted
on `data-state="closed"`) and the main content fades on phase changes (connect → swap → checkout
→ success), so cards and amounts don't snap in.

### The swap flow is a finite state machine

One Zustand store ([entities/swap-flow](src/entities/swap-flow/model/store.ts)) with a single
discriminated `phase`, guarded transitions, and no scattered booleans:

```
idle → selecting → quoting → review
  → creating_invoice → approving? → swapping? → paying
  → polling_invoice → success | failed(step, reason, recoverable)
```

- The **invoice is created only on confirm** (it is a real order); the pre-confirm price is an
  estimate. After creation the app re-quotes **EXACT_OUTPUT** for `payment.price` so the wallet
  sends exactly what the invoice requires.
- Payment is two separate on-chain transactions with separate hashes: the Uniswap swap into your
  own wallet, then a plain USDC `transfer` to Bitrefill.
- The durable slice (invoice id, payment details, tx hashes, phase) persists to
  `sessionStorage` — **reloading mid-flow resumes polling**; a paid invoice or code is never lost.
- Failures are recoverable per step: retry re-enters the machine exactly where it broke.

### Key integration notes

- **Bitrefill API is v2**, not the documented v1 (probed: v1 → 404). All responses are
  zod-validated at the `shared/api` boundary; schema drift surfaces as a typed error.
- **Token discovery** is an interface with two implementations: Alchemy (full discovery,
  metadata, USD prices) and a curated-list + viem `multicall` fallback used automatically when
  no `VITE_ALCHEMY_API_KEY` is set. Native ETH is always included; dust under $0.01 is hidden
  when a price is known.
- **Uniswap Trading API** (`check_approval` → `quote` → `swap`) with the Permit2 flow: approval
  tx only when the allowance is missing, signature-only permit otherwise. Quotes auto-refresh
  every 30s with a visible countdown in review.
- **Purchase history** survives "Start a new swap": ids only in `localStorage` (scoped to the
  connected wallet, capped at 20) — redemption codes are never stored at rest and are
  re-fetched on demand through the order endpoint.

## Environment

| Variable | Purpose |
| --- | --- |
| `BITREFILL_API_KEY` | Server-side only — read by the dev proxy / edge function, no `VITE_` prefix on purpose |
| `UNISWAP_API_KEY` | Server-side only too ([hub.uniswap.org](https://hub.uniswap.org)): the trade-api gateway blocks CORS for non-localhost origins, so calls go through the same-origin `/api/uniswap` proxy (`VITE_UNISWAP_API_KEY` is accepted as a fallback name) |
| `VITE_WALLETCONNECT_PROJECT_ID` | RainbowKit / WalletConnect ([cloud.reown.com](https://cloud.reown.com)) |
| `VITE_ALCHEMY_API_KEY` | Optional — richer token discovery + USD prices |

## Deployment (Netlify)

Auto-deploys `main` with PR previews. One-time setup:

1. Connect the repo at [app.netlify.com](https://app.netlify.com) (build settings are read from
   [netlify.toml](netlify.toml) — build `npm run build`, publish `dist/`, SPA redirect included).
2. Set the four env vars above in **Site settings → Environment variables**.
3. The Bitrefill proxy is a deployed [Edge Function](netlify/edge-functions/bitrefill-proxy.ts)
   bound to `/api/bitrefill/*` — it reads `BITREFILL_API_KEY` from Netlify env, so the key stays
   out of the client bundle in production too.

CI ([.github/workflows/ci.yml](.github/workflows/ci.yml)) gates every push: Biome, `tsc`,
Vitest, build, and a bundle scan for key leaks.

**Not locked to Netlify.** The client only knows the same-origin paths `/api/bitrefill/*` and
`/api/uniswap/*`; the Netlify-specific part is two small adapter files (`netlify.toml` + the
edge functions). Any host that can proxy with an injected header works the same way: a
Cloudflare Pages Function, Vercel Edge Middleware, or plain nginx `proxy_pass` +
`proxy_set_header` — the Vite dev proxy in [vite.config.ts](vite.config.ts) is the reference
implementation of the contract.

## Testing

- **Unit**: FSM transitions/guards/persistence/resume, zod schemas against captured live
  fixtures, formatting, denomination + affordability validation, step-indicator model.
- **Component**: token select (search/empty/skeleton/error), step indicator, redemption card.
- **Integration smoke**: mocked Bitrefill + Uniswap clients drive the full happy path, the
  approval path, the USDC-direct path, and rejection → retry through the real orchestrator.

## Known limitations

- **MetaMask deep-link warning in mobile emulation.** Clicking MetaMask while in a desktop
  browser's mobile-emulation viewport logs `Failed to launch 'metamask://…' because the scheme
  does not have a registered handler`. This is RainbowKit's mobile path firing in an environment
  that has no MetaMask app to handle the deep link. On a real desktop it uses the browser
  extension (verified end-to-end), and on a real phone the link opens the MetaMask app — so the
  warning only appears in emulation, never to an actual user.

- **Order emails go to the API-key account, not the buyer.** The app talks to Bitrefill through a
  single server-side API key, so every order is created under that one Bitrefill account.
  Bitrefill's order-confirmation emails therefore land in the key owner's inbox regardless of who
  drives the UI — the request payload carries no per-user email (only the wallet as `refund_address`),
  and the connected wallet is just the on-chain payer, unrelated to Bitrefill account identity. A
  multi-tenant product would use per-user Bitrefill (sub-)accounts or route notifications through its
  own backend.

## Approach, decisions, and AI usage

**How the problem was approached.** Probe first, build second: both APIs were hit with the real
keys before any code was written — that surfaced the v1-vs-v2 base-URL discrepancy, the
satoshi-denominated product prices, and the quote round-trip rules that shaped the schemas.
Then strict increments (scaffold → API layer → state machine → UI → tests → deploy), each gated
by lint/typecheck/tests. The key decisions — Zustand-FSM over RTK, invoice-on-confirm with an
EXACT_OUTPUT re-quote, polling over webhooks, proxy-injected keys, device-local purchase
history — are argued in [docs/WRITEUP.md](docs/WRITEUP.md), including the
considered-and-rejected options (Bitrefill's MCP surface, Alchemy Swaps/Portfolio,
API-side history).

**What I'd do differently with more time.** A thin backend (key custody, webhook-driven invoice
status, per-user history), Playwright e2e with a mock EIP-1193 wallet, Alchemy Portfolio API to
collapse token discovery into one call, multi-chain input via bridging quotes, Permit2 deadline
UX, Storybook for `shared/ui`, and shipping the proxy logs to a sink via Netlify Log Drains
(error monitoring itself — Sentry with FSM-phase breadcrumbs + PII scrubbing — is now wired in
[shared/lib/monitoring](src/shared/lib/monitoring/sentry.ts)). Full list in the
[writeup](docs/WRITEUP.md#what-id-do-differently-with-more-time).

**AI tools.** Built with **Claude Code** (Anthropic); **Claude in Chrome** drove the in-browser
end-to-end runs, while every wallet confirmation and payment was performed by the author
personally. The prompting style and representative prompts are described in
[docs/WRITEUP.md → AI usage](docs/WRITEUP.md#ai-usage); the three live e2e runs (demo,
native-ETH swap, ERC-20 with approve + Permit2 on production) and the five bugs they caught are
documented in [End-to-end verification](docs/WRITEUP.md#end-to-end-verification).
