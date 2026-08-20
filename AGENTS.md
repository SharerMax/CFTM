# AGENTS.md

## Structure

Full-stack monorepo, TypeScript + pnpm workspaces.

- `packages/shared` — Zod schemas, types, crypto utils (shared frontend/backend only, NO Prisma)
- `packages/client` — Vue 3 + Vite + Pinia + Naive UI + UnoCSS + unplugin-icons
- `packages/server` — Node.js + Hono + Prisma + SQLite

## Catalog

All dependency versions managed in `pnpm-workspace.yaml` catalog. Reference as `"catalog:"` in package.json.

## Commands

```bash
pnpm install                    # Install
pnpm dev                        # Run all dev servers in parallel
pnpm -F @cftm/server dev        # Backend only (port 3000)
pnpm -F @cftm/client dev        # Frontend only (port 5173)
pnpm lint                       # Lint all (root, auto-runs in all packages)
pnpm lint --fix                 # Fix lint issues
pnpm typecheck                  # Type-check (vue-tsc in client, tsc in server)
pnpm prisma:generate            # Regenerate Prisma Client
pnpm prisma:migrate             # Create migration (interactive)
```

Verification order: `lint → typecheck`

## ESLint

Uses `@antfu/eslint-config` (flat config, no Prettier). Root `eslint.config.ts` covers all packages.
- `.opencode/plans/**` and `.agents/**` are ignored

## Backend

- **Router/Service separation**: `routes/` is the control layer (HTTP parsing, Zod validation, auth check, call service, return JSON — NO business logic, NO direct DB access). `services/` is the business layer (DB ops, CF API calls, process management)
- Hono routes in `packages/server/src/routes/` (`accounts`, `tunnels`, `zones` — DNS record CRUD, tunnel-linked records synced to DB)
- `routes/accounts.ts`: per-account management — `GET/POST /`, `PUT/DELETE /:id`. `POST`/`PUT` verify the token via CF before storing; `DELETE` is blocked with 409 (`account_in_use`) while any local `Tunnel.accountId` references the account's `cloudflareAccountId`
- `routes/tunnels.ts`: local CRUD (`GET/POST /`, `GET/PUT/DELETE /:id`, `/:id/config`, `/:id/start`, `/:id/stop`, `/:id/logs`) + remote (`GET /remote`, `GET/PUT /remote/config` — no DB storage, fetched/edited via CF API, requires `?accountId=`)
- `routes/zones.ts`: DNS CRUD requires `?accountId=`, resolved to that account's token
- `services/dns.ts`: `DnsService` — record list/create/delete via CF API with per-account token resolution. `listRecords` annotates each record's `service` source (strong signal first): content patterns (`*.cfargotunnel.com` → tunnel, `*.workers.dev`/`*.pages.dev`/`*.r2.dev` → worker/pages/r2); `meta.origin_worker_id` → worker (custom-domain placeholder records like `AAAA 100::`); hostname match against worker domains (best-effort, requires Workers Scripts permission, 403 tolerated); `locked`/`meta.read_only` → managed (**read_only is the real flag — `locked` is legacy and often absent**, e.g. R2/Web3/Email Routing records); legacy `meta.auto_added` → auto (field removed by CF 2025-02). Exposes `readOnly` on `DnsRecordView`; worker domains are only queried when worker-target records exist
- `services/accounts.ts`: `AccountService` — CRUD, token verify on create/update, delete-block check, and `getTokenByAccountId`/`getTokenById` helpers used to resolve per-account tokens
- `services/migration.ts`: `migrateLegacyToken()` runs once at server startup — decrypts the old `cf_token` Setting, verifies it, creates a default `Account` (empty `cloudflareAccountId` when the legacy token had none), then removes the Setting row
- `services/tunnels.ts`: `TunnelService` (no injected token) resolves each account's token on demand. `listRemote(accountId)` fetches from CF and filters out DB tunnels; `getRemoteConfig`/`updateRemoteConfig` proxy to CF configurations API — **but reject `config_src: 'local'` tunnels with 409** (their config lives on the origin host, configurations API is invalid). `updateConfig` for managed tunnels syncs ingress/originRequest to the configurations API before saving to DB. Throws `TunnelError` with HTTP status for domain failures
- Global `app.onError` in `index.ts`: Zod errors → 400, others → 500 — both returned in the unified envelope below
- **Unified API response**: every endpoint returns `{ code, message, data }`. Success = `code: 0` (HTTP 200); error = `code: <http status>`, `data: null` (HTTP status preserved). Helpers in `packages/server/src/response.ts` (`ok(c, data, message?)` / `fail(c, status, message)`). Shared `ApiResponse<T>` type in `@cftm/shared/types`. Client wrapper `client/src/api/index.ts` unwraps `data` and throws `Error(message)` on non-zero `code`. SSE `/api/tunnels/:id/logs` is the only non-JSON endpoint
- **Logging**: Pino (v10) via `packages/server/src/logger.ts` (`LOG_LEVEL` env, default `info`). Request logging middleware in `index.ts` (method/path/status/duration). Every CF API call logged in `services/cloudflare.ts` (method/path/status/duration; warns on CF errors, errors on network/invalid-response failures). Key service ops logged (account/tunnel create/delete, token-verify failures, tunnel start/stop, cloudflared process lifecycle). Never log tokens or secrets
- Cloudflare API client in `packages/server/src/services/cloudflare.ts` — `listTunnels`, `getTunnel`, `createTunnel` (explicitly `config_src: 'cloudflare'`), `getTunnelToken`, `getTunnelConfig`, `updateTunnelConfig` (configurations API for remotely-managed tunnels), `listWorkerDomains` (DNS source detection; 403 without Workers Scripts permission is tolerated); `verifyToken` for account creation
- cloudflared process manager in `packages/server/src/services/tunnel.ts` — spawns `cloudflared tunnel run`; **two run modes via `TunnelRunMode`**: `{ type: 'token' }` runs `--token <TOKEN>` for remotely-managed tunnels (no config file), `{ type: 'config' }` writes config.yml via `yaml` lib `stringify` (NOT hand-rolled YAML) and runs `--config <path> <name>` for locally-managed tunnels; buffers logs (SSE)
- Account tokens stored encrypted (AES-256-GCM) per account in the `Account` table; decrypted only for CF API calls
- Prisma singleton in `packages/server/src/prisma.ts` — uses v7 driver adapter (`PrismaBetterSqlite3`), import from `../generated/prisma/client`
- Prisma CLI config in `packages/server/prisma.config.ts` (Prisma v7; `dotenv` loaded there)
- **Dev script**: `node --import tsx --watch src/index.ts` (NOT `tsx watch` — fails in `pnpm -r --parallel`)

