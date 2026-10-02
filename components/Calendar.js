import { useEffect, useMemo, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, getDocs, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebaseClient';
import { useApp } from './AppContext';
import { Chip, Empty, Field, Modal } from './ui';
import { EVENT_TYPES } from '../lib/constants';
import { ymd } from '../lib/utils';

const TYPE = Object.fromEntries(EVENT_TYPES.map((t) => [t.key, t]));
const WD = ['日', '月', '火', '水', '木', '金', '土'];

export function fmtEventDate(s) {
  const d = new Date(s + 'T00:00:00');
  return `${d.getMonth() + 1}月${d.getDate()}日(${WD[d.getDay()]})`;
}

export default function Calendar() {
  const app = useApp();
  const uid = app.user.uid;
  const [events, setEvents] = useState([]);
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [day, setDay] = useState(null);
  const [form, setForm] = useState(null);

  const load = async () => {
    const s = await getDocs(collection(db, 'users', uid, 'events'));
    setEvents(s.docs.map((d) => ({ id: d.id, ...d.data() })));
  };
  useEffect(() => { load(); }, []);

  const byDate = useMemo(() => {
    const m = {};
    events.forEach((e) => { (m[e.date] = m[e.date] || []).push(e); });
    Object.values(m).forEach((l) => l.sort((a, b) => (a.time || '99').localeCompare(b.time || '99')));
    return m;
  }, [events]);

  const today = ymd(new Date());
  const upcoming = events.filter((e) => e.date >= today).sort((a, b) => (a.date + (a.time || '99')).localeCompare(b.date + (b.time || '99'))).slice(0, 5);

  const y = cursor.getFullYear(), mo = cursor.getMonth();
  const first = new Date(y, mo, 1).getDay();
  const days = new Date(y, mo + 1, 0).getDate();
  const cells = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];

  async function save() {
    const data = { date: form.date, type: form.type, time: form.noTime ? '' : form.time, memo: form.memo };
    if (form.id) {
      const appended = form.appended || (form.memo.trim() && form.memo !== form.origMemo);
      await updateDoc(doc(db, 'users', uid, 'events', form.id), { ...data, appended: !!appended, updatedAt: serverTimestamp() });
    } else await addDoc(collection(db, 'users', uid, 'events'), { ...data, appended: false, createdAt: serverTimestamp() });
    setForm(null); await load();
  }
  async function remove() {
    if (!confirm('この予定を削除しますか?')) return;
    await deleteDoc(doc(db, 'users', uid, 'events', form.id)); setForm(null); await load();
  }
  const openNew = (date) => setForm({ date, type: 'lesson', time: '19:00', noTime: false, memo: '', origMemo: '' });
  const openEdit = (e) => setForm({ ...e, noTime: !e.time, time: e.time || '19:00', memo: e.memo || '', origMemo: e.memo || '' });

  return (
    <>
      <section className="mb-7">
        <h2 className="font-serif font-bold text-lg mb-3 px-1">これからの予定</h2>
        {!upcoming.length ? <Empty>予定はまだありません。カレンダーの日付を押して登録できます。</Empty> : (
          <ul className="card divide-y divide-ks-border">
            {upcoming.map((e) => (
              <li key={e.id}><button className="w-full flex items-center gap-3 px-4 py-3 text-left" onClick={() => openEdit(e)}>
                <span className="w-1.5 self-stretch rounded-full" style={{ background: TYPE[e.type]?.color }} />
                <span className="flex-1">
                  <span className="block text-sm font-bold">{fmtEventDate(e.date)} {e.time || ''}</span>
                  <span className="block text-xs text-ks-sub">{TYPE[e.type]?.label}{e.memo ? `・${e.memo.split('\n')[0].slice(0, 24)}` : ''}</span>
                </span>
                {e.appended && <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" title="追記済み" />}
              </button></li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-7">
        <h2 className="font-serif font-bold text-lg mb-3 px-1">マイカレンダー</h2>
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <button className="w-9 h-9 rounded-full border border-ks-border" onClick={() => setCursor(new Date(y, mo - 1, 1))} aria-label="前の月">‹</button>
            <span className="font-serif font-bold text-lg">{y}年{mo + 1}月</span>
            <button className="w-9 h-9 rounded-full border border-ks-border" onClick={() => setCursor(new Date(y, mo + 1, 1))} aria-label="次の月">›</button>
          </div>
          <div className="grid grid-cols-7 text-center text-xs mb-1">{WD.map((w, i) => <span key={w} className={i === 0 ? 'text-ks-red' : i === 6 ? 'text-blue-600' : 'text-ks-sub'}>{w}</span>)}</div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((d, i) => {
              if (!d) return <span key={'e' + i} />;
              const ds = `${y}-${String(mo + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
              const evs = byDate[ds] || [];
              const wd = (first + d - 1) % 7;
              return (
                <button key={ds} onClick={() => setDay(ds)}
                  className={`aspect-square rounded-lg border text-sm flex flex-col items-center pt-1 ${ds === today ? 'border-ks-red bg-[#FDF1EC]' : 'border-ks-border bg-white'}`}>
                  <span className={wd === 0 ? 'text-ks-red' : wd === 6 ? 'text-blue-600' : ''}>{d}</span>
                  <span className="flex gap-0.5 mt-auto mb-1.5">
                    {evs.slice(0, 3).map((e) => <span key={e.id} className="w-1.5 h-1.5 rounded-full" style={{ background: e.appended ? '#10B981' : TYPE[e.type]?.color }} />)}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-3 mt-3 text-xs text-ks-sub">
            {EVENT_TYPES.map((t) => <span key={t.key} className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: t.color }} />{t.label}</span>)}
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" />追記済み</span>
          </div>
        </div>
      </section>

      <Modal open={!!day && !form} onClose={() => setDay(null)} title={day ? fmtEventDate(day) : ''}>
        {day && (
          <div>
            {!(byDate[day] || []).length ? <Empty>この日の予定はありません。</Empty> : (
              <ul className="space-y-2 mb-4">
                {byDate[day].map((e) => (
                  <li key={e.id}><button className="card w-full text-left px-4 py-3 flex items-center gap-3" onClick={() => openEdit(e)}>
                    <span className="w-1.5 self-stretch rounded-full" style={{ background: TYPE[e.type]?.color }} />
                    <span className="flex-1"><b className="text-sm">{TYPE[e.type]?.label}</b> <span className="text-sm text-ks-sub">{e.time || '時間指定なし'}</span>
                      {e.memo && <span className="block text-xs text-ks-sub mt-1 whitespace-pre-wrap line-clamp-3">{e.memo}</span>}</span>
                    {e.appended && <span className="text-[10px] text-emerald-700 font-bold">追記済み</span>}
                  </button></li>
                ))}
              </ul>
            )}
            <button className="btn btn-primary w-full" onClick={() => openNew(day)}>この日に予定を追加</button>
          </div>
        )}
      </Modal>

      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? '予定を編集' : '予定を追加'}>
        {form && (
          <div>
            <Field label="日付"><input type="date" className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
            <Field label="種類"><div className="flex gap-2">{EVENT_TYPES.map((t) => <Chip key={t.key} active={form.type === t.key} onClick={() => setForm({ ...form, type: t.key })}>{t.label}</Chip>)}</div></Field>
            <Field label="時間">
              <div className="flex items-center gap-3">
                <input type="time" className="input" disabled={form.noTime} value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
                <label className="flex items-center gap-1.5 text-sm shrink-0"><input type="checkbox" className="w-5 h-5 accent-[#E54D26]" checked={form.noTime} onChange={(e) => setForm({ ...form, noTime: e.target.checked })} />指定なし</label>
              </div>
            </Field>
            <Field label="備忘録" note={form.id ? '後から書き足すと「追記済み」の印が付きます。' : ''}><textarea className="input" value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} /></Field>
            <div className="flex gap-2">
              {form.id && <button className="btn btn-ghost text-ks-red" onClick={remove}>削除</button>}
              <button className="btn btn-primary flex-1" disabled={!form.date} onClick={save}>保存する</button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
