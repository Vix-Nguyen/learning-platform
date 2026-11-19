# Product

<!-- impeccable:product-schema 1 -->

## Platform
web

## Stack
User requested React/TypeScript/Tailwind or Next.js and delegated implementation. React with Vite and a small Node server is selected for fast local setup and a server-side remote AI proxy.

## Users
A Vietnamese software engineer reactivating rusty English, preparing for IELTS Academic 6.5+ over six months, studying four hours each weekday.

## Product Purpose
Turn a six-month goal into a manageable daily study loop: practise, inspect mistakes, ask a mentor, and review again.

## Operating Context
One private learner. Desktop study with mobile review. Daily allocation: 60 minutes foundations, 90 minutes listening/reading, 90 minutes writing/speaking. Weekends optional. The user confirmed IELTS Academic and a calm light-first workspace with dark mode and one next-session action.

## Capabilities and Constraints
Dashboard, weekday planner, original reading/listening mini drills, writing workspace, speaking recording/transcription, vocabulary review, error log, embedded mentor. Local-first progress with export/import. Vietnamese explanations by default; English for exam practice. Remote AI via server-side OpenAI-compatible adapter, preferably OpenClaw matching the user's Omega setup. The user's latest instruction excludes the previous VPS: prefer a static SPA or lightweight free service; local is acceptable. Use real server-side username/password protection for a hosted app. No invented test results, proficiency, activity, or AI responses. AI band estimates are provisional. Transcription alone cannot assess pronunciation.

## Brand Commitments
Modern, minimalist, developer-friendly, responsive, keyboard-accessible. Calm light-first with dark mode. English learning for a Vietnamese speaker. Working name: FluentPath.

## Evidence on Hand
Empty starting repository. Official IELTS research will be retained in docs/research.md. Original exercises are learning drills, not full official IELTS tests. No baseline band or historical study data supplied.

## Product Principles
- One obvious next study action.
- Show actual learning evidence and honest empty states.
- Explain the why in Vietnamese; practise the answer in English.
- Keep data portable and credentials server-side.
- Prefer useful small practice loops over an unmaintainable course catalogue.

## Current interface requirements

- Learning pages show exercises, answers, feedback and actual progress. Put provider configuration in Settings; keep integration diagnostics out of the learner's view.
- Use factual labels and necessary task instructions. Omit introductory taglines, motivational slogans and promotional product copy.
- Dark mode uses a black canvas and neutral gray surfaces. Green is an action/selection accent, not the page or panel background.
- Support narrow desktop multitasking windows down to 320px with the same usable single-column layout as mobile.
