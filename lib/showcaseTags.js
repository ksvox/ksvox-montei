// ショーケース用タグの共通処理
import { TAG_MAX } from './constants';
import { youtubeId } from './utils';

// 複数選択(上限つき)の切り替え
export function toggleMax(list, v, max = TAG_MAX) {
  const l = list || [];
  if (l.includes(v)) return l.filter((x) => x !== v);
  if (l.length >= max) return [...l.slice(1), v]; // 上限を超えたら古い方を外す
  return [...l, v];
}

// ショーケース用のタグがそろっているか
export function isTagged(s) {
  return !!((s.sounds || []).length && (s.vibes || []).length && s.tempo);
}

export function hasYoutube(s) {
  return !!(s.youtubeId || youtubeId(s.youtubeUrl));
}

// 保存用にYouTubeのURLとIDをそろえる
export function youtubeFields(url) {
  const u = String(url || '').trim();
  const id = youtubeId(u);
  return { youtubeUrl: u, youtubeId: id };
}
