import esbuild from 'esbuild';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const isProduction = process.env.NODE_ENV === 'production';

const config = {
  entryPoints: ['index.ts'],
  bundle: true,
  outdir: 'dist',
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  sourcemap: !isProduction,
  minify: isProduction,
  treeShaking: true,
  external: [
    // Node.js built-ins
    'fs',
    'path',
    'http',
    'https',
    'crypto',
    'stream',
    'util',
    'events',
    'buffer',
    'url',
    'querystring',
    'zlib',
    'net',
    'tls',
    'dns',
    'os',
    'child_process',
    'cluster',
    'worker_threads',
    // Keep these as external dependencies (they're large and should be installed separately)
    'mongoose',
    'express',
    'socket.io',
    'ioredis',
    'redis',
    'bullmq',
    '@openai/agents',
    '@anthropic-ai/sdk',
    '@openrouter/sdk',
    'googleapis',
    'google-auth-library',
  ],
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
  },
  logLevel: 'info',
  banner: {
    js: isProduction ? '' : '/* Development build */',
  },
};

// Build function
async function build() {
  try {
    console.log('Building with esbuild...');
    await esbuild.build(config);
    console.log('Build completed successfully!');
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

// Watch mode for development
if (process.argv.includes('--watch')) {
  const ctx = await esbuild.context(config);
  await ctx.watch();
  console.log('Watching for changes...');
} else {
  build();
}

