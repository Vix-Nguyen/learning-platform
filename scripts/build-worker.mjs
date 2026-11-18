import { build } from 'esbuild';

await build({ entryPoints: ['worker/index.ts'], bundle: true, format: 'esm', platform: 'browser', target: 'es2022', outfile: 'dist-worker/index.js', minify: true });
console.log('Built lightweight Cloudflare Worker. Static SPA assets remain in dist/.');
