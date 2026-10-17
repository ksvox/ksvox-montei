// 「K's VOX - Topic」チャンネルの再生リスト(EPごと)と、その中の曲順を読み込む(管理者専用)
import { handle, verifyRequest } from '../../../lib/firebaseAdmin';
import { KSVOX_TOPIC_CHANNEL } from '../../../lib/constants';

const API = 'https://www.googleapis.com/youtube/v3';
const decode = (s) => String(s || '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

async function yt(path, params, key) {
  const qs = new URLSearchParams({ ...params, key });
  const r = await fetch(`${API}/${path}?${qs}`);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const reason = j?.error?.errors?.[0]?.reason || '';
    if (reason === 'quotaExceeded') throw Object.assign(new Error('今日のYouTubeの利用上限に達しました。明日もう一度お試しください。'), { status: 429 });
    throw new Error('YouTubeへの問い合わせに失敗しました:' + (j?.error?.message || r.status));
  }
  return j;
}

// 再生リストの中身(曲順どおり)
async function playlistItems(playlistId, key) {
  const out = [];
  let skipped = 0; // 非公開・削除済みなどで中身を読めなかった動画
  let pageToken = '';
  for (let n = 0; n < 3; n++) {
    const j = await yt('playlistItems', { part: 'snippet', playlistId, maxResults: '50', ...(pageToken ? { pageToken } : {}) }, key);
    for (const it of j.items || []) {
      const videoId = it.snippet?.resourceId?.videoId;
      const title = decode(it.snippet?.title);
      if (!videoId || /^(private|deleted) video$/i.test(title)) { skipped += 1; continue; }
      out.push({ videoId, title, position: it.snippet?.position ?? out.length });
    }
    pageToken = j.nextPageToken;
    if (!pageToken) break;
  }
  return { items: out.sort((a, b) => a.position - b.position).map(({ videoId, title }) => ({ videoId, title })), skipped };
}

// チャンネルの再生リスト一覧(出てこない時は検索で探す)
async function channelPlaylists(key) {
  const list = [];
  let pageToken = '';
  for (let n = 0; n < 6; n++) {
    let j;
    try { j = await yt('playlists', { part: 'snippet,contentDetails', channelId: KSVOX_TOPIC_CHANNEL, maxResults: '50', ...(pageToken ? { pageToken } : {}) }, key); }
    catch (e) { if (e.status === 429) throw e; break; }
    for (const p of j.items || []) list.push({ id: p.id, title: decode(p.snippet?.title), count: p.contentDetails?.itemCount ?? null });
    pageToken = j.nextPageToken;
    if (!pageToken) break;
  }
  if (list.length) return list;
  pageToken = '';
  for (let n = 0; n < 3; n++) {
    const j = await yt('search', { part: 'snippet', channelId: KSVOX_TOPIC_CHANNEL, type: 'playlist', maxResults: '50', ...(pageToken ? { pageToken } : {}) }, key);
    for (const p of j.items || []) if (p.id?.playlistId) list.push({ id: p.id.playlistId, title: decode(p.snippet?.title), count: null });
    pageToken = j.nextPageToken;
    if (!pageToken) break;
  }
  return list;
}

function parseId(v) {
  const s = String(v || '').trim();
  const m = /[?&]list=([A-Za-z0-9_-]+)/.exec(s);
  if (m) return m[1];
  return /^[A-Za-z0-9_-]{10,60}$/.test(s) ? s : '';
}

export default handle(async (req) => {
  await verifyRequest(req, { requireAdmin: true });
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error('サーバーの設定(YOUTUBE_API_KEY)が未登録です。');

  // 再生リスト1つだけを指定して読み込む
  if (req.body?.playlistId) {
    const id = parseId(req.body.playlistId);
    if (!id) throw Object.assign(new Error('再生リストのURLとして読み取れません。'), { status: 400 });
    const [meta, got] = await Promise.all([
      yt('playlists', { part: 'snippet,contentDetails', id }, key).catch(() => ({ items: [] })),
      playlistItems(id, key),
    ]);
    const p = meta.items?.[0];
    return { playlists: [{ id, title: decode(p?.snippet?.title) || '', count: p?.contentDetails?.itemCount ?? got.items.length, items: got.items, skipped: got.skipped }] };
  }

  // チャンネルの再生リストをすべて(2曲未満のシングルは中身を読まない)
  const pls = await channelPlaylists(key);
  const targets = pls.filter((p) => p.count === null || p.count >= 2);
  const result = [];
  for (let i = 0; i < targets.length; i += 8) {
    const part = await Promise.all(targets.slice(i, i + 8).map(async (p) => {
      const got = await playlistItems(p.id, key).catch(() => ({ items: [], skipped: 0 }));
      return { ...p, items: got.items, skipped: got.skipped };
    }));
    result.push(...part);
  }
  return { playlists: result.filter((p) => p.items.length), total: pls.length };
});
