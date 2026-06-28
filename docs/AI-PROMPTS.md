# Bitrefill Swap — AI prompts & conversation log

Tools: **Claude Code** (Anthropic) for implementation, **Claude in Chrome** for the in-browser e2e runs. Every wallet confirmation and payment was performed by the author personally.

---

## Основная сессия (11–26 июня 2026) — build → API → FSM → UI → тесты → деплой → верификация и ревью

### 👤 06-09 11:51

**Implementation Prompt — Bitrefill Swap (Frontend Focused)**

You are implementing a Web3 Frontend app in collaboration with Bitrefill. Work methodically: Step 0 first, then scaffold, then features. Production-ready quality is the explicit goal — "code quality and UX decisions matter as much as the feature working."

#### Step 0 — Study the reference codebases (MANDATORY, before writing any code)

Two of my projects are available locally. Read them and inherit their conventions instead of inventing your own:

- `[reference repo A]` — primary style reference (newer stack)
- `[reference repo B]` — web3 / API-layer pattern reference

Extract and follow:

1. From reference repo A: FSD layout with kebab-case slices (`features/<name>/ui/<component>.tsx` + `index.ts` barrels, `entities/<name>/model/types.ts`), path aliases (`@app`, `@pages`, `@widgets`, `@features`, `@entities`, `@shared`), Biome config, tsconfig setup, Vitest + Testing Library setup with colocated tests, `cn()` helper (clsx + tailwind-merge), Zustand store style (`devtools(persist(...))` with `partialize`), Tailwind v4 via `@tailwindcss/vite`, design tokens naming (`bg-card`, `text-muted-foreground`, `border-border`).
2. From reference repo B: typed API client pattern (`shared/api/client.ts` — typed `ApiError` with error codes, timeout race), query-key factory (`QUERY_KEYS` in `app/config`), one-hook-per-domain TanStack Query hooks with explicit `staleTime`/`refetchInterval` and mutation invalidations, SDK isolation layer (`shared/lib/sdk`) for blockchain logic.
3. Unify divergences in favor of reference repo A: kebab-case everywhere (reference repo B uses PascalCase widget dirs — do not copy that), Biome 2, tests required.

Confirm in one short summary what conventions you extracted before scaffolding.

#### Goal

A single-page web app: the user swaps any token they hold (on Base) for a Bitrefill Balance gift card (USD), ending with a redeemable code — without leaving the page.

Fixed constraints are:

