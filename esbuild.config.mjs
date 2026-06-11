// Bundles the renderer entry point into a single classic script. The renderer
// source uses ES module imports (frontend/scripts/lib/*), which esbuild inlines
// here so bootstrap.js can keep loading one plain <script> over file://.
import { build } from 'esbuild';

build({
  entryPoints: ['frontend/scripts/legacy-app.ts'],
  bundle: true,
  outfile: 'dist/frontend/scripts/legacy-app.js',
  format: 'iife',
  platform: 'browser',
  target: 'es2022',
  legalComments: 'none',
  logLevel: 'info',
}).catch(() => process.exit(1));
