#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "==> Enabling pnpm"
corepack enable
corepack prepare pnpm@9.15.4 --activate

echo "==> Installing dependencies"
pnpm install

if [[ ! -f apps/api/.env ]]; then
  echo "==> Creating apps/api/.env"
  cp apps/api/.env.example apps/api/.env
fi

if [[ ! -f apps/web/.env.local ]]; then
  echo "==> Creating apps/web/.env.local"
  cp apps/web/.env.example apps/web/.env.local
fi

echo "==> Starting Podman machine"
podman machine start || true

echo "==> Starting PostgreSQL"
podman compose up -d

echo "==> Generating Prisma client"
pnpm --filter api exec prisma generate

echo "==> Running migrations"
pnpm --filter api exec prisma migrate deploy

free_port() {
  local port=$1
  if lsof -ti ":$port" >/dev/null 2>&1; then
    echo "==> Freeing port $port (leftover dev process)"
    lsof -ti ":$port" | xargs kill -9 2>/dev/null || true
    sleep 1
  fi
}

free_port 3000
free_port 3001

echo "==> Starting dev servers"
echo "Web: http://localhost:3000"
echo "API: http://localhost:3001/api/health"
pnpm dev
