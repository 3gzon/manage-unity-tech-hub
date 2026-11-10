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

if (existsSync('apps/api/assets')) {
  cpSync('apps/api/assets', join(BUNDLE_DIR, 'assets'), { recursive: true });
}

// Copy the fully generated Prisma client (with enums) into the bundle.
// pnpm deploy installs a clean @prisma/client without generated output,
// so we overwrite every copy with the workspace version that prisma generate built.
const pnpmStore = 'node_modules/.pnpm';
const prismaEntry = readdirSync(pnpmStore).find((d) => d.startsWith('@prisma+client@'));
if (prismaEntry) {
  const generatedClient = join(pnpmStore, prismaEntry, 'node_modules', '@prisma', 'client');
  const generatedDotPrisma = join(pnpmStore, prismaEntry, 'node_modules', '.prisma');

  // Overwrite the top-level node_modules copy
  if (existsSync(generatedClient)) {
    const dest = join(BUNDLE_DIR, 'node_modules', '@prisma', 'client');
    rmSync(dest, { recursive: true, force: true });
    cpSync(generatedClient, dest, { recursive: true });
  }
  if (existsSync(generatedDotPrisma)) {
    const dest = join(BUNDLE_DIR, 'node_modules', '.prisma');
    rmSync(dest, { recursive: true, force: true });
    cpSync(generatedDotPrisma, dest, { recursive: true });
  }

  // Also overwrite the .pnpm store copy (pnpm resolves through this path)
  const bundlePnpmDir = join(BUNDLE_DIR, 'node_modules', '.pnpm');
  if (existsSync(bundlePnpmDir)) {
    const bundlePrismaEntry = readdirSync(bundlePnpmDir).find((d) => d.startsWith('@prisma+client@'));
    if (bundlePrismaEntry) {
      if (existsSync(generatedClient)) {
        const dest = join(bundlePnpmDir, bundlePrismaEntry, 'node_modules', '@prisma', 'client');
        rmSync(dest, { recursive: true, force: true });
        cpSync(generatedClient, dest, { recursive: true });
      }
      if (existsSync(generatedDotPrisma)) {
        const dest = join(bundlePnpmDir, bundlePrismaEntry, 'node_modules', '.prisma');
        rmSync(dest, { recursive: true, force: true });
        cpSync(generatedDotPrisma, dest, { recursive: true });
      }
    }
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
