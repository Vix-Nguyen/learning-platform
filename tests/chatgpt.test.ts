import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { createApp } from '../server/app';

const scope = 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct';
const writing = {
  mode: 'writing', language: 'vi', task: 'IELTS Writing Task 1: Compare the figures.',
  text: 'The first figure increased.',
};
const feedback = {
  criteria: ['Task Achievement', 'Coherence and Cohesion', 'Lexical Resource', 'Grammatical Range and Accuracy']
    .map(name => ({ name, feedback: 'Nêu rõ số liệu.' })),
};

test('local mentor verifies OAuth, honors consent, refreshes once and grades through Responses', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'fluentpath-chatgpt-'));
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const jwk = { ...await exportJWK(publicKey), kid: 'test-key', alg: 'RS256' };
  let now = Date.now();
  let expectedClient = 'oaiapp_test';
  let nonce = '';
  let callback = '';
  let verifierChallenge = '';
  let browserCookie = '';
  let grantCount = 0;
  let refreshCount = 0;
  let revokeCount = 0;
  let responsesCount = 0;
  let planPermission = false;
  let invalidNonce = false;
  let replyMode: 'success' | 'limit' | 'incomplete' = 'success';
  const captured: unknown[] = [];

  function sse(events: unknown[]) {
    const text = events.map(event => 'data: ' + JSON.stringify(event) + '\r\n\r\n').join('');
    const encoded = new TextEncoder().encode(text);
    return new Response(new ReadableStream({
      start(controller) {
        for (let i = 0; i < encoded.length; i += 13) controller.enqueue(encoded.slice(i, i + 13));
        controller.close();
      },
    }), { headers: { 'Content-Type': 'text/event-stream', 'x-request-id': 'test-request' } });
  }

  const fetcher: typeof fetch = async (input, options) => {
    const url = String(input);
    if (url === 'https://auth.openai.com/.well-known/jwks.json') return Response.json({ keys: [jwk] });
    if (url === 'https://auth.openai.com/api/accounts/oauth/token') {
      const params = options?.body as URLSearchParams;
      assert.equal(params.get('client_id'), expectedClient);
      assert.equal(params.get('resource'), 'https://api.openai.com/v1');
      if (params.get('grant_type') === 'refresh_token') {
        refreshCount++;
        assert.equal(params.get('refresh_token'), 'stub-refresh-1');
        return Response.json({ access_token: 'stub-access-2', refresh_token: 'stub-refresh-2', expires_in: 3600, token_type: 'Bearer' });
      }
      grantCount++;
      assert.equal(params.get('grant_type'), 'authorization_code');
      assert.equal(params.get('redirect_uri'), callback);
      assert.equal(createHash('sha256').update(params.get('code_verifier')!).digest('base64url'), verifierChallenge);
      const timestamp = Math.floor(now / 1000);
      const token = await new SignJWT({ nonce: invalidNonce ? 'bad-nonce' : nonce, email: 'student@example.test' })
        .setProtectedHeader({ alg: 'RS256', kid: jwk.kid })
        .setIssuer('https://auth.openai.com').setAudience(expectedClient).setSubject('student')
        .setIssuedAt(timestamp).setExpirationTime(timestamp + 3600).sign(privateKey);
      return Response.json({
        id_token: token, access_token: 'stub-access-1', refresh_token: 'stub-refresh-1',
        token_type: 'Bearer', expires_in: 3600,
        scope: planPermission ? scope : 'openid email',
      });
    }
    if (url === 'https://auth.openai.com/api/accounts/oauth/revoke') {
      revokeCount++;
      assert.equal((options?.body as URLSearchParams).get('token'), 'stub-refresh-2');
      return new Response(null);
    }
    if (url === 'https://api.openai.com/v1/models' || url === 'https://api.openai.com/v1/responses') {
      assert.equal(new Headers(options?.headers).get('Authorization'), 'Bearer stub-access-' + (refreshCount ? '2' : '1'));
      if (url.endsWith('/models')) return Response.json({ models: [{ visibility: 'hidden', slug: 'hidden' }, { visibility: 'list', slug: 'available-model' }] });
      responsesCount++;
      captured.push(JSON.parse(String(options?.body)));
      if (replyMode === 'limit') return sse([{ type: 'response.failed', response: { error: { code: 'subscription_sharing_usage_limit_exceeded' } } }]);
      return sse([
        { type: 'response.output_text.delta', delta: JSON.stringify({ reply: 'Nhận xét', feedback }) },
        ...(replyMode === 'success' ? [{ type: 'response.completed' }] : []),
      ]);
    }
    throw new Error('Unexpected upstream endpoint');
  };

  let app: ReturnType<typeof createApp>;
  const server = createServer((req, res) => app(req, res));
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const origin = 'http://127.0.0.1:' + address.port;
  const options = { host: '127.0.0.1', env: {
    LLM_BASE_URL: 'https://fallback.example/v1', LLM_API_KEY: 'stub-key', LLM_MODEL: 'fallback',
  }, now: () => now, chatgpt: { origin, directory }, fetcher };
  app = createApp(options);
  const post = (route: string, body: unknown, source = origin) => fetch(origin + '/api/' + route, {
    method: 'POST', headers: { Origin: source, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const session = async () => (await fetch(origin + '/api/session')).json();
  async function begin(id?: string) {
    const response = await post('chatgpt/connect', { id });
    assert.equal(response.status, 200);
    browserCookie = response.headers.get('set-cookie')!.split(';')[0];
    assert.match(response.headers.get('set-cookie')!, /HttpOnly; SameSite=Lax/);
    const url = new URL((await response.json()).url);
    assert.equal(url.origin, 'https://auth.openai.com');
    callback = url.searchParams.get('redirect_uri')!;
    assert.equal(callback, origin + '/auth/callback');
    assert.equal(url.searchParams.get('scope'), scope);
    assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
    verifierChallenge = url.searchParams.get('code_challenge')!;
    nonce = url.searchParams.get('nonce')!;
    return url.searchParams;
  }
  function finish(state: string, options: { clientId?: string; cookie?: string } = {}) {
    const params = new URLSearchParams({ state, code: 'stub-code' });
    if (options.clientId) params.set('client_id', options.clientId);
    return fetch(callback + '?' + params, {
      redirect: 'manual', headers: { Cookie: options.cookie ?? browserCookie },
    });
  }

  try {
    assert.deepEqual((await session()).chatgpt, { connected: false, accounts: [] });
    assert.equal((await post('mentor', writing)).status, 401);
    assert.equal((await post('chatgpt/connect', {}, 'https://different.example')).status, 403);

    const first = await begin();
    const hostId = first.get('ext_agent_host_id');
    assert.match(hostId!, /^urn:uuid:/);
    assert.equal(first.get('client_id'), 'dynamic_agent_client');
    assert.equal((await finish('wrong-state', { clientId: expectedClient })).headers.get('location'), '/?chatgpt=invalid');
    assert.equal((await finish(first.get('state')!, { clientId: expectedClient, cookie: 'x=y' })).headers.get('location'), '/?chatgpt=invalid');
    assert.equal(grantCount, 0);
    assert.equal((await finish(first.get('state')!, { clientId: expectedClient })).headers.get('location'), '/?chatgpt=consent');
    assert.equal((await finish(first.get('state')!, { clientId: expectedClient })).headers.get('location'), '/?chatgpt=invalid');
    assert.equal(grantCount, 1);
    assert.equal((await post('mentor', writing)).status, 401);
    const id: string = (await session()).chatgpt.activeId;

    planPermission = true;
    invalidNonce = true;
    const rejected = await begin(id);
    assert.equal(rejected.get('prompt'), 'consent');
    assert.equal(rejected.get('client_id'), expectedClient);
    assert.equal(rejected.get('ext_agent_host_id'), hostId);
    assert.equal((await finish(rejected.get('state')!)).headers.get('location'), '/?chatgpt=failed');
    assert.equal((await session()).aiConfigured, false);

    invalidNonce = false;
    const reconnect = await begin(id);
    assert.equal((await finish(reconnect.get('state')!)).headers.get('location'), '/?chatgpt=connected');
    const connected = await session();
    assert.equal(connected.aiConfigured, true);
    assert.equal(connected.chatgpt.activeId, id);
    assert.doesNotMatch(JSON.stringify(connected), /stub-(access|refresh)|oaiapp_test/);
    if (process.platform !== 'win32') assert.equal((await stat(path.join(directory, 'chatgpt.json'))).mode & 0o777, 0o600);

    // Restart the application instance. The next request reuses the saved credentials.
    app = createApp(options);
    const result = await post('mentor', writing);
    assert.equal(result.status, 200);
    assert.deepEqual(await result.json(), { reply: 'Nhận xét', feedback });
    assert.deepEqual(captured[0], {
      model: 'available-model', instructions: (captured[0] as { instructions: string }).instructions,
      input: [{ role: 'user', content: 'Task or question: ' + writing.task + '\n\n' + writing.text }],
      store: false, stream: true,
    });
    assert.match((captured[0] as { instructions: string }).instructions, /Task Achievement/);
    assert.equal((await post('mentor', writing, 'https://different.example')).status, 403);

    replyMode = 'limit';
    const limit = await post('mentor', writing);
    assert.equal(limit.status, 429);
    assert.equal((await limit.json()).requestId, 'test-request');
    replyMode = 'incomplete';
    assert.equal((await post('mentor', writing)).status, 502);

    now += 3600_000;
    replyMode = 'success';
    const refreshed = await Promise.all([post('mentor', writing), post('mentor', writing)]);
    assert.deepEqual(refreshed.map(response => response.status), [200, 200]);
    assert.equal(refreshCount, 1);
    assert.equal(responsesCount, 5);
    assert.equal((await (await post('chatgpt/disconnect', { id })).json()).revoked, true);
    assert.equal(revokeCount, 1);
    assert.equal((await post('mentor', writing)).status, 401);
    assert.doesNotMatch(await readFile(path.join(directory, 'chatgpt.json'), 'utf8'), /stub-(access|refresh)/);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await rm(directory, { recursive: true, force: true });
  }
});
