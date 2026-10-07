# Unity Tech Hub Management Platform

Production-ready monorepo for Unity Tech Hub internal management.

## Stack

- **Frontend:** Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **Backend:** NestJS, TypeScript, REST API
- **Database:** PostgreSQL, Prisma ORM
- **Monorepo:** pnpm workspaces, Turborepo
- **Local database runtime:** Podman

## Structure

```
apps/
  web/          Next.js admin app
  api/          NestJS REST API
packages/
  ui/           Shared UI utilities (shadcn-ready)
  types/        Shared TypeScript types
  eslint-config Shared ESLint configs
  tsconfig/     Shared TypeScript configs
```

## Setup

```bash
cd /Users/egzonuka/Desktop/unity-tech-hub-platform
corepack enable
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

### Database (Podman)

Start the Podman VM if needed, then bring up PostgreSQL:

```bash
podman machine start
pnpm db:up
```

Check the container:

```bash
pnpm db:ps
podman compose ps
```

Expected local database values:

| Setting | Value |
| --- | --- |
| Database | `unity_tech_hub` |
| User | `uth` |
| Password | `uthpass` |
| Host from app | `127.0.0.1` |
| Port | `5432` |
| Container | `unity-tech-hub-postgres` |

If port `5432` is already used by another Podman container (for example `uth-postgres`), either stop that container or change the host port in `compose.yaml`.

Then run Prisma:

```bash
pnpm --filter api exec prisma generate
pnpm --filter api exec prisma migrate dev --name init
```

## Development

```bash
pnpm dev                 # web + api via Turborepo
pnpm --filter api dev    # http://localhost:3001/api/health
pnpm --filter web dev    # http://localhost:3000
```

## Database commands

```bash
pnpm db:up      # start postgres via podman compose
pnpm db:down    # stop and remove compose services
pnpm db:logs    # follow postgres logs
pnpm db:ps      # show postgres container status
```

Manual Podman commands also work:

```bash
podman machine start
podman compose up -d
podman start unity-tech-hub-postgres
podman stop unity-tech-hub-postgres
```

## Verify

```bash
pnpm typecheck
pnpm build
curl http://localhost:3001/api/health
```

Connect with psql:

```bash
PGPASSWORD=uthpass psql -h 127.0.0.1 -p 5432 -U uth -d unity_tech_hub
```

## Notes

- No business modules implemented yet.
- Future domain modules: `apps/api/src/modules/*`, `apps/web/src/features/*`.
- `compose.yaml` is compatible with `podman compose`.
