# Local voice coach and this chat

## Run

```sh
npm ci
npm run local
```

Open `http://127.0.0.1:5173/`. The web app and local API share this address. This launch mode forces IPv4 loopback and bypasses the old app username/password settings. Hosted deployments and their credentials are unchanged. `npm run dev` is the hot-reload alternative with a local API at port 8787.

## Windows shortcut

Run this once after installing Node.js 24+:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/setup-local.ps1
```

It installs dependencies if missing, builds the local production app and creates **FluentPath** shortcuts on the Desktop and Start menu. Afterwards, click the shortcut to study. It opens a dedicated Edge app window (Chrome fallback), with the local server running invisibly. No CLI, watch server, recurring task or Windows startup entry is required. Close all FluentPath windows, including any sign-in windows, to stop its browser process and local server. While closed there is no FluentPath launcher/server running. While open, the browser and server still use memory even when minimized.

The browser profile lives at `%LOCALAPPDATA%\FluentPath\browser`; it is separate from your normal browser and ChatGPT's built-in browser. Export/import existing progress to move it into this profile. ChatGPT credentials use the existing private `%LOCALAPPDATA%\FluentPath\chatgpt` directory. Neither directory is in Git. The shortcut keeps these saved files when you close it. Browser updates may run their own unrelated background processes.

The launcher serves the last built version. After code updates, rerun setup to rebuild; it does not fetch Git updates. Keep this checkout in place because the shortcuts point to it. Reopening a shortcut while it is already running focuses the existing window. If port 5173 is occupied by a manually started server, stop that server first; the launcher never kills an unrelated process. Startup errors show a dialog; local server logs are overwritten per launch in `%LOCALAPPDATA%\FluentPath\server*.log`.

This shortcut is for the in-website voice coach. This chat's Site tools additionally require opening the URL in ChatGPT's built-in browser; keeping only that extra tab open does not keep the shortcut-owned server alive after the dedicated app is closed.

Verified on this Windows machine: setup/build, Desktop and Start menu shortcuts, hidden local server, API readiness and a FluentPath app window. Ending the launcher-owned browser process caused the server, launcher and browser processes to exit, leaving port 5173 closed. A normal title-bar close was not exercised by UI automation because the computer-use tool could not confidently determine the app window's URL; the process-lifetime cleanup path was tested separately. No FluentPath Windows startup shortcut was installed.

## Two connections, for two jobs

**Inside the website:** in Settings choose **Continue with ChatGPT** and complete authorization yourself. This enables automatic coaching using the existing text-only subscription adapter. Voice coach sends the transcript and recent study context, receives an English reply/follow-up question with Vietnamese feedback, then reads the reply aloud. API-key model providers remain available through the local server. Signing in does not copy this chat's conversation history into the app.

**Between this chat and the website:** open the local page in the ChatGPT desktop app's built-in browser. The page registers WebMCP **Site tools**, which this chat can discover and call while the page stays open. No second sign-in, separately configured MCP server, public host or tunnel is needed for this workflow. It uses the same browser-local learning state and existing application actions. Other browsers retain the ordinary UI even when Site tools are unavailable. Closing the page removes its tools. [OpenAI Site tools documentation](https://learn.chatgpt.com/docs/webmcp).

Examples to ask this chat:

- “Read my current speaking answer and give me one hint before the correction.”
- “Give me an IELTS Part 1 question about work and open it in the website.”
- “Save your feedback against the answer version you just read.”
- “Add ‘articulate’ to my vocabulary with a Vietnamese meaning and an English example.”
- “Read the next question aloud on the page.”

The native tool names are `get_study_context`, `assign_coaching_task`, `save_coaching_feedback`, `add_review_vocabulary`, `speak_coach_text`, `stop_coach_audio`, and `get_coach_voice_status`. Browser-supplied identifiers may add a suffix. Tools expose learning work, not OAuth tokens or server environment variables. They do not start the microphone. Feedback cannot be saved for an empty answer or a revision that has changed.

This is WebMCP for an open browser page. Standard MCP over stdio/HTTP is a different integration for tools that must work without a page; it has not been added here.

## Voice workflow

1. Choose **Bắt đầu luyện nói**, or let this chat assign a task.
2. Press **Nghe câu hỏi** once to permit browser playback. Automatic speech requests may be blocked until a user gesture. If this chat requested different audio, **Phát lại âm thanh** retries that exact requested text and language.
3. Press **Trả lời bằng giọng nói** and grant microphone access yourself. Stop when ready; each recording/dictation turn is limited to two minutes. You can type instead.
4. With **Tự gửi khi kết thúc ghi âm** checked, the transcript is sent to the configured coach when input ends. Uncheck it to edit the transcript first. Failed requests retain the answer.
5. Hear the follow-up, read the Vietnamese correction, and try again. Coaching task history is selectable on the page and is included in progress backups.

This is turn-based voice coaching, not a full-duplex realtime audio call. Browser dictation availability depends on the browser and its speech service. Browser speech may use vendor-hosted recognition; it is not guaranteed to run offline. The text model receives the transcript and cannot assess pronunciation or acoustic fluency. Scores, if provided, are provisional.

## Optional ElevenLabs

Browser voice needs no extra API key. For an alternative, place your own key in the ignored local `.env`:

```dotenv
ELEVENLABS_API_KEY=your-private-key
ELEVENLABS_VOICE_ID=JBFqnCBsd6RMkjVDRZzb
ELEVENLABS_TTS_MODEL=eleven_flash_v2_5
```

Restart the local app, then select **ElevenLabs** under **Settings → Giọng nói khi luyện tập**. Automatic reply reading is configured there too. Both preferences are saved with your other settings and included in backups. The coach page shows the task, answer, conversation and feedback; technical setup and Site tools status cards are intentionally absent. The seven Site tools remain registered in the background. Its availability is reported by `/api/voice/status`; the key is never returned to the browser. Transcription uses Scribe v2; speech uses the selected voice/model. Audio is sent to ElevenLabs only when that provider is selected. This uses your ElevenLabs account's credits. No ElevenLabs agent or paid subscription was created by this change. [Speech output API](https://elevenlabs.io/docs/api-reference/text-to-speech/convert), [transcription API](https://elevenlabs.io/docs/api-reference/speech-to-text/convert).

Local endpoints are `GET /api/voice/status`, `POST /api/voice/speak` (JSON text/language), and `POST /api/voice/transcribe` (audio body, maximum 10 MB). Mutations require a same-origin request. The server uses the official ElevenLabs JavaScript SDK. No speech is fabricated when the provider is unavailable.

## Data and verification

New coaching tasks, answers, response revisions, conversation text and feedback are browser-local and included in Settings export/import. Existing practice-editor drafts still follow the older storage behavior documented in the product review. Raw audio is not included in backups; an ElevenLabs recording is kept in memory for transcription retry until another recording, provider change, page change or reload releases it.

Verified through the real Site tools in this chat: reading study context, assigning a speaking task, vocabulary deduplication, speech request/status, and user-initiated browser read-aloud. A blocked request retained its exact text and language; the retry button started playback and completed without an error. All 31 automated tests passed, as did TypeScript checking and the local production build. Tests cover local no-password behavior, origin/host guards, voice provider requests with mocks, unconfigured-provider states, coaching history backups and stale-revision rejection. A real connection test using the learner's already-authorized ChatGPT account passed on 19 November 2026 after fixing headerless event-stream parsing. Microphone capture and paid ElevenLabs synthesis/transcription are not claimed as live-tested.

If the app was already open during a server update, close and reopen it from its shortcut to load the updated server. ChatGPT sign-in and the **Thử kết nối** inference test are separate steps; a failed test does not necessarily mean sign-in failed. The adapter accepts valid event streams even when the upstream proxy omits Content-Type, and still requires a completed response before reporting success.

Dark theme and narrow-window checks on 19 November 2026 used the built app in Chromium: all seven main pages at 320 px in dark mode and 480 px in light mode, all four practice tabs at 320 px, Voice coach at 360 px, and the desktop dashboard at 1280 px. These views had no horizontal page overflow. Measured dark-mode muted-text contrast was 6.98–8.12:1 across the reading surfaces; primary-button text was 8.90:1 and control borders at least 3.24:1 against neutral surfaces. The Settings connection test displayed its real success message. No console errors were captured. These are resized desktop browser checks, not physical-phone or microphone tests.

The subsequent learner-view simplification replaced the green-tinted dark canvas with black (`#000000`) and neutral panels (`#111111`), removed setup cards and promotional copy, and moved voice preferences to Settings. Verified all seven pages at 320 px, the coach at 480 px and 1280 px, light mode at 480 px, preference persistence after reload, browser playback/stop, and continued registration of all seven Site tools. No horizontal page overflow or console errors were observed.
