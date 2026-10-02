import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebaseClient';
import Layout from '../components/Layout';
import { useApp } from '../components/AppContext';
import { Chip, Empty, Spinner } from '../components/ui';
import { GENRES, VOCALS, MOODS } from '../lib/constants';
import { loadPdfBlob } from '../lib/songPdf';
import { downloadBlob, safeFileName } from '../lib/utils';
import { hashEmail, loadStats, recordDownload } from '../lib/songStats';

const GENRE_COLOR = { 'ポップス': '#F9E1E6', 'ロック': '#E7E3F4', 'カントリー': '#FBEFD5', 'R&B': '#E2EEF6', 'HipHop': '#EDE2F6', 'エレクトロ': '#DDF1EE', 'ブルース': '#DFE6F5', 'フォーク': '#E1F2E1', 'ラテン': '#FCE6D9', 'ソウル': '#F4E3DA', 'ディスコ': '#F8E0F0', 'バラード': '#EAE6DF', 'その他': '#EEEEEE' };

function toggle(list, v) { return list.includes(v) ? list.filter((x) => x !== v) : [...list, v]; }

function Songs() {
  const app = useApp();
  const router = useRouter();
  const [songs, setSongs] = useState(null);
  const [q, setQ] = useState('');
  const [mineFromStats, setMineFromStats] = useState({});
  const [genres, setGenres] = useState([]);
  const [vocal, setVocal] = useState('');
  const [moods, setMoods] = useState([]);
  const [showFilter, setShowFilter] = useState(false);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => { if (router.query.q) setQ(String(router.query.q)); }, [router.query.q]);
  useEffect(() => {
    (async () => {
      try {
        const [h, stats] = await Promise.all([hashEmail(app.user.email), loadStats()]);
        setMineFromStats(Object.fromEntries(stats.filter((x) => (x.users || []).includes(h)).map((x) => [x.id, true])));
      } catch (e) { console.error(e); }
    })();
  }, [app.user.email]);
  useEffect(() => {
    getDocs(collection(db, 'songs')).then((s) => setSongs(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))));
  }, []);

  const filtered = useMemo(() => {
    if (!songs) return [];
    const k = q.trim().toLowerCase();
    return songs.filter((s) =>
      (!k || s.title.toLowerCase().includes(k)) &&
      (!genres.length || genres.some((g) => (s.genres || []).includes(g))) &&
      (!vocal || s.vocal === vocal) &&
      (!moods.length || moods.some((m) => (s.moods || []).includes(m))));
  }, [songs, q, genres, vocal, moods]);

  const filterCount = genres.length + moods.length + (vocal ? 1 : 0);

  async function download(s) {
    setBusy(s.id); setErr('');
    try {
      const blob = await loadPdfBlob(s.id);
      downloadBlob(blob, safeFileName(s.title) + '.pdf');
      await app.updatePriv({ downloaded: { [s.id]: Date.now() } });
      recordDownload(s, app.user.email).catch(console.error);
    } catch (e) { setErr(e.message); }
    setBusy('');
  }

  if (!songs) return <Spinner />;
  return (
    <>
      <div className="sticky top-[62px] z-20 -mx-4 px-4 pb-3 pt-1 bg-ks-bg">
        <input className="input" placeholder="曲名で検索" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="flex items-center justify-between mt-2">
          <button className="btn btn-ghost btn-sm" onClick={() => setShowFilter(!showFilter)}>絞り込み{filterCount ? `(${filterCount})` : ''}{showFilter ? 'を閉じる' : ''}</button>
          <span className="text-xs text-ks-sub">{filtered.length}曲</span>
        </div>
      </div>
      {showFilter && (
        <div className="card p-4 mb-4 space-y-4">
          <div><p className="text-xs font-bold text-ks-sub mb-2">ジャンル(複数選択可)</p><div className="flex flex-wrap gap-2">{GENRES.map((g) => <Chip key={g} active={genres.includes(g)} onClick={() => setGenres(toggle(genres, g))}>{g}</Chip>)}</div></div>
          <div><p className="text-xs font-bold text-ks-sub mb-2">ボーカル</p><div className="flex flex-wrap gap-2">{VOCALS.map((v) => <Chip key={v} active={vocal === v} onClick={() => setVocal(vocal === v ? '' : v)}>{v}</Chip>)}</div></div>
          <div><p className="text-xs font-bold text-ks-sub mb-2">雰囲気(複数選択可)</p><div className="flex flex-wrap gap-2">{MOODS.map((m) => <Chip key={m} active={moods.includes(m)} onClick={() => setMoods(toggle(moods, m))}>{m}</Chip>)}</div></div>
          {filterCount > 0 && <button className="text-xs text-ks-sub underline" onClick={() => { setGenres([]); setMoods([]); setVocal(''); }}>条件をクリア</button>}
        </div>
      )}
      {err && <p className="text-sm text-ks-red mb-3">{err}</p>}
      {!filtered.length ? <Empty>条件に合う曲がありません。</Empty> : (
        <div className="space-y-3">
          {filtered.map((s) => {
            const dl = app.priv.downloaded[s.id] || mineFromStats[s.id];
            return (
              <article key={s.id} className="card p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-bold text-[17px] leading-snug mr-1">{s.title}</h3>
                  {s.recommended && <span className="badge">おすすめ</span>}
                  {s.easy && <span className="badge" style={{ background: '#E6F4EA', color: '#2E7D4F', borderColor: '#C5E6CF' }}>歌いやすい</span>}
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {(s.genres || []).map((g) => <span key={g} className="text-xs px-2 py-0.5 rounded-full" style={{ background: GENRE_COLOR[g] || '#eee' }}>{g}</span>)}
                  {s.vocal && <span className="text-xs px-2 py-0.5 rounded-full border border-ks-border">🎤 {s.vocal}</span>}
                  {(s.moods || []).map((m) => <span key={m} className="text-xs px-2 py-0.5 rounded-full bg-stone-100 text-stone-600">{m}</span>)}
                </div>
                {s.range && <p className="text-xs text-ks-sub mt-2">音域: {s.range}</p>}
                <div className="flex gap-2 mt-3">
                  {s.songUrl && <a href={s.songUrl} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm flex-1">楽曲URL</a>}
                  {s.hasPdf && (
                    <button onClick={() => download(s)} disabled={busy === s.id}
                      className={`btn btn-sm flex-[1.4] ${dl ? 'bg-stone-200 text-stone-600' : 'btn-primary'}`}>
                      {busy === s.id ? '準備中…' : dl ? '✓ ダウンロード済み(再ダウンロード)' : '歌詞をダウンロード'}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
export default function Page() { return <Layout title="楽曲検索"><Songs /></Layout>; }
