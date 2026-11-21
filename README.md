# Becha-Kena — Trust-First C2C Marketplace (Bangladesh)

Monorepo for the Becha-Kena platform:
- `packages/shared` (`@becha-kena/shared`): Shared Zod validators, constants, error codes, and DTO types.
- `apps/api` (`@becha-kena/api`): Express.js 4-layer modular monolith + Socket.io + MongoDB Atlas (Mongoose) + Redis/BullMQ.
- `apps/web` (`@becha-kena/web`): Next.js App Router frontend (coming in Frontend Phases F00–F10).

## Prerequisites

- **Node.js** 20+ LTS
- **pnpm** 9+
- **Docker & Docker Compose** (for local MongoDB Replica Set, Redis, and MinIO)

## Local Setup

1. Start local backing services (MongoDB `rs0` replica set, Redis 7, MinIO with `bk-private` and `bk-public` buckets):
   ```bash
   docker compose up -d
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Copy the API environment template:
   ```bash
   cp apps/api/.env.example apps/api/.env
   ```

4. Run the API in development mode:
   ```bash
   pnpm --filter @becha-kena/api dev
   ```

## Common Commands

```bash
pnpm lint        # ESLint across all workspaces
pnpm typecheck   # TypeScript strict typecheck across all workspaces
pnpm test        # Run all Vitest suites
pnpm build       # Compile all workspaces
```
