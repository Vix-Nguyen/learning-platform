import { useCallback, useEffect, useRef, useState } from 'react';
import { transcribeAudio, voiceAudio } from './api';

type SpeechResult = { isFinal: boolean; 0: { transcript: string } };
export type SpeechRecognitionLike = {
  lang: string; continuous?: boolean; interimResults: boolean;
  onresult: ((event: { results: ArrayLike<SpeechResult> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null; onend: (() => void) | null;
  start(): void; stop(): void; abort(): void;
};
declare global { interface Window { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike } }
export type VoiceProvider = 'browser' | 'elevenlabs';

export function useCoachVoice(provider: VoiceProvider, onTranscript: (text: string) => void, onFinished: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState('');
  const [recording, setRecording] = useState<Blob | null>(null);
  const [lastRequest, setLastRequest] = useState<{ text: string; language: 'en' | 'vi' } | null>(null);
  const callbacks = useRef({ onTranscript, onFinished }); callbacks.current = { onTranscript, onFinished };
  const mounted = useRef(true);
  const inputGeneration = useRef(0); const outputGeneration = useRef(0);
  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const recorder = useRef<MediaRecorder | null>(null); const stream = useRef<MediaStream | null>(null);
  const inputTimeout = useRef<number | undefined>(undefined);
  const audio = useRef<HTMLAudioElement | null>(null); const audioUrl = useRef('');
  const outputRequest = useRef<AbortController | null>(null); const inputRequest = useRef<AbortController | null>(null);

  const stopAudio = useCallback(() => {
    outputGeneration.current++; outputRequest.current?.abort();
    audio.current?.pause(); audio.current = null;
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    if (audioUrl.current) URL.revokeObjectURL(audioUrl.current);
    audioUrl.current = ''; if (mounted.current) { setSpeaking(false); setLastRequest(null); }
  }, []);
  const cancelInput = useCallback(() => {
    inputGeneration.current++; inputRequest.current?.abort(); window.clearTimeout(inputTimeout.current);
    recognition.current?.abort(); recognition.current = null;
    if (recorder.current?.state === 'recording') recorder.current.stop();
    stream.current?.getTracks().forEach(track => track.stop()); stream.current = null;
    if (mounted.current) { setListening(false); setTranscribing(false); setRecording(null); }
  }, []);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; cancelInput(); stopAudio(); }; }, [cancelInput, stopAudio]);
  useEffect(() => { cancelInput(); stopAudio(); setError(''); }, [provider, cancelInput, stopAudio]);

  async function speak(text: string, language: 'en' | 'vi' = 'en') {
    stopAudio(); setError(''); const generation = outputGeneration.current;
    setLastRequest({ text: text.slice(0, 2000), language });
    if (provider === 'browser') {
      if (!('speechSynthesis' in window)) throw new Error('Browser speech is unavailable. Select configured ElevenLabs voice instead.');
      const utterance = new SpeechSynthesisUtterance(text.slice(0, 2000));
      utterance.lang = language === 'vi' ? 'vi-VN' : 'en-GB'; utterance.rate = 0.92;
      utterance.voice = window.speechSynthesis.getVoices().find(voice => voice.lang.toLowerCase().startsWith(language)) ?? null;
      utterance.onend = () => { if (mounted.current && generation === outputGeneration.current) { setSpeaking(false); setLastRequest(null); } };
      utterance.onerror = event => {
        if (!mounted.current || generation !== outputGeneration.current) return;
        setSpeaking(false);
        if (event.error !== 'canceled' && event.error !== 'interrupted') setError('Audio could not play. Press “Phát lại âm thanh” to retry the requested text, or select another voice provider.');
      };
      setSpeaking(true); window.speechSynthesis.speak(utterance);
      return { status: 'speech_requested', provider };
    }
    const controller = new AbortController(); outputRequest.current = controller;
    const blob = await voiceAudio(text.slice(0, 2000), language, controller.signal);
    if (!mounted.current || generation !== outputGeneration.current) return { status: 'cancelled' };
    audioUrl.current = URL.createObjectURL(blob); const player = new Audio(audioUrl.current); audio.current = player;
    player.onended = () => { if (mounted.current && generation === outputGeneration.current) { setSpeaking(false); setLastRequest(null); } };
    player.onerror = () => { if (mounted.current && generation === outputGeneration.current) { setSpeaking(false); setError('The audio could not play. You can still read the coach’s reply.'); } };
    try { await player.play(); if (generation !== outputGeneration.current) { player.pause(); return { status: 'cancelled' }; } setSpeaking(true); return { status: 'playing', provider }; }
    catch { setError('Your browser blocked automatic playback. Press “Phát lại âm thanh” to retry the requested text.'); return { status: 'needs_user_action', provider }; }
  }

  async function retrySpeech() {
    if (!lastRequest) return { status: 'nothing_to_retry' };
    if (provider === 'elevenlabs' && audio.current && audioUrl.current) {
      setError('');
      try { await audio.current.play(); setSpeaking(true); return { status: 'playing', provider }; }
      catch { setError('Playback is still blocked. Press “Phát lại âm thanh” again to retry the saved audio.'); return { status: 'needs_user_action', provider }; }
    }
    try { return await speak(lastRequest.text, lastRequest.language); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Voice output is unavailable.'); return { status: 'unavailable', provider }; }
  }

  async function transcribe(blob: Blob, generation: number) {
    const controller = new AbortController(); inputRequest.current = controller; setTranscribing(true);
    try {
      const text = await transcribeAudio(blob, controller.signal);
      if (!mounted.current || generation !== inputGeneration.current) return;
      callbacks.current.onTranscript(text); callbacks.current.onFinished(text);
    } catch (reason) {
      if (mounted.current && !controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Transcription failed. Type your answer to continue.');
    } finally { if (mounted.current && generation === inputGeneration.current) setTranscribing(false); }
  }
  function finishRecording() {
    window.clearTimeout(inputTimeout.current);
    if (recognition.current) { setTranscribing(true); recognition.current.stop(); }
    if (recorder.current?.state === 'recording') recorder.current.stop(); setListening(false);
  }
  async function startRecording() {
    cancelInput(); stopAudio(); setError(''); setRecording(null); const generation = inputGeneration.current;
    if (provider === 'browser') {
      const Constructor = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!Constructor) { setError('This browser does not offer dictation. Use ElevenLabs recording, or type your answer.'); return; }
      const instance = new Constructor(); recognition.current = instance;
      instance.lang = 'en-US'; instance.interimResults = true; instance.continuous = true;
      let latest = ''; let failed = false;
      instance.onresult = event => {
        if (generation !== inputGeneration.current) return;
        latest = Array.from(event.results).map(result => result[0].transcript).join(' ').trim().slice(0, 12000);
        callbacks.current.onTranscript(latest);
      };
      instance.onerror = event => {
        failed = true; if (!mounted.current || generation !== inputGeneration.current) return;
        window.clearTimeout(inputTimeout.current); setListening(false); setTranscribing(false);
        setError(event.error === 'not-allowed' ? 'Microphone access was denied. Type your answer, or allow the microphone in the browser.' : `Dictation stopped (${event.error}). Your transcript is kept; retry or type to continue.`);
      };
      instance.onend = () => {
        window.clearTimeout(inputTimeout.current); if (!mounted.current || generation !== inputGeneration.current) return;
        setListening(false); setTranscribing(false); recognition.current = null; if (latest && !failed) callbacks.current.onFinished(latest);
      };
      try { instance.start(); setListening(true); inputTimeout.current = window.setTimeout(finishRecording, 120000); }
      catch { setError('Dictation could not start. Try ElevenLabs recording or type your answer.'); }
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { setError('Audio recording is unavailable in this browser. Type your answer instead.'); return; }
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mounted.current || generation !== inputGeneration.current) { media.getTracks().forEach(track => track.stop()); return; }
      stream.current = media; const instance = new MediaRecorder(media); recorder.current = instance; const chunks: Blob[] = [];
      instance.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      instance.onstop = () => {
        window.clearTimeout(inputTimeout.current); media.getTracks().forEach(track => track.stop()); stream.current = null;
        if (!mounted.current || generation !== inputGeneration.current) return;
        setListening(false); const blob = new Blob(chunks, { type: instance.mimeType || 'audio/webm' }); setRecording(blob);
        if (blob.size > 10 * 1024 * 1024) { setError('The recording exceeds 10 MB. Please record a shorter answer.'); return; }
        void transcribe(blob, generation);
      };
      instance.onerror = () => { cancelInput(); setError('Recording failed. Your existing transcript is kept.'); };
      instance.start(); setListening(true); inputTimeout.current = window.setTimeout(finishRecording, 120000);
    } catch { setError('Could not open the microphone. Check permission, or type your answer.'); }
  }
  return { provider, listening, transcribing, speaking, error, setError, recording, lastRequest, speak, retrySpeech, stopAudio, startRecording, finishRecording, cancelInput,
    browserDictation: Boolean(window.SpeechRecognition || window.webkitSpeechRecognition), browserSpeech: 'speechSynthesis' in window,
    retryTranscription: () => recording ? transcribe(recording, inputGeneration.current) : Promise.resolve(),
  };
}
