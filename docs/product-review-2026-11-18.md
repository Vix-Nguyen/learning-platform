# FluentPath review — 18 November 2026

The app is a useful practice workspace. The main unfinished work is deciding what to learn, helping the learner return, and preserving evidence of improvement. More visual design would add little at this stage.

Reviewed the source, existing plans, current `omega-landing` source, and the local app in a browser. All **20 tests pass**; the SPA and Worker builds pass. Live AI grading, microphone quality, and the main computer were not tested. No application behavior or deployment was changed by this review.

## What works, and what remains open

| Area | Implemented | Still open |
| --- | --- | --- |
| Daily study | Timer, manual logs, weekday totals, streak | Concrete lesson assignments, adjustable workload, recovery after missed days |
| Schedule | Weekly history and fixed quotas | Availability, future sessions, rescheduling, reminders, breaks |
| Practice | 2 reading passages, 2 synthetic listening scripts, 2 writing prompts, 3 speaking cues | Diagnostic, foundations lessons, progression, broader question types, sustained content supply |
| Tutor | Vietnamese explanation setting, chat drawer, optional provider adapter | Local ChatGPT sign-in, learner context, guided hints, saved conversations |
| Grading | Answer keys; writing criteria and corrections when a provider is connected | Attempt history, saved feedback, revisions, calibration against assessed samples |
| Review | Vocabulary due dates, incorrect-answer log | Recall checks before resolving errors, review scheduling for mistakes, automatic follow-up tasks |
| Portability | Validated JSON backup for the main store | Draft/transcript backup, feedback/audio persistence, cross-device sync |

There is no remaining TODO list that captures these gaps. The original implementation plan describes the first release; it should not be treated as a complete learning-product roadmap.

## Fix before relying on the app daily

| Priority | Finding and evidence | Completion check |
| --- | --- | --- |
| P1 | **Backups omit actual written work.** `src/lib/store.ts:42` exports only `AppState`; writing drafts and the speaking transcript use separate keys in `src/components/PracticeHub.tsx:19`. Feedback is held only in component state, and recordings only in memory. | Write a draft, save transcript/feedback, export, and restore into a fresh browser. Every promised item survives. Handle audio explicitly if it needs a separate export. |
| P1 | **Study time can be counted twice.** `src/App.tsx:79` starts an outer session; `PracticeHub.tsx:86`, `:94`, and `:112` also log elapsed practice time. Finishing a drill and then the outer timer records overlapping time. The outer skill can also disagree with the selected practice tab. | Use one session ID and one time-accounting owner. A ten-minute session contributes ten minutes once, under the actual skill. |
| P1 | **Foundations opens Reading.** Reproduced in the browser. `App.tsx:79` passes no skill for foundations, so `PracticeHub.tsx:28` defaults to reading. Input/output starts also consistently favor reading/writing. | Foundations opens a real grammar/vocabulary activity; the queue assigns listening and speaking as well. |
| P1 | **Feedback can belong to an old response or task.** Editing a draft does not invalidate feedback; pending requests can finish after switching tasks or cues (`PracticeHub.tsx:83`, `:100–105`, `:117–120`). | Bind each result to an immutable attempt and prompt. Editing creates a revision; late results attach only to the submitted version. |
| P2 | **Leaving/reloading can lose a session.** Session state is in memory; starting another outer session resets elapsed time. Practice timers are discarded on unmount. | Save active-session state, offer resume/end, and prevent overlapping sessions. Treat long idle periods explicitly. |
| P2 | **The date and roadmap can become misleading.** `App.tsx:26` captures today at module load, while other components recalculate it. `App.tsx:154` always marks the first roadmap phase current. | Refresh date state at local midnight and on resume; calculate phase from dates and distinguish elapsed time from demonstrated readiness. |
| P2 | **Grading validation is weaker than the prompt.** Both server implementations accept arbitrary numeric scores between 0 and 9, although the prompt asks for half-band steps. Task identity is inferred from combined prompt/answer text. | Use a typed task ID and shared response schema; reject malformed criterion sets and scores. Keep this consistent in Node and Worker. |

The passing tests cover dates, backup validation, authentication, request validation, and mocked provider behavior. They do not cover the overlapping timers, draft portability, browser task routing, or assessment quality above.

## Product direction for this learner

Keep IELTS Academic and the existing goal unless the learner changes them. Make the daily workload configurable. The present five-hour weekday target is a large fixed commitment; offer it as an intensive option, with smaller sessions that still count as useful progress. A smaller schedule does not imply the same exam outcome or timeline.

The home screen should answer three things: **what to do now, how long it takes, and what improved**. One main button starts a specific activity. Put the full roadmap, totals, and extra explanations behind secondary controls.

Example home copy:

> Hôm nay: Nghe 10 phút  
> Ôn 3 lỗi cũ, rồi làm 4 câu mới.  
> **Bắt đầu** · Hôm nay ít sức

Suggested session options, to validate during actual use:

| Mode | Session | Finish condition |
| --- | --- | --- |
| Low energy | 10 minutes: recall 3 items, do 1 small task, correct 1 mistake | A small completed learning loop |
| Normal | 45 minutes: 5 review + 20 practice + 15 correction/retry + 5 recap | Attempt and correction saved |
| Intensive | Additional focused blocks with breaks, up to the chosen daily budget | Clear block boundaries and an easy stopping point |

Encouragement should be short and tied to evidence: “Bạn sửa đúng 2 lỗi hôm qua.” After an absence: “Mình học lại 5 phút nhé.” Show days studied this week alongside any streak, so a missed day does not erase the sense of progress. Never claim learning from elapsed time alone.

## Build in this order

