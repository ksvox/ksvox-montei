import { useState } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db, api } from '../lib/firebaseClient';
import { useApp } from './AppContext';
import { Avatar, displayName } from './ui';

export default function MessageCompose({ to, onDone }) {
  const app = useApp();
  const [body, setBody] = useState('');
  const [notify, setNotify] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function send() {
    setBusy(true); setErr('');
    try {
      const ref = await addDoc(collection(db, 'messages'), { from: app.user.uid, to: to.uid, body: body.trim(), read: false, hiddenFor: [], createdAt: serverTimestamp() });
      if (notify) {
        try { await api('/api/notify', { type: 'message', id: ref.id }); }
        catch (e) { setErr('メッセージは送りましたが、メール通知に失敗しました:' + e.message); setBusy(false); return; }
      }
      setBody(''); onDone && onDone();
    } catch (e) { setErr('送信できませんでした:' + e.message); }
    setBusy(false);
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3 text-sm"><span className="text-ks-sub">宛先</span><Avatar user={to} size={26} /><b>{displayName(to)}</b>さん</div>
      <textarea className="input" placeholder="メッセージを書く" value={body} onChange={(e) => setBody(e.target.value)} />
      <label className="flex items-center gap-2 mt-3 text-sm">
        <input type="checkbox" className="w-5 h-5 accent-[#E54D26]" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
        {displayName(to)}さんにメールで知らせる
      </label>
      {err && <p className="text-sm text-ks-red mt-2">{err}</p>}
      <button className="btn btn-primary w-full mt-4" disabled={busy || !body.trim()} onClick={send}>{busy ? '送信中…' : 'メッセージを送る'}</button>
    </div>
  );
}
