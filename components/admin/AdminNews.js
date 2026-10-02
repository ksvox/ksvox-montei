import { useEffect, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, getDocs, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db, api } from '../../lib/firebaseClient';
import { Field, Modal, Empty } from '../ui';
import { sortAnnouncements } from '../Announcements';
import { KEEP_LIMIT } from '../../lib/constants';
import { fmtDate } from '../../lib/utils';

const blank = { title: '', body: '', url: '', important: false, pinned: false, mail: false };

export default function AdminNews() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  const load = async () => { const s = await getDocs(collection(db, 'announcements')); setItems(s.docs.map((d) => ({ id: d.id, ...d.data() }))); return s.docs; };
  useEffect(() => { load(); }, []);

  async function trim() {
    const s = await getDocs(collection(db, 'announcements'));
    const normal = s.docs.map((d) => ({ id: d.id, ...d.data() })).filter((a) => !a.pinned).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    for (const a of normal.slice(KEEP_LIMIT)) await deleteDoc(doc(db, 'announcements', a.id));
  }

  async function save() {
    setBusy(true); setNote('');
    const data = { title: form.title.trim(), body: form.body, url: form.url.trim(), important: form.important, pinned: form.pinned };
    try {
      let id = form.id;
      if (id) await updateDoc(doc(db, 'announcements', id), { ...data, updatedAt: serverTimestamp() });
      else { const r = await addDoc(collection(db, 'announcements'), { ...data, createdAt: serverTimestamp() }); id = r.id; await trim(); }
      if (form.mail) {
        try { const r = await api('/api/notify', { type: 'announcement', id }); setNote(`${r.sent}名にメールで通知しました。`); }
        catch (e) { setNote('お知らせは保存しましたが、メール通知に失敗しました:' + e.message); }
      }
      setForm(null); await load();
    } catch (e) { alert('保存できませんでした:' + e.message); }
    setBusy(false);
  }
  async function remove(a) {
    if (!confirm(`「${a.title}」を削除しますか?`)) return;
    await deleteDoc(doc(db, 'announcements', a.id)); await load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-ks-sub">ピン留め以外は最新{KEEP_LIMIT}件まで保存されます。</p>
        <button className="btn btn-primary btn-sm" onClick={() => setForm({ ...blank })}>新規作成</button>
      </div>
      {note && <p className="text-sm text-emerald-700 mb-3">{note}</p>}
      {!items.length ? <Empty>お知らせはまだありません。</Empty> : (
        <ul className="card divide-y divide-ks-border">
          {sortAnnouncements(items).map((a) => (
            <li key={a.id} className="px-4 py-3 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex gap-1.5 mb-1">{a.pinned && <span className="badge">ピン留め</span>}{a.important && <span className="badge">重要</span>}</div>
                <p className="font-bold leading-snug">{a.title}</p>
                <p className="text-xs text-ks-sub">{fmtDate(a.createdAt, true)}</p>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setForm({ ...blank, ...a, mail: false })}>編集</button>
              <button className="btn btn-ghost btn-sm text-ks-red" onClick={() => remove(a)}>削除</button>
            </li>
          ))}
        </ul>
      )}
      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? 'お知らせを編集' : 'お知らせを作成'}>
        {form && (
          <div>
            <Field label="タイトル"><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
            <Field label="本文"><textarea className="input" style={{ minHeight: 160 }} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></Field>
            <Field label="リンク(任意)"><input className="input" placeholder="https://..." value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} /></Field>
            <div className="space-y-2.5 mb-5 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" className="w-5 h-5 accent-[#E54D26]" checked={form.important} onChange={(e) => setForm({ ...form, important: e.target.checked })} />重要</label>
              <label className="flex items-center gap-2"><input type="checkbox" className="w-5 h-5 accent-[#E54D26]" checked={form.pinned} onChange={(e) => setForm({ ...form, pinned: e.target.checked })} />ピン留め(常に先頭・自動削除しない)</label>
              <label className="flex items-center gap-2 font-bold"><input type="checkbox" className="w-5 h-5 accent-[#E54D26]" checked={form.mail} onChange={(e) => setForm({ ...form, mail: e.target.checked })} />メールでも通知する(登録済みの全会員)</label>
            </div>
            <button className="btn btn-primary w-full" disabled={busy || !form.title.trim()} onClick={save}>{busy ? '保存中…' : form.id ? '保存する' : '投稿する'}</button>
          </div>
        )}
      </Modal>
    </div>
  );
}
