import assert from 'node:assert/strict';
import { test } from 'node:test';
import worker, { type WorkerEnv } from '../worker/index';

const credentials = `Basic ${btoa('learner:correct horse')}`;
const assets = { fetch: async () => new Response('<main>FluentPath</main>', { headers: { 'Content-Type': 'text/html' } }) };

function request(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('Authorization', credentials);
  return new Request(`https://fluentpath.example${path}`, { ...init, headers });
}

const baseEnv: WorkerEnv = { AUTH_USERNAME: 'learner', AUTH_PASSWORD: 'correct horse', ASSETS: assets };

test('rejects every request without Basic credentials and issues native challenge', async () => {
  const response = await worker.fetch(new Request('https://fluentpath.example/'), baseEnv);
  assert.equal(response.status, 401);
  assert.match(response.headers.get('WWW-Authenticate') ?? '', /^Basic realm=/);
  assert.equal(response.headers.get('Strict-Transport-Security'), 'max-age=31536000');
  assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
});

test('redirects HTTP to HTTPS before checking credentials or issuing a challenge', async () => {
  const response = await worker.fetch(new Request('http://fluentpath.example/private/path?x=1'), {});
  assert.equal(response.status, 308);
  assert.equal(response.headers.get('Location'), 'https://fluentpath.example/private/path?x=1');
  assert.equal(response.headers.has('WWW-Authenticate'), false);
});

test('fails closed when Basic credentials are not configured', async () => {
  const response = await worker.fetch(new Request('https://fluentpath.example/'), { ASSETS: assets });
  assert.equal(response.status, 503);
  assert.match((await response.json() as { error: string }).error, /not configured/i);
});

test('serves authenticated assets with private no-store cache headers', async () => {
  let fetched = false;
  const response = await worker.fetch(request('/'), { ...baseEnv, ASSETS: { fetch: async () => { fetched = true; return new Response('site'); } } });
  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'site');
  assert.equal(fetched, true);
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  assert.equal(response.headers.get('Strict-Transport-Security'), 'max-age=31536000');
  assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
});

test('session reports Basic-authenticated state without a React login flow', async () => {
  const response = await worker.fetch(request('/api/session'), baseEnv);
  assert.deepEqual(await response.json(), { authenticated: true, authEnabled: false, aiConfigured: false });
});

test('mentor validates requests and returns explicit missing-AI configuration error', async () => {
  const invalid = await worker.fetch(request('/api/mentor', { method: 'POST', headers: { Origin: 'https://fluentpath.example', 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'writing', language: 'vi' }) }), baseEnv);
  assert.equal(invalid.status, 400);
  const missing = await worker.fetch(request('/api/mentor', { method: 'POST', headers: { Origin: 'https://fluentpath.example', 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'chat', language: 'vi', messages: [{ role: 'user', content: 'Help me' }] }) }), baseEnv);
  assert.equal(missing.status, 503);
  assert.match((await missing.json() as { error: string }).error, /LLM_BASE_URL/);
});

test('mentor rejects cross-origin mutations and wrong credentials', async () => {
  const crossOrigin = await worker.fetch(request('/api/mentor', { method: 'POST', headers: { Origin: 'https://attacker.example', 'Content-Type': 'application/json' }, body: '{}' }), baseEnv);
  assert.equal(crossOrigin.status, 403);
  const wrong = new Request('https://fluentpath.example/api/session', { headers: { Authorization: `Basic ${btoa('learner:wrong')}` } });
  const unauthorized = await worker.fetch(wrong, baseEnv);
  assert.equal(unauthorized.status, 401);
});

test('Worker proxies Task 1 with Task Achievement criteria and bounded output tokens', async () => {
  let capturedBody = '';
  const originalFetch = globalThis.fetch;
  const task1Criteria = [
    { name: 'Task Achievement', feedback: 'Compares the table data.' },
    { name: 'Coherence and Cohesion', feedback: 'Organized clearly.' },
    { name: 'Lexical Resource', feedback: 'Uses appropriate terms.' },
    { name: 'Grammatical Range and Accuracy', feedback: 'Mostly accurate.' },
  ];
  globalThis.fetch = async (_input, init) => {
    capturedBody = String(init?.body);
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ reply: 'Task 1 review', feedback: { criteria: task1Criteria } }) } }] }), { status: 200 });
  };
  try {
    const response = await worker.fetch(request('/api/mentor', {
      method: 'POST',
      headers: { Origin: 'https://fluentpath.example', 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'writing', language: 'vi', task: 'Task 1: table data: 2010 10; 2020 20.', text: 'Sales rose from 10 to 20.' }),
    }), { ...baseEnv, LLM_BASE_URL: 'https://provider.test/v1', LLM_API_KEY: 'server-key', LLM_MODEL: 'test-model' });
    assert.equal(response.status, 200);
    const result = await response.json() as { feedback: { criteria: { name: string }[] } };
    assert.equal(result.feedback.criteria[0]?.name, 'Task Achievement');
    assert.match(capturedBody, /Task Achievement/);
    assert.match(capturedBody, /Task 1: table data: 2010 10; 2020 20/);
    assert.match(capturedBody, /"max_tokens":2000/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
