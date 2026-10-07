#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
echo "Installing dependencies..."
pnpm install
echo "Clearing Next.js cache..."
rm -rf apps/web/.next
echo "Verifying lucide-react..."
pnpm --filter web exec node -e "require('lucide-react'); console.log('lucide-react OK')"
echo "Verifying react-hook-form..."
pnpm --filter web exec node -e "require('react-hook-form'); console.log('react-hook-form OK')"
echo "Verifying zod..."
pnpm --filter web exec node -e "require('zod'); console.log('zod OK')"
echo "Done. Run: pnpm --filter web dev"
