# FluentPath

A focused IELTS Academic workspace for a Vietnamese software engineer preparing for 6.5+ in six months. React + TypeScript + Tailwind, local browser storage, original mini drills, Vietnamese mentor explanations, and an optional remote AI adapter.

Start with the [local voice coach and Site tools guide](docs/local-voice-coach.md). The [product review](docs/product-review-2026-11-18.md) records the earlier learning-product gaps and wider backlog.

The current voice-coaching work runs locally. The [earlier hosted version](https://fluentpath-ielts.nguyenvipy.workers.dev) has not been updated by this change.

## Run quickly

Requires Node.js 24+ and npm.

On Windows, run `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/setup-local.ps1` once to build the app and install **FluentPath** Desktop/Start menu shortcuts. After setup, click the shortcut: no terminal, no rebuild on each launch, and the local server stops when all its dedicated app windows close. Nothing runs at Windows sign-in. See [local launcher details](docs/local-voice-coach.md#windows-shortcut).

```powershell
npm install
npm run local
```

Open `http://127.0.0.1:5173`. This command builds and serves the app and its API on one loopback address with no app username/password, even if an old `.env` contains authentication settings. In **Settings**, use **Continue with ChatGPT** to authorize automatic coaching. Planning, saved practice and this chat's Site tools do not require model authorization.

For development with hot reload, use `npm run dev` (Vite on `5173`, API on `8787`, both local; model API-key providers can be used). Use `npm run local` for the ChatGPT sign-in flow.

## Continue on another machine

With Node.js 24+ installed:

```powershell
git clone https://github.com/Vix-Nguyen/learning-platform.git
cd learning-platform
npm ci
npm run local
```

The private `.env` is excluded from Git. Local planning and practice run without it. Configure it only for an API-key model or optional ElevenLabs speech. Use Settings export/import to move browser-local progress separately; new coaching tasks, answers, conversation transcripts and feedback are included.

For a purely static SPA, run `npm run dev:spa`. Build with `npm run build`, then `npm run preview` to inspect `dist/`. The static build can be hosted without a database. Hosting authentication requires an edge function, a server, or the hosting provider's access gate: a client-side password cannot protect a static site.

## What's included

- Five-hour weekday plan: 90m foundations, 120m listening/reading, 90m writing/speaking; actual study logs, quota bars, timer, streak and six-month roadmap.
- Original short reading/listening drills with immediate raw scores, explanations and an error log. Listening uses browser synthetic speech; these are mini drills, not full official tests.
- Writing Task 1/Task 2 prompts, saved drafts, word count and optional criterion feedback/corrections from the configured mentor.
- Speaking recording, playback/download, browser transcription where supported, editable transcript and optional text coaching. Pronunciation is not assessed from a transcript.
- Vietnamese vocabulary cards, spaced review, import/export, light/dark themes, focus mode, keyboard navigation and an embedded AI drawer.
- A voice coaching workspace: browser dictation and read-aloud, optional ElevenLabs speech, saved coaching conversations, revision-aware feedback and seven WebMCP Site tools for this chat.

Progress belongs to the current browser/profile and origin. Export it in Settings before clearing storage or moving between local and hosted versions. This version has no cross-device sync. Audio recordings stay in memory until downloaded; drafts and progress stay in browser storage. Browser speech-recognition services may process microphone audio remotely; use manual transcription if that is unsuitable.

## Use your ChatGPT plan on your main computer

After this checkout is available on the main computer, stop any FluentPath dev server and run:

```sh
npm ci
npm run mentor:local
```

Open [FluentPath locally](http://127.0.0.1:5173/) and go to **Settings → Study mentor → Continue with ChatGPT**. Sign in to an eligible account, allow FluentPath to use your plan, and select **Thử kết nối** when you return. A successful test sends a short sample prompt and counts toward the plan's usage. Use **Manage usage** to view limits and **Tài khoản ChatGPT** to reconnect or disconnect.

This command listens only at `127.0.0.1:5173` and does not require the old app password. Use the same browser and address to see existing study data from local development. Progress on the hosted site is stored separately. OAuth credentials stay in your computer's user directory, outside the repository and study backups. The local mode uses ChatGPT plan authorization for text-based coaching, mentor chat, writing feedback, and speaking transcripts. Speech recognition and playback are a separate browser/ElevenLabs layer; microphone audio is not sent to the ChatGPT subscription adapter. [OpenAI integration guide](https://developers.openai.com/cookbook/articles/sign-in-with-chatgpt) · [Preview limitations](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations)

## Voice and this ChatGPT chat

Open the local app in ChatGPT's built-in browser and choose **Voice coach**. Its seven Site tools let this chat read the current answer, assign a task, save revision-bound feedback, add review vocabulary, and request or stop speech. A separate MCP server or tunnel is not needed for this open-page workflow. See [the connection guide](docs/local-voice-coach.md) for the tools, permission boundaries and optional ElevenLabs configuration.

## Connect an API-key provider

Create a private `.env` from `.env.example`. The server loads it automatically. Set these private variables for an OpenAI-compatible provider:

```dotenv
LLM_BASE_URL=https://your-compatible-gateway.example/v1
LLM_API_KEY=your-private-key
LLM_MODEL=your-model
```

Restart `npm run dev`. For hosted Workers, configure the same values as Worker secrets/settings. Never put a provider key in a `VITE_` variable; Vite values are public browser configuration. `VITE_API_BASE_URL` may contain a public same-origin API URL only.

The adapter appends `/chat/completions`. An OpenClaw gateway must expose that compatible API and be reachable from the API runtime. The inspected Omega checkout used an OpenAI-compatible provider pattern; its Discord/OpenClaw endpoint was not identified. No existing production key was copied. Until an endpoint, token and model are configured, AI requests return an actionable unavailable state. They do not generate simulated grading.

Writing feedback uses the four official criteria and marks band estimates as provisional. Speaking text feedback can address vocabulary, grammar and organisation, but does not measure acoustic fluency or pronunciation. A teacher or official test is needed for a reliable baseline band.

## Password-protected local server

Set `AUTH_USERNAME`, `AUTH_PASSWORD` and a random `SESSION_SECRET` of at least 32 characters in `.env`. Run:

```powershell
npm run build
$env:NODE_ENV = 'production'
npm start
```

The server binds to loopback by default. Production/non-loopback configuration fails closed without authentication. Use HTTPS through a reverse proxy if exposing it. The lightweight hosted Worker uses HTTP Basic authentication ahead of every asset/API request, with credentials stored in Cloudflare secrets. Hosting details and the live URL are in [docs/deployment.md](docs/deployment.md).

## Project structure

```text
src/App.tsx                   shell, overview, planner, settings, timer
src/components/PracticeHub.tsx reading/listening/writing/speaking
src/components/Mentor.tsx      embedded mentor drawer
src/components/Vocabulary.tsx vocabulary review
src/components/ErrorLog.tsx   mistakes and review states
src/lib/store.ts               local state and portable backups
src/lib/progress.ts            local dates, quotas, weekday streaks
src/lib/api.ts                 optional server requests
src/data/practice.ts           original exercise content
server/                       optional local Express API/auth
worker/                       lightweight Cloudflare entrypoint
tests/                        scoring/state/auth/proxy checks
docs/implementation-plan.md    architecture and UI decisions
docs/research.md               official sources and study rationale
```

## Validate

```powershell
npm test
npm run build
```

Use `Ctrl/Cmd+K` for navigation, `Ctrl/Cmd+J` for the mentor, and `Escape` to close overlays. The first version intentionally contains a small original exercise set. Use the linked official IELTS materials for full-length timed mocks. See [research](docs/research.md) for source links and [the implementation plan](docs/implementation-plan.md) for the chosen scope and future expansion points.
