import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { after, before, test } from 'node:test';
import { createApp } from '../server/app';

const server = createServer(createApp({ env: { NODE_ENV: 'test' }, host: '127.0.0.1' }));
let origin = '';
before(async () => {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (address && typeof address !== 'string') origin = `http://127.0.0.1:${address.port}`;
});
after(async () => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));

test('session reports optional auth and AI as unconfigured locally', async () => {
  const response = await fetch(`${origin}/api/session`);
  assert.deepEqual(await response.json(), { authenticated: true, authEnabled: false, aiConfigured: false });
});

test('mentor rejects malformed requests and reports missing provider configuration', async () => {
  const invalid = await fetch(`${origin}/api/mentor`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'writing', language: 'vi' }) });
  assert.equal(invalid.status, 400);
  const valid = await fetch(`${origin}/api/mentor`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'chat', language: 'vi', messages: [{ role: 'user', content: 'Help me study' }] }) });
  assert.equal(valid.status, 503);
  assert.match((await valid.json() as { error: string }).error, /not configured/i);
});

test('requires credentials and session secret for production and non-loopback binds', () => {
  assert.throws(() => createApp({ env: { NODE_ENV: 'production' }, production: true }), /AUTH_USERNAME/);
  assert.throws(() => createApp({ env: { AUTH_USERNAME: 'a', AUTH_PASSWORD: 'b' }, host: '0.0.0.0' }), /AUTH_USERNAME/);
  assert.throws(() => createApp({ env: { AUTH_USERNAME: 'a', AUTH_PASSWORD: 'b', SESSION_SECRET: 'short' } }), /at least 32 characters/);
});

test('login is origin checked, creates a signed session, and protects mentor requests', async () => {
  const authServer = createServer(createApp({
    env: { AUTH_USERNAME: 'learner', AUTH_PASSWORD: 'correct horse', SESSION_SECRET: 'a'.repeat(48), NODE_ENV: 'test' },
    host: '127.0.0.1',
  }));
  await new Promise<void>((resolve) => authServer.listen(0, '127.0.0.1', resolve));
  const address = authServer.address();
  assert.ok(address && typeof address !== 'string');
  const authOrigin = `http://127.0.0.1:${address.port}`;
  try {
    const locked = await fetch(`${authOrigin}/api/mentor`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(locked.status, 401);
    const blocked = await fetch(`${authOrigin}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://attacker.test' }, body: JSON.stringify({ username: 'learner', password: 'correct horse' }) });
    assert.equal(blocked.status, 403);
    const login = await fetch(`${authOrigin}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: authOrigin }, body: JSON.stringify({ username: 'learner', password: 'correct horse' }) });
    assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie')?.split(';')[0];
    assert.ok(cookie?.startsWith('fluentpath_session='));
    const status = await fetch(`${authOrigin}/api/session`, { headers: { Cookie: cookie! } });
    assert.deepEqual(await status.json(), { authenticated: true, authEnabled: true, aiConfigured: false });
    const logout = await fetch(`${authOrigin}/api/logout`, { method: 'POST', headers: { Origin: authOrigin, Cookie: cookie! } });
    assert.equal(logout.status, 200);
    const lockedAgain = await fetch(`${authOrigin}/api/mentor`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(lockedAgain.status, 401);
  } finally {
    await new Promise<void>((resolve, reject) => authServer.close((error) => error ? reject(error) : resolve()));
  }
});