- Gift card product is fixed: Bitrefill Balance card in USD. Use product id `test-gift-card-code` throughout development (free, returns a real-looking redemption code).
- The swap always settles in USDC on Base (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`, 6 decimals).
- Available tokens must reflect what the user actually holds.
- API credentials in the frontend are the only accepted production shortcut.

#### Stack (agreed, do not substitute)

- Vite + React 19 + TypeScript (strict)
- FSD architecture (layers as in reference repo A)
- wagmi v2 + viem, RainbowKit for wallet connect
- TanStack Query (all server state, smart polling)
- Zustand (one store: swap-flow finite state machine, `persist` + `devtools`)
- react-hook-form + zod (`@hookform/resolvers`) for the amount/denomination form
- zod parsing of ALL external API responses at the `shared/api` boundary
- Tailwind v4 + shadcn/ui with a custom theme (do not ship default shadcn look; reuse reference repo A's token naming)
- Biome (lint/format), Vitest + Testing Library

#### Project structure (target)

```
src/
├── app/            # providers (wagmi+rainbowkit, query), config (env, query-keys, chain), styles
├── pages/swap/     # single page composing widgets
├── widgets/        # swap-card, checkout-status, redemption-card
├── features/       # connect-wallet, select-token, select-denomination,
│                   # get-quote, execute-swap, pay-invoice, poll-invoice
├── entities/       # token (model+ui: token-row, balance), gift-card, invoice, quote
└── shared/
    ├── api/        # bitrefill/ (client + zod schemas), uniswap/ (trading api), alchemy/
    ├── lib/        # swap-flow store (FSM), formatting (units, usd), cn
    ├── config/     # addresses, constants
    └── ui/         # shadcn-based primitives + theme
```

#### Swap-flow finite state machine (Zustand store)

Model the flow as a discriminated union — single `status` field, explicit transitions as actions. No scattered booleans.

```
idle → selecting → quoting → review
  → creating_invoice → approving (skippable) → swapping (skippable)
  → paying → polling_invoice → success | failed(recoverable, step, reason)
```

Decisions baked in:

- Invoice is created only on user confirm (an invoice is a real order). The pre-confirm quote is an estimate from product denominations + Uniswap quote.
- After invoice creation, re-quote EXACT_OUTPUT for `payment.price` USDC so the user sends exactly what the invoice requires.
- Payment is a two-step on-chain sequence: (a) swap token→USDC into the user's wallet via Uniswap Trading API calldata, (b) plain ERC-20 `transfer` of `payment.price` USDC to `payment.address`. Keep them as separate FSM states with separate tx hashes.
- Skip paths: if the selected token IS USDC → no approve/swap, go straight to `paying`. If allowance is sufficient → skip `approving`.
- Persist (sessionStorage, partialize): `invoiceId`, `paymentAddress`, `paymentPrice`, tx hashes, `status`. On reload mid-flow, resume polling — the user must never lose a paid invoice/redemption code because of a refresh.
- `failed` is recoverable where possible: store which step failed and offer retry from that step (e.g. transfer failed but invoice alive → retry transfer; quote expired → re-quote).

Write unit tests for the FSM transitions (valid transitions, illegal transition guards, persistence partialize).

#### API integrations

**Bitrefill (`shared/api/bitrefill`)**

- Auth: `Authorization: Bearer <key>`. Version caveat: base `https://api.bitrefill.com/v1`, but the developer dashboard shows `v2`. Make base URL a config value; on first run verify which version the provided key accepts (try `GET /products/test-gift-card-code?currency=USDC` against v1, then v2) and pin the working one. Document the finding in the writeup.
- Endpoints:
  - `GET /products/test-gift-card-code?currency=USDC` → denominations + USDC prices (fetch dynamically; hardcoded fallback list is acceptable if the endpoint misbehaves).
  - `POST /invoices` body `{ "products": [{ "product_id": "test-gift-card-code", "value": <denomination> }], "payment_method": "usdc_base", "refund_address": "<connected wallet address>" }` → `{ id, payment: { address, price }, ... }`.
  - `GET /invoices/:id` → poll until `payment_received` or `complete`.
  - `GET /orders/:order_id` where `order_id = invoice.orders[0].id` → redemption code.
- CORS: the API will almost certainly not serve browser origins. Configure a Vite dev proxy (`/api/bitrefill` → `https://api.bitrefill.com`) and inject the `Authorization` header in the proxy config — this keeps the key out of the shipped JS bundle entirely, which is strictly better than the "accepted shortcut". Note this improvement in the writeup.
- Polling: TanStack Query with conditional `refetchInterval` (4s while non-terminal, `false` on terminal states), `refetchIntervalInBackground: false`, error backoff, and an overall soft timeout (~5 min) that switches UI to "taking longer than usual" with the invoice id visible — never an infinite spinner. Rationale for polling over websockets/webhooks (client-only constraint) goes in the writeup.
- All responses parsed with zod schemas; schema mismatch surfaces as a typed error, not a runtime crash.

**Uniswap Trading API (`shared/api/uniswap`)**

- Register flow already done; key provided separately. Docs: `developers.uniswap.org/docs/trading/overview`. Use the Trading API (quote → approval check → swap calldata), chain Base (8453), output token always USDC.
- Sequence per swap: `check_approval` (Permit2 flow — if approval tx needed, surface it as the `approving` FSM state) → `quote` (EXACT_OUTPUT, amount = `payment.price` in USDC base units) → `swap` → sign & send returned calldata via wagmi `sendTransaction`, then `waitForTransactionReceipt`.
- Quote TTL: show a visible countdown (~30s) in review state; auto-refresh quote on expiry; re-quote before execution if stale.
- Handle native ETH as input (Trading API supports native; verify param shape against docs).

**Token discovery (`shared/api/alchemy` or fallback)**

- "Tokens the user actually holds": implement a `TokenDiscovery` interface with two implementations:
  1. Alchemy `alchemy_getTokenBalances` + `alchemy_getTokenMetadata` on Base (preferred; needs `VITE_ALCHEMY_API_KEY`).
  2. Fallback: curated Base token list (top ~30 by liquidity) + viem `multicall` `balanceOf`, filtering zero balances. Used automatically when no Alchemy key is set.
- Always include native ETH balance. Filter dust (< $0.01 equivalent if price known, else < smallest denomination feasibility). Sort by balance value.

#### UX requirements (as important as the code)

- Connect: RainbowKit, custom theme matching app palette. Wrong-network → prominent "Switch to Base" (wagmi `switchChain`), block the flow until on Base.
- Token select: shadcn `Dialog` + `Command` (search), token rows with logo, symbol, formatted balance. Skeletons while balances load; empty state ("No tokens with balance on Base").
- Amount/denomination: RHF + zodResolver. Denominations from the product endpoint rendered as quick-pick chips; validation against real balance (respecting decimals) including "enough for gas" awareness for ETH input. Show fiat value and the live estimate of how much of the selected token it costs.
- Review: rate, price impact, minimum required, quote countdown with auto-refresh, clear "you pay X TOKEN → you get $Y Bitrefill card".
- Execution: vertical step indicator (Approve → Swap → Pay → Confirming → Code) with per-step states (pending / awaiting wallet / confirming on-chain with explorer link / done / failed+retry). Human-readable error mapping: user rejection, insufficient funds, slippage/quote expiry, network errors — never raw RPC strings.
- Success: redemption code card — code masked by default, reveal + copy-to-clipboard, order id, link to invoice/order. Persisted until user explicitly starts a new swap.
- Resilience: reload mid-flow resumes correctly (FSM persist). All async surfaces have loading skeletons, empty, and error states.
- Responsive (mobile-first card layout), keyboard navigable, focus-visible rings, `aria-live` for status changes.

#### Environment

`.env` (gitignored) + `.env.example` committed:

```
# Bitrefill — injected via Vite dev proxy, never shipped to the bundle
BITREFILL_API_KEY=

# Uniswap Trading API
VITE_UNISWAP_API_KEY=

# WalletConnect Cloud project id (required by RainbowKit) — create free at cloud.reown.com
VITE_WALLETCONNECT_PROJECT_ID=

# Optional: Alchemy for token discovery (free tier) — fallback to curated list if empty
VITE_ALCHEMY_API_KEY=
```

If `VITE_WALLETCONNECT_PROJECT_ID` is missing, stop and ask me to create one before implementing connect-wallet.

#### Testing strategy

- Unit: FSM transitions, zod schemas (fixture responses for v1/v2 shapes), formatting utils, denomination validation schema.
- Component: token select (search/empty/skeleton), step indicator state rendering, redemption card reveal/copy.
- Integration smoke: mocked Bitrefill + Uniswap clients driving a full happy path through the FSM.
- Manual e2e plan documented in writeup: USDC-direct path exercises the full Bitrefill flow with zero swap risk; swap path verified with a dust-sized trade.

#### CI/CD — Netlify (mirror reference repo A's setup)

- Deploy target is Netlify, same as reference repo A: auto-deploy on push to `main`, PR deploy previews enabled. Check reference repo A locally for an existing `netlify.toml` / Netlify config and reuse its approach.
- Commit a `netlify.toml`: build command `npm run build`, publish `dist/`, SPA redirect (`/* → /index.html 200`).
- The Bitrefill proxy must survive production: the Vite dev proxy doesn't exist on Netlify, so replicate it as a Netlify rewrite/redirect from `/api/bitrefill/*` to `https://api.bitrefill.com/*`. If header injection via redirects proves insufficient for the `Authorization` header, use a tiny Netlify Edge Function as the proxy — this keeps the no-own-backend constraint (still no backend of our own, key still out of the bundle via Netlify env vars). Document whichever variant you land on in the writeup.
- Add a lightweight CI gate before deploy (GitHub Actions or Netlify build step): `biome check`, `tsc --noEmit`, `vitest run`. Build fails → no deploy.
- Set env vars in Netlify UI (`BITREFILL_API_KEY`, `VITE_UNISWAP_API_KEY`, `VITE_WALLETCONNECT_PROJECT_ID`, `VITE_ALCHEMY_API_KEY`); never commit them. Add the live URL to the README header once deployed (as reference repo A does).

#### Deliverables

1. Working app (dev server) + clean commit history with conventional, meaningful messages (scaffold → api layer → flow → ui polish → tests → docs).
2. `README.md` — setup, env, architecture overview (mirror reference repo A README quality).
3. `docs/WRITEUP.md` covering:
   - Approach and key decisions: FSD; TanStack Query + Zustand-FSM (and why not Redux Toolkit — RTK Query would duplicate the TanStack cache that wagmi already mandates; remaining client state is one small FSM, so right-sizing wins); RainbowKit (pros/cons vs ConnectKit/AppKit/custom, and the thin FSD isolation that makes it swappable: imported only in `app/providers` + `features/connect-wallet`); polling over websockets (Bitrefill offers no client realtime channel; webhooks need a backend; on-chain confirmations already give realtime via wagmi — smart polling covers only the last mile); invoice-on-confirm + EXACT_OUTPUT re-quote; proxy-injected Bitrefill key as an improvement over the accepted shortcut; v1-vs-v2 finding.
   - What I'd do differently with more time: backend proxy + webhooks, e2e (Playwright + mock wallet), embedded swap widget comparison, multi-chain input, Permit2 signature-only flow polish, Sentry.
   - AI usage: tools used and links/exports of the conversation history (I will attach the planning conversation; export your implementation session log).

#### Definition of done

- [ ] Full happy path works: connect → pick held token → pick denomination → approve (if needed) → swap → pay → code revealed.
- [ ] USDC-direct path works (no swap) — verified end-to-end against the real test product.
- [ ] Reload during `polling_invoice` resumes and still delivers the code.
- [ ] Wrong network, rejection at every wallet step, quote expiry, and insufficient balance all produce specific, recoverable UI.
- [ ] `biome check` clean, `tsc` clean, all tests green.
- [ ] No Bitrefill key in the client bundle (verify in build output).
- [ ] Deployed to Netlify: live URL works end-to-end, including the Bitrefill proxy in production; CI gate (lint + types + tests) blocks broken deploys.
- [ ] README + WRITEUP complete.

#### Agent workspace conventions (CLAUDE.md, skills, agents)

- Maintain a `CLAUDE.md` at the repo root as the project's living memory: extracted codebase conventions (Step 0 output), agreed architectural decisions from this prompt, env/proxy quirks (Bitrefill v1-vs-v2 finding, CORS proxy), commands (dev/test/lint), and any decisions we make along the way. Keep it concise and update it when decisions change — it must stay the single source of truth for future sessions.
- Where it genuinely helps the workflow, you may introduce skills (e.g. a reusable "bitrefill-api" or "uniswap-trading-api" skill encapsulating endpoint contracts and fixtures) and subagents (e.g. a test-runner/reviewer agent for the FSM, or a UX-review pass agent).
- Process rule: never add skills, agents, or CLAUDE.md sections beyond the scope above silently. First propose: what it is, why it pays off for this project, and the maintenance cost. Wait for my approval, then add. Same applies to restructuring or deleting them later.

Work in increments; after each major milestone (scaffold, API layer, FSM, UI, polish) show me a brief status and anything that diverged from this plan before continuing.

**🤖 ассистент:** I'll start with Step 0: reading the brief and studying both reference codebases before writing any code.

_действия: 1×Read_

### 👤 06-10 13:20

env должен быть в корне проекта если что, именно как .env (названия ключей - в .env.example), и надо пройти все флоу e2e, с поключением кошелька и свапа

**🤖 ассистент:** Понял: проверю `.env` в корне и пройдём полный e2e через ваш Chrome с реальным кошельком. Сначала проверка окружения:

_действия: 1×Bash_

### 👤 06-11 13:01

я сам запушу в репу и подключу netlify, и потом прогоним e2e.

планируем ли использовать bitrefill mcp?

**🤖 ассистент:** Нет, Bitrefill MCP мы не использовали — в этом окружении такого MCP-сервера нет (и в списке доступных коннекторов его не было). Всё взаимодействие с Bitrefill шло двумя путями:

1. **Прямые probe-запросы через curl** во время разработки — ими я выяснил, что работает только v2 (v1 → 404), снял реальные формы ответов `/products`, `/invoices`, `/orders` и зафиксировал их в тестовых фикстурах ([src/test/fixtures/bitrefill.ts](../src/test/fixtures/bitrefill.ts)).
2. **Типизированный клиент в самом приложении** ([shared/api/bitrefill](../src/shared/api/bitrefill/client.ts)) — fetch через same-origin прокси `/api/bitrefill/*` с zod-валидацией ответов. Ключ инжектится Vite-прокси в dev и Netlify Edge Function в проде.

То же самое с Uniswap — прямые вызовы Trading API (`check_approval` / `quote` / `swap`), без MCP.

Если хочется, в `CLAUDE.md` прописана опция завести проектный skill «bitrefill-api» (контракты эндпоинтов + фикстуры) для будущих сессий — по процессному правилу я его без вашего одобрения не добавлял. На итоговый результат проекта это не влияет.

Ок по плану: вы пушите (`gh auth refresh -h github.com -s workflow`, затем `git push origin main`) и подключаете Netlify, потом прогоняем полный e2e с кошельком. Dev-сервер на `localhost:3000` я оставил запущенным.

### 👤 06-12 07:18

закончим здесь. Насчет ключей - надо именно BITREFILL_API_KEY, верно?

**🤖 ассистент:** **`BITREFILL_API_KEY`** — именно без префикса `VITE_`, и это сделано намеренно.

Vite встраивает в клиентский бандл только переменные с префиксом `VITE_*`. Ключ Bitrefill в бандл попадать не должен, поэтому:

- **`BITREFILL_API_KEY`** (без префикса) читается только сервер-сайд: в dev — конфигом Vite-прокси ([vite.config.ts](../vite.config.ts) через `loadEnv`, который добавляет `Authorization` к запросам на `/api/bitrefill/*`), в проде — Netlify Edge Function из env-переменных Netlify. Клиентский код его не видит в принципе.

Итого в `.env` (и в Netlify → Environment variables) четыре переменные, как в `.env.example`:

| Переменная                      | Куда попадает                                                                |
| ------------------------------- | ---------------------------------------------------------------------------- |
| `BITREFILL_API_KEY`             | только сервер (прокси / edge function)                                       |
| `VITE_UNISWAP_API_KEY`          | бандл (их API рассчитан на браузер, CORS открыт)                             |
| `VITE_WALLETCONNECT_PROJECT_ID` | бандл (публичный идентификатор)                                              |
| `VITE_ALCHEMY_API_KEY`          | бандл, опциональная — без неё токен-дискавери работает по курируемому списку |

В вашем локальном `.env` всё уже названо правильно — для Netlify просто переносите эти же четыре имени.

### 👤 06-12 09:26

при рисерче я выбрал Alcheme, reown, walletconnect / rainbowkit; но нам важно иметь возможность тестировать флоу на тестовых данных, не на реальных деньгах. Какие у нас варианты? Проверь достаточно ли информации об этом в доках из основного промпта?

**🤖 ассистент:** Хороший вопрос — давайте проверю фактами: перечитаю требования, посмотрю, что говорят доки/API. Сначала — что именно обещает задача про тестовый продукт:

_действия: 1×Bash_

### 👤 06-12 09:42

согласен, 1 и 3. Можем гонять флоу через test-gift-card-code.
однако сначала хочу уточнить 1 момент: у Bitrefill есть вот такие возможности https://www.bitrefill.com/agents, для интеграции можно использовать скилл или mcp, как думаешь, не избыточно ли это в рамках нашего проекта?

**🤖 ассистент:** Гляну, что именно они предлагают, прежде чем оценивать:

_действия: 1×WebFetch_

### 👤 06-12 10:22

выбрал rainbow - дальше пустой экран и ошибка в консоли (это очень плохой UX если пользователь не понимает что происходит)

_[скриншот]_

**🤖 ассистент:** Отличный улов — это реальный баг, причём двойной: краш RainbowKit при рендере QR-кода (выбор кошелька без установленного расширения → WalletConnect QR) **и** отсутствие error boundary, из-за чего краш превращается в чёрный экран. Чиню оба. Сначала смотрю версии:

_действия: 1×Bash_

### 👤 06-12 12:02

еще раз пройду тест сам. И кстати как пользователь поймет когда мы в демо режиме? у нас нет возможности переключаться между режимами в интерфейсе.

**🤖 ассистент:** Сейчас пользователь видит demo-режим по трём сигналам: янтарный бейдж «Demo» в шапке, подпись под формой («the invoice pays itself…»), «You pay: Nothing — demo mode» на ревью и в чекауте. Но переключаться из UI нельзя — режим зашит env-переменной на этапе сборки. Это слабо: ревьюер на проде не сможет включить demo сам.

Делаю переключатель в интерфейсе: runtime-оверрайд в localStorage (env остаётся дефолтом), кнопка в шапке, блокировка переключения посреди активной покупки:

_действия: 1×Edit_

### 👤 06-12 12:36

в UI для сущностей которые имеют состояние загруки важно показывать скелетоны. Проверь везде ли это реализовано и покажи инфо

**🤖 ассистент:** Да, реализовано — у всех четырёх сущностей с асинхронной загрузкой:

| Сущность                               | Где                                                                                                                                       | Что показывается                                                                                                  |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Балансы токенов**                    | [token-select-dialog.tsx](../src/features/select-token/ui/token-select-dialog.tsx) (`TokenListSkeleton`) | 4 строки-скелетона: круглый аватар + две строки текста + сумма справа — повторяют геометрию настоящего `TokenRow` |
| **Номиналы карты** (продукт Bitrefill) | [denomination-form.tsx](../src/features/select-denomination/ui/denomination-form.tsx)                    | 5 скелетонов-чипов размером с реальные кнопки `$10…$100`                                                          |
| **Котировка** (estimate)               | там же, `EstimateLine`                                                                                                                    | строка-скелетон на месте «≈ 0.006 WETH for $10.50»                                                                |
| **Quoting-фаза** (переход к ревью)     | [swap-card/index.tsx](../src/widgets/swap-card/index.tsx)                                                | блок-скелетон формы ревью (карточка + строка + кнопка), `role="status"`                                           |
| **Redemption-код**                     | [redemption-card](../src/widgets/redemption-card/index.tsx)                                              | скелетон на месте кода + «Waiting for the code to be issued…», `role="status"`                                    |

Все на общем примитиве [shared/ui/skeleton](../src/shared/ui/skeleton/index.tsx) (`animate-pulse bg-muted`), с `role="status"`/`aria-label` для скринридеров.

Важное осознанное разграничение: **скелетоны — для загрузки данных** (форма контента известна, содержимое нет), а в чекаут-степпере — **спиннеры/иконки состояний** (`Confirming…`, `Confirm in your wallet`), потому что там идёт процесс с известным содержимым, а не загрузка вёрстки. Это каноничное применение обоих паттернов.

Вы могли видеть два из них вживую в demo-прогоне: скелетоны в диалоге токенов мелькают при первом открытии (потом TanStack отдаёт из кэша мгновен …[обрезано]

### 👤 06-12 12:41

прокликал локально - есть некоторые замечания:

1. переход после подтверждения на экран ревью слишком резкий, дай время юзеру увидеть что транзакция в чекаут-степпере завершилась (успехом / ошибкой)
2. немного по ui: синяя кнопка больше по размеру чем соседняя, нужно поправить; иконка в хедере рядом с Bitrefill Swap - давай возьмем logo bitrefill вместо рандомной иконки
3. в реальном флоу в форме вокруг поля нужно убрать аутлайн

_[скриншот]_

**🤖 ассистент:** Отличный фидбек. По пунктам: 1 — да, так задумано (объясню ниже), 1 — согласен, сделаю паузу, 2 — чиню оба, 3 - аутлайн сейчас разберу вживую. Начинаю с диагностики аутлайна:

_действия: 1×mcp**Claude_in_Chrome**javascript_tool_

### 👤 06-12 15:07

я бы предпочел отображать историю транзакций / действий. Что думаешь?

**🤖 ассистент:** Короткий ответ: **в задаче этого нет, но одну вещь я бы добавил — историю покупок, потому что сейчас есть реальная UX-дыра: код теряется после «Start a new swap»**.

Разбор по слоям:

**Что уже покрыто и дублировать не стоит:**

- On-chain история — это работа кошелька и эксплорера: MM Activity вы только что видели, а наш степпер даёт «View on BaseScan» по ходу покупки. Дублировать их в приложении — чужая ответственность и лишний скоуп.
- История _текущей_ покупки — есть: степпер + persisted-состояние переживает перезагрузку.

**Где дыра:** успех-экран показывает код и order/invoice id, но после «Start a new swap» (или закрытия сессии — у нас sessionStorage) всё исчезает. Купили две карты → код первой пропал из UI навсегда. Для продукта, выдающего **денежно-подобные коды**, это самый весомый аргумент «за».

**Как сделать дёшево и безопасно:** не хранить коды вообще. Хранить в `localStorage` только метаданные прошлых покупок — дата, номинал, `orderId`, `invoiceId`, хеши транзакций. Код по клику подтягивается **заново через существующий** `useOrder` (наш прокси умеет `GET /orders/:id` в любой момент — я так делал верификацию). Получаем:

- секреты не лежат в браузере at rest (только идентификаторы)
- код всегда доступен повторно — даже спустя дни
- UI — маленькая секция «Past purchases» под карточкой: строка = дата + $10 + order id + кнопка «Show code» (переиспользуем готовый `CodePanel`)

Стоимость: ~час с тестами (сторадж-модуль + пара компонентов + запись в момент success). Для ревью это сильный сигнал product thinking — забота о пользователе за пределами happy path, тем более вы это место прочувствовали на себе в прогонах.

Делаем? Если да — реализую сейчас; если жалко времени — можно ограничиться одной строкой в WRITEUP («What I'd do differently: purchase his …[обрезано]

### 👤 06-12 15:09

да, делаем

**🤖 ассистент:** ## Делаю: сторадж-модуль + запись при success + секция «Past purchases» с кодом по требованию

_действия: 1×Write_

### 👤 06-12 15:33

Вопросы по ридми:
1 в ридми VITE_ALCHEMY_API_KEY Optional — richer token discovery + USD prices => ALCHEMY это опционально, поэтому срабатывает фолбэк; но - добавили ли мы ключ?
2 The Bitrefill proxy is a deployed Edge Function => у нас есть жесткая привязка к нетлифай, но - если захочу раскатить через другой сервис?
3 "If you used AI tools: which ones, and share the prompts" => обновим WRITEUP

**🤖 ассистент:** Отвечаю по пунктам, два из них требуют правок — сделаю сразу.

**1. Alchemy — да, строго опционально.** Это и была цель интерфейса `TokenDiscovery`: без ключа автоматически включается фолбэк (курируемый список топ-токенов Base + один multicall `balanceOf`). Флоу работает целиком. Что теряется без ключа: полное сканирование кошелька (фолбэк видит только ~14 известных токенов), USD-цены (фиатные суммы в списке, dust-фильтр, дизейбл недоступных номиналов). Если по задаче просим «tokens the user actually holds» — фолбэк закрывает это честно, но узко; Alchemy закрывает полностью. Решение «добавить, но не требовать» — осознанное, и в README оно описано верно. Если добавишь ключ - все будет работать через Alchemy

**2. Привязка к Netlify — минимальная и изолированная, переезд дешёвый.** Клиентский код о Netlify не знает вообще: его контракт — same-origin пути `/api/bitrefill/*` и `/api/uniswap/*`. Netlify-специфичны ровно два файла-адаптера (`netlify.toml` + `netlify/edge-functions/`). На другом хосте нужен эквивалентный прокси с инжекцией заголовка:

- **Cloudflare Pages** — те же ~40 строк в Pages Function
- **Vercel** — Edge Middleware или две serverless-функции
- **nginx/self-host** — вообще без кода: `proxy_pass` + `proxy_set_header`
- dev-режим уже демонстрирует паттерн (Vite proxy)

Добавлю это одной заметкой в README.

**3. Согласен** — «prompts **or** conversation history», описания словами достаточно. Перепишу секцию AI usage в WRITEUP самодостаточной: инструменты + как работал + ключевые промпты словами.

_действия: 1×Read_

### 👤 06-12 15:39

сделай ревью кода, проверь нет ли dead code, не нарушены ли общие паттерны

**🤖 ассистент:** Сделаю системно: сначала автоматический поиск мёртвого кода (knip — неиспользуемые файлы/экспорты/зависимости), затем ручная проверка паттернов (направление импортов FSD, консистентность query-keys, обработка ошибок, состояние FSM).

_действия: 1×Bash_

### 👤 06-12 15:53

также можно указать в ридми что shared/ui это по сути готовая к выделению дизайн система / пакет ui-kit, куда можно было бы еще добавить сторибук для отдельного описания динамическх состояний и интерфейсов наших компонентов

**🤖 ассистент:** _(без текстового ответа — только действия)_

_действия: 1×Read_

### 👤 06-12 16:01

скиллы / агенты мы пока решили не добавлять - распишем "почему"?

**🤖 ассистент:** Да, осознанно не добавляли — и я бы оставил так. Расклад:

**Что есть сейчас:**

- **CLAUDE.md в репо** — единственный AI-артефакт в коде, и он там уместен: это рабочая память проекта (квирки API v2, конвенции, статусы инвойсов, процессные правила)
- **Bitrefill MCP** — подключён как локальный дев-инструмент (конфиг в `~/.claude.json`, в репо не попадает)
- **Скиллов и агентов — ноль**, ни в репо, ни локально

**Почему не добавляли (и не стоит):**

1. Кандидат был один — проектный скилл `bitrefill-api` (контракты эндпоинтов + фикстуры). Но его ценность уже размазана по правильным местам: квирки API — в CLAUDE.md (грузится в каждую сессию автоматически), живые фикстуры — в `src/test/fixtures/`, находки — в WRITEUP. Скилл дублировал бы все три.
2. Скиллы окупаются для **переиспользуемых кросс-проектных** процедур («каждый раз, когда деплоим X…»), а у нас одиночный проект с законченным жизненным циклом — CLAUDE.md покрывает его полностью.
3. Для ревьюеров сабмишена `.claude/skills/` в репо — шум: они оценивают продуктовый код, а не мою оснастку.

**Когда передумать:** если проект продолжит жить (например, Bitrefill попросит развивать его дальше) — тогда осмысленны скилл с процедурой релиза/e2e-чеклистом или агент для регулярного прогона demo-флоу. Но это решение того момента, не сегодняшнее.

Так что текущее состояние — это и есть зафиксированное решение из процессных правил («propose first»), а не забытый пункт. Если хотите что-то из этого всё же завести — скажите, заведу.

### 👤 06-12 16:17

Дальше давай прогоним на проде ERC-20 вход (approve + Permit2) флоу (у тебя открыта вкладка в браузере)

**🤖 ассистент:** План: для approve+Permit2 нужен **не-USDC ERC-20** на кошельке (USDC уйдёт直 direct-путём без свапа). Проверяю, что осталось на кошельках:

_действия: 1×Bash_

### 👤 06-12 18:39

Я обновил отдельную секцию в конце в ридми, сделай ревью моих ответов на эти вопросы:
●
●
●
How you approached the problem and the decisions you made
What you would do differently with more time
If you used AI tools: which ones, and share the prompts or conversation history

**🤖 ассистент:** _(без текстового ответа — только действия)_

_действия: 1×Bash_

### 👤 06-14 20:56

иконку в центральной секции предлагаю заменить на wallet, не лого конторы.

_[скриншот]_

### 👤 06-14 21:17

И еще одна проблема - при переключении демо режима моргает контент, особенно кнопки (из-за явного ререндера всей страницы), давай реализуем переключение режима через localStorage

**🤖 ассистент:** Сначала верну текст демо-кнопке (раз места хватает, кнопка-иконка коннекта в шапке его освободила). Потом разберусь с морганием. Сначала найду все места, где режим читается:

_действия: 1×Bash_

### 👤 06-14 22:44

на метамаск я реально заводил eth + weth, откуда остальные?

_[скриншот]_

**🤖 ассистент:** Это спам/скам-токены, которые кто-то разослал эйрдропом на адрес — любой активный EVM-адрес такие накапливает. Я их не «добавлял»: Alchemy `getTokenBalances` возвращает **все** ERC-20 с ненулевым балансом, включая непрошеный мусор. Обрати внимание — у ETH/WETH есть цена ($35.52 / $18.42), а у AAIF/DISCOPUSSY/IOOR её нет: Alchemy не смог их оценить, потому что у них нет реального рынка. Наш текущий фильтр режет «пыль» только когда цена известна, а беcценочные намеренно оставляет («не прячем то, что не можем оценить») — вот они и просочились.

Это стоит починить: в пикере токенов спам — и мусор, и потенциальный фишинг. Чиню. Сначала смотрю текущую фильтрацию:

_действия: 1×Read_

### 👤 06-22 20:11

Я сделал ревью, вот несколько комментариев:
1 Зачем мне invoice id как покупателю после покупки? Что я с ним могу сделать? Поддержки ведь нет никакой... если он ни для чего не нужен — лучше скрыть / убрать
2 То же самое касается order id. Вижу что это разные значения, но не пойму зачем они мне как пользователю сейчас могут понадобиться

**🤖 ассистент:** Да, замечания резонные — и я бы их принял, но с нюансом по каждому id.

**Invoice id — согласен полностью, скрывать.** Это чисто внутренний идентификатор платёжной системы Bitrefill. У покупателя с ним нет ни одного действия: ни трекинга, ни поддержки, ни повторного запроса вручную (нужен API-ключ). Это developer-facing значение, утёкшее в UI. Ценности ноль, только шум и лёгкое «а это зачем?».

**Order id — в основном согласен, но причина тоньше.** У него есть слабый теоретический смысл («номер заказа» = ощущение, что покупка зафиксирована, и хэндл для поддержки). Но:

- поддержки в продукте нет — аргумент «для саппорта» спекулятивен;
- это уродливый ObjectId, а не дружелюбный `#1024` — психологической ценности «вот ваш номер заказа» он не даёт;
- пользователь с ним всё равно ничего не делает руками.

Так что для **отображения** он тоже шум. **Важно:** order id реально используется — по нему история повторно тянет код из API. Поэтому его надо **оставить в state/localStorage, но убрать из вёрстки**. Это не «удалить», а «не показывать».

**Что я бы НЕ трогал — и это сильный контраргумент в пользу того, что мы не прячем полезное:** ссылки на транзакции в BaseScan (в степпере и в истории). Вот это для крипто-покупателя настоящее, проверяемое доказательство оплаты, с реальным действием (открыть, посмотреть ончейн). В отличие от opaque-id, хэш — actionable. Их оставляем.

Итог: оба замечания принимаю. План — **скрыть из UI и invoice id, и order id** (order id остаётся под капотом для ре-фетча кода), а как «след покупки» оставить redemption-код, список истории и ссылки на BaseScan. Это и чище, и честнее про то, с чем пользователь может что-то сделать.

Реализовать так?

### 👤 06-22 20:14

да. И поработаем на импрувами ui в отдельной ветке (так и назови - ui-improvements)

**🤖 ассистент:** Создаю отдельную ветку и работаю в ней:

_действия: 1×Bash_

### 👤 06-22 20:23

Ревьюер - это я. Сильно подробно расписывать коммиты не надо. В конце сделай сквош.
Дальше. Вот на этом экране было бы хорошо видеть примерные цены сразу, по возможности. Какие у нас варианты?

_[скриншот]_

**🤖 ассистент:** Ревьюер — вы, понял; коммиты пишу кратко (всё равно финальный сквош).

Да, это можно и дёшево: цена карты ≈ номинал × ~5% премии — это фиксированная USD-оценка, не требует ни выбора токена, ни котировки (работает и в demo). Покажу под каждым чипом «≈ $10.50» сразу. Смотрю форму:

_действия: 1×Read_

### 👤 06-22 21:58

Хорошо. Далее. Цены везде в USD, даже если я выберу какой-нибудь щиткоин. Я только в демо моде проверял, так что окна подписи транзакции я не видел, но подозреваю что цену я увижу только там — было бы хорошо иметь где-нибудь в UI до этого момента эквивалент в той валюте, в которой я плачу, чтобы я понимал сколько у меня на кошельке должно быть

**🤖 ассистент:** Тут важный нюанс, который меняет ответ: **в реальном режиме этот эквивалент уже есть** — вы просто видели только demo, где его намеренно нет.

Что показывается в **real-режиме** (как только выбран токен + номинал, ещё до кошелька):

- **Под чипами** (`EstimateLine`): `≈ 0.006 ETH for $10.50 in USDC (estimate)` — сумма в вашем токене.
- **На Review-экране**: `You pay ≈ 0.006303 ETH` и отдельной строкой **`Maximum you'll spend — 0.006335 ETH`** (worst-case с учётом проскальзывания — фактически «столько нужно иметь на кошельке»).

В **demo** этого нет, потому что платёж идёт с тестового баланса Bitrefill — ваш кошелёк не тратится вообще («nothing leaves your wallet»), и показывать «нужно X ETH» там было бы противоречиво.

То есть фичи как таковой не хватает только в demo, а в demo она и не нужна по смыслу.

Где есть реальный простор улучшить — **формулировка и заметность** в real-режиме. Сейчас «Maximum you'll spend» — это инженерный термин; для покупателя понятнее прямое «нужно иметь на кошельке». Предлагаю:

1. В `EstimateLine` усилить акцент: вместо `≈ X ETH for $Y in USDC` сделать **`You'll pay ≈ X ETH` + `Have at least Y ETH in your wallet`** (max-amount как явное требование к балансу).
2. Опционально — если хотите, чтобы это было видно и без реальных средств: показывать в demo **индикативный** эквивалент («≈ X ETH — though demo charges nothing»), дернув котировку только для отображения. Но это размывает смысл demo и добавляет ему сетевой вызов; я бы **не делал**, чтобы demo оставался честным «ничего не списывается».

Моя рекомендация: сделать (1) — это прямо закрывает «сколько у меня должно быть на кошельке», и оставить demo как есть.

Делаю (1)? Или хотите всё-таки и индикатив в demo (2)?

### 👤 06-22 22:13

Ну и общий коммент - UI выглядит резковато: 1. модалки закрываются без анимаций, 2. в некоторых местах не хватает скелетонов (например резко выглядит появление амаунтов после подключения кошелька). Полагаю, не подключена библиотека для анимаций. Давай проверим эти моменты

**🤖 ассистент:** Согласен по сути — это та самая «motion polish», что я отметил в README как след. шаг. Но прежде чем соглашаться огульно, проверю фактуру: работают ли вообще текущие animate-классы (в диалоге уже стоят `animate-in fade-in`, но если плагина нет — они мёртвые) и где реально дыры по скелетонам.

_действия: 1×Bash_

### 👤 06-22 22:47

тут сложные тернарники, давай упростим

_[скриншот]_

**🤖 ассистент:** Да — у меня уже есть хелпер `currentView`, отдающий имя вью. Сделаю рендер декларативным через него: switch по вью вместо вложенных тернарников. Читаю файл:

_действия: 1×Read_

### 👤 06-22 22:51

PR открыт, все ок. Запусти проект и пройди демо флоу чтобы убедиться что все работает как надо

**🤖 ассистент:** Запущу проверку демо-флоу на текущей ветке (`ui-improvements`) через ваш Chrome с MetaMask. Сначала убедлюсь, что dev-сервер отдаёт свежий код ветки:

_действия: 1×Bash_

### 👤 06-22 23:05

помимо success flow, надо также убедиться что мы корректно обрабатываем все основные кейсы с ошибками / unsuccess flows

**🤖 ассистент:** Хорошая мысль — success мало, надо проверить и ошибочные ветки. Сначала зафиксирую, что уже покрыто тестами, потом вживую прогоню ключевые через инъекцию сбоев (без денег и без десятка реджектов в кошельке).

**Уже покрыто юнит/интеграционными тестами:** fail/retry по каждому шагу FSM, нерекаверабельный фейл без retry, resume после перезагрузки (`deriveResumedState`), reject→retry в оркестраторе, ошибка создания инвойса, ошибка списка токенов→retry, ошибка загрузки кода→retry, маппинг ошибок (user_rejected/insufficient/network/api/unknown).

**Прогоню вживую 3 репрезентативных кейса** через перехват `fetch`. Начну с **ошибки создания инвойса** (demo): глушу `POST /invoices`, дохожу до Confirm — жду failure-панель + retry, затем восстанавливаю и проверяю recovery.

_действия: 1×mcp**Claude_in_Chrome**javascript_tool_

### 👤 06-22 23:15

заканчиваем. А по поводу per-chip оценки цен - неочевидно, надо убрать

_[скриншот]_

**🤖 ассистент:** Честно — твоё сомнение обоснованное. Сейчас в чипе два долларовых числа без подписей («$10.00» и «≈ $10.50»), и связь между ними неочевидна: пользователь может подумать «почему две цены? какую я плачу?». Раз ты сам споткнулся — это уже сигнал.

**Как делают в индустрии (gift-card / top-up / on-ramp):**

- Чипы номиналов обычно показывают **только лицевую сумму** ($10, $20…), чистo и без шума.
- Стоимость с наценкой/спредом выводят **один раз** — для выбранного номинала, в строке-итоге/ревью, а не на каждом чипе.
- Если цену всё же показывают на чипе — её **подписывают** («total», «you pay»), чтобы не было двух «голых» цифр.

То есть «голый» второй прайс на каждом чипе — не самый частый паттерн и как раз даёт ту неоднозначность, что ты заметил.

### 👤 06-22 23:30

надо корректно подсвечивать выбранную валюту в модалке (см скриншот)

_[скриншот]_

**🤖 ассистент:** Проблема: cmdk подсвечивает первую строку (ETH) как курсор клавиатуры, а реально выбранный токен (WETH) ничем не помечен. Нужен явный индикатор «текущий выбор» — как в Uniswap (галочка), отдельный от hover/курсора. Смотрю диалог и TokenRow:

_действия: 1×Read_

### 👤 06-22 23:38

вот здесь надо поправить скелетон: он в.1 строку, а реального контента - в 3 строки

_[скриншот]_

**🤖 ассистент:** Верно — скелетон в `EstimateLine` (одна строка `h-4 w-48`), а контент теперь в 3 строки. Подгоню скелетон под реальную форму (строка платежа + двухстрочная подсказка):

_действия: 1×Edit_

### 👤 06-23 06:47

ПР замерджил. Теперь давай проверим такой кейс: после подключения кошелька, когда переключаю демо, в модалке выбора валюты всегда одни и те же данные из кошелька (ETH + WETH) - нужно сбрасывать состояние.

_[скриншот]_

**🤖 ассистент:** Переключаюсь на main и подтягиваю:

_действия: 1×Bash_

### 👤 06-23 07:00

И еще вопрос - при переключении кошелька (сначала включили один, потом - переключил на второй) надо ли сбрасывать состояние селектбокса You pay with? и проверь, корректно ли обрабатывается кейс, если на втором кошельке нет вообще никаких средств?

**🤖 ассистент:** _(без текстового ответа — только действия)_

### 👤 06-23 07:40

я протестировал сам, все ок.

_[скриншот]_

---

## Параллельная сессия (18–22 июня 2026) — FSD-рефактор и observability

### 👤 06-18 12:02

Я закончил ревью, давай в отдельной ветке реализуем некоторые улучшения:

1. По FSD src/main.tsx не должен существовать, подобный файл должен находиться в app слое
2. // Align RainbowKit’s modal surfaces with the app’s design tokens. — тут получается неявная зависимость этого файла от CSS файла, не отслеживается никак — цвета в любой момент могут рассинхронизироваться. Предлагаю заменить на css-переменные
3. app/config vs shared/config — в чём разница? С виду одинаковые конфигурации почему-то лежат в разных местах
4. shared/config/constants.ts я бы разнёс, т.к. рядом лежит shared/config/addresses.ts, в котором собственно тоже константы
5. shared/lib/swap-flow — супер бизнесовая штука, чуть ли не самое важное что есть с точки зрения кода, но почему-то лежит в shared/lib, хотя shared/lib предназначается по FSD для небизнесовых переиспользуемых утилок
6. учитывая что у нас тут с криптой работа, архиважно иметь мониторинг, хотя бы Sentry
7. ещё у нас есть прокси — в нём тоже можно что-нибудь засылать в аналитику или какой-нибудь cloudwatch, потому что в web3 очень важно мониторить всё что происходит. Какие еще есть предложения?

**🤖 ассистент:** Давай сначала разберусь со структурой проекта, прежде чем что-то менять.

_действия: 2×Bash_
