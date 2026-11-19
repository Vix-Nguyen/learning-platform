# Future: learning with friends

Status: deferred, 19 November 2026 (Asia/Saigon). Current scope is one person using the local voice coach with their own ChatGPT plan. Do not deploy or introduce multi-user accounts as part of the local launcher work.

## Intended experience

Friends create individual platform accounts, connect their own supported AI provider, and use the platform for plans, practice, voice coaching, feedback and progress. Platform login and AI-provider authorization are separate connections. A subscription is not a universal API entitlement.

## Decisions to resolve first

- Establish the supported hosted ChatGPT-plan integration before promising subscription-powered coaching in a shared website. OpenAI's personal/open-source flow supports eligible plan requests; its documentation directs remotely hosted apps to the hosted-app interest process. Personal self-hosting is different from operating a shared service for friends.
- Evaluate other providers independently. Do not promise that arbitrary consumer subscriptions can fund requests from this app. API keys and provider-linked billing are optional alternatives with their own costs; do not silently switch users to a paid alternative.
- Choose the experience: a fully hosted automatic coach, each learner's personal installation/companion, or an assistant-native MCP connection. MCP lets an existing assistant use platform tools; it does not independently put that model inside the website.

## Implementation work after that decision

1. Individual accounts and private per-user database records for progress and coaching history; replace the shared Basic-auth gate.
2. Bind each provider connection to its owning user. The current personal adapter has a shared active profile and local credential file and must not be reused as a multi-user credential store.
3. Encrypted provider credential storage, disconnect/revocation, per-user request limits and clear usage/billing information.
4. Bring the hosted API up to date: coach mode, supported speech routes and deployment checks. The older Cloudflare Worker lacks these features.
5. Add cross-device sync and test isolation between accounts before inviting friends.

Browser dictation/read-aloud remains the starting voice layer. ElevenLabs is optional and separately metered. An uninterrupted realtime voice conversation and acoustic pronunciation assessment remain separate future features.

## Sources checked 19 November 2026

- [OpenAI ChatGPT plan integration](https://developers.openai.com/siwc/token-sharing-open-source)
- [OpenAI personal self-hosted VMs](https://developers.openai.com/siwc/token-sharing-open-source/self-hosted-vms)
- [Anthropic third-party authentication guidance](https://support.claude.com/en/articles/13189465-log-in-to-your-claude-account)
- [ChatGPT Site tools](https://learn.chatgpt.com/docs/webmcp)
