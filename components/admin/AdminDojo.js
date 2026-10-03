import { useEffect, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, getDocs, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebaseClient';
import { Chip, Empty, Field, Modal } from '../ui';
import { DOJO_TYPES, fmtRange } from '../../lib/dateRange';
import { ymd } from '../../lib/utils';

const DOJO = Object.fromEntries(DOJO_TYPES.map((t) => [t.key, t]));

// 道場カレンダー:全員のマイカレンダーに「休」「K」の印で表示(これからの予定一覧には出さない)
export default function AdminDojo() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showPast, setShowPast] = useState(false);

  const load = async () => {
    const s = await getDocs(collection(db, 'dojoEvents'));
    setItems(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.start.localeCompare(b.start)));
  };
  useEffect(() => { load(); }, []);

  async function save() {
    setBusy(true);
    const end = form.end && form.end > form.start ? form.end : '';
    const data = { start: form.start, end, type: form.type, title: form.title.trim(), memo: form.memo };
    try {
      if (form.id) await updateDoc(doc(db, 'dojoEvents', form.id), data);
      else await addDoc(collection(db, 'dojoEvents'), { ...data, createdAt: serverTimestamp() });
      setForm(null); await load();
    } catch (e) { alert('保存できませんでした:' + e.message); }
    setBusy(false);
  }
  async function remove(it) {
    if (!confirm(`「${it.title}」を削除しますか?`)) return;
    await deleteDoc(doc(db, 'dojoEvents', it.id)); setForm(null); await load();
  }

  const today = ymd(new Date());
  const list = items.filter((it) => showPast || (it.end || it.start) >= today);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-ks-sub leading-relaxed">全員のマイカレンダーに印で表示されます(これからの予定一覧には出ません)。</p>
        <button className="btn btn-primary btn-sm shrink-0" onClick={() => setForm({ start: ymd(new Date()), end: '', type: 'off', title: '臨時休業', memo: '' })}>追加</button>
      </div>
      <label className="flex items-center gap-2 text-xs text-ks-sub mb-3"><input type="checkbox" className="w-4 h-4 accent-[#E54D26]" checked={showPast} onChange={(e) => setShowPast(e.target.checked)} />終わった予定も表示する</label>
      {!list.length ? <Empty>登録された予定はありません。</Empty> : (
        <ul className="card divide-y divide-ks-border">
          {list.map((it) => (
            <li key={it.id}><button className="w-full text-left px-4 py-3 flex items-center gap-3" onClick={() => setForm({ ...it, end: it.end || '', memo: it.memo || '' })}>
              <span className="w-7 h-7 rounded-md text-white font-bold flex items-center justify-center text-sm shrink-0" style={{ background: DOJO[it.type]?.color }}>{DOJO[it.type]?.mark}</span>
              <span className="flex-1 min-w-0">
                <span className="block font-bold text-sm truncate">{it.title}</span>
                <span className="block text-xs text-ks-sub">{fmtRange(it.start, it.end)}</span>
              </span>
            </button></li>
          ))}
        </ul>
      )}
      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? '道場の予定を編集' : '道場の予定を追加'}>
        {form && (
          <div>
            <Field label="種類"><div className="flex gap-2">{DOJO_TYPES.map((t) => <Chip key={t.key} active={form.type === t.key} onClick={() => setForm({ ...form, type: t.key })}>{t.mark}:{t.label}</Chip>)}</div></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="開始日"><input type="date" className="input" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} /></Field>
              <Field label="終了日(複数日の時)"><input type="date" className="input" min={form.start} value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} /></Field>
            </div>
            <Field label="内容"><input className="input" placeholder="例:臨時休業/発表会" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
            <Field label="補足(任意)"><textarea className="input" style={{ minHeight: 80 }} value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} /></Field>
            <div className="flex gap-2">
              {form.id && <button className="btn btn-ghost text-ks-red" onClick={() => remove(form)}>削除</button>}
              <button className="btn btn-primary flex-1" disabled={busy || !form.start || !form.title.trim()} onClick={save}>{busy ? '保存中…' : '保存する'}</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
