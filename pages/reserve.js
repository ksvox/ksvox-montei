import { useEffect, useMemo, useState } from 'react';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db, api } from '../lib/firebaseClient';
import Layout from '../components/Layout';
import { useApp } from '../components/AppContext';
import { Empty, Modal } from '../components/ui';
import {
  PRO_CLASS, KIND_LABEL, LESSON_SLOTS, jstToday, firstBookableDay, lessonKoma, lessonStarts, practiceSlots,
  dayState, rangeLabel, minutesLabel, fmtYmd,
} from '../lib/reserve';

const TEAL = '#2A7F86';
const TEAL_DARK = '#1F5F64';
const WD = ['月', '火', '水', '木', '金', '土', '日'];
const pad = (n) => String(n).padStart(2, '0');

function Ring() {
  return <span aria-hidden="true" className="inline-block w-[11px] h-[11px] rounded-full border-[2.5px] border-ks-red" />;
}

function Reserve() {
  const app = useApp();
  const uid = app.user.uid;
  const cls = app.me?.className || '';
  const isPro = cls === PRO_CLASS;
  const koma = lessonKoma(cls);

  const [kind, setKind] = useState('lesson');
  const [cursor, setCursor] = useState(() => firstBookableDay().slice(0, 7));
  const [months, setMonths] = useState({});
  const [dojo, setDojo] = useState([]);
  const [mine, setMine] = useState([]);
  const [day, setDay] = useState(null);
  const [step, setStep] = useState('pick');
  const [picked, setPicked] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [doneInfo, setDoneInfo] = useState(null);

  const today = jstToday();

  const loadMonth = async (ym) => {
    const d = await getDoc(doc(db, 'reserveMonths', ym));
    setMonths((m) => ({ ...m, [ym]: d.exists() ? d.data() : {} }));
  };
  const loadMine = async () => {
    const s = await getDocs(query(collection(db, 'bookings'), where('uid', '==', uid)));
    setMine(s.docs.map((d) => ({ id: d.id, ...d.data() })).filter((b) => b.date >= today)
      .sort((a, b) => (a.date + a.slots[0]).localeCompare(b.date + b.slots[0])));
  };
  useEffect(() => {
    getDocs(collection(db, 'dojoEvents')).then((s) => setDojo(s.docs.map((d) => d.data()))).catch(console.error);
    loadMine().catch(console.error);
  }, []);
  useEffect(() => { loadMonth(cursor).catch(console.error); }, [cursor]);

  const month = months[cursor];
  const [y, mo] = cursor.split('-').map(Number);
  const daysIn = new Date(y, mo, 0).getDate();
  const lead = (new Date(y, mo - 1, 1).getDay() + 6) % 7; // 月曜はじまり
  const cells = [...Array(lead).fill(null), ...Array.from({ length: daysIn }, (_, i) => `${cursor}-${pad(i + 1)}`)];
  const minYm = today.slice(0, 7);
  const shift = (n) => { const d = new Date(y, mo - 1 + n, 1); setCursor(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`); };

  const mineByDate = useMemo(() => {
    const m = {}; mine.forEach((b) => { (m[b.date] = m[b.date] || []).push(b); }); return m;
  }, [mine]);

  function openDay(ds) {
    setDay(ds); setStep('pick'); setPicked([]); setErr(''); setDoneInfo(null);
    loadMonth(ds.slice(0, 7)).catch(console.error);
  }
  function closeDay() { setDay(null); setPicked([]); setStep('pick'); }

  const dayMonth = day ? months[day.slice(0, 7)] : null;
  const dayStateNow = day ? dayState({ month: dayMonth, dojoEvents: dojo, ymd: day, kind, koma }) : 'none';
  const dayBookable = dayStateNow === 'open' || dayStateNow === 'full';
  const slotList = !day ? [] : kind === 'lesson' ? lessonStarts(dayMonth, day, koma) : practiceSlots(dayMonth, day);

  function tapSlot(s) {
    setErr('');
    if (s.state !== 'open') return;
    if (kind === 'lesson') {
      const i = LESSON_SLOTS.indexOf(s.slot);
      setPicked(picked[0] === s.slot ? [] : LESSON_SLOTS.slice(i, i + koma));
    } else {
      setPicked(picked.includes(s.slot) ? picked.filter((x) => x !== s.slot) : [...picked, s.slot].sort());
    }
  }

  async function confirmBook() {
    setBusy(true); setErr('');
    try {
      const r = await api('/api/reserve', { action: 'book', date: day, kind, slots: picked });
      setDoneInfo({ date: day, slots: picked, kind, mailError: r.mailError });
      setStep('done');
      await Promise.all([loadMine(), loadMonth(day.slice(0, 7))]);
    } catch (e) {
      setErr(e.message); setStep('pick'); setPicked([]);
      await loadMonth(day.slice(0, 7)).catch(() => {});
    }
    setBusy(false);
  }

  async function cancelBooking(b) {
    if (!confirm(`${fmtYmd(b.date)} ${rangeLabel(b.slots)} の${KIND_LABEL[b.kind]}をキャンセルしますか?`)) return;
    setBusy(true);
    try {
      const r = await api('/api/reserve', { action: 'cancel', id: b.id });
      if (r.mailError) alert(r.mailError);
      await Promise.all([loadMine(), loadMonth(b.date.slice(0, 7))]);
    } catch (e) { alert(e.message); }
    setBusy(false);
  }

  const BookingRow = ({ b }) => (
    <li className="flex items-center justify-between gap-3 px-4 py-3">
      <span className="min-w-0">
        <span className="block font-bold">{fmtYmd(b.date)}</span>
        <span className="block text-sm text-ks-sub">{rangeLabel(b.slots)} {KIND_LABEL[b.kind]}({b.kind === 'lesson' ? minutesLabel(b.slots) : `${b.slots.length}コマ`})</span>
      </span>
      {b.date > today
        ? <button className="btn btn-ghost btn-sm shrink-0 text-ks-redhover" disabled={busy} onClick={() => cancelBooking(b)}>キャンセル</button>
        : <span className="text-xs text-ks-sub shrink-0">本日</span>}
    </li>
  );

  return (
    <>
      {isPro && (
        <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-[#E9E4DB] mb-4">
          {['lesson', 'practice'].map((k) => (
            <button key={k} onClick={() => setKind(k)} className="h-11 rounded-xl font-bold text-[15px]"
              style={kind === k ? { background: TEAL, color: '#fff' } : { color: '#57534E' }}>{KIND_LABEL[k]}</button>
          ))}
        </div>
      )}
      <p className="text-xs text-ks-sub mb-3 px-1 leading-relaxed">
        {kind === 'lesson'
          ? `レッスンは水〜日 14:30〜22:00。${isPro ? '正門下生は90分(2コマ)' : '1回45分'}です。予約はレッスン日の2日前まで。`
          : '個人練習は45分単位で、空いている枠を何コマでも選べます。予約は2日前まで。'}
      </p>

      <div className="card p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <button className="w-11 h-11 rounded-full border border-ks-border bg-white flex items-center justify-center disabled:opacity-30" style={{ color: TEAL }}
            disabled={cursor <= minYm} onClick={() => shift(-1)} aria-label="前の月">‹</button>
          <span className="font-serif font-bold text-lg">{y}年{mo}月</span>
          <button className="w-11 h-11 rounded-full border border-ks-border bg-white flex items-center justify-center" style={{ color: TEAL }}
            onClick={() => shift(1)} aria-label="次の月">›</button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs mb-1">
          {WD.map((w, i) => <span key={w} className={i === 6 ? 'text-ks-red' : i === 5 ? 'text-blue-600' : 'text-ks-sub'}>{w}</span>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((ds, i) => {
            if (!ds) return <span key={'e' + i} />;
            const d = Number(ds.slice(8));
            if (!month) return <span key={ds} className="h-[54px] rounded-xl bg-white/60" />;
            const st = dayState({ month, dojoEvents: dojo, ymd: ds, kind, koma });
            const hasMine = !!mineByDate[ds];
            const isToday = ds === today;
            if (st === 'open') return (
              <button key={ds} onClick={() => openDay(ds)} className="press h-[54px] rounded-xl bg-white border border-ks-border flex flex-col items-center justify-center gap-1">
                <span className="text-[15px] font-medium">{d}</span><Ring />
              </button>
            );
            if (st === 'full' || st === 'off') return (
              <button key={ds} onClick={() => hasMine && openDay(ds)} className="h-[54px] rounded-xl bg-[#EFEBE4] flex flex-col items-center justify-center gap-0.5 cursor-default">
                <span className="text-[15px] text-[#6E6E6E]">{d}</span>
                <span className="text-xs font-bold text-[#6E6E6E]">{st === 'off' ? '休' : '満'}</span>
              </button>
            );
            return (
              <button key={ds} onClick={() => hasMine && openDay(ds)} className="h-[54px] flex flex-col items-center justify-center gap-0.5 cursor-default">
                <span className={`text-[15px] ${isToday ? 'font-bold' : 'text-[#B3B3B3]'}`} style={isToday ? { color: TEAL } : undefined}>{d}</span>
                {isToday && <span className="text-[10px] font-bold" style={{ color: TEAL }}>今日</span>}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-ks-sub items-center">
          <span className="flex items-center gap-1.5"><Ring />予約できます</span>
          <span>満 = 満席</span>
          <span>休 = お休み</span>
        </div>
      </div>

      <section className="mb-7">
        <h2 className="font-serif font-bold text-lg mb-3 px-1">あなたの予約</h2>
        {!mine.length ? <Empty>予約はまだありません。カレンダーの⭕️の日を押して予約できます。</Empty> : (
          <ul className="card divide-y divide-ks-border">{mine.map((b) => <BookingRow key={b.id} b={b} />)}</ul>
        )}
        <p className="text-xs text-ks-sub mt-2 px-1">キャンセルは前日まで。当日のキャンセルは先生へ直接ご連絡ください。</p>
      </section>

      <Modal open={!!day} onClose={closeDay} title={day ? `${fmtYmd(day)}${step === 'confirm' ? ' 予約内容の確認' : ''}` : ''}>
        {day && step === 'pick' && (
          <div>
            {(mineByDate[day] || []).length > 0 && (
              <div className="mb-4">
                <p className="text-sm font-bold mb-2">この日のあなたの予約</p>
                <ul className="card divide-y divide-ks-border">{mineByDate[day].map((b) => <BookingRow key={b.id} b={b} />)}</ul>
              </div>
            )}
            {dayBookable ? (
              <>
                <p className="text-sm text-ks-sub mb-3 flex items-center gap-2">
                  <span className="text-xs font-bold text-white px-2.5 py-1 rounded-full" style={{ background: TEAL }}>{KIND_LABEL[kind]}</span>
                  {kind === 'lesson' ? (koma === 2 ? '開始時間を押すと、2コマ(90分)が選ばれます。' : '開始時間を押してください(45分)。') : '使いたい枠をすべて押してください。'}
                </p>
                {!dayMonth ? <Empty>読み込み中…</Empty> : (
                  <div className="grid grid-cols-2 gap-2">
                    {slotList.map((s) => {
                      const sel = picked.includes(s.slot);
                      if (sel) return (
                        <button key={s.slot} onClick={() => tapSlot(s)} className="h-[60px] rounded-2xl flex items-center justify-between px-3.5 text-white border-2" style={{ background: TEAL, borderColor: TEAL_DARK }}>
                          <span className="text-lg font-bold">{s.slot}</span>
                          <span className="text-xs font-bold">✓ {kind === 'lesson' && koma === 2 ? (picked[0] === s.slot ? '開始' : '2コマ目') : '選択中'}</span>
                        </button>
                      );
                      if (s.state === 'open') return (
                        <button key={s.slot} onClick={() => tapSlot(s)} className="press h-[60px] rounded-2xl bg-white border border-ks-border flex items-center justify-between px-3.5">
                          <span className="text-lg font-bold">{s.slot}</span>
                          <span className="flex items-center gap-1.5 text-xs text-ks-sub"><Ring />空き</span>
                        </button>
                      );
                      if (s.state === 'short') return (
                        <div key={s.slot} className="h-[60px] rounded-2xl border border-dashed border-[#CFC8BC] flex items-center justify-between px-3.5">
                          <span className="text-lg text-[#9A9A9A]">{s.slot}</span>
                          <span className="text-[11px] text-ks-sub text-right leading-tight">90分<br />取れません</span>
                        </div>
                      );
                      return (
                        <div key={s.slot} className="h-[60px] rounded-2xl bg-[#EFEBE4] flex items-center justify-between px-3.5">
                          <span className="text-lg text-[#7A7A7A]">{s.slot}</span>
                          <span className="text-xs text-[#6E6E6E]">予約済</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                {err && <p className="text-sm text-ks-red mt-3">{err}</p>}
                <div className="sticky bottom-0 bg-ks-bg pt-4 mt-2">
                  <div className="flex items-baseline justify-between mb-3 px-1">
                    <span className="text-sm text-ks-sub">選択中</span>
                    <span className="text-lg font-bold" style={{ color: TEAL_DARK }}>
                      {picked.length ? <>{rangeLabel(picked)}<span className="text-sm font-medium text-ks-sub ml-1.5">({minutesLabel(picked)})</span></> : 'まだ選ばれていません'}
                    </span>
                  </div>
                  <button className="btn w-full text-white h-[52px]" style={{ background: TEAL, borderRadius: 14 }} disabled={!picked.length}
                    onClick={() => setStep('confirm')}>この時間で予約へ進む</button>
                </div>
              </>
            ) : (
              !(mineByDate[day] || []).length && <Empty>この日は予約を受け付けていません。</Empty>
            )}
          </div>
        )}

        {day && step === 'confirm' && (
          <div>
            <p className="text-center font-medium mb-4">この内容で予約します。よろしいですか?</p>
            <div className="card overflow-hidden mb-4">
              <div className="px-5 py-4 text-white" style={{ background: TEAL }}>
                <p className="text-sm tracking-wider">{KIND_LABEL[kind]}({minutesLabel(picked)})</p>
                <p className="text-2xl font-bold mt-0.5">{fmtYmd(day)}</p>
                <p className="text-xl font-medium">{rangeLabel(picked)}</p>
              </div>
              <div className="px-5 py-1 text-sm">
                <div className="flex justify-between py-3 border-b border-ks-border"><span className="text-ks-sub">お名前</span><b>{app.me?.realName || app.me?.nickname || ''}</b></div>
                <div className="flex justify-between py-3"><span className="text-ks-sub">クラス</span><b>{cls}</b></div>
              </div>
            </div>
            <div className="rounded-2xl px-4 py-3 mb-5 text-sm leading-relaxed space-y-1.5" style={{ background: '#EEF5F5', color: '#2B4A4C' }}>
              <p>予約が完了すると、登録のメールアドレスに確認メールが届きます。</p>
              <p>キャンセルは前日まで、予約画面から行えます。当日のキャンセルは先生へ直接ご連絡ください。</p>
            </div>
            <button className="btn w-full text-white h-14 text-base" style={{ background: TEAL, borderRadius: 14 }} disabled={busy} onClick={confirmBook}>{busy ? '予約しています…' : '予約を確定する'}</button>
            <button className="btn btn-ghost w-full mt-2.5" style={{ borderRadius: 14 }} disabled={busy} onClick={() => setStep('pick')}>日時を選び直す</button>
          </div>
        )}

        {day && step === 'done' && doneInfo && (
          <div className="text-center py-2">
            <div className="w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center text-white text-2xl" style={{ background: TEAL }}>✓</div>
            <p className="font-serif font-bold text-xl mb-1">予約しました</p>
            <p className="font-bold">{fmtYmd(doneInfo.date)} {rangeLabel(doneInfo.slots)}</p>
            <p className="text-sm text-ks-sub mb-4">{KIND_LABEL[doneInfo.kind]}({minutesLabel(doneInfo.slots)})</p>
            <p className="text-sm text-ks-sub mb-5">{doneInfo.mailError || '確認メールをお送りしました。'}</p>
            <button className="btn btn-dark w-full" onClick={closeDay}>閉じる</button>
          </div>
        )}
      </Modal>
    </>
  );
}

export default function Page() { return <Layout title="レッスン予約"><Reserve /></Layout>; }
