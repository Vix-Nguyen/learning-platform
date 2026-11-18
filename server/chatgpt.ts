import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { lstatSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createRemoteJWKSet, customFetch, jwtVerify } from 'jose';
import type { ChatGPTStatus } from '../src/types';

const ISSUER = 'https://auth.openai.com';
const RESOURCE = 'https://api.openai.com/v1';
const TOKEN_URL = `${ISSUER}/api/accounts/oauth/token`;
const PLAN_SCOPE = 'chatgpt.tokens.use.direct';
const SIGN_IN_SCOPE = `openid profile email offline_access resource.invoke ${PLAN_SCOPE}`;
const DYNAMIC_CLIENT = 'dynamic_agent_client';
const SIGN_IN_MS = 10 * 60 * 1000;
export const CHATGPT_CALLBACK = '/auth/callback';

type SessionTokens = { access: string; refresh?: string; expires: number; scopes: string[]; refreshAfter?: number };
type Profile = { id: string; clientId: string; subject: string; label: string; tokens?: SessionTokens };
type SavedState = { hostId: string; profiles: Profile[]; activeId?: string };
type PendingSignIn = { state: string; nonce: string; verifier: string; expires: number; clientId?: string; profile?: Profile };
export type SignInResult = 'connected' | 'consent' | 'denied' | 'failed' | 'invalid';

export class ChatGPTError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string, readonly requestId?: string) {
    super(message);
  }
}

