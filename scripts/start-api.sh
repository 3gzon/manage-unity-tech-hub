#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "==> API backend setup"

if [[ ! -f apps/api/.env ]]; then
  echo "==> Creating apps/api/.env"
  cp apps/api/.env.example apps/api/.env
fi

echo "==> Starting PostgreSQL"
podman machine start 2>/dev/null || true
podman compose up -d

echo "==> Building shared types"
pnpm --filter @unity/types build

echo "==> Prisma generate + migrate"
pnpm --filter api exec prisma generate
pnpm --filter api exec prisma migrate deploy

if lsof -ti ":3001" >/dev/null 2>&1; then
  echo "==> Freeing port 3001"
  lsof -ti ":3001" | xargs kill -9 2>/dev/null || true
  sleep 1
fi

echo "==> Starting API on http://localhost:3001"
echo "    Health: http://localhost:3001/api/health"
pnpm --filter api dev
