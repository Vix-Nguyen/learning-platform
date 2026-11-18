export interface WorkerEnv {
  AUTH_USERNAME?: string;
  AUTH_PASSWORD?: string;
  LLM_BASE_URL?: string;
  LLM_API_KEY?: string;
  LLM_MODEL?: string;
  ASSETS?: { fetch(request: Request): Promise<Response> };
}

const MAX_BODY_BYTES = 64 * 1024;
const MAX_MESSAGE_CHARS = 6000;
const MODES = new Set(['chat', 'writing', 'speaking', 'practice']);

type MentorInput = {
  mode: 'chat' | 'writing' | 'speaking' | 'practice';
  messages?: { role: 'user' | 'assistant'; content: string }[];
  text?: string;
  task?: string;
  language: 'vi' | 'en';
};

function json(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  const resultHeaders = new Headers(headers);
  resultHeaders.set('Content-Type', 'application/json; charset=utf-8');
  resultHeaders.set('Cache-Control', 'private, no-store');
  resultHeaders.set('Strict-Transport-Security', 'max-age=31536000');
  resultHeaders.set('X-Content-Type-Options', 'nosniff');
  resultHeaders.set('Vary', 'Authorization');
  return new Response(JSON.stringify(body), { status, headers: resultHeaders });
}

function unauthorized(): Response {
  return json({ error: 'Authentication required.' }, 401, { 'WWW-Authenticate': 'Basic realm="FluentPath", charset="UTF-8"' });
}

async function sha256(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  let difference = a.length ^ b.length;
  const size = Math.max(a.length, b.length);
  for (let index = 0; index < size; index += 1) difference |= (a[index % a.length] ?? 0) ^ (b[index % b.length] ?? 0);
  return difference === 0;
}

async function hasValidBasicAuth(request: Request, username: string, password: string): Promise<boolean> {
  const header = request.headers.get('Authorization') ?? '';
  const match = /^Basic\s+([A-Za-z0-9+/]+={0,2})$/i.exec(header);
  let suppliedUser = '';
  let suppliedPassword = '';
  if (match) {
    try {
      const decoded = new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(atob(match[1]), (char) => char.charCodeAt(0)));
      const separator = decoded.indexOf(':');
      if (separator >= 0) {
        suppliedUser = decoded.slice(0, separator);
        suppliedPassword = decoded.slice(separator + 1);
      }
    } catch { /* Malformed credentials are compared as empty values. */ }
  }
  const [actualUser, expectedUser, actualPassword, expectedPassword] = await Promise.all([
    sha256(suppliedUser), sha256(username), sha256(suppliedPassword), sha256(password),
  ]);
  return constantTimeEqual(actualUser, expectedUser) && constantTimeEqual(actualPassword, expectedPassword);
}

async function readBoundedJson(request: Request): Promise<unknown | null> {
  const length = Number(request.headers.get('Content-Length') ?? 0);
  if (length > MAX_BODY_BYTES) return null;
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  try {
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    return null;
  }
}

function validMentorInput(value: unknown): value is MentorInput {
  if (!value || typeof value !== 'object') return false;
  const input = value as Record<string, unknown>;
  if (typeof input.mode !== 'string' || !MODES.has(input.mode) || !['vi', 'en'].includes(String(input.language))) return false;
  if (input.text !== undefined && (typeof input.text !== 'string' || input.text.length > 12000)) return false;
  if (input.task !== undefined && (typeof input.task !== 'string' || input.task.length > 12000)) return false;
  if (input.messages !== undefined) {
    if (!Array.isArray(input.messages) || input.messages.length > 24) return false;
    if (!input.messages.every((item) => item && typeof item === 'object'
      && ['user', 'assistant'].includes(String((item as Record<string, unknown>).role))
      && typeof (item as Record<string, unknown>).content === 'string'
      && ((item as Record<string, unknown>).content as string).length <= MAX_MESSAGE_CHARS)) return false;
  }
  if (input.mode === 'chat' && (!Array.isArray(input.messages) || input.messages.length === 0)) return false;
  if (input.mode !== 'chat' && typeof input.text !== 'string' && !Array.isArray(input.messages)) return false;
  return true;
}