## Frontend

- State: Pinia stores in `client/src/stores/` (accounts, tunnels, theme)
- API client: `client/src/api/index.ts` — wrapper around fetch, supports `{ params: {...} }` for query strings
- Vite proxies `/api` to `http://localhost:3000`
- Icons: unplugin-icons with `~icons/mdi/*` and `~icons/lucide/*` imports
- **Layout**: `App.vue` = `NConfigProvider(:theme) > NGlobalStyle > NMessageProvider > NDialogProvider > NNotificationProvider > NLoadingBarProvider > AppLayout.vue` (sider/menu/theme toggle + RouterView). Theme driven by `stores/theme.ts` (`light` | `dark` | `system`, persisted in localStorage)
- **Accounts**: `stores/accounts.ts` holds managed accounts and the shared top-level selected account (`selectedAccountId`, default `'all'` = no filter, persisted in localStorage). A shared `NSelect` in the AppLayout header binds to it
- No auth router guard — pages always accessible; when no accounts exist views show an empty state with a link to Accounts
- `views/TunnelList.vue`: local/remote tabs. Local = DB tunnels, filtered client-side by the selected account (`'all'` = no filter); create-tunnel modal picks a managed account from a dropdown. Remote = live CF API tunnels (require a specific selected account; `'all'` unsupported); remote rows show management type (remotely/locally managed), locally-managed config edits disabled. Remote "编辑" navigates to the ingress pages below
- `views/RemoteTunnelIngress.vue`: lists the ingress rules of a remote tunnel in a table (hostname/path/service + add/delete); "编辑"/"添加规则" navigate to `RemoteIngressEdit`
- `views/RemoteIngressEdit.vue`: per-rule config page — hostname/path/service plus every origin parameter from Cloudflare docs (TLS: originServerName, matchSNItoHost, caPool, noTLSVerify, tlsTimeout, http2Origin; HTTP: httpHostHeader, disableChunkedEncoding; Connection: connectTimeout, noHappyEyeballs, proxyType, keepAliveTimeout, keepAliveConnections, tcpKeepAlive; Access: required/teamName/audTag). Reads/merges existing ingress, saves back to CF configurations API; `/ingress/new` appends a new rule
- `views/DnsManager.vue`: loads zones/records for the selected account (`?accountId=`); `'all'`/no account shows a hint to pick one, empty-state link to Accounts when no accounts exist; source column shows service tags with names (tunnel/worker/pages/R2/managed); delete disabled for read-only records (`locked` or `readOnly`); create-record modal is a plain record form (no tunnel binding)
- `components/CodeEditor.vue`: CodeMirror editor with `language` (`yaml`|`json`), `dark`, and `readOnly` props (uses `EditorState.readOnly` compartment)
- `components/PageHeader.vue`: shared page header = `NBreadcrumb` (crumbs with optional `to` links, last crumb not clickable) + title + `#after-title`/`#actions` slots; used by all views

## Naive UI — Critical Rules

