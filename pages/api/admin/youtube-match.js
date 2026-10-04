// 「K's VOX - Topic」チャンネルから、曲名に合うYouTube動画の候補を探す(管理者専用)
import { handle, verifyRequest } from '../../../lib/firebaseAdmin';
import { KSVOX_TOPIC_CHANNEL } from '../../../lib/constants';

const API = 'https://www.googleapis.com/youtube/v3';
const SEARCH_LIMIT = 30; // 1回の照合で検索を使う曲数の上限(検索は1回100ポイント、1日10,000ポイントまで無料)

const norm = (s) => String(s || '').toLowerCase()
  .replace(/\(official.*?\)|\[official.*?\]|official audio|official video/g, '')
  .replace(/[^a-z0-9]/g, '');
const decode = (s) => String(s || '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

async function yt(path, params, key) {
  const qs = new URLSearchParams({ ...params, key });
  const r = await fetch(`${API}/${path}?${qs}`);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const reason = j?.error?.errors?.[0]?.reason || '';
    if (reason === 'quotaExceeded') throw Object.assign(new Error('今日のYouTube検索の上限に達しました。明日もう一度お試しください。'), { status: 429 });
    throw new Error('YouTubeへの問い合わせに失敗しました:' + (j?.error?.message || r.status));
  }
  return j;
}

// チャンネルの「アップロード動画」一覧をまとめて取得(安く済む方法)
async function channelVideos(key) {
  const list = [];
  let pageToken = '';
  const playlistId = 'UU' + KSVOX_TOPIC_CHANNEL.slice(2);
  for (let n = 0; n < 20; n++) {
    let j;
    try { j = await yt('playlistItems', { part: 'snippet', playlistId, maxResults: '50', ...(pageToken ? { pageToken } : {}) }, key); }
    catch (e) { if (e.status === 429) throw e; break; } // 一覧が取れないチャンネルの場合は検索だけで探す
    for (const it of j.items || []) {
      const id = it.snippet?.resourceId?.videoId;
      if (id) list.push({ videoId: id, title: decode(it.snippet.title) });
    }
    pageToken = j.nextPageToken;
    if (!pageToken) break;
  }
  return list;
}

function score(songTitle, videoTitle) {
  const a = norm(songTitle); const b = norm(videoTitle);
  if (!a || !b) return 0;
  if (a === b) return 100;
  // 副題の有無の違い(例:「Title-(Sub)」と「Title」)
  const base = norm(String(songTitle).split(/[-(]/)[0]);
  if (base.length >= 5 && (b === base || b.startsWith(base) || base.startsWith(b))) return 80;
  if (a.length >= 6 && (b.startsWith(a) || a.startsWith(b))) return 70;
  if (base.length >= 5 && b.includes(base)) return 60;
  return 0;
}

export default handle(async (req) => {
  await verifyRequest(req, { requireAdmin: true });
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error('サーバーの設定(YOUTUBE_API_KEY)が未登録です。');
  const songs = (req.body?.songs || []).filter((s) => s && s.id && s.title);

  // 門弟アプリに未登録の曲(YouTubeにはあるが、どの曲とも結びつかないもの)
  if (req.body?.mode === 'unregistered') {
    const all = req.body?.allSongs || [];
    const linked = new Set(all.map((s) => s.youtubeId).filter(Boolean));
    const videos = await channelVideos(key);
    const seen = new Set();
    const list = videos.filter((v) => {
      if (linked.has(v.videoId) || seen.has(v.videoId)) return false;
      seen.add(v.videoId);
      // 曲名がほぼ同じ曲がすでに登録されていれば「登録済み」とみなす
      return !all.some((s) => score(s.title, v.title) >= 70);
    });
    return { videos: list, listed: videos.length };
  }

  if (!songs.length) return { results: [], searched: 0, remaining: 0 };

  const videos = await channelVideos(key);
  const results = [];
  const needSearch = [];
  for (const s of songs) {
    const cands = videos.map((v) => ({ ...v, score: score(s.title, v.title) })).filter((v) => v.score > 0)
      .sort((x, y) => y.score - x.score).slice(0, 3);
    if (cands.length) results.push({ id: s.id, title: s.title, candidates: cands, via: 'list' });
    else needSearch.push(s);
  }

  // 一覧で見つからなかった曲だけ検索で探す
  const batch = needSearch.slice(0, SEARCH_LIMIT);
  for (const s of batch) {
    const q = String(s.title).split(/[-(]/)[0].trim() || s.title;
    const j = await yt('search', { part: 'snippet', channelId: KSVOX_TOPIC_CHANNEL, q, type: 'video', maxResults: '5' }, key);
    const cands = (j.items || []).map((it) => ({ videoId: it.id?.videoId, title: decode(it.snippet?.title) }))
      .filter((v) => v.videoId).map((v) => ({ ...v, score: score(s.title, v.title) }))
      .sort((x, y) => y.score - x.score).slice(0, 3);
    results.push({ id: s.id, title: s.title, candidates: cands, via: 'search' });
  }

  return { results, listed: videos.length, searched: batch.length, remaining: needSearch.length - batch.length };
});
