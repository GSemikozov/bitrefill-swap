# Writeup — Bitrefill Swap

## How I approached it

I started by probing both APIs with the provided keys before writing any code, because two
things in the brief didn't add up — and both probes changed the implementation:

1. **Bitrefill is v2, not v1.** The integration docs give `https://api.bitrefill.com/v1` as the base URL, but
   the developer dashboard shows v2. Probing `GET /products/test-gift-card-code?currency=USDC`
   with the provided key: **v1 → 404, v2 → 200**. Everything is pinned to v2 (configurable via
   `VITE_BITREFILL_API_BASE`). Two more findings from the probes: the v2 envelope is
   `{ meta, data }`; and the product endpoint's `price` field is denominated in the account's
   display currency (satoshis here — the `currency` query param is ignored), so the only
   trustworthy USDC amount is the invoice's `payment.price` (base units: a $10 card costs
   10 500 000 = 10.5 USDC, a ~5 % premium I use for the pre-invoice estimate, clearly labeled).
2. **The Uniswap Trading API quote shape.** Live probes confirmed EXACT_OUTPUT support, the
   zero-address convention for native ETH, Permit2 approval via `check_approval`, and that the
   `/swap` endpoint wants the quote object back verbatim — which is why the zod schemas are
   deliberately loose (`looseObject`): they validate what the UI reads and preserve everything
   else for the round-trip. Captured responses became test fixtures.

Then: scaffold → API layer → flow state machine → UI → tests → docs, with conventions inherited
from my two reference projects (FSD layout, Biome, design-token theming, typed API client,
query-key factory, one-hook-per-domain).

## Key decisions

### State: TanStack Query + a Zustand FSM (and why not Redux Toolkit)

Server state — balances, product, quotes, invoice polling — lives in TanStack Query, which wagmi
already mandates as a peer dependency. RTK Query would duplicate that cache layer wholesale. The
remaining client state is exactly one thing: the purchase flow. That's a single Zustand store
modeled as a finite state machine — a discriminated `phase` union, a transition table, guarded
edges (illegal transitions are no-ops that warn in dev), and explicit actions. No scattered
`isLoading`/`isApproved` booleans; impossible states are unrepresentable. Right-sizing beats a
framework: ~150 lines, fully unit-tested.

The durable slice (invoice id, payment address/price, tx hashes, phase) persists to
**sessionStorage** via `persist`/`partialize`. On rehydrate, a pure `deriveResumedState` decides
where to resume: polling/success resume as-is (a paid invoice must never be lost), an interrupted
execution step becomes a *recoverable failure* with retry at exactly that step, and anything
pre-invoice resets — nothing durable existed yet. sessionStorage over localStorage is deliberate:
reloads are protected, but yesterday's half-finished flow doesn't haunt a new session.

### Invoice-on-confirm + EXACT_OUTPUT re-quote

An invoice is a real order, so it is created only when the user confirms. Before that, the price
shown is an estimate (denomination × observed 5 % premium → Uniswap quote). After creation, the
app re-quotes **EXACT_OUTPUT** for the invoice's `payment.price`, so the swap delivers exactly
the USDC the invoice requires — no dust, no underpayment. Payment is then two independent
on-chain steps with separate tx hashes and separate FSM states: swap into the user's own wallet,
then a plain ERC-20 `transfer` to Bitrefill. Keeping them separate makes every failure mode
recoverable: if the transfer fails after a successful swap, the USDC is already in the user's
wallet and retry just re-sends the transfer.

Skip paths: USDC input goes straight to payment (no quote, no swap — this also makes the full
Bitrefill flow testable with zero swap risk); a sufficient Permit2 allowance skips the approval
state entirely (signature-only permit).

### Wallet UX: RainbowKit (vs ConnectKit / AppKit / custom)

