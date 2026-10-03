// 日付(YYYY-MM-DD)の範囲を1日ずつに展開する(最大120日)
export function expandRange(start, end) {
  if (!start) return [];
  const last = end && end >= start ? end : start;
  const out = [];
  const d = new Date(start + 'T00:00:00');
  for (let i = 0; i < 120; i++) {
    const s = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    out.push(s);
    if (s >= last) break;
    d.setDate(d.getDate() + 1);
  }
  return out;
}

const WD = ['日', '月', '火', '水', '木', '金', '土'];
export function fmtDay(s) {
  const d = new Date(s + 'T00:00:00');
  return `${d.getMonth() + 1}月${d.getDate()}日(${WD[d.getDay()]})`;
}
export function fmtRange(start, end) {
  return end && end > start ? `${fmtDay(start)}〜${fmtDay(end)}` : fmtDay(start);
}

export const DOJO_TYPES = [
  { key: 'off', mark: '休', label: 'お休み', color: '#E54D26' },
  { key: 'event', mark: 'K', label: 'スクールのイベント', color: '#C5A059' },
];
