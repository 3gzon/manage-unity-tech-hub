import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const BUNDLE_DIR = 'api-bundle';

if (existsSync(BUNDLE_DIR)) {
  rmSync(BUNDLE_DIR, { recursive: true });
}
mkdirSync(BUNDLE_DIR, { recursive: true });

// Build a package.json with only production dependencies (no pnpm symlinks)
const apiPkg = JSON.parse(readFileSync('apps/api/package.json', 'utf8'));
const deps = { ...apiPkg.dependencies };
// Remove workspace: dependencies — they'll be copied manually
for (const [key, value] of Object.entries(deps)) {
  if (typeof value === 'string' && value.startsWith('workspace:')) {
    delete deps[key];
  }
}
const bundlePkg = {
  name: apiPkg.name,
  version: apiPkg.version,
  private: true,
  dependencies: deps,
};
writeFileSync(join(BUNDLE_DIR, 'package.json'), JSON.stringify(bundlePkg, null, 2));

// Install with npm for a flat, symlink-free node_modules
execSync('npm install --omit=dev --ignore-scripts', { cwd: BUNDLE_DIR, stdio: 'inherit' });

// Copy compiled code, Prisma schema, and assets
cpSync('apps/api/dist', join(BUNDLE_DIR, 'dist'), { recursive: true });
cpSync('apps/api/prisma', join(BUNDLE_DIR, 'prisma'), { recursive: true });

if (existsSync('apps/api/assets')) {
  cpSync('apps/api/assets', join(BUNDLE_DIR, 'assets'), { recursive: true });
}

// Copy @unity/types (workspace dependency)
const typesPkg = 'packages/types';
if (existsSync(typesPkg)) {
  const dest = join(BUNDLE_DIR, 'node_modules', '@unity', 'types');
  mkdirSync(dest, { recursive: true });
  cpSync(typesPkg, dest, { recursive: true });
}

// Generate Prisma client inside the bundle
import { resolve } from 'node:path';
const schemaAbsPath = resolve(BUNDLE_DIR, 'prisma', 'schema.prisma');
execSync(`pnpm --filter api exec prisma generate --schema ${schemaAbsPath}`, { stdio: 'inherit' });

// Remove macOS-only Prisma engine binaries (Lambda runs Linux)
const prismaClientOut = join(BUNDLE_DIR, 'node_modules', '.prisma', 'client');
if (existsSync(prismaClientOut)) {
  for (const f of readdirSync(prismaClientOut)) {
    if (f.includes('darwin')) {
      unlinkSync(join(prismaClientOut, f));
    }
  }
}
