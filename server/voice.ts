import express from 'express';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

export interface VoiceService {
  speak(text: string, language: 'en' | 'vi', signal: AbortSignal): Promise<Uint8Array>;
  transcribe(audio: Uint8Array, mime: string, signal: AbortSignal): Promise<string>;
}

function elevenLabsService(env: NodeJS.ProcessEnv): VoiceService | undefined {
  if (!env.ELEVENLABS_API_KEY) return undefined;
  const client = new ElevenLabsClient({ apiKey: env.ELEVENLABS_API_KEY, maxRetries: 0, timeoutInSeconds: 35 });
  return {
    async speak(text, language, signal) {
      const audio = await client.textToSpeech.convert(env.ELEVENLABS_VOICE_ID || 'JBFqnCBsd6RMkjVDRZzb', {
        text, modelId: env.ELEVENLABS_TTS_MODEL || 'eleven_flash_v2_5', languageCode: language,
        outputFormat: 'mp3_44100_128',
      }, { abortSignal: signal });
      return new Uint8Array(await new Response(audio).arrayBuffer());
    },
    async transcribe(audio, mime, signal) {
      const response = await client.speechToText.convert({
        file: new File([new Uint8Array(audio)], 'answer.webm', { type: mime }), modelId: 'scribe_v2',
        languageCode: 'eng', diarize: false, tagAudioEvents: false,
      }, { abortSignal: signal });
      if (!('text' in response) || typeof response.text !== 'string') throw new Error('No transcript returned.');
      return response.text;
    },
  };
}

export function createVoiceRouter(env: NodeJS.ProcessEnv, override?: VoiceService) {
  const router = express.Router();
  const service = override ?? elevenLabsService(env);
  router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  router.get('/status', (_req, res) => res.json({ elevenLabsConfigured: Boolean(service) }));
  router.post('/speak', async (req, res) => {
    const { text, language } = req.body ?? {};
    if (typeof text !== 'string' || !text.trim() || text.length > 2000 || !['en', 'vi'].includes(language)) {
      return res.status(400).json({ error: 'Provide 1–2000 characters and an English or Vietnamese voice.' });
    }
    if (!service) return res.status(503).json({ error: 'ElevenLabs is not configured. Use browser voice or set ELEVENLABS_API_KEY on the local server.' });
    const controller = new AbortController();
    res.once('close', () => controller.abort());
    try {
      const audio = await service.speak(text, language, controller.signal);
      if (audio.length > 5 * 1024 * 1024) throw new Error('Audio response too large.');
      return res.type('audio/mpeg').send(Buffer.from(audio));
    } catch { if (!res.destroyed) return res.status(502).json({ error: 'ElevenLabs could not produce audio. Your text is saved; try browser voice or retry.' }); }
  });
  router.post('/transcribe', express.raw({ type: ['audio/*', 'video/webm', 'application/octet-stream'], limit: '10mb' }), async (req, res) => {
    const mime = (req.get('content-type') || '').split(';')[0];
    if (!['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'video/webm'].includes(mime) || !Buffer.isBuffer(req.body) || !req.body.length) {
      return res.status(400).json({ error: 'Send an audio recording in WebM, Ogg, MP4, MP3 or WAV format.' });
    }
    if (!service) return res.status(503).json({ error: 'ElevenLabs transcription needs ELEVENLABS_API_KEY. You can also type or use browser dictation.' });
    const controller = new AbortController();
    res.once('close', () => controller.abort());
    try {
      const text = await service.transcribe(req.body, mime, controller.signal);
      if (!text.trim() || text.length > 12000) return res.status(502).json({ error: 'No usable transcript was returned. Please try a shorter answer.' });
      return res.json({ text });
    } catch { if (!res.destroyed) return res.status(502).json({ error: 'ElevenLabs could not transcribe this recording. Retry or type the answer.' }); }
  });
  const errorHandler: express.ErrorRequestHandler = (error, _req, res, _next) => {
    if (error?.type === 'entity.too.large') return void res.status(413).json({ error: 'Keep recordings below 10 MB.' });
    res.status(400).json({ error: 'The voice request could not be read.' });
  };
  router.use(errorHandler);
  return router;
}