function string(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function equal(left: string, right: string) {
  return left.length === right.length && /^[A-Za-z0-9_-]+$/.test(left)
    && timingSafeEqual(Buffer.from(left), Buffer.from(right));
}

function challenge(verifier: string) {
  return createHash('sha256').update(verifier).digest('base64url');
}

function handleProviderError(status: number, code?: string, requestId?: string) {
  let message = 'Không thể nhận phản hồi từ ChatGPT. Hãy thử lại.';
  if (status === 401) message = 'Phiên ChatGPT đã hết hạn. Hãy kết nối lại trong Cài đặt.';
  if (status === 403) message = 'Tài khoản hoặc workspace này chưa dùng được gói ChatGPT trong FluentPath.';
  if (status === 429 || code === 'subscription_sharing_usage_limit_exceeded') {
    status = 429;
    message = 'Đã chạm giới hạn sử dụng. Xem Manage usage trong Cài đặt.';
  }
  if (status === 503 || code === 'subscription_sharing_usage_unavailable') {
    status = 503;
    message = 'ChatGPT chưa thể kiểm tra lượt sử dụng. Hãy thử lại sau.';
  }
  return new ChatGPTError(message, status, code, requestId);
}

async function requireOk(response: Response) {
  if (response.ok) return response;
  const body = await response.json().catch(() => null);
  throw handleProviderError(response.status, string(body?.error?.code), response.headers.get('x-request-id') ?? undefined);
}

async function readResponseStream(response: Response): Promise<string> {
  if (!response.body || !response.headers.get('content-type')?.includes('text/event-stream')) {
    throw new ChatGPTError('ChatGPT trả về dữ liệu không đọc được.', 502);
  }
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  const requestId = response.headers.get('x-request-id') ?? undefined;
  let buffer = '';
  let output = '';
  try {
    // Decode SSE frames independently of the network chunk boundaries.
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += value;
      let boundary: RegExpExecArray | null;
      while ((boundary = /\r?\n\r?\n/.exec(buffer))) {
        const frame = buffer.slice(0, boundary.index);
        buffer = buffer.slice(boundary.index + boundary[0].length);
        const data = frame.split(/\r?\n/)
          .filter(line => line.startsWith('data:'))
          .map(line => line.slice(5).replace(/^ /, ''))
          .join('\n');
        if (!data || data === '[DONE]') continue;

        const event = JSON.parse(data);
        if (event.type === 'response.output_text.delta' && typeof event.delta === 'string') {
          output += event.delta;
          if (output.length > 60_000) throw new ChatGPTError('Phản hồi từ ChatGPT quá dài. Hãy thử câu hỏi ngắn hơn.', 502);
        }
        if (event.type === 'response.completed' && output.trim()) return output;
        if (event.type === 'response.failed' || event.type === 'error') {
          const code = string(event.response?.error?.code) ?? string(event.code);
          throw handleProviderError(502, code, requestId);
        }
        if (event.type === 'response.incomplete') throw new ChatGPTError('Phản hồi từ ChatGPT chưa hoàn tất. Hãy thử lại.', 502, undefined, requestId);
      }
      if (buffer.length > 1_000_000) break;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
  throw new ChatGPTError('Phản hồi từ ChatGPT chưa hoàn tất. Hãy thử lại.', 502, undefined, requestId);
}

export function createChatGPTMentor(options: { origin: string; directory: string; fetcher: typeof fetch; now: () => number }) {
  const { origin, directory, fetcher, now } = options;
  const filename = path.join(directory, 'chatgpt.json');
  const redirectUri = `${origin}${CHATGPT_CALLBACK}`;
  const fetchOpenAI: typeof fetch = (input, init) => fetcher(input, {
    ...init, redirect: 'error', signal: init?.signal ?? AbortSignal.timeout(15_000),
  });
  const jwks = createRemoteJWKSet(new URL(`${ISSUER}/.well-known/jwks.json`), { [customFetch]: fetchOpenAI });
  let loaded: SavedState | undefined;
  let pending: PendingSignIn | undefined;
  let retryRegistration: { clientId: string; expires: number } | undefined;
  let queue: Promise<unknown> = Promise.resolve();

  // Serialize writes and rotating refresh tokens inside the local server.
  function serialized<T>(work: () => Promise<T> | T): Promise<T> {
    const result = queue.then(work);
    queue = result.catch(() => undefined);
    return result;
  }

  function privatePath(file: string, directoryExpected: boolean) {
    const stat = lstatSync(file);
    const correctType = directoryExpected ? stat.isDirectory() : stat.isFile();
    const ownerOnly = process.platform === 'win32' || ((stat.mode & 0o077) === 0 && stat.uid === process.getuid?.());
    if (!correctType || !ownerOnly) throw new Error('Invalid permissions for local ChatGPT storage.');
  }

  function state(): SavedState {
    if (loaded) return loaded;
    try {
      privatePath(directory, true);
      privatePath(filename, false);
      loaded = JSON.parse(readFileSync(filename, 'utf8')) as SavedState;
      if (typeof loaded.hostId !== 'string' || !Array.isArray(loaded.profiles)) {
        loaded = undefined;
        throw new Error('Invalid local ChatGPT profile.');
      }
      return loaded;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      return (loaded = { hostId: `urn:uuid:${randomUUID()}`, profiles: [] });
    }
  }

  function save(next: SavedState) {
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    privatePath(directory, true);
    const temp = `${filename}.${randomUUID()}.tmp`;
    try {
      writeFileSync(temp, JSON.stringify(next), { flag: 'wx', mode: 0o600 });
      renameSync(temp, filename);
    } finally {
      rmSync(temp, { force: true });
    }
    loaded = next;
  }

  function active() {
    const current = state();
    return current.profiles.find(profile => profile.id === current.activeId);
  }

  function saveProfile(profile: Profile, activate: boolean) {
    const current = state();
    const profiles = current.profiles.filter(item => item.id !== profile.id);
    // Keep labels and account ordering stable as tokens rotate.
    const index = current.profiles.findIndex(item => item.id === profile.id);
    profiles.splice(index < 0 ? profiles.length : index, 0, profile);
    save({
      ...current, profiles,
      activeId: activate ? profile.id : current.activeId === profile.id ? undefined : current.activeId,
    });
  }

  async function tokenGrant(params: Record<string, string>) {
    const response = await fetchOpenAI(TOKEN_URL, {
      method: 'POST',
      body: new URLSearchParams({ ...params, resource: RESOURCE }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      if (data?.error === 'invalid_grant') throw new ChatGPTError('Hãy kết nối lại tài khoản ChatGPT.', 401, 'invalid_grant');
      throw handleProviderError(response.status);
    }
    return data as Record<string, unknown> | null;
  }

  function readTokens(data: Record<string, unknown> | null, previous?: SessionTokens): SessionTokens | undefined {
    const scopes = string(data?.scope)?.split(/\s+/) ?? previous?.scopes ?? [];
    if (!scopes.includes(PLAN_SCOPE)) return undefined;
    const access = string(data?.access_token);
    const refresh = string(data?.refresh_token);
    const lifetime = data?.expires_in;
    if (!access || string(data?.token_type)?.toLowerCase() !== 'bearer'
      || typeof lifetime !== 'number' || !Number.isFinite(lifetime) || lifetime <= 0
      || (scopes.includes('offline_access') && !refresh)) {
      throw new ChatGPTError('ChatGPT trả về phiên đăng nhập không hợp lệ.', 502);
    }
    const earliest = data?.earliest_refresh_at;
    const refreshAfter = typeof earliest === 'number' ? earliest * 1000
      : typeof earliest === 'string' ? Date.parse(earliest) : NaN;
    return { access, refresh, scopes, expires: now() + lifetime * 1000, refreshAfter: Number.isFinite(refreshAfter) ? refreshAfter : undefined };
  }

  async function accessForMentor() {
    return serialized(async () => {
      const profile = active();
      const tokens = profile?.tokens;
      if (!profile || !tokens) throw new ChatGPTError('Kết nối ChatGPT trong Cài đặt để hỏi gia sư.', 401);
      const refreshAt = Math.min(tokens.expires, Math.max(tokens.expires - 60_000, tokens.refreshAfter ?? 0));
      if (now() < refreshAt || (!tokens.refresh && now() < tokens.expires)) return { access: tokens.access, id: profile.id };
      if (!tokens.refresh) throw new ChatGPTError('Hãy kết nối lại tài khoản ChatGPT.', 401);
      try {
        const data = await tokenGrant({ grant_type: 'refresh_token', client_id: profile.clientId, refresh_token: tokens.refresh });
        const updated = readTokens(data, tokens);
        saveProfile({ ...profile, tokens: updated }, true);
        if (updated) return { access: updated.access, id: profile.id };
      } catch (error) {
        if (!(error instanceof ChatGPTError) || error.code !== 'invalid_grant') throw error;
        saveProfile({ ...profile, tokens: undefined }, true);
      }
      throw new ChatGPTError('Hãy kết nối lại tài khoản ChatGPT.', 401);
    });
  }

  function status(): ChatGPTStatus {
    const current = state();
    const tokens = active()?.tokens;
    return {
      activeId: current.activeId,
      accounts: current.profiles.map(({ id, label }) => ({ id, label })),
      connected: Boolean(tokens && (tokens.refresh || tokens.expires > now())),
    };
  }

  return {
    origin,
    status,
    begin(profileId?: string) {
      return serialized(() => {
        const current = state();
        const profile = current.profiles.find(item => item.id === profileId);
        if (profileId && !profile) throw new ChatGPTError('Không tìm thấy kết nối này.', 400);
        const retry = !profileId && retryRegistration && retryRegistration.expires > now() ? retryRegistration : undefined;
        retryRegistration = undefined;
        save(current);
        const attempt = {
          state: randomBytes(32).toString('base64url'),
          nonce: randomBytes(32).toString('base64url'),
          verifier: randomBytes(32).toString('base64url'),
          expires: now() + SIGN_IN_MS,
          clientId: profile?.clientId ?? retry?.clientId,
          profile,
        };
        pending = attempt;
        const url = new URL(`${ISSUER}/api/accounts/authorize`);
        url.search = new URLSearchParams({
          client_id: attempt.clientId ?? DYNAMIC_CLIENT,
          ext_agent_host_id: current.hostId,
          response_type: 'code', redirect_uri: redirectUri, scope: SIGN_IN_SCOPE, resource: RESOURCE,
          state: attempt.state, nonce: attempt.nonce, code_challenge_method: 'S256', code_challenge: challenge(attempt.verifier),
        }).toString();
        if (!profile && !retry) url.searchParams.set('agent_name_hint', 'FluentPath');
        if (profile && !profile.tokens) url.searchParams.set('prompt', 'consent');
        return { url: url.href, state: attempt.state, maxAge: SIGN_IN_MS };
      });
    },
    finish(params: URLSearchParams, browserState: string): Promise<SignInResult> {
      return serialized(async () => {
        const attempt = pending;
        const returnedState = params.get('state') ?? '';
        if (!attempt || attempt.expires <= now() || !equal(returnedState, attempt.state) || !equal(browserState, attempt.state)) return 'invalid';
        pending = undefined;
        if (params.has('error')) return params.get('error') === 'access_denied' ? 'denied' : 'failed';
        const code = params.get('code');
        const clientId = params.get('client_id') ?? attempt.clientId;
        if (!code || !clientId || clientId === DYNAMIC_CLIENT
          || (attempt.clientId && clientId !== attempt.clientId)) return 'failed';
        try {
          const data = await tokenGrant({
            grant_type: 'authorization_code', client_id: clientId, code,
            code_verifier: attempt.verifier, redirect_uri: redirectUri,
          });
          const idToken = string(data?.id_token);
          if (!idToken) return 'failed';
          const { payload } = await jwtVerify(idToken, jwks, {
            algorithms: ['RS256'], issuer: ISSUER, audience: clientId, requiredClaims: ['sub', 'exp', 'iat', 'nonce'],
            clockTolerance: 5, currentDate: new Date(now()),
          });
          if (!payload.sub || payload.nonce !== attempt.nonce
            || (attempt.profile && attempt.profile.subject !== payload.sub)) return 'failed';
          const current = state();
          const existing = current.profiles.find(item => item.clientId === clientId);
          if (existing && existing.subject !== payload.sub) return 'failed';
          const tokens = readTokens(data);
          const account = string(payload.email) ?? string(payload.name) ?? 'ChatGPT';
          saveProfile({
            id: existing?.id ?? randomUUID(), clientId, subject: payload.sub,
            label: existing?.label ?? `${account} · ${current.profiles.length + 1}`,
            tokens,
          }, true);
          return tokens ? 'connected' : 'consent';
        } catch (error) {
          if (!attempt.profile && error instanceof ChatGPTError && error.code === 'invalid_grant') {
            retryRegistration = { clientId, expires: now() + SIGN_IN_MS };
          }
          return 'failed';
        }
      });
    },
    disconnect(profileId: string) {
      return serialized(async () => {
        const profile = state().profiles.find(item => item.id === profileId);
        if (!profile) throw new ChatGPTError('Không tìm thấy kết nối này.', 400);
        pending = undefined;
        let revoked = !profile.tokens;
        if (profile.tokens?.refresh) {
          try {
            const response = await fetchOpenAI(`${ISSUER}/api/accounts/oauth/revoke`, {
              method: 'POST',
              body: new URLSearchParams({
                token: profile.tokens.refresh, token_type_hint: 'refresh_token', client_id: profile.clientId,
              }),
            });
            revoked = response.ok;
          } catch { /* Clear local credentials even when remote revocation is unavailable. */ }
        }
        saveProfile({ ...profile, tokens: undefined }, false);
        return { ...status(), revoked };
      });
    },
    async complete(instructions: string, input: { role: 'user' | 'assistant'; content: string }[]) {
      const { access, id } = await accessForMentor();
      const headers = { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' };
      const catalog = await requireOk(await fetchOpenAI(`${RESOURCE}/models`, { headers }));
      const data = await catalog.json();
      const model = Array.isArray(data?.models)
        ? data.models.find((item: { visibility?: unknown; slug?: unknown }) => item?.visibility === 'list' && string(item.slug))
        : undefined;
      if (!model) throw new ChatGPTError('Không tìm thấy mô hình khả dụng cho tài khoản ChatGPT này.', 503);
      const profile = active();
      if (profile?.id !== id || !profile.tokens) {
        throw new ChatGPTError('Kết nối ChatGPT đã thay đổi. Hãy thử lại.', 409);
      }
      const response = await requireOk(await fetchOpenAI(`${RESOURCE}/responses`, {
        method: 'POST', headers, signal: AbortSignal.timeout(90_000),
        body: JSON.stringify({ model: model.slug, instructions, input, store: false, stream: true }),
      }));
      return readResponseStream(response);
    },
  };
}
