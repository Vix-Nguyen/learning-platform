import { useEffect, useState } from 'react';
import { Volume2 } from 'lucide-react';
import { voiceStatus } from '../lib/api';
import { actions, useAppStore } from '../lib/store';
import type { VoiceStatus } from '../types';

export default function CoachVoiceSettings() {
  const { settings } = useAppStore();
  const [status, setStatus] = useState<VoiceStatus | null>(null);

  useEffect(() => {
    let active = true;
    void voiceStatus().then(result => { if (active) setStatus(result); });
    return () => { active = false; };
  }, []);

  return <section className="settings-card panel coach-voice-settings">
    <div className="settings-card-head"><div className="settings-icon"><Volume2 size={18}/></div><div><h2>Giọng nói khi luyện tập</h2></div></div>
    <label className="settings-select">Giọng đọc<select value={settings.coachVoiceProvider ?? 'browser'} onChange={event => actions.updateSettings({ coachVoiceProvider: event.target.value as 'browser' | 'elevenlabs' })}>
      <option value="browser">Giọng có sẵn trên máy</option>
      <option value="elevenlabs" disabled={!status?.elevenLabsConfigured}>ElevenLabs</option>
    </select></label>
    {status && !status.elevenLabsConfigured && <p className="field-note">ElevenLabs là tùy chọn. Cấu hình tài khoản ElevenLabs trên máy chủ để sử dụng.</p>}
    <label className="coach-checkbox"><input type="checkbox" checked={settings.readCoachReplies ?? true} onChange={event => actions.updateSettings({ readCoachReplies: event.target.checked })}/> Tự đọc câu trả lời của coach</label>
  </section>;
}