function systemPrompt(mode: string, language: string, writingTask = ''): string {
  const base = `You are a careful IELTS Academic learning mentor. Give provisional coaching, never official scores. Explain in ${language === 'vi' ? 'Vietnamese' : 'English'} by default; use English for examples and corrections. Do not invent evidence or claim certainty beyond the submitted work.`;
  if (mode === 'writing') {
    const task1 = /\btask\s*1\b/i.test(writingTask);
    const responseCriterion = task1 ? 'Task Achievement' : 'Task Response';
    const taskContext = task1
      ? 'This is IELTS Academic Writing Task 1. Assess Task Achievement, including accurate coverage and comparison of the supplied table data. Do not assess Task Response.'
      : 'This is IELTS Academic Writing Task 2 unless the supplied task clearly identifies Task 1. Assess Task Response.';
    return `${base} ${taskContext} Evaluate only the supplied writing. Return JSON with keys reply and feedback. feedback.criteria must contain exactly four items named ${responseCriterion}, Coherence and Cohesion, Lexical Resource, and Grammatical Range and Accuracy. Each item has feedback and may have a provisional score from 0 to 9 in half-band steps. Include corrections only when grounded in the text. State limitations if task prompt/context is missing.`;
  }
  if (mode === 'speaking') return `${base} Coach the supplied speaking transcript. Comment on fluency, vocabulary, grammar, and answer development where evidenced. Never assess pronunciation or claim to hear audio from text. Return JSON with keys reply and optional feedback; omit unsupported judgments.`;
  if (mode === 'practice') return `${base} Help with the supplied practice question or response. Distinguish an example answer from an assessment. Return JSON with keys reply and optional feedback.`;
  return `${base} Answer as a supportive IELTS study mentor. Keep answers practical, concise, and grounded in the conversation.`;
}

function parseProviderContent(content: unknown): { reply: string; feedback?: unknown } | null {
  if (typeof content !== 'string' || !content.trim()) return null;
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    if (typeof parsed.reply === 'string' && parsed.reply.trim()) return { reply: parsed.reply, feedback: parsed.feedback };
  } catch { /* Plain text is a valid provider response. */ }
  return { reply: content.trim() };
}

function validFeedback(value: unknown): value is { criteria: { name: string; score?: number; feedback: string }[]; corrections?: { original: string; improved: string; reason: string }[]; summary?: string } {
  if (!value || typeof value !== 'object') return false;
  const feedback = value as Record<string, unknown>;
  if (!Array.isArray(feedback.criteria) || feedback.criteria.length > 8) return false;
  if (!feedback.criteria.every((item) => {
    if (!item || typeof item !== 'object') return false;
    const criterion = item as Record<string, unknown>;
    return typeof criterion.name === 'string' && typeof criterion.feedback === 'string'
      && (criterion.score === undefined || (typeof criterion.score === 'number' && criterion.score >= 0 && criterion.score <= 9));
  })) return false;
  if (feedback.corrections !== undefined && (!Array.isArray(feedback.corrections) || feedback.corrections.length > 20
    || !feedback.corrections.every((item) => item && typeof item === 'object'
      && ['original', 'improved', 'reason'].every((key) => typeof (item as Record<string, unknown>)[key] === 'string')))) return false;
  if (feedback.summary !== undefined && typeof feedback.summary !== 'string') return false;
  return true;
}

