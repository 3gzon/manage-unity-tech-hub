import { execSync } from 'node:child_process';
import { cpSync, existsSync, lstatSync, readlinkSync, realpathSync, rmSync, readdirSync, unlinkSync } from 'node:fs';
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

// Dereference all symlinks — pnpm deploy creates a hoisted layout with symlinks
// but Netlify Functions (Lambda) does not preserve them when packaging.
function derefAllSymlinks(dir) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isSymbolicLink()) {
      const realPath = realpathSync(fullPath);
      unlinkSync(fullPath);
      cpSync(realPath, fullPath, { recursive: true });
    } else if (entry.isDirectory()) {
      derefAllSymlinks(fullPath);
    }
  }
}
derefAllSymlinks(join(BUNDLE_DIR, 'node_modules'));

// Copy the fully generated Prisma client (with enums) into the bundle.
// pnpm deploy installs a clean @prisma/client without the generated enum objects.
const pnpmStore = 'node_modules/.pnpm';
const prismaEntry = readdirSync(pnpmStore).find((d) => d.startsWith('@prisma+client@'));
if (prismaEntry) {
  const generatedClient = join(pnpmStore, prismaEntry, 'node_modules', '@prisma', 'client');
  const generatedDotPrisma = join(pnpmStore, prismaEntry, 'node_modules', '.prisma');

  // Overwrite every @prisma/client location in the bundle
  const targets = [join(BUNDLE_DIR, 'node_modules')];
  const bundlePnpmDir = join(BUNDLE_DIR, 'node_modules', '.pnpm');
  if (existsSync(bundlePnpmDir)) {
    for (const entry of readdirSync(bundlePnpmDir)) {
      if (entry.startsWith('@prisma+client@')) {
        targets.push(join(bundlePnpmDir, entry, 'node_modules'));
      }
    }
  }

  for (const target of targets) {
    if (existsSync(generatedClient)) {
      const dest = join(target, '@prisma', 'client');
      if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
      cpSync(generatedClient, dest, { recursive: true });
    }
    if (existsSync(generatedDotPrisma)) {
      const dest = join(target, '.prisma');
      if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
      cpSync(generatedDotPrisma, dest, { recursive: true });
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
