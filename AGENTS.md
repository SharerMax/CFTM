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
- Hono routes in `packages/server/src/routes/` (`auth`, `tunnels`, `zones` — DNS record CRUD, tunnel-linked records synced to DB)
- `routes/tunnels.ts`: local CRUD (`GET/POST /`, `GET/PUT/DELETE /:id`, `/:id/config`, `/:id/start`, `/:id/stop`, `/:id/logs`) + remote (`GET /remote`, `GET/PUT /remote/config` — no DB storage, fetched/edited via CF API)
- `services/tunnels.ts`: `TunnelService` holds all business logic. `listRemote(accountId)` fetches from CF and filters out DB tunnels; `getRemoteConfig`/`updateRemoteConfig` proxy to CF configurations API. Throws `TunnelError` with HTTP status for domain failures
- Global `app.onError` in `index.ts`: Zod errors → 400, others → `{ error }` JSON 500
- Cloudflare API client in `packages/server/src/services/cloudflare.ts` — `listTunnels`, `createTunnel`, `getTunnelToken`, `getTunnelConfig`, `updateTunnelConfig` (configurations API for remote tunnels)
- cloudflared process manager in `packages/server/src/services/tunnel.ts` — spawns `cloudflared tunnel run`, buffers logs (SSE), writes config.yml via `yaml` lib `stringify` (NOT hand-rolled YAML)
- Token stored encrypted (AES-256-GCM) in SQLite `Setting` table
- `getCfTokenAsync()` from `routes/auth.ts` used by all protected routes
- Prisma singleton in `packages/server/src/prisma.ts` — uses v7 driver adapter (`PrismaBetterSqlite3`), import from `../generated/prisma/client`
- Prisma CLI config in `packages/server/prisma.config.ts` (Prisma v7; `dotenv` loaded there)
- **Dev script**: `node --import tsx --watch src/index.ts` (NOT `tsx watch` — fails in `pnpm -r --parallel`)

## Frontend

- State: Pinia stores in `client/src/stores/` (auth, tunnels, theme)
- API client: `client/src/api/index.ts` — wrapper around fetch, supports `{ params: {...} }` for query strings
- Vite proxies `/api` to `http://localhost:3000`
- Icons: unplugin-icons with `~icons/mdi/*` and `~icons/lucide/*` imports
- **Layout**: `App.vue` = `NConfigProvider(:theme) > NGlobalStyle > NMessageProvider > NDialogProvider > NNotificationProvider > NLoadingBarProvider > AppLayout.vue` (sider/menu/theme toggle + RouterView). Theme driven by `stores/theme.ts` (`light` | `dark` | `system`, persisted in localStorage)
- Router guard in `router/index.ts` redirects to `/settings` when token unconfigured (routes marked `meta.requiresAuth`)
- `views/TunnelList.vue`: local/remote tabs. Local = DB tunnels (create/start/stop/delete/detail); Remote = live CF API tunnels (load by Account ID, view/edit config via API — not stored in DB)
- `components/CodeEditor.vue`: CodeMirror editor with `language` (`yaml`|`json`), `dark`, and `readOnly` props (uses `EditorState.readOnly` compartment)

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
- ✅ Phase 6: Polish done — dark/light/system theme toggle (persisted, `stores/theme.ts`, `AppLayout.vue`), route guard redirects to Settings when token unconfigured, route loading bar, CodeEditor follows app theme, sider collapse-aware footer
- ✅ Phase 7: Remote tunnel management — local/remote tabs; remote tunnels fetched/edited live via CF API (no DB storage); router/service separation (control layer vs business layer)

