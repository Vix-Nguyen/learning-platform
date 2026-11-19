# FluentPath implementation plan

Confirmed: IELTS Academic, Vietnamese learner, light-first calm workspace with dark mode, one next-session action. Static SPA preferred; do not use the previous VPS. Local is an accepted fallback.

Current scope (19 November 2026): single-user local voice coach with on-demand Windows shortcuts and no startup service. Shared hosting, individual accounts and users bringing AI subscriptions are deferred to [future multi-user planning](future-multi-user.md).

1. Build a React/TypeScript static SPA with local progress, original mini drills, vocabulary review, error log, weekday planner and study timer. Verify persistence, scoring and mobile navigation.
2. Add writing and speaking workspaces with saved drafts, recording/download, browser transcription where supported, and an embedded mentor. Vietnamese explanations by default. Verify supported/unsupported/error states. Pronunciation requires audio analysis and cannot be inferred from a transcript.
3. Add an optional Node server with password sessions and a server-side OpenAI-compatible proxy. No secrets in Vite variables. Verify unauthenticated access, failed login, invalid requests, missing AI configuration and provider errors with tests.
4. Build and inspect desktop/mobile. Check the connected free-hosting options; deploy only if a suitable target exists. Otherwise document static hosting, the optional server and local startup.

## UI contract

Operate mode: predictable navigation, familiar controls, generous reading space. Working name FluentPath. Warm paper ground, ink text, forest-green navigation/actions, sage selection, amber review states, muted blue listening. Vietnamese-safe Be Vietnam Pro font, self-hosted via npm. No fabricated bands, study history or streak.

First viewport: 224px left rail (brand, Overview, Study plan, Practice hub, Vocabulary, Error log, Settings). Main area: date and mentor action, a calm greeting, a three-column study allocation strip, today's study queue with one start action, and a compact six-month roadmap. Right utility column contains goal and next review. Schedule is a list of tasks, not a grid of marketing cards. At narrow widths use compact top navigation and a single column. Mentor opens as a labelled, dismissible side drawer with focus management.

Signature: the daily 240-minute study strip uses three distinct segments aligned to actual logged minutes. Timer progress and planner allocations share that language. No estimated IELTS score until real evidence exists.

UI states: fresh start with zero activity, partial quota, completed task, paused timer, unconfigured AI, pending/error AI request, empty errors, vocabulary answer revealed, recording supported/unsupported, import validation and storage failure.

Keyboard: Ctrl/Cmd+K opens navigation, Ctrl/Cmd+J mentor, Escape closes overlays, Space toggles a focused timer button. Shortcuts must not interrupt text entry.

## Content and learning loop

60m foundations + 90m listening/reading + 90m writing/speaking each weekday. Start with a diagnostic, then rebuild (month 1), practise deliberately (months 2–3), consolidate under time (months 4–5), and prepare for the exam (month 6). Original short drills demonstrate the interface; official external resources provide fuller materials. Attempt → review → classify mistake → redo. AI feedback is provisional, never official assessment.
