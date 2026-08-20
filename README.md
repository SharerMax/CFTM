# CFTM — Cloudflare Tunnel Manager

Full-stack web app for managing Cloudflare Tunnels and DNS records.

## Features

- **Local tunnels** — create, configure (JSON/YAML editor), start/stop `cloudflared`, view live logs (SSE)
- **Remote tunnels** — browse and edit config via Cloudflare API (no local storage)
- **DNS management** — zone selection, record CRUD via Cloudflare API, service source annotation (tunnel/worker/pages/R2/managed) with read-only record guard
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

## Recommended Skills

This project is built using the following opencode skills. Install them for AI-assisted development that follows the same conventions:

| Skill              | Use case in this project                          |
| ------------------ | ------------------------------------------------- |
| `antfu`            | Project scaffolding, monorepo, tooling conventions |
| `antfu-design`     | UnoCSS-first design, theming, component styling   |
| `git-commit`       | Conventional commit messages                      |
| `naive-ui-skills`  | Naive UI component patterns and rules             |
| `pinia`            | Vue state management (auth, tunnels, theme stores) |
| `pnpm`             | Workspace management, catalogs                     |
| `prisma-cli`       | Prisma CLI workflows (generate, migrate)          |
| `prisma-client-api`| Prisma Client queries and DB operations            |
| `unocss`           | Atomic CSS utilities and presets                  |
| `vite`             | Build tool configuration                          |
| `vue`              | Vue 3 Composition API, `<script setup>`           |
| `vue-best-practices` | Vue 3 best practices and patterns               |
| `vue-router-best-practices` | Vue Router guards and navigation         |
| `vueuse-functions` | VueUse composables                                |
| `vitest`           | Unit testing                                      |

### MCP Servers

| Server             | Purpose                                          |
| ------------------ | ------------------------------------------------- |
| `hono-docs`        | Query Hono framework documentation                |
| `cloudflare-docs`  | Query Cloudflare Tunnel / API documentation       |

Both are configured in `opencode.json` (project-level).

### Quick Install

Install all recommended skills with one command:

```bash
pnpx skills add \
  antfu/skills@antfu \
  antfu/skills@antfu-design \
  github/awesome-copilot@git-commit \
  jiaiyan/naive-ui-skills@naive-ui-skills \
  antfu/skills@pinia \
  antfu/skills@pnpm \
  prisma/skills@prisma-cli \
  prisma/skills@prisma-client-api \
  antfu/skills@unocss \
  antfu/skills@vite \
  antfu/skills@vue \
  antfu/skills@vue-best-practices \
  antfu/skills@vue-router-best-practices \
  antfu/skills@vueuse-functions \
  antfu/skills@vitest
```
