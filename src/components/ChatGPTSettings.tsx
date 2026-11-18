import { useState } from 'react';
import type { ChatGPTStatus } from '../types';
import { connectChatGPT, disconnectChatGPT, mentorRequest } from '../lib/api';

const resultMessages: Record<string, string> = {
  connected: 'Đã kết nối. Bấm Thử kết nối để kiểm tra gia sư.',
  consent: 'Đã đăng nhập. Hãy kết nối lại và cho phép dùng gói ChatGPT.',
  denied: 'Bạn đã từ chối hoặc hủy kết nối.',
  invalid: 'Phiên đăng nhập đã hết hạn hoặc không khớp. Hãy kết nối lại.',
  failed: 'Chưa kết nối được. Kiểm tra tài khoản ChatGPT và thử lại.',
};

export default function ChatGPTSettings({ status, result, onRefresh }: {
  status: ChatGPTStatus;
  result?: string;
  onRefresh: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(() => result && Object.hasOwn(resultMessages, result) ? resultMessages[result] : '');
  const active = status.accounts.find(account => account.id === status.activeId);

  async function run(work: () => Promise<void>) {
    setMessage('');
    setBusy(true);
    try { await work(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Không thể kết nối ChatGPT.'); }
    finally { setBusy(false); }
  }

  async function testMentor() {
    try {
      await mentorRequest({
        mode: 'chat', language: 'vi',
        messages: [{ role: 'user', content: 'Xác nhận kết nối bằng một câu ngắn bằng tiếng Việt.' }],
      });
      setMessage('Gia sư ChatGPT đã trả lời.');
    } finally { await onRefresh(); }
  }

  async function signOut(id: string) {
    const result = await disconnectChatGPT(id);
    await onRefresh();
    setMessage(result.revoked ? 'Đã ngắt kết nối.'
      : 'Đã ngắt kết nối trên máy này. Bạn có thể thu hồi quyền trong cài đặt ChatGPT.');
  }

  return <div className="chatgpt-settings">
    {active && <p className="field-note">
      {active.label} · {status.connected ? 'Đang dùng gói ChatGPT' : 'Cần kết nối lại'}
    </p>}
    <div className="backup-actions chatgpt-actions">
      {status.accounts.length === 0 && <button className="btn btn-primary" disabled={busy}
        onClick={() => void run(() => connectChatGPT())}>Continue with ChatGPT</button>}
      {active && !status.connected && <button className="btn btn-primary" disabled={busy}
        onClick={() => void run(() => connectChatGPT(active.id))}>Kết nối lại</button>}
      {status.connected && <button className="btn btn-primary" disabled={busy}
        onClick={() => void run(testMentor)}>Thử kết nối</button>}
      {status.accounts.length > 0 && <a className="btn btn-ghost" href="https://chatgpt.com/settings/usage"
        target="_blank" rel="noreferrer">Manage usage</a>}
    </div>
    {status.accounts.length > 0 && <details>
      <summary>Tài khoản ChatGPT</summary>
      <ul className="chatgpt-accounts">
        {status.accounts.map(account => <li key={account.id}>
          <span>{account.label}</span>
          <div className="backup-actions chatgpt-actions">
            <button className="btn btn-ghost" disabled={busy}
              onClick={() => void run(() => connectChatGPT(account.id))}>Kết nối lại</button>
            <button className="btn btn-ghost" disabled={busy}
              onClick={() => void run(() => signOut(account.id))}>Ngắt kết nối</button>
          </div>
        </li>)}
      </ul>
      <button className="btn btn-ghost" disabled={busy}
        onClick={() => void run(() => connectChatGPT())}>Thêm tài khoản</button>
    </details>}
    {(busy || message) && <p className="field-note" role="status">{busy ? 'Đang xử lý…' : message}</p>}
  </div>;
}
