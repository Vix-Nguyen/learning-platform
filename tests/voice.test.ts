import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request as httpRequest } from 'node:http';
import { createApp } from '../server/app';

const calls: { text?: string; audioBytes?: number } = {};
const server = createServer(createApp({ host: '127.0.0.1', local: true, env: { AUTH_USERNAME: 'old-user', AUTH_PASSWORD: 'old-password', SESSION_SECRET: 's'.repeat(32) }, voice: {
  async speak(text) { calls.text = text; return new Uint8Array([73, 68, 51]); },
  async transcribe(bytes) { calls.audioBytes = bytes.length; return 'I enjoy solving practical problems.'; },
} }));
let origin = '';
before(async () => { await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve)); const address = server.address(); if (address && typeof address !== 'string') origin = `http://127.0.0.1:${address.port}`; });
after(async () => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));

test('explicit local mode ignores old password settings and rejects non-loopback hosts', async () => {
  const status = await (await fetch(`${origin}/api/session`)).json();
  assert.equal(status.authEnabled, false); assert.equal(status.authenticated, true);
  assert.throws(() => createApp({ local: true, host: '0.0.0.0', env: {} }), /loopback/);
  const untrustedHostStatus = await new Promise<number | undefined>((resolve, reject) => {
    const request = httpRequest(`${origin}/api/voice/status`, { headers: { Host: 'untrusted.example' } }, response => { response.resume(); resolve(response.statusCode); });
    request.on('error', reject); request.end();
  });
  assert.equal(untrustedHostStatus, 403);
});
test('voice endpoints report configuration and guard cross-origin requests', async () => {
  assert.deepEqual(await (await fetch(`${origin}/api/voice/status`)).json(), { elevenLabsConfigured: true });
  assert.equal((await fetch(`${origin}/api/voice/speak`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://example.com' }, body: JSON.stringify({ text: 'Hello', language: 'en' }) })).status, 403);
});
test('speech output validates input and returns actual provider audio bytes', async () => {
  const headers = { 'Content-Type': 'application/json', Origin: origin };
  const result = await fetch(`${origin}/api/voice/speak`, { method: 'POST', headers, body: JSON.stringify({ text: 'What do you enjoy about work?', language: 'en' }) });
  assert.equal(result.status, 200); assert.match(result.headers.get('content-type') || '', /audio\/mpeg/);
  assert.deepEqual(new Uint8Array(await result.arrayBuffer()), new Uint8Array([73, 68, 51]));
  const lastCall = calls.text;
  assert.equal((await fetch(`${origin}/api/voice/speak`, { method: 'POST', headers, body: JSON.stringify({ text: 'x'.repeat(2001), language: 'en' }) })).status, 400);
  assert.equal(calls.text, lastCall);
});
test('transcription accepts bounded audio and rejects unrelated content types', async () => {
  const result = await fetch(`${origin}/api/voice/transcribe`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'audio/webm' }, body: new Uint8Array([1, 2, 3]) });
  assert.equal(result.status, 200); assert.equal((await result.json()).text, 'I enjoy solving practical problems.'); assert.equal(calls.audioBytes, 3);
  assert.equal((await fetch(`${origin}/api/voice/transcribe`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'text/plain' }, body: 'not audio' })).status, 400);
});

test('unconfigured ElevenLabs stays explicit instead of producing simulated audio', async () => {
  const unconfigured = createServer(createApp({ local: true, host: '127.0.0.1', env: {} }));
  await new Promise<void>(resolve => unconfigured.listen(0, '127.0.0.1', resolve));
  try {
    const address = unconfigured.address(); assert.ok(address && typeof address !== 'string');
    const url = `http://127.0.0.1:${address.port}`;
    assert.deepEqual(await (await fetch(`${url}/api/voice/status`)).json(), { elevenLabsConfigured: false });
    const result = await fetch(`${url}/api/voice/speak`, { method: 'POST', headers: { Origin: url, 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'Hello', language: 'en' }) });
    assert.equal(result.status, 503); assert.match((await result.json()).error, /not configured/);
  } finally { await new Promise<void>(resolve => unconfigured.close(() => resolve())); }
});

test('interactive coaching reuses the mentor with spoken English and Vietnamese feedback', async () => {
  let instructions = '';
  const coach = createServer(createApp({ local: true, host: '127.0.0.1', env: { LLM_BASE_URL: 'https://provider.example/v1', LLM_API_KEY: 'test-only', LLM_MODEL: 'test-only' }, fetcher: async (_input, options) => {
    const body = JSON.parse(String(options?.body)); instructions = body.messages[0].content;
    return Response.json({ choices: [{ message: { content: JSON.stringify({ reply: 'What kind of problem do you enjoy solving?', feedback: { criteria: [], summary: 'Thêm một ví dụ cụ thể về công việc của bạn.' } }) } }] });
  } }));
  await new Promise<void>(resolve => coach.listen(0, '127.0.0.1', resolve));
  try {
    const address = coach.address(); assert.ok(address && typeof address !== 'string');
    const url = `http://127.0.0.1:${address.port}`;
    const result = await fetch(`${url}/api/mentor`, { method: 'POST', headers: { Origin: url, 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'coach', language: 'vi', task: 'Speaking Part 1: work', messages: [{ role: 'user', content: 'I like solving problems at work.' }] }) });
    assert.equal(result.status, 200); assert.match(instructions, /spoken aloud/); assert.match(instructions, /Vietnamese/); assert.match(instructions, /not audio/);
    const data = await result.json(); assert.equal(data.reply, 'What kind of problem do you enjoy solving?'); assert.match(data.feedback.summary, /ví dụ/);
  } finally { await new Promise<void>(resolve => coach.close(() => resolve())); }
});
