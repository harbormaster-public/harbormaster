import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';
import { meteor } from 'meteor-vite/plugin';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const pkg = JSON.parse(
  fs.readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
);
const projectRoot = fileURLToPath(new URL('.', import.meta.url));

// Ensure any relative paths inside meteor-vite (it reads `.meteor/local/...`)
// resolve from the Meteor project root.
process.chdir(projectRoot);

const ensureMeteorViteRuntimeSourceMaps = () => {
  // jorgenvatle:vite@1.5.4 ships server-runtime.mjs with a sourceMappingURL
  // comment but (in some installs) without the corresponding .map file.
  // The Vite compiler plugin (swc) treats this as fatal.
  //
  // We create a minimal valid sourcemap next to each installed runtime file,
  // and also at the "virtual" path swc reports (packages/jorgenvatle:vite/...).
  try {
    const home = os.homedir();
    const meteorPackagesDir = path.join(home, '.meteor', 'packages');
    const pkgDir = path.join(meteorPackagesDir, 'jorgenvatle_vite');
    if (!fs.existsSync(pkgDir)) return;

    const versions = fs.readdirSync(pkgDir).filter((d) => d.startsWith('.'));
    const minimalMap = JSON.stringify({
      version: 3,
      sources: [],
      names: [],
      mappings: '',
    });

    // swc error paths are relative (e.g. packages/jorgenvatle:vite/dist/...).
    // Create a minimal map there too so source-map resolution succeeds.
    const virtualMapFile = path.join(
      projectRoot,
      'packages',
      'jorgenvatle:vite',
      'dist',
      'server-runtime.mjs.map',
    );
    if (!fs.existsSync(virtualMapFile)) {
      fs.mkdirSync(path.dirname(virtualMapFile), { recursive: true });
      fs.writeFileSync(virtualMapFile, minimalMap, 'utf8');
    }

    for (const versionDir of versions) {
      const base = path.join(pkgDir, versionDir);
      // We only need the map where the runtime file exists.
      const candidates = [
        path.join(base, 'os', 'dist', 'server-runtime.mjs'),
        path.join(base, 'web.browser', 'dist', 'server-runtime.mjs'),
        path.join(base, 'web.browser.legacy', 'dist', 'server-runtime.mjs'),
        path.join(base, 'web.cordova', 'dist', 'server-runtime.mjs'),
      ];

      for (const runtimeFile of candidates) {
        if (!fs.existsSync(runtimeFile)) continue;
        const mapFile = `${runtimeFile}.map`;
        if (fs.existsSync(mapFile)) continue;

        const content = fs.readFileSync(runtimeFile, 'utf8');
        if (!content.includes('sourceMappingURL=server-runtime.mjs.map')) {
          continue;
        }

        fs.writeFileSync(mapFile, minimalMap, 'utf8');
      }
    }
  }
  catch (e) {
    // eslint-disable-next-line no-console
    console.warn('Unable to ensure meteor-vite runtime sourcemaps:', e);
  }
};

ensureMeteorViteRuntimeSourceMaps();

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    vue(),
    meteor({
      clientEntry: 'client/main.js',
      stubValidation: {
        ignorePackages: ['meteor/mongo'],
      },
    }),
  ],
  optimizeDeps: {
    exclude: ['vue-meteor-tracker'],
  },
  server: {
    watch: {
      ignored: [
        '**/.coverage/**',
        '**/.meteor-test-app/**',
      ],
    },
    fs: {
      strict: false,
      allow: [projectRoot],
    },
  },
});