async function mentor(request: Request, env: WorkerEnv): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, { Allow: 'POST' });
  const origin = request.headers.get('Origin');
  if (!origin || origin !== new URL(request.url).origin) return json({ error: 'A same-origin request is required.' }, 403);
  const input = await readBoundedJson(request);
  if (!validMentorInput(input)) return json({ error: 'The mentor request is invalid or too large.' }, 400);
  if (!env.LLM_BASE_URL || !env.LLM_API_KEY || !env.LLM_MODEL) {
    return json({ error: 'The AI mentor is not configured. Set LLM_BASE_URL, LLM_API_KEY, and LLM_MODEL on the Worker, or connect the local API server.' }, 503);
  }
  let endpoint: URL;
  try {
    endpoint = new URL(env.LLM_BASE_URL);
    if (endpoint.protocol !== 'https:') throw new Error();
    endpoint.pathname = `${endpoint.pathname.replace(/\/$/, '')}/chat/completions`;
  } catch {
    return json({ error: 'The AI mentor server configuration is invalid.' }, 503);
  }
  const messages = [
    { role: 'system', content: systemPrompt(input.mode, input.language, [input.task, input.text, ...(input.messages ?? []).map((message) => message.content)].filter(Boolean).join('\n')) },
    ...(input.messages ?? []),
    ...(!input.messages?.length && input.text ? [{ role: 'user', content: `${input.task ? `Task or question: ${input.task}\n\n` : ''}${input.text}` }] : []),
    ...(input.task && input.messages?.length ? [{ role: 'user', content: `Task or question: ${input.task}` }] : []),
  ];
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.LLM_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: env.LLM_MODEL, messages, temperature: 0.3, max_tokens: 2000 }),
      redirect: 'error',
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) return json({ error: 'The AI mentor could not complete that request. Please try again later.' }, 502);
    const data = await response.json() as { choices?: { message?: { content?: unknown } }[] };
    const result = parseProviderContent(data.choices?.[0]?.message?.content);
    if (!result) return json({ error: 'The AI mentor returned an unusable response. Please try again.' }, 502);
    const output: { reply: string; feedback?: unknown } = { reply: result.reply };
    const feedback = result.feedback;
    if (validFeedback(feedback)) {
      const writingTask = [input.task, input.text, ...(input.messages ?? []).map((message) => message.content)].filter(Boolean).join('\n');
      const responseCriterion = /\btask\s*1\b/i.test(writingTask) ? 'Task Achievement' : 'Task Response';
      const criteria = [responseCriterion, 'Coherence and Cohesion', 'Lexical Resource', 'Grammatical Range and Accuracy'];
      if (input.mode !== 'writing' || (feedback.criteria.length === 4 && criteria.every((name) => feedback.criteria.some((item) => item.name === name)))) output.feedback = feedback;
    }
    return json(output);
  } catch {
    return json({ error: 'The AI mentor is temporarily unavailable. Please try again later.' }, 502);
  }
}

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const url = new URL(request.url);
    if (url.protocol === 'http:') {
      url.protocol = 'https:';
      return new Response(null, { status: 308, headers: { Location: url.toString(), 'Cache-Control': 'no-store' } });
    }
    if (!env.AUTH_USERNAME || !env.AUTH_PASSWORD) return json({ error: 'Worker authentication is not configured.' }, 503);
    if (!await hasValidBasicAuth(request, env.AUTH_USERNAME, env.AUTH_PASSWORD)) return unauthorized();
    if (url.pathname === '/api/session' && request.method === 'GET') {
      return json({ authenticated: true, authEnabled: false, aiConfigured: Boolean(env.LLM_BASE_URL && env.LLM_API_KEY && env.LLM_MODEL) });
    }
    if (url.pathname === '/api/mentor') return mentor(request, env);
    if (!env.ASSETS) return json({ error: 'Static assets are not configured.' }, 503);
    try {
      const response = await env.ASSETS.fetch(request);
      const headers = new Headers(response.headers);
      headers.set('Cache-Control', 'private, no-store');
      headers.set('Strict-Transport-Security', 'max-age=31536000');
      headers.set('X-Content-Type-Options', 'nosniff');
      headers.set('Vary', 'Authorization');
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
    } catch {
      return json({ error: 'The site is temporarily unavailable.' }, 502);
    }
  },
};
