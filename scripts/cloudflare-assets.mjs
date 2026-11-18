// Cloudflare direct asset uploads. Session credentials are accepted only on stdin.
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createInterface } from 'node:readline';

const directory = path.resolve('dist');
async function manifest(dir = directory, result = {}) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) await manifest(file, result);
    else {
      const content = await readFile(file);
      result[`/${path.relative(directory, file).replaceAll('\\', '/')}`] = { hash: createHash('sha256').update(content).digest('hex').slice(0, 32), size: content.length };
    }
  }
  return result;
}
const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.png': 'image/png', '.json': 'application/json' };
if (process.argv[2] === 'manifest') console.log(JSON.stringify(await manifest()));
else if (process.argv[2] === 'upload') {
  const input = createInterface({ input: process.stdin });
  input.once('line', async line => {
    input.close();
    try {
      const { accountId, jwt, buckets } = JSON.parse(line);
      if (!/^[a-f0-9]{32}$/.test(accountId) || typeof jwt !== 'string' || !Array.isArray(buckets)) throw new Error('Invalid upload session');
      const files = await manifest();
      let completion = buckets.length === 0 ? jwt : undefined;
      for (const bucket of buckets) {
        const body = new FormData();
        for (const hash of bucket) {
          const filePath = Object.keys(files).find(key => files[key].hash === hash);
          if (!filePath) throw new Error('Upload manifest changed. Build again and restart the upload.');
          const content = await readFile(path.join(directory, filePath));
          body.append(hash, new Blob([content.toString('base64')], { type: mime[path.extname(filePath)] || 'application/octet-stream' }), hash);
        }
        const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/assets/upload?base64=true`, { method: 'POST', headers: { Authorization: `Bearer ${jwt}` }, body });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(`Asset upload failed (${response.status}).`);
        if (result.result?.jwt) completion = result.result.jwt;
      }
      if (!completion) throw new Error('Cloudflare did not return a completion token.');
      // Machine output: callers must retain this token in memory, never log it.
      console.log(JSON.stringify({ jwt: completion, uploaded: buckets.flat().length }));
    } catch (error) { console.error(error.message); process.exitCode = 1; }
  });
} else throw new Error('Use manifest or upload');
