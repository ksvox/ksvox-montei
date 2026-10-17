// YouTubeの再生リストと、登録済みの曲を結びつける(EP管理用)

export const norm = (s) => String(s || '').toLowerCase()
  .replace(/\(official.*?\)|\[official.*?\]|official audio|official video/g, '')
  .replace(/[^a-z0-9ぁ-んァ-ヶ一-龠]/g, '');

// 「Title-(EP名)」から表示用の曲名
export const baseTitle = (t) => String(t || '').replace(/-\s*\([^()]+\)\s*$/, '').trim();

// 再生リストの1本の動画 → 登録済みの曲(YouTube URLが同じ曲を優先、なければ曲名で探す)
export function matchSong(songs, item, used) {
  const free = (s) => !used.has(s.id);
  const byId = songs.find((s) => s.youtubeId === item.videoId && free(s));
  if (byId) return byId;
  const v = norm(item.title);
  if (!v) return null;
  const cands = songs.filter((s) => {
    if (!free(s)) return false;
    const a = norm(baseTitle(s.title));
    return a && (a === v || (a.length >= 6 && (v.startsWith(a) || a.startsWith(v))));
  });
  return cands.length === 1 ? cands[0] : null;
}

// 再生リスト1本を調べる:各曲の結びつきと、EP名の候補
export function analyzePlaylist(pl, songs) {
  const used = new Set();
  const tracks = pl.items.map((item) => {
    const song = matchSong(songs, item, used);
    if (song) used.add(song.id);
    return { item, song };
  });
  const matched = tracks.filter((t) => t.song);
  const count = {};
  matched.forEach((t) => { const r = (t.song.release || '').trim(); if (r) count[r] = (count[r] || 0) + 1; });
  const top = Object.entries(count).sort((a, b) => b[1] - a[1])[0];
  const fromTitle = String(pl.title || '').replace(/^(album|ep|single)\s*[-–:]\s*/i, '').trim();
  return { id: pl.id, title: pl.title, tracks, matchedCount: matched.length, name: top ? top[0] : fromTitle };
}
