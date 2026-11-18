import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
try {
  process.loadEnvFile(path.join(root, '.env'));
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}

const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 8787);
const production = process.env.NODE_ENV === 'production';
const app = createApp({ host, production, distDir: path.join(root, 'dist') });
app.listen(port, host, () => console.log(`FluentPath server listening on http://${host}:${port}`));