RainbowKit because it pairs first-class with wagmi v2, ships accessible modals, and its theming
API let me match the app palette rather than shipping a stock look. Trade-offs: it pulls in
WalletConnect/Lit weight and is opinionated visually. ConnectKit is lighter but less maintained;
AppKit (WalletConnect's own) is heavier and pushier about its ecosystem; a custom connector UI is
a week of edge cases (wallet detection, mobile deep links) outside this project's scope. The FSD
isolation makes the choice cheap to reverse: RainbowKit is imported in exactly two slices —
`app/providers` and `features/connect-wallet` — so swapping it touches nothing else.

### Polling over websockets/webhooks

Bitrefill exposes no client-side realtime channel, and webhooks require a backend this project deliberately avoids. On-chain events already give realtime feedback through wagmi
(`waitForTransactionReceipt`), so polling only covers the last mile — Bitrefill noticing the
payment. The polling is deliberately boring: 4s cadence (the integration brief suggests 3–5s), conditional
`refetchInterval` that stops on terminal states, paused in background tabs, exponential backoff
on errors, and a ~5-minute soft timeout that switches the UI to "taking longer than usual" with
the invoice id visible — never an infinite spinner.

### Proxy-injected Bitrefill key — improving on the accepted shortcut

The brief tolerates API credentials in the frontend. I kept the key out of the bundle anyway,
since it costs almost nothing: the client only ever calls same-origin `/api/bitrefill/*`; in dev
a Vite proxy injects `Authorization`, in production a tiny Netlify Edge Function does the same
from a Netlify env var (plain `_redirects` proxying can't read env vars, hence the edge
function — still no backend of our own). This also sidesteps CORS, which the Bitrefill API does
not serve for browser origins. CI greps the built bundle to keep it that way. The Uniswap key
initially shipped in the bundle (their API serves browser CORS on localhost and the key is
client-oriented), but the production e2e revealed the trade-api gateway only allows
**localhost origins** — production browser calls are CORS-blocked. So Uniswap goes through the
same same-origin proxy pattern (`/api/uniswap`), and as a side effect that key left the bundle
too.

### Considered and not used: Bitrefill's MCP / agents surface

Bitrefill also ships an agent-facing integration ([bitrefill.com/agents](https://www.bitrefill.com/agents)):
an MCP server at `api.bitrefill.com/mcp` with `search-products` / `buy-products` /
`get-invoice-by-id` tools — and the provided API key authenticates against it. I deliberately
did not use it in the app: MCP is a protocol between an LLM client and a tool server, i.e. the
"agent as the buyer" surface. This product's buyer is a human in a web UI with a wallet, and
the prescribed REST endpoints give full control over schemas, error handling, and the custom
swap→transfer payment flow. Where it *was* useful: as a development-time tool for inspecting
invoices during end-to-end testing.

### Purchase history: ids in localStorage, codes never at rest

Without it, the redemption code becomes unreachable from the UI the moment the user starts a
new swap — unacceptable for money-like codes. Three storage options were weighed: a query
cache is not persistence (dies on reload); listing invoices from the Bitrefill API looks
appealing but the key is a shared merchant account, so the list would contain *other users'*
orders (and their fetchable codes) — in production this belongs behind a backend with per-user
auth. Device-local ids are the honest scope: `localStorage` keeps only order/invoice ids and tx
hashes (scoped per wallet address, capped), and the code is re-fetched on demand through the
existing order endpoint — no secrets at rest.

### Considered and not used: the rest of the Alchemy platform

Alchemy is used for three things: Base RPC, the Token API (balances + metadata) and the Prices
API. The platform offers more that was deliberately left out: its **Swaps API** could replace
the Uniswap Trading API, but the brief prescribes Uniswap explicitly (and Alchemy's swaps
target smart accounts, not plain EOAs); **Portfolio API** would collapse our
balances+metadata+prices composition into one call — a fair "with more time" simplification;
**webhooks/websockets** would push payment confirmations instead of polling but require a
backend; **gas sponsorship** (Gas Policies) would remove the "ETH for fees" hurdle at the cost
of moving to ERC-4337 smart accounts — a different wallet architecture than the any-wallet EOA
flow this app targets.

### Token discovery behind an interface

"Tokens the user actually holds" is a `TokenDiscovery` interface with two implementations:
Alchemy (`alchemy_getTokenBalances` + metadata + USD prices, capped at 40 tokens) and a
curated-list + viem `multicall` fallback chosen automatically when no Alchemy key is configured.
Native ETH is always included; dust under $0.01 is hidden only when a price is known — a token we
can't value is never hidden.

## What I'd do differently with more time

- **Backend proxy + webhooks**: a thin server owning the Bitrefill key, invoice creation, and
  webhook-driven status (no polling), with signed sessions.
- **E2E with a mock wallet**: Playwright + a synthetic EIP-1193 provider driving the real UI
  through approve/swap/pay against mocked APIs; visual regression on the step indicator.
- **Embedded swap widget comparison**: evaluate Uniswap's embeddable widget vs the Trading API
  for maintenance cost; the API won here for output-exact control and UI ownership.
- **Multi-chain input**: accept tokens on other chains via bridging quotes (the Trading API
  supports cross-chain swaps) — the FSM already isolates where that complexity would land.
- **Permit2 polish**: batch permit reuse across retries, deadline handling UX (re-sign prompt
  before expiry instead of on failure).
- **Observability**: Sentry with FSM-phase breadcrumbs — the `phase` union makes every error
  report self-describing.
- ~~Verify the delivered-order shape~~ — done post-delivery: a free `payment_method: "balance"
  + auto_pay` purchase (the provider's "deducts no balance" affordance) confirmed the
  code lives at `redemption_info.code`, and revealed that a paid invoice reports
  `all_delivered` (not just the documented `payment_received`/`complete`) — `isInvoicePaid` was
  fixed accordingly.

## End-to-end verification

Two full runs against the live integrations, driven through a real browser with real wallets:

1. **Demo path** (free): empty wallet → curated token list → $10 card → invoice auto-paid from
   the test balance → polling → code revealed and byte-compared against a direct API read.
2. **Real swap path, native ETH** (real funds, MetaMask): ETH → EXACT_OUTPUT swap to exactly
   the invoice's USDC price → ERC-20 transfer to the invoice address → invoice `all_delivered`
   with `payment_method: usdc_base / complete` → delivered code matched the API.
3. **Real swap path, ERC-20 input with approve + Permit2** (production deploy, MetaMask):
   WETH → on-chain approve to Permit2 (allowance verified MAX on-chain) → EIP-712 permit
   signature → swap → transfer → invoice `all_delivered`, order delivered. Exercises the full
   four-interaction wallet sequence and the `approving` FSM state skipped by the other paths.

The runs paid for themselves — five bugs no unit test had caught, each fixed with a regression
test where applicable:

- balance-paid invoices have no `payment.address` (schema assumed it was required);
- a paid invoice reports `all_delivered` — the documented `payment_received`/`complete` list is
  incomplete, polling would never have resolved;
- the Uniswap gateway flips numeric quote fields between number and string across calls, and
  `/swap` rejects any mutation of the quote — a single zod `coerce` broke the round-trip;
- the trade-api gateway serves CORS only for localhost origins — production browser calls
  fail, which is why both APIs ended up behind the same-origin proxy;
- right after the swap, the wallet's own RPC can lag a block and estimate `transfer()` against
  the pre-swap balance; the failed estimation made MetaMask submit a 140M-gas fallback that
  Base rejects — fixed with an explicit 100k gas limit.

The failure machinery was also exercised on real money: a failed payment step recovered via
retry-from-step without losing the already-swapped USDC, and a mid-purchase reload resumed
exactly where it stopped.

## AI usage

Built with **Claude Code** (Anthropic), with **Claude in Chrome** driving the in-browser e2e
runs. The collaboration, in words:

- **Planning prompt**: a detailed brief — the product requirements, two of my reference repos to
  extract conventions from (FSD layout, Biome config, design tokens, typed API client,
  query-key factory), the target stack (Vite/React/TS, wagmi + RainbowKit, TanStack Query,
  Zustand-as-FSM, RHF+zod), and the requirement to plan before writing code.
- **Probe-first rule**: before implementing each integration, hit the live API with the real
  key and design schemas from observed responses, not docs — this caught the v1-vs-v2 base URL
  discrepancy and most shape quirks before any UI existed.
- **Implementation prompts** were incremental ("scaffold", "API layer", "FSM with tests",
  "UI", "tests", "deploy"), each gated by lint/typecheck/tests before commit.
- **E2E prompts**: "walk the demo flow in my browser", "now the real flow with MetaMask" —
  Claude drove the app UI and diagnostics (network/console/state inspection) while I performed
  every wallet confirmation and payment personally; the five findings above came out of these
  sessions, each turned into a fix plus a test or doc note.
- Review discipline: I challenged intermediate states ("why Failed + alert here?", "should we
  show history?", "is localStorage right?") and several UI/UX corrections (skeletons, focus
  ring, button sizing, success-screen pause, Bitrefill logo) came from my manual passes.

All code was typechecked, linted, and covered by 80 tests before delivery; every external
response shape in the test fixtures is a captured live response, not an invention.
