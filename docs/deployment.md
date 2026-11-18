# Hosting

The previous VPS is excluded. The app is a static React SPA, with an optional small Cloudflare Worker for a real password gate and AI calls. No database, container, paid plan upgrade or persistent VM is required by this architecture. Workers Free has usage limits; do not enable paid AI services without configuring their provider deliberately.

## Current target

- Worker: `fluentpath-ielts`
- Account: the connected Cloudflare account (metadata in `deploy/cloudflare.json`).
- Live URL: [fluentpath-ielts.nguyenvipy.workers.dev](https://fluentpath-ielts.nguyenvipy.workers.dev).
- `cocchu.site` was not present in the connected Cloudflare account. No DNS or VPS settings were changed.
- Authentication: HTTP Basic gate on every HTML, JS, font and API request. Credentials are encrypted secret bindings, not included in the JavaScript bundle.
- Persistence: current browser storage, with progress export/import in Settings. No server database or cross-device sync.
- AI: optional `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL` secret bindings. The initial release has no verified OpenClaw gateway or copied provider key.

Verified 18 November 2026 (Asia/Saigon): authenticated HTML/session return 200; anonymous HTML/JavaScript return 401; wrong-origin mutations return 403; unconfigured mentor returns 503; HTTP redirects to HTTPS. HTML matches the final local build. Run `node scripts/check-deployment.mjs` with the ignored private `.env` to repeat the checks. Username/password are in that private file and Cloudflare secret bindings, not this document or Git.

## Build outputs

```powershell
npm ci
npm test
npm run build
npm run build:worker
```

`dist/` contains the SPA and self-hosted fonts. `dist-worker/index.js` contains the lightweight edge handler. `deploy/cloudflare.json` records the binding and routing requirements. It is deployment metadata for the connector workflow, not a Wrangler configuration file.

## Deploy using the connected Cloudflare API

1. Read `deploy/cloudflare.json`; ensure this worker name is yours and does not replace another app.
2. Run `node scripts/cloudflare-assets.mjs manifest` and pass the full manifest to `POST /accounts/{account_id}/workers/scripts/{script_name}/assets-upload-session`.
3. Keep its upload JWT in memory. Start `node scripts/cloudflare-assets.mjs upload`; provide one JSON line on stdin with `accountId`, `jwt`, and `buckets`. Retain the returned completion JWT in memory. Do not echo or save these temporary upload credentials.
4. Upload `dist-worker/index.js` to the Worker script upload endpoint with multipart metadata: `main_module: index.js`, `compatibility_date: 2026-11-17` (UTC date at first deployment), an `assets` binding called `ASSETS`, the completion JWT, `assets.config.run_worker_first: true`, and `assets.config.not_found_handling: single-page-application`. Include the encrypted `AUTH_USERNAME` and `AUTH_PASSWORD` secret bindings. Preserve any existing AI secret bindings on redeploy. Observability and traces are enabled at a 10% sampling rate with query strings redacted.
5. Enable only this Worker's `workers.dev` route. Verify HTTP redirects to HTTPS, unauthenticated requests return 401, authenticated assets load, `/api/session` reports state, and unconfigured `/api/mentor` returns 503.

The [Cloudflare direct upload documentation](https://developers.cloudflare.com/workers/static-assets/direct-upload/) describes the metadata and upload flow. For a CLI-based workflow, start with the [current cf setup](https://developers.cloudflare.com/cf/get-started/) and a `cloudflare.config.ts`; this project does not require Wrangler.

## Purely static hosting

You may deploy `dist/` to any static host and set its SPA fallback to `index.html`. Learning features work without a backend. Protect access through the host's access controls if needed. The app's UI cannot implement secure password protection by itself. AI stays unavailable unless the host routes `/api/mentor` to an authenticated compatible adapter. A remote API must be HTTPS and either same-origin or explicitly configured for the app; this version intentionally does not enable wildcard CORS.

## Verify locally

`npm run dev` serves the full local experience. `npm run dev:spa` runs just Vite. `npm run build && npm run preview` serves the exact static build. Microphone recording needs a secure context (HTTPS or loopback) and browser permission. Speech transcription is browser-dependent and may use its vendor's remote service.