test('signed sessions expire', async () => {
  let clock = 1000;
  const authServer = createServer(createApp({
    env: { AUTH_USERNAME: 'learner', AUTH_PASSWORD: 'pass', SESSION_SECRET: 'b'.repeat(48) },
    host: '127.0.0.1',
    now: () => clock,
  }));
  await new Promise<void>((resolve) => authServer.listen(0, '127.0.0.1', resolve));
  const address = authServer.address();
  assert.ok(address && typeof address !== 'string');
  const authOrigin = `http://127.0.0.1:${address.port}`;
  try {
    const login = await fetch(`${authOrigin}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: authOrigin }, body: JSON.stringify({ username: 'learner', password: 'pass' }) });
    const cookie = login.headers.get('set-cookie')?.split(';')[0];
    assert.ok(cookie);
    clock += 8 * 60 * 60 * 1000;
    const status = await fetch(`${authOrigin}/api/session`, { headers: { Cookie: cookie! } });
    assert.deepEqual(await status.json(), { authenticated: false, authEnabled: true, aiConfigured: false });
  } finally {
    await new Promise<void>((resolve, reject) => authServer.close((error) => error ? reject(error) : resolve()));
  }
});

test('mentor proxies to configured OpenAI-compatible endpoint and validates feedback', async () => {
  let capturedUrl = '';
  let capturedBody = '';
  const app = createApp({
    env: { LLM_BASE_URL: 'https://provider.test/v1', LLM_API_KEY: 'server-only', LLM_MODEL: 'test-model' },
    host: '127.0.0.1',
    fetcher: async (input, init) => {
      capturedUrl = String(input);
      capturedBody = String(init?.body);
      return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ reply: 'Good work', feedback: { criteria: [
        { name: 'Task Response', feedback: 'Answers the prompt', score: 6.5 },
        { name: 'Coherence and Cohesion', feedback: 'Clear order' },
        { name: 'Lexical Resource', feedback: 'Good range' },
        { name: 'Grammatical Range and Accuracy', feedback: 'Check articles' },
      ] } }) } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    },
  });
  const localServer = createServer(app);
  await new Promise<void>((resolve) => localServer.listen(0, '127.0.0.1', resolve));
  const address = localServer.address();
  assert.ok(address && typeof address !== 'string');
  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/api/mentor`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'writing', language: 'vi', text: 'I believe education is important.' }) });
    assert.equal(response.status, 200);
    const result = await response.json() as { reply: string; feedback: { criteria: unknown[] } };
    assert.equal(result.reply, 'Good work');
    assert.equal(result.feedback.criteria.length, 4);
    assert.equal(capturedUrl, 'https://provider.test/v1/chat/completions');
    assert.match(capturedBody, /Task Response/);
    assert.match(capturedBody, /"max_tokens":2000/);
    assert.doesNotMatch(capturedBody, /server-only/);
  } finally {
    await new Promise<void>((resolve, reject) => localServer.close((error) => error ? reject(error) : resolve()));
  }
});

test('Task 1 writing feedback uses Task Achievement and validates its four criteria', async () => {
  let capturedBody = '';
  const task1Criteria = [
    { name: 'Task Achievement', feedback: 'Compares the table data.' },
    { name: 'Coherence and Cohesion', feedback: 'Organized clearly.' },
    { name: 'Lexical Resource', feedback: 'Uses appropriate terms.' },
    { name: 'Grammatical Range and Accuracy', feedback: 'Mostly accurate.' },
  ];
  const app = createApp({
    env: { LLM_BASE_URL: 'https://provider.test/v1', LLM_API_KEY: 'key', LLM_MODEL: 'model' },
    fetcher: async (_input, init) => {
      capturedBody = String(init?.body);
      return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ reply: 'Task 1 review', feedback: { criteria: task1Criteria } }) } }] }), { status: 200 });
    },
  });
  const localServer = createServer(app);
  await new Promise<void>((resolve) => localServer.listen(0, '127.0.0.1', resolve));
  const address = localServer.address();
  assert.ok(address && typeof address !== 'string');
  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/api/mentor`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'writing', language: 'vi', task: 'Task 1: Summarise the table data below: 2010 10; 2020 20.', text: 'Sales rose from 10 to 20.' }) });
    assert.equal(response.status, 200);
    const result = await response.json() as { feedback?: { criteria: { name: string }[] } };
    assert.equal(result.feedback?.criteria[0]?.name, 'Task Achievement');
    assert.match(capturedBody, /Task Achievement/);
    assert.match(capturedBody, /Task 1: Summarise the table data below: 2010 10; 2020 20/);
    assert.match(capturedBody, /"max_tokens":2000/);
  } finally {
    await new Promise<void>((resolve, reject) => localServer.close((error) => error ? reject(error) : resolve()));
  }
});
