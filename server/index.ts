import path from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createApp } from './app';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
try {
  process.loadEnvFile(path.join(root, '.env'));
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}

const useChatGPT = process.argv.includes('--chatgpt-local');
const local = useChatGPT || process.argv.includes('--local');
const host = local ? '127.0.0.1' : process.env.HOST || '127.0.0.1';
const port = useChatGPT ? 5173 : Number(process.env.PORT || 8787);
const production = process.env.NODE_ENV === 'production';
const origin = `http://${host}:${port}`;
const directory = process.platform === 'win32' && process.env.LOCALAPPDATA
  ? path.join(process.env.LOCALAPPDATA, 'FluentPath', 'chatgpt')
  : path.join(homedir(), '.config', 'fluentpath-ielts', 'chatgpt');
const app = createApp({
  host, production, local, distDir: path.join(root, 'dist'),
  env: useChatGPT ? { ...process.env, APP_BASE_PATH: '/' } : process.env,
  chatgpt: useChatGPT ? { origin, directory } : undefined,
});
app.listen(port, host, () => console.log(`FluentPath server listening on ${origin}`));
