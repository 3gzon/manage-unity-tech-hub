const fs = require('fs');
const path = require('path');

// @netlify/plugin-nextjs v5 in monorepo mode creates its artifacts at a "stray" path
// (CWD/packagePath/... instead of CWD/...) because the plugin resolves paths relative
// to CWD which already contains the packagePath component.
//
// The Netlify CLI deploy step then looks for functions and edge functions at the
// NON-stray path and finds nothing — so the deploy has 0 functions and 0 edge functions,
// meaning every route returns Netlify's own 404.
//
// This plugin fixes both issues:
// 1. onBuild: Patch /var/task/apps/web/ absolute paths in the Lambda handler to
//    ./apps/web/ relative paths (the absolute paths only work on Netlify CI).
// 2. onPostBuild: Copy the functions manifest and edge-functions-dist from the stray
//    path to the non-stray path where the CLI deploy step expects them.

function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src)) {
    const srcPath = path.join(src, entry);
    const destPath = path.join(dest, entry);
    const stat = fs.statSync(srcPath);
    if (stat.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

module.exports = {
  onBuild: ({ constants, utils }) => {
    const internalFunctionsSrc = constants.INTERNAL_FUNCTIONS_SRC || 'apps/web/.netlify/functions-internal';
    const handlerFile = path.join(internalFunctionsSrc, '___netlify-server-handler', '___netlify-server-handler.mjs');

    if (!fs.existsSync(handlerFile)) {
      utils.status.show({ summary: 'Handler not yet created, skipping patch.' });
      return;
    }

    const content = fs.readFileSync(handlerFile, 'utf8');

    const patched = content
      .replace(/from '\/var\/task\/apps\/web\//g, "from './apps/web/")
      .replace(/import\('\/var\/task\/apps\/web\//g, "import('./apps/web/");

    if (patched === content) {
      utils.status.show({ summary: 'No /var/task/ paths to patch.' });
      return;
    }

    fs.writeFileSync(handlerFile, patched);
    utils.status.show({ summary: 'Patched /var/task/apps/web/ → ./apps/web/ for local CLI deploy.' });
  },

  onPostBuild: ({ constants, utils }) => {
    // CWD = {project_root}/apps/web (the packagePath directory)
    // Stray artifacts are at CWD/apps/web/.netlify/ (because PACKAGE_PATH = apps/web is
    // added again relative to CWD).
    // The CLI deploy step looks at CWD/.netlify/ (which is the non-stray path).

    const packagePath = constants.PACKAGE_PATH || 'apps/web';
    const strayNetlifyDir = path.join(packagePath, '.netlify'); // relative to CWD
    const nonStrayNetlifyDir = '.netlify'; // CWD/.netlify

    if (!fs.existsSync(strayNetlifyDir)) {
      utils.status.show({ summary: 'No stray .netlify dir found, skipping copy.' });
      return;
    }

    const copied = [];

    // 1. Copy functions manifest (CLI reads: {site.root}/{packagePath}/.netlify/functions/manifest.json
    //    site.root = CWD/.., packagePath = apps/web → same as CWD/.netlify/functions/manifest.json)
    const strayManifest = path.join(strayNetlifyDir, 'functions', 'manifest.json');
    if (fs.existsSync(strayManifest)) {
      const targetManifestDir = path.join(nonStrayNetlifyDir, 'functions');
      const targetManifest = path.join(targetManifestDir, 'manifest.json');
      if (path.resolve(strayManifest) !== path.resolve(targetManifest)) {
        fs.mkdirSync(targetManifestDir, { recursive: true });
        fs.copyFileSync(strayManifest, targetManifest);
        copied.push('functions/manifest.json');
      }
    }

    // 2. Copy edge-functions-dist directory (CLI reads: {workingDir}/.netlify/edge-functions-dist
    //    workingDir = CWD → CWD/.netlify/edge-functions-dist)
    const strayEdgeDist = path.join(strayNetlifyDir, 'edge-functions-dist');
    if (fs.existsSync(strayEdgeDist)) {
      const targetEdgeDist = path.join(nonStrayNetlifyDir, 'edge-functions-dist');
      if (path.resolve(strayEdgeDist) !== path.resolve(targetEdgeDist)) {
        copyDirSync(strayEdgeDist, targetEdgeDist);
        copied.push('edge-functions-dist/');
      }
    }

    if (copied.length === 0) {
      utils.status.show({ summary: 'Nothing to copy (paths are identical or artifacts missing).' });
    } else {
      utils.status.show({ summary: `Copied from stray .netlify path to deploy path: ${copied.join(', ')}` });
    }
  },
};
