import { useEffect, useMemo, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, where } from 'firebase/firestore';
import { db, api } from '../../lib/firebaseClient';
import { Field, Modal } from '../ui';
import { ALL_SLOTS, KIND_LABEL, addDays, jstToday, weekdayOf, isOffDay, rangeLabel, minutesLabel, fmtYmd } from '../../lib/reserve';

const TEAL = '#2A7F86';
const WD = ['日', '月', '火', '水', '木', '金', '土'];
// 続いている枠は「14:30〜16:00」、飛び飛びなら「14:30・16:00」
function selLabel(sel) {
  const idx = sel.map((s) => ALL_SLOTS.indexOf(s));
  const cont = idx.every((v, k) => k === 0 || v === idx[k - 1] + 1);
  return cont ? rangeLabel(sel) : sel.join('・');
}
const mondayOf = (ymd) => addDays(ymd, -((weekdayOf(ymd) + 6) % 7));

// 管理画面「予約」:日ごとの予約の確認・終日休み・予約不可の枠・先生の予約
export default function AdminReserve() {
  const [date, setDate] = useState(jstToday());
  const weekStart = mondayOf(date);
  const week = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const [bookings, setBookings] = useState([]);
  const [months, setMonths] = useState({});
  const [dojo, setDojo] = useState([]);
  const [sel, setSel] = useState([]);
  const [alsoPractice, setAlsoPractice] = useState(true);
  const [detail, setDetail] = useState(null);
  const [bookForm, setBookForm] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const end = addDays(weekStart, 6);
    const yms = [...new Set([weekStart.slice(0, 7), end.slice(0, 7)])];
    const [bs, dj, ...ms] = await Promise.all([
      getDocs(query(collection(db, 'bookings'), where('date', '>=', weekStart), where('date', '<=', end))),
      getDocs(collection(db, 'dojoEvents')),
      ...yms.map((ym) => getDoc(doc(db, 'reserveMonths', ym))),
    ]);
    setBookings(bs.docs.map((d) => ({ id: d.id, ...d.data() })));
    setDojo(dj.docs.map((d) => ({ id: d.id, ...d.data() })));
    setMonths(Object.fromEntries(ms.map((d, i) => [yms[i], d.exists() ? d.data() : {}])));
  };
  useEffect(() => { load().catch((e) => alert(e.message)); }, [weekStart]);
  useEffect(() => { setSel([]); }, [date]);

  const month = months[date.slice(0, 7)] || {};
  const taken = month.taken?.[date] || {};
  const blocks = month.blocks?.[date] || {};
  const byId = useMemo(() => Object.fromEntries(bookings.map((b) => [b.id, b])), [bookings]);
  const countOf = (ds) => bookings.filter((b) => b.date === ds).length;
  const off = isOffDay(dojo, date);
  const ownOff = dojo.find((e) => e.type === 'off' && e.start === date && !e.end && e.fromReserve);

  async function toggleOff() {
    setBusy(true);
    try {
      if (off) {
        if (!ownOff) { alert('この日は「道場カレンダー」タブで休みに設定されています。解除はそちらから行ってください。'); setBusy(false); return; }
        await deleteDoc(doc(db, 'dojoEvents', ownOff.id));
      } else {
        const n = countOf(date);
        if (!confirm(`${fmtYmd(date)}を終日休みにしますか?${n ? `\nこの日には予約が${n}件あります。休みにしても予約は自動では取り消されません。` : ''}`)) { setBusy(false); return; }
        await addDoc(collection(db, 'dojoEvents'), { start: date, end: '', type: 'off', title: 'お休み', memo: '', fromReserve: true, createdAt: serverTimestamp() });
      }
      await load();
    } catch (e) { alert(e.message); }
    setBusy(false);
  }

  const isOpenSlot = (s) => !taken[s] && !blocks[s];
  function tap(s) {
    if (taken[s]) { setDetail({ type: 'booking', b: byId[taken[s]] }); return; }
    if (blocks[s]) { setDetail({ type: 'block', slot: s, scope: blocks[s] }); return; }
    setSel(sel.includes(s) ? sel.filter((x) => x !== s) : [...sel, s].sort());
  }
  function extend(dir) {
    const i = ALL_SLOTS.indexOf(sel[0]);
    const range = dir < 0 ? ALL_SLOTS.slice(0, i + 1) : ALL_SLOTS.slice(i);
    setSel(range.filter(isOpenSlot));
  }

  async function run(body, after) {
    setBusy(true);
    try { const r = await api('/api/reserve', body); if (r.gcalError) alert(r.gcalError); if (r.mailError) alert(r.mailError); after && after(); await load(); }
    catch (e) { alert(e.message); }
    setBusy(false);
  }
  const block = () => run({ action: 'block', date, slots: sel, scope: alsoPractice ? 'all' : 'lesson' }, () => setSel([]));
  const unblock = (slot) => run({ action: 'unblock', date, slots: [slot] }, () => setDetail(null));
  const cancelBooking = (b) => {
    const msg = b.kind === 'teacher' ? `「${b.label}」を取り消しますか?` : `${b.name}の${KIND_LABEL[b.kind]}を取り消しますか?\n本人に取り消しのメールが届きます。`;
    if (!confirm(msg)) return;
    run({ action: 'cancel', id: b.id }, () => setDetail(null));
  };
  const adminBook = () => run({ action: 'adminBook', date, slots: sel, label: bookForm.label }, () => { setBookForm(null); setSel([]); });

  const Row = ({ s, i }) => {
    const id = taken[s];
    const b = id && byId[id];
    const cont = id && i > 0 && taken[ALL_SLOTS[i - 1]] === id;
    if (b) {
      const teacher = b.kind === 'teacher';
      return (
        <button onClick={() => tap(s)} className="press w-full h-12 rounded-xl flex items-center gap-3 px-3 text-left" style={{ background: teacher ? '#F4EAD8' : '#E3EFEF' }}>
          <span className="w-12 font-bold" style={{ color: teacher ? '#6B4A1C' : '#1F5F64' }}>{s}</span>
          <span className="font-bold truncate flex-1" style={{ color: teacher ? '#4F3613' : '#1F4A4D' }}>{b.name}</span>
          {cont ? <span className="text-xs text-ks-sub">(続き)</span>
            : teacher ? <span className="text-[11px] font-bold text-white px-2 py-0.5 rounded-full" style={{ background: '#8A6125' }}>先生</span>
              : <span className="text-xs" style={{ color: '#2B5557' }}>{KIND_LABEL[b.kind]}{b.kind === 'lesson' ? ` ${minutesLabel(b.slots)}` : ''}</span>}
        </button>
      );
    }
    if (id) return <div className="h-12 rounded-xl bg-[#E3EFEF] flex items-center px-3 text-sm text-ks-sub"><span className="w-12 font-bold mr-3">{s}</span>予約あり(読み込み中)</div>;
    if (blocks[s]) return (
      <button onClick={() => tap(s)} className="press w-full h-12 rounded-xl bg-[#E6E2DB] flex items-center gap-3 px-3 text-left">
        <span className="w-12 font-bold text-[#6E6E6E]">{s}</span>
        <span className="text-sm font-bold text-[#57534E]">予約不可</span>
        <span className="text-xs text-[#57534E]">{blocks[s] === 'all' ? 'レッスン・個人練習' : 'レッスンのみ'}</span>
      </button>
    );
    const on = sel.includes(s);
    return (
      <button onClick={() => tap(s)} className="press w-full h-12 rounded-xl flex items-center gap-3 px-3 text-left bg-white"
        style={{ border: on ? `2px solid ${TEAL}` : '1px solid #EDE8E1', background: on ? '#F1F8F8' : '#fff' }}>
        <span className="w-12 font-bold" style={on ? { color: '#1F5F64' } : undefined}>{s}</span>
        {on ? <span className="text-sm font-bold" style={{ color: '#1F5F64' }}>✓ 選択中</span> : <span className="text-sm text-[#8A8A8A]">空き</span>}
      </button>
    );
  };

  return (
    <div className={sel.length ? 'pb-56' : ''}>
      <div className="card p-3 mb-4">
        <div className="flex items-center justify-between mb-2 px-1">
          <button className="w-10 h-10 rounded-full border border-ks-border" style={{ color: TEAL }} onClick={() => setDate(addDays(weekStart, -7))} aria-label="前の週">‹</button>
          <span className="font-bold">{Number(date.slice(0, 4))}年{Number(date.slice(5, 7))}月</span>
          <button className="w-10 h-10 rounded-full border border-ks-border" style={{ color: TEAL }} onClick={() => setDate(addDays(weekStart, 7))} aria-label="次の週">›</button>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {week.map((ds) => {
            const active = ds === date;
            const n = countOf(ds);
            const dOff = isOffDay(dojo, ds);
            return (
              <button key={ds} onClick={() => setDate(ds)} className="h-[58px] rounded-xl flex flex-col items-center justify-center gap-0.5"
                style={active ? { background: TEAL, color: '#fff' } : { background: '#fff', border: '1px solid #EDE8E1' }}>
                <span className="text-[11px]" style={active ? undefined : { color: '#78716C' }}>{WD[weekdayOf(ds)]}</span>
                <span className="text-[17px] font-bold">{Number(ds.slice(8))}</span>
                <span className="text-[10px]" style={active ? undefined : { color: '#1F5F64' }}>{dOff ? '休' : n ? `${n}件` : ''}</span>
              </button>
            );
          })}
        </div>
        <button className="link mt-2 px-1" onClick={() => setDate(jstToday())}>今日に戻る</button>
      </div>

      <div className="card px-4 py-3 mb-5 flex items-center justify-between gap-3">
        <span>
          <span className="block font-bold text-[15px]">{fmtYmd(date)}を終日休みにする</span>
          <span className="block text-xs text-ks-sub">生徒のマイカレンダーにも「休」と表示されます</span>
        </span>
        <button role="switch" aria-checked={off} aria-label="終日休み" disabled={busy} onClick={toggleOff}
          className="w-[52px] h-[30px] rounded-full relative shrink-0 transition-colors" style={{ background: off ? '#E54D26' : '#CFC8BC' }}>
          <span className="absolute top-[3px] w-6 h-6 rounded-full bg-white transition-all" style={{ left: off ? 25 : 3 }} />
        </button>
      </div>

      {[['個人練習のみの時間', ALL_SLOTS.slice(0, 6), 0], ['レッスンの時間', ALL_SLOTS.slice(6), 6]].map(([title, list, base]) => (
        <div key={title} className="mb-4">
          <div className="flex items-center gap-2 mb-2 px-1">
            <span className="text-[13px] font-bold text-ks-sub">{title}</span>
            <span className="flex-1 h-px bg-ks-border" />
          </div>
          <div className="space-y-1.5">{list.map((s, k) => <Row key={s} s={s} i={base + k} />)}</div>
        </div>
      ))}

      {sel.length > 0 && (
        <div className="fixed left-1/2 -translate-x-1/2 w-full max-w-[480px] z-40 bg-white border-t border-ks-border rounded-t-3xl px-4 pt-4 shadow-lg"
          style={{ bottom: 0, paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }}>
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-sm text-ks-sub">{sel.length}コマ選択中</span>
            <span className="text-lg font-bold" style={{ color: '#1F5F64' }}>{selLabel(sel)}</span>
          </div>
          {sel.length === 1 && (
            <div className="flex gap-3 mb-2 text-sm">
              <button className="link" onClick={() => extend(-1)}>この枠より前も選ぶ</button>
              <button className="link" onClick={() => extend(1)}>この枠より後も選ぶ</button>
            </div>
          )}
          <label className="flex items-center gap-2.5 min-h-[44px] px-3 rounded-xl bg-ks-bg mb-3 text-sm">
            <input type="checkbox" className="w-5 h-5" style={{ accentColor: TEAL }} checked={alsoPractice} onChange={(e) => setAlsoPractice(e.target.checked)} />
            予約不可を個人練習にも反映する
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button className="btn btn-ghost" style={{ borderRadius: 14, border: '1.5px solid #57534E' }} disabled={busy} onClick={block}>予約不可にする</button>
            <button className="btn text-white" style={{ borderRadius: 14, background: TEAL }} disabled={busy} onClick={() => setBookForm({ label: '' })}>予約を入れる</button>
          </div>
          <button className="w-full text-xs text-ks-sub mt-2 py-1" onClick={() => setSel([])}>選択をやめる</button>
        </div>
      )}

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.type === 'block' ? '予約不可の枠' : '予約の内容'}>
        {detail?.type === 'booking' && detail.b && (
          <div>
            <div className="card px-4 py-1 mb-4 text-sm">
              <div className="flex justify-between py-3 border-b border-ks-border"><span className="text-ks-sub">日時</span><b>{fmtYmd(detail.b.date)} {rangeLabel(detail.b.slots)}</b></div>
              <div className="flex justify-between py-3 border-b border-ks-border"><span className="text-ks-sub">内容</span><b>{KIND_LABEL[detail.b.kind]}({minutesLabel(detail.b.slots)})</b></div>
              <div className="flex justify-between py-3"><span className="text-ks-sub">名前</span><b>{detail.b.name}{detail.b.className ? `(${detail.b.className})` : ''}</b></div>
            </div>
            {detail.b.gcalError && <p className="text-xs text-ks-red mb-3">Googleカレンダーへの登録に失敗しています:{detail.b.gcalError}</p>}
            <button className="btn btn-ghost w-full text-ks-red" disabled={busy} onClick={() => cancelBooking(detail.b)}>この予約を取り消す</button>
          </div>
        )}
        {detail?.type === 'block' && (
          <div>
            <p className="mb-4">{fmtYmd(date)} {rangeLabel([detail.slot])} は予約不可({detail.scope === 'all' ? 'レッスン・個人練習' : 'レッスンのみ'})に設定されています。</p>
            <button className="btn btn-primary w-full" disabled={busy} onClick={() => unblock(detail.slot)}>予約不可を解除する</button>
          </div>
        )}
      </Modal>

      <Modal open={!!bookForm} onClose={() => setBookForm(null)} title="予約を入れる">
        {bookForm && (
          <div>
            <div className="card px-4 py-3 mb-4">
              <p className="text-xs text-ks-sub">選択した日時</p>
              <p className="text-xl font-bold" style={{ color: '#1F5F64' }}>{fmtYmd(date)}</p>
              <p className="font-medium">{selLabel(sel)}<span className="text-sm text-ks-sub ml-1.5">({sel.length}コマ・{minutesLabel(sel)})</span></p>
            </div>
            <Field label="カレンダーに表示する名前" note="例:お試しレッスン(大声歌子)/大声歌子 入門初月">
              <input className="input" autoFocus value={bookForm.label} onChange={(e) => setBookForm({ label: e.target.value })} />
            </Field>
            <p className="text-xs text-ks-sub leading-relaxed mb-4 rounded-xl p-3" style={{ background: '#EEF5F5' }}>先生のGoogleカレンダーに登録されます。メールは送信されません。生徒の予約画面では、この時間はレッスン・個人練習とも「予約済」になります。</p>
            <button className="btn w-full text-white" style={{ background: TEAL }} disabled={busy || !bookForm.label.trim()} onClick={adminBook}>{busy ? '登録中…' : '予約を登録する'}</button>
          </div>
        )}
      </Modal>
    </div>
  );
}
