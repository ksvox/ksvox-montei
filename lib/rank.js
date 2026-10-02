// 段位の自動計算。入門月は数えず、翌月から1年を数える。
const RANKS = ['歌方 初段', '歌方 弐段', '歌方 参段', '歌方 仕段'];

export function computeRank(className, joinYm, now = new Date()) {
  if (className === '正門下生') return '正門下生';
  if (className !== '門下生' || !joinYm) return '';
  const m = /^(\d{4})-(\d{1,2})$/.exec(joinYm);
  if (!m) return '';
  const elapsed = now.getFullYear() * 12 + (now.getMonth() + 1) - (Number(m[1]) * 12 + Number(m[2]));
  if (elapsed < 0) return '';
  const idx = elapsed <= 12 ? 0 : Math.floor((elapsed - 1) / 12);
  return idx >= RANKS.length ? '正門下生' : RANKS[idx];
}