1. **Manual imports required**: Do NOT use `unplugin-vue-components` with `NaiveUiResolver` — it conflicts with Naive UI's export structure causing `does not provide an export named 'NButton'` errors.
2. **Import components explicitly**: `import { NButton, NCard } from 'naive-ui'`
3. **Provider components required**: `useMessage()`, `useDialog()` require `<n-message-provider>` and `<n-dialog-provider>` ancestors.
4. **No unplugin-vue-components**: Do NOT use `NaiveUiResolver` — it causes export resolution failures
5. **NDataTable `render` must return VNodes**: Return `h(...)` (NTag/NButton etc.), NOT HTML strings — strings render as escaped text, breaking styles/click handlers

## Database

Prisma + SQLite (Prisma v7). Schema at `packages/server/prisma/schema.prisma`.
- DB file: `packages/server/prisma/data.db`
- `DATABASE_URL` env var points to the SQLite file (`file:./prisma/data.db`, in `packages/server/.env`)
- Migrations: `packages/server/prisma/migrations/`
- Prisma Client output: `packages/server/generated/prisma/` (TS source, `prisma-client` generator)
- Runtime uses `@prisma/adapter-better-sqlite3` driver adapter (required in v7), not the datasource url
- Prisma CLI reads `packages/server/prisma.config.ts` (schema, migrations path, datasource url)
- server tsconfig includes `generated/prisma` (`rootDir` is `.`); `start` = `node dist/src/index.js`
- better-sqlite3 prebuilt binaries come from npmmirror mirror — see `.npmrc`

## Shared Package Exports

```
@cftm/shared                  → types + schemas
@cftm/shared/schemas          → Zod schemas
@cftm/shared/types            → TypeScript types
@cftm/shared/crypto           → encrypt/decrypt utilities
```

## Conventions

- TypeScript only. No `.js`/`.jsx` source files.
- pnpm only — no lockfiles other than pnpm-lock.yaml.
- Imports from shared use package exports (e.g. `@cftm/shared/schemas`), never relative paths across packages.
- No cross-package relative imports.

## Git Commits

- Split commits by sub-project: each change to `packages/shared`, `packages/client`, `packages/server` gets its own commit
- Commit order: `shared` → `server` → `client`
- Documentation updates (`AGENTS.md`, `*.md`, etc.) committed as a separate `docs` commit
- Dependency/version updates use `chore` scope (e.g. `chore(client): add yaml dependency`)
- Commit messages in English, conventional format (`feat`, `fix`, `docs`, `chore`, `refactor`, ...)
- **Subject**: one line, imperative mood, present tense, ≤72 chars
- **Body**: blank line after subject, then a `-` bullet list of the specific changes; **required** unless the commit is a simple single-line change

## Prerequisites

- cloudflared CLI must be installed locally for tunnel runtime (Phase 3+)
- API Token stored encrypted at rest, decrypted only for CF API calls

## Current Status

- ✅ Phase 1: Scaffold complete
- ✅ Phase 2: Auth + Cloudflare API integration complete
- ✅ Phase 3: cloudflared process management complete (SSE logs, start/stop)
- ✅ Prisma relocated to server + upgraded to v7 (driver adapter, prisma.config.ts)
- ✅ Phase 4: Config editor complete (JSON/YAML modes, linting, format, save via `yaml`/zod); create-tunnel modal wired; TunnelList NDataTable columns render via `h()` (VNode, not HTML strings)
- ✅ Phase 5: DNS management complete (zone select, records CRUD via CF, tunnel-linked records persisted to DB)
- ✅ Phase 6: Polish done — dark/light/system theme toggle (persisted, `stores/theme.ts`, `AppLayout.vue`), route loading bar, CodeEditor follows app theme, sider collapse-aware footer
- ✅ Phase 7: Remote tunnel management — local/remote tabs; remote tunnels fetched/edited live via CF API (no DB storage); router/service separation (control layer vs business layer)
- ✅ Phase 8: Remote/locally-managed tunnel split — run remotely-managed tunnels via `--token` (no config.yml); reject `config_src: 'local'` tunnels from configurations API with 409; `updateConfig` syncs to configurations API; remote list shows management type, locally-managed config edits disabled
- ✅ Phase 9: Per-account management — each managed `Account` has its own API token + account ID + display name; Accounts view + top-level account selector (persisted, default `'all'`); accounts replaced the single `cf_token` Setting (migrated at startup); no auth router guard (empty states link to Accounts); TLS/DNS/tunnel pages filter by selected account; account deletion blocked while local tunnels reference it
- ✅ Phase 10: Per-ingress-rule editing — remote tunnel "编辑" opens a new page listing ingress rules; each rule opens a dedicated config page (`RemoteIngressEdit`) exposing all Cloudflare origin parameters; `/ingress/new` adds a rule; all pages share a `PageHeader` with breadcrumb
- ✅ Phase 11: Unified API responses + logging — every endpoint returns `{ code, message, data }` (shared `ApiResponse<T>`, server `ok`/`fail` helpers, client unwraps); Pino v10 request/CF-call/service logging