1. **Protect work and correct time accounting.** Fix the P1 issues, add complete versioned backups, and introduce durable attempts/revisions. This is especially useful before moving to the main computer.
2. **Make one complete daily learning loop.** A short onboarding asks for available days, preferred start time, normal session length, and the goal. Start with a diagnostic; assign one concrete task; save the result; retry the main error. A diagnostic identifies practice needs, rather than inventing an official IELTS band.
3. **Make scheduling real.** Persist future sessions with skill, exercise, start time, duration, and status. Use `Asia/Ho_Chi_Minh` for the study schedule. Offer “Bắt đầu”, “Nhắc sau”, and “Hôm nay ít sức”. After a missed day, choose the next useful session without stacking all missed work onto tomorrow. Alternate all four skills and favor weaknesses supported by recent attempts.
4. **Connect the mentor on the main computer.** Keep a copy/open-in-ChatGPT fallback. The integrated mentor should receive the current task, relevant recent mistakes, and the attempt being discussed; today it receives chat history or submitted text only.
5. **Improve assessment and content.** Save criterion feedback and revisions, add a small structured foundations course and a usable multiweek practice supply, then add progress trends and periodic full mocks using appropriate materials.

Reminders need a dependable delivery mechanism. An open-page timer cannot notify reliably after the browser closes. For local use, choose the main computer's OS scheduler/notification mechanism during setup; for hosted use, select a push or delivery service separately. Keep reminders within chosen hours, avoid repeated nagging, and provide a direct start action. This review does not create a reminder on this laptop.

## Tutor and grading contract

The tutor should ask one question at a time, offer a hint before the solution, explain the main error briefly in Vietnamese, then ask for a new attempt. A chat window alone does not provide this teaching loop.

For writing, show: the task result, evidence under each criterion, the three most useful corrections, and one revision request. Store the original, feedback, revised response, model/rubric version, and assessment date. Use assessed samples to check whether grading is consistent before making band estimates prominent. A short paragraph can receive useful coaching without a full-task band estimate.

For reading/listening, preserve answers, raw score, question type, time, explanation, and whether help/transcript was used. Distinguish a retry from a first attempt. A four-question mini drill does not establish an IELTS band.

For speaking, transcript coaching can address language and answer structure. Acoustic fluency and pronunciation require audio evidence and a suitable assessment path. The current recorder/transcriber is not an audio grader. IELTS uses four speaking criteria and four writing criteria; Task 2 carries more weight in writing. [Official scoring reference](https://ielts.org/take-a-test/your-results/ielts-scoring-in-detail).

An error should become “learned” after a successful later recall or a related exercise, rather than only clicking “Mark reviewed”. Schedule short follow-ups and use the result to decide the next activity.

## ChatGPT subscription on the main computer

**Feasible in principle for local personal use.** Current OpenAI documentation explicitly includes personal projects that run locally, with eligible Plus/Pro accounts authorizing ChatGPT plan usage. This has not been tested against the learner's account. A remotely hosted app has a different access process. [Official integration guide](https://developers.openai.com/cookbook/articles/sign-in-with-chatgpt).

Recommended arrangement: run the existing React app and a small local Node service on the main computer. The service handles browser sign-in, protects credentials, refreshes the session, and makes mentor requests. The interface shows connection state and a usage-management link. This can remain a local web app; an Electron rewrite is not needed just to add this flow.

This requires a separate provider adapter. The current adapter appends `/chat/completions` and sends an API-key-shaped request. The documented subscription flow uses OAuth-authorized **Responses API** requests with `store: false` and `stream: true`, and account-specific model discovery. Stream interruption and usage-limit failures must preserve the learner's submission. [Inference contract](https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference).

The preview rejects several fields used by ordinary API examples, including `temperature` and `max_output_tokens`, and does not support audio/video input or transcription. Therefore subscription-backed text tutoring does not solve pronunciation grading or speech recognition. [Current preview limitations](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations).

Keep OAuth credentials in protected runtime storage on that computer, outside browser storage, backups, and Git. Handle refresh/revocation and show when usage is limited. Plan authorization does not bring existing ChatGPT conversation history into the app; FluentPath must supply its own learning context. [Account/session guidance](https://developers.openai.com/siwc/token-sharing-open-source/profiles-and-sessions), [flow overview](https://developers.openai.com/siwc/token-sharing-open-source).

Fallback: prepare a compact task-and-response packet, let the learner paste it into ChatGPT or [Study mode](https://chatgpt.com/studymode), and allow feedback to be brought back into the saved attempt. Automatic structured grading needs the actual integration. Conventional API billing remains separate from ChatGPT plan usage. [Billing distinction](https://help.openai.com/en/articles/9039756-managing-billing-for-chatgpt-and-the-api-platform).

## Style learned from Omega

The current Omega source uses direct, outcome-led copy such as “One set of numbers. Ask what changed.” and short action labels. Carry that brevity into FluentPath: useful headings, one clear action, explanations close to the relevant answer, and details shown only when needed.

Default interface copy, errors, onboarding, and feedback summaries to Vietnamese. Keep English for practice passages, questions, responses, and useful IELTS terminology. The existing `mentorLanguage` setting changes the requested explanation language; it does not localize the interface. Client-built writing/speaking prompts also hardcode Vietnamese despite the English option.

Use labels such as **Hôm nay**, **Lịch học**, **Luyện tập**, **Ôn lại**, **Bắt đầu**, **Chấm bài**, and **Làm lại**. Keep the current quiet layout and Vietnamese-capable font. Improve small text and touch targets where useful. Visual effects from Omega do not contribute to the study loop.

The next milestone is reached when the learner can open the app, start the assigned session, get useful feedback, retry one error, and see the next scheduled session—without assembling that workflow manually.
