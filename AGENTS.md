# AGENTS.md

## Stack

Full-stack monorepo, TypeScript + pnpm workspaces. Deps in `pnpm-workspace.yaml` catalog, referenced as `"catalog:"`.

- `packages/shared` — Zod schemas, types, crypto utils (no Prisma)
- `packages/client` — Vue 3 + Vite + Pinia + Naive UI + UnoCSS + unplugin-icons
- `packages/server` — Node.js + Hono + Prisma v7 + SQLite

## Commands

```bash
pnpm install                    # Install
pnpm dev                        # All dev servers in parallel
pnpm -F @cftm/server dev        # Backend only (port 3000)
pnpm -F @cftm/client dev        # Frontend only (port 5173)
pnpm lint                       # Lint all (antfu config, no Prettier)
pnpm lint --fix
pnpm typecheck                  # vue-tsc (client) / tsc (server)
pnpm prisma:generate            # Regenerate Prisma Client
pnpm prisma:migrate             # Create migration (interactive)
```

Verify: `lint → typecheck`

## Backend

- **Router/Service split**: `routes/` = HTTP + Zod + auth + JSON only (no business logic, no DB). `services/` = DB ops, CF API, process mgmt.
- Routes: `accounts` (`GET/POST /`, `PUT/DELETE /:id`), `tunnels` (local CRUD + `/:id/config|start|stop|logs`; remote `GET /remote`, `GET/PUT /remote/config`), `zones` (DNS CRUD). DNS + remote routes require `?accountId=` (resolved to that account's token).
- **Gotchas**:
  - Account `DELETE` → 409 `account_in_use` while any `Tunnel.accountId` references it; `POST`/`PUT` verify token via CF first.
  - `config_src: 'local'` tunnels → configurations API rejected with 409 (config lives on origin host).
  - DNS source detection: `meta.read_only` → managed (**real flag; `locked` is legacy, often absent**); content patterns (`*.cfargotunnel.com` → tunnel, `*.workers.dev`/`*.pages.dev`/`*.r2.dev` → worker/pages/R2); `meta.origin_worker_id` → worker; hostname match vs worker domains (best-effort, 403 tolerated). Exposes `readOnly` on `DnsRecordView`.
  - `migrateLegacyToken()` at startup: migrates old `cf_token` Setting into a default Account.
  - **Dev script**: `node --import tsx --watch src/index.ts` — NOT `tsx watch` (breaks in `pnpm -r --parallel`).
- **Unified API**: every endpoint returns `{ code, message, data }` — success `code: 0` (HTTP 200); error `code: <status>`, `data: null`. Helpers `ok()/fail()` in `src/response.ts`; shared `ApiResponse<T>` in `@cftm/shared/types`; client unwraps `data`, throws on non-zero `code`. SSE `GET /api/tunnels/:id/logs` is the only non-JSON endpoint. `app.onError`: Zod → 400, else 500.
- **Logging**: Pino v10 (`src/logger.ts`, `LOG_LEVEL` env, default `info`). Request + CF-call logs (method/path/status/duration). Never log tokens/secrets.
- **CF API** (`src/services/cloudflare.ts`): tunnels CRUD, `getTunnelToken`, config API (remote-managed only), `listWorkerDomains`, `verifyToken`. `createTunnel` always `config_src: 'cloudflare'`.
- **cloudflared** (`src/services/tunnel.ts`): `TunnelRunMode` — `token` (`--token`, remote-managed, no config file) or `config` (config.yml via `yaml` stringify, local-managed); buffers logs for SSE.
- **Prisma**: v7 driver adapter (`PrismaBetterSqlite3`), Client in `generated/prisma` (TS source), CLI config in `prisma.config.ts` (dotenv).

## Frontend

- State: Pinia in `stores/` (accounts, tunnels, theme); API wrapper in `api/index.ts` (`{ params }` → query string); Vite proxies `/api` → :3000; icons via `~icons/mdi/*` and `~icons/lucide/*`.
- Layout: `App.vue` = `NConfigProvider > NGlobalStyle > NMessageProvider > NDialogProvider > NNotificationProvider > NLoadingBarProvider > AppLayout.vue`. Theme `light|dark|system`, persisted (theme.ts).
- Accounts: `stores/accounts.ts` — managed accounts + top-level selector `selectedAccountId` (default `'all'`, persisted). No auth guard; views show empty-state links when no accounts exist.
- Views: `TunnelList.vue` (local DB tunnels filtered by account / remote CF tunnels — remote requires a specific account); `RemoteTunnelIngress.vue` + `RemoteIngressEdit.vue` (per-rule origin params, saved to CF configurations API); `DnsManager.vue` (zones/records CRUD, delete disabled for read-only); `components/CodeEditor.vue` (CodeMirror, `yaml|json`, dark, readOnly); `components/PageHeader.vue` (breadcrumb + title + slots).

## Naive UI — Critical Rules

1. Import explicitly: `import { NButton } from 'naive-ui'` — never `unplugin-vue-components`/`NaiveUiResolver` (breaks exports).
2. `useMessage()`/`useDialog()` require `<n-message-provider>`/`<n-dialog-provider>` ancestors.
3. NDataTable `render` must return VNodes via `h(...)` — HTML strings render escaped, breaking styles/click handlers.

## Database

- DB file: `packages/server/prisma/data.db` (`DATABASE_URL = file:./prisma/data.db` in `server/.env`); migrations in `prisma/migrations/`.
- Runtime uses `@prisma/adapter-better-sqlite3` (required in v7), not the datasource url; CLI reads `prisma.config.ts`.
- server tsconfig includes `generated/prisma` (`rootDir` `.`); `start` = `node dist/src/index.js`.
- better-sqlite3 prebuilt binaries from npmmirror — see `.npmrc`.

## Conventions

- TypeScript only; pnpm only (no other lockfiles).
- Shared imports via package exports (`@cftm/shared/schemas`, `/types`, `/crypto`) — no cross-package relative paths.

## Git Commits

- One commit per sub-project: `shared` → `server` → `client`; docs changes separate (`docs`).
- Conventional format (feat/fix/docs/chore/refactor…), English, imperative subject ≤72 chars.
- Body: blank line + `-` bullets; required unless a trivial single-line change.

## Prerequisites

- `cloudflared` CLI installed locally for tunnel runtime.
- Account tokens encrypted (AES-256-GCM), decrypted only for CF API calls.

## Status

All phases complete (1–11): scaffold, auth, cloudflared process mgmt (SSE), Prisma v7, config editor, DNS mgmt, theming, remote tunnels, per-account mgmt, per-rule ingress editing, unified API + logging.
