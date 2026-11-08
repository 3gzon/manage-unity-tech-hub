import { execSync } from 'node:child_process';
import { cpSync, existsSync, rmSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

const BUNDLE_DIR = 'api-bundle';

if (existsSync(BUNDLE_DIR)) {
  rmSync(BUNDLE_DIR, { recursive: true });
}

execSync(`pnpm --filter api --prod deploy ${BUNDLE_DIR}`, { stdio: 'inherit' });

cpSync('apps/api/dist', join(BUNDLE_DIR, 'dist'), { recursive: true });
cpSync('apps/api/prisma', join(BUNDLE_DIR, 'prisma'), { recursive: true });

// Copy generated Prisma client from the workspace
const prismaClientDir = 'node_modules/.pnpm';
const prismaEntry = readdirSync(prismaClientDir).find((d) => d.startsWith('@prisma+client@'));
if (prismaEntry) {
  const src = join(prismaClientDir, prismaEntry, 'node_modules', '.prisma');
  if (existsSync(src)) {
    cpSync(src, join(BUNDLE_DIR, 'node_modules', '.prisma'), { recursive: true });
  }
}

// Remove packages not needed at runtime
const pnpmDir = join(BUNDLE_DIR, 'node_modules', '.pnpm');
const removable = ['typescript@', 'effect@', '@types+node@', 'fast-check@', 'jiti@'];
if (existsSync(pnpmDir)) {
  for (const entry of readdirSync(pnpmDir)) {
    if (removable.some((prefix) => entry.startsWith(prefix))) {
      rmSync(join(pnpmDir, entry), { recursive: true, force: true });
    }
  }
}

// Remove macOS-only Prisma engine binary (Lambda runs Linux)
const prismaClientOut = join(BUNDLE_DIR, 'node_modules', '.prisma', 'client');
if (existsSync(prismaClientOut)) {
  for (const f of readdirSync(prismaClientOut)) {
    if (f.includes('darwin')) {
      unlinkSync(join(prismaClientOut, f));
    }
  }
}
const enginesDir = join(pnpmDir);
if (existsSync(enginesDir)) {
  for (const entry of readdirSync(enginesDir)) {
    if (entry.startsWith('@prisma+engines@')) {
      const engDir = join(enginesDir, entry, 'node_modules', '@prisma', 'engines');
      if (existsSync(engDir)) {
        for (const f of readdirSync(engDir)) {
          if (f.includes('darwin')) {
            unlinkSync(join(engDir, f));
          }
        }
      }
    }
  }
}
