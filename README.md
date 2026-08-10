# CFTM — Cloudflare Tunnel Manager

Full-stack web app for managing Cloudflare Tunnels and DNS records.

## Features

- **Local tunnels** — create, configure (JSON/YAML editor), start/stop `cloudflared`, view live logs (SSE)
- **Remote tunnels** — browse and edit config via Cloudflare API (no local storage)
- **DNS management** — zone selection, record CRUD via Cloudflare API, tunnel-linked records persisted locally
- **Dark / light / system theme** with collapse-aware layout
- Token stored encrypted (AES-256-GCM) at rest

## Tech Stack

| Layer    | Stack                                                        |
| -------- | ------------------------------------------------------------ |
| Frontend | Vue 3 + Vite + Pinia + Naive UI + UnoCSS + unplugin-icons    |
| Backend  | Node.js + Hono + Prisma + SQLite                             |
| Shared   | Zod schemas, TypeScript types, crypto utils                  |

## Project Structure

```
packages/
├── shared/   # Zod schemas, types, crypto (no Prisma)
├── client/   # Vue 3 frontend
└── server/   # Hono API + Prisma + SQLite
    └── src/
        ├── routes/     # control layer (HTTP → service)
        └── services/   # business layer (DB, CF API, cloudflared)
```

## Prerequisites

- Node.js + pnpm
- Cloudflare API Token (with `Cloudflare Tunnel` + `DNS` permissions)
- `cloudflared` CLI (for local tunnel runtime)

## Getting Started

```bash
pnpm install

# Backend: configure packages/server/.env with DATABASE_URL + Cloudflare token
pnpm -F @cftm/server dev        # API on :3000

# Frontend
pnpm -F @cftm/client dev        # UI on :5173

# Or run both
pnpm dev
```

## Commands

```bash
pnpm dev                 # all dev servers
pnpm lint                # eslint (all packages)
pnpm lint --fix          # auto-fix
pnpm typecheck           # vue-tsc + tsc
pnpm prisma:generate     # regenerate Prisma Client
pnpm prisma:migrate      # create migration (interactive)
```

## Verification Order

`lint → typecheck`
