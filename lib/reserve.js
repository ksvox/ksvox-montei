// レッスン予約の共通ルール(アプリ画面とサーバーの両方で使う)
export const SLOT_MIN = 45; // 1コマの長さ(分)
export const DEADLINE_DAYS = 2; // 予約はレッスン日の2日前まで
export const PRO_CLASS = '正門下生'; // レッスン90分(2コマ)・個人練習ができるクラス

export function addMin(t, m) {
  const [h, mm] = t.split(':').map(Number);
  const v = h * 60 + mm + m;
  return `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`;
}

// 10:00〜22:00 を45分ずつ(16コマ)。レッスンは14:30からの10コマ
export const ALL_SLOTS = Array.from({ length: 16 }, (_, i) => addMin('10:00', i * SLOT_MIN));
export const LESSON_SLOTS = ALL_SLOTS.slice(6);
export const LESSON_WEEKDAYS = [0, 3, 4, 5, 6]; // 日・水・木・金・土(月火はレッスンなし)

export const KIND_LABEL = { lesson: 'レッスン', practice: '個人練習', teacher: '先生の予約' };

const pad = (n) => String(n).padStart(2, '0');
export function jstToday() {
  const d = new Date(Date.now() + 9 * 3600 * 1000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
export function addDays(ymd, n) {
  const d = new Date(ymd + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
export function weekdayOf(ymd) { return new Date(ymd + 'T00:00:00Z').getUTCDay(); }
export function isLessonDay(ymd) { return LESSON_WEEKDAYS.includes(weekdayOf(ymd)); }
export function firstBookableDay() { return addDays(jstToday(), DEADLINE_DAYS); }
export function lessonKoma(className) { return className === PRO_CLASS ? 2 : 1; }

// 「17:30〜19:00」の形にする
export function rangeLabel(slots) {
  if (!slots || !slots.length) return '';
  const s = [...slots].sort();
  return `${s[0]}〜${addMin(s[s.length - 1], SLOT_MIN)}`;
}
export function minutesLabel(slots) { return `${(slots || []).length * SLOT_MIN}分`; }

// 道場カレンダーの「休」に入っている日か
export function isOffDay(dojoEvents, ymd) {
  return (dojoEvents || []).some((e) => {
    if (e.type !== 'off' || !e.start) return false;
    const end = e.end && e.end >= e.start ? e.end : e.start;
    return ymd >= e.start && ymd <= end;
  });
}

// その枠が予約できるか(month = reserveMonths の1か月分)
// 予約不可の枠:'lesson' はレッスンだけ不可、'all' は個人練習も不可
export function isFree(month, ymd, slot, kind) {
  if (month?.taken?.[ymd]?.[slot]) return false;
  const b = month?.blocks?.[ymd]?.[slot];
  if (!b) return true;
  if (kind === 'practice') return b !== 'all';
  return false;
}

// レッスンの開始枠ごとの状態:open(予約できる)/taken(埋まっている)/short(90分取れない)
export function lessonStarts(month, ymd, koma) {
  return LESSON_SLOTS.map((slot, i) => {
    if (!isFree(month, ymd, slot, 'lesson')) return { slot, state: 'taken' };
    const need = LESSON_SLOTS.slice(i, i + koma);
    if (need.length < koma || !need.every((s) => isFree(month, ymd, s, 'lesson'))) return { slot, state: 'short' };
    return { slot, state: 'open' };
  });
}
export function practiceSlots(month, ymd) {
  return ALL_SLOTS.map((slot) => ({ slot, state: isFree(month, ymd, slot, 'practice') ? 'open' : 'taken' }));
}

// カレンダーの日付の印:'open'(⭕️)/'full'(満)/'off'(休)/'none'(受付外)
export function dayState({ month, dojoEvents, ymd, kind, koma }) {
  if (ymd < firstBookableDay()) return 'none';
  if (isOffDay(dojoEvents, ymd)) return 'off';
  if (kind === 'lesson') {
    if (!isLessonDay(ymd)) return 'none';
    return lessonStarts(month, ymd, koma).some((s) => s.state === 'open') ? 'open' : 'full';
  }
  return practiceSlots(month, ymd).some((s) => s.state === 'open') ? 'open' : 'full';
}

const WD = ['日', '月', '火', '水', '木', '金', '土'];
export function fmtYmd(ymd) {
  const [, m, d] = ymd.split('-').map(Number);
  return `${m}月${d}日(${WD[weekdayOf(ymd)]})`;
}
