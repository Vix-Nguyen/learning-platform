# Research and study rationale

Prepared 18 November 2026. Sources checked before implementation. Exercises in this app are original learning drills; the app is not affiliated with IELTS.

- [IELTS Academic format](https://ielts.org/take-a-test/test-types/ielts-academic-test): Reading 60 minutes, Writing 60 minutes, Speaking 11–14 minutes. Listening approximately 30 minutes; computer-specific timings should be checked with the test provider.
- [IELTS scoring](https://ielts.org/take-a-test/your-results/ielts-scoring-in-detail): Listening and Reading contain 40 questions. Conversion to bands varies by test version. Mini-drill percentages in this app are not IELTS bands. Overall bands use the four skill bands and official half-band rounding.
- [Writing band descriptors](https://ielts.org/cdn/Guides/ielts-writing-band-descriptors.pdf): Task Achievement/Response, Coherence and Cohesion, Lexical Resource, Grammatical Range and Accuracy. Task 1 requires at least 150 words; Task 2 at least 250 and carries more weight.
- [Speaking band descriptors](https://ielts.org/cdn/ielts-guides/ielts-speaking-band-descriptors.pdf): Fluency and Coherence, Lexical Resource, Grammatical Range and Accuracy, Pronunciation. Browser transcription does not constitute pronunciation assessment.
- [British Council computer familiarisation](https://www.britishcouncil.org/exam/ielts/prepare/free-practice-tests): official practice and computer-based preparation. Useful pattern: timed attempt followed by answer review.
- [IDP Prepare Hub](https://ielts.idp.com/prepare/article-how-to-make-the-most-of-the-ielts-prepare-hub): diagnostic and targeted practice patterns.

## Plan (product recommendation)

This plan is a study recommendation, not a promise of a band outcome. Start with a diagnostic. Six months at four hours every weekday is a substantial workload; breaks and sustainable review matter.

1. Month 1: rebuild grammar, vocabulary, intelligibility and daily input.
2. Months 2–3: learn question types and establish timed mini-task routines.
3. Months 4–5: practise under time constraints and repair recurring mistakes.
4. Month 6: use official full materials for mocks, target weak areas, then taper.

Daily budget: 60m foundations, 90m listening/reading, 90m writing/speaking. Weekends optional. Learning loop: attempt → check → diagnose → redo → log. For a Vietnamese learner, explanations and vocabulary meanings default to Vietnamese while prompts and exam output remain English. Prioritise meaningful collocations, countability/articles, tense consistency, sentence boundaries and intelligibility based on individual error evidence rather than assumptions about nationality.

## Implementation choices

Use local browser storage for progress and drafts, export/import for backup, no invented baseline band. Static hosting requires no database. AI calls must use a server-side adapter because browser bundles cannot protect API secrets. Existing Omega source shows an OpenAI-compatible OpenRouter pattern; no verified OpenClaw/Discord endpoint was found. The optional server accepts a compatible endpoint through private environment configuration. The prior VPS is excluded by the user's latest instruction.
