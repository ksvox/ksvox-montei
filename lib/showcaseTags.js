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

// 曲名の「-(EPタイトル)」から収録作品名を取り出す
export function releaseFromTitle(title) {
  const m = /-\s*\(([^()]+)\)\s*$/.exec(String(title || ''));
  return m ? m[1].trim() : '';
}

// 登録済みの収録作品名の一覧(入力候補用)
export function releaseList(songs) {
  return [...new Set((songs || []).map((s) => (s.release || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
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
