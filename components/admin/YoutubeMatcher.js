// YouTube自動照合:候補を出して、先生が確認して決定する
import { useState } from 'react';
import { addDoc, collection, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { api, db } from '../../lib/firebaseClient';
import { Modal } from '../ui';
import { hasYoutube } from '../../lib/showcaseTags';

const url = (id) => `https://www.youtube.com/watch?v=${id}`;

export default function YoutubeMatcher({ open, onClose, songs, onSaved, onAdded }) {
  const [busy, setBusy] = useState('');
  const [res, setRes] = useState(null);
  const [done, setDone] = useState({}); // songId -> 'ok' | 'skip'
  const [extra, setExtra] = useState(null); // 門弟アプリに未登録のYouTube曲
  const [added, setAdded] = useState({});

  const todo = songs.filter((s) => !hasYoutube(s));

  async function run() {
    setBusy('run'); setRes(null); setDone({});
    try {
      const r = await api('/api/admin/youtube-match', { songs: todo.map((s) => ({ id: s.id, title: s.title })) });
      setRes(r);
    } catch (e) { alert(e.message); }
    setBusy('');
  }

  async function choose(item, c) {
    try {
      const data = { youtubeUrl: url(c.videoId), youtubeId: c.videoId };
      await updateDoc(doc(db, 'songs', item.id), data);
      onSaved && onSaved(item.id, data);
      setDone((d) => ({ ...d, [item.id]: 'ok' }));
    } catch (e) { alert('保存できませんでした:' + e.message); }
  }

  // 曲名が完全に一致した候補をまとめて登録
  async function chooseExact() {
    const list = (res?.results || []).filter((it) => !done[it.id] && it.candidates[0]?.score === 100);
    if (!list.length) { alert('完全に一致した候補はありません。'); return; }
    if (!confirm(`曲名が完全に一致した${list.length}曲をまとめて登録しますか?`)) return;
    setBusy('exact');
    for (const it of list) await choose(it, it.candidates[0]);
    setBusy('');
  }

  async function findUnregistered() {
    setBusy('extra'); setExtra(null); setAdded({});
    try {
      const r = await api('/api/admin/youtube-match', { mode: 'unregistered', allSongs: songs.map((s) => ({ title: s.title, youtubeId: s.youtubeId || '' })) });
      setExtra(r.videos || []);
    } catch (e) { alert(e.message); }
    setBusy('');
  }

  // 準備中として登録(門弟アプリの楽曲検索とショーケースには出ない)
  async function addSong(v) {
    try {
      const data = { title: v.title, recommended: false, easy: false, songUrl: '', genres: [], vocal: '', moods: [], range: '',
        sounds: [], vibes: [], tempo: '', youtubeUrl: url(v.videoId), youtubeId: v.videoId, draft: true, hasPdf: false };
      const ref = await addDoc(collection(db, 'songs'), { ...data, createdAt: serverTimestamp() });
      onAdded && onAdded({ id: ref.id, ...data });
      setAdded((a) => ({ ...a, [v.videoId]: true }));
    } catch (e) { alert('登録できませんでした:' + e.message); }
  }

  async function addAll() {
    const list = (extra || []).filter((v) => !added[v.videoId]);
    if (!list.length) return;
    if (!confirm(`${list.length}曲を「準備中」としてまとめて登録しますか?`)) return;
    setBusy('addall');
    for (const v of list) await addSong(v);
    setBusy('');
  }

  function close() { setRes(null); setDone({}); setExtra(null); setAdded({}); onClose(); }

  return (
    <Modal open={open} onClose={close} title="YouTube自動照合" wide>
      <p className="text-sm mb-3">「K's VOX - Topic」チャンネルから、曲名に合う動画の候補を探します。候補を聴いて確認し、正しいものを「これに決定」してください。</p>
      <p className="text-xs text-ks-sub mb-3">YouTube未登録:{todo.length}曲</p>
      <button className="btn btn-primary w-full mb-4" disabled={!!busy || !todo.length} onClick={run}>{busy === 'run' ? '探しています…(少し時間がかかります)' : '候補を探す'}</button>

      {res && (
        <div>
          <p className="text-xs text-ks-sub mb-2 whitespace-pre-wrap">
            {`チャンネルの動画一覧:${res.listed}件 / 検索で探した曲:${res.searched}曲`}
            {res.remaining > 0 ? `\nまだ探していない曲が${res.remaining}曲あります。登録が済んだら、もう一度「候補を探す」を押してください(検索は1日に約100曲まで)。` : ''}
          </p>
          <button className="btn btn-ghost btn-sm w-full mb-3" disabled={!!busy} onClick={chooseExact}>{busy === 'exact' ? '登録中…' : '曲名が完全に一致したものをまとめて登録'}</button>
          <ul className="space-y-3">
            {res.results.map((it) => (
              <li key={it.id} className={`card p-3 ${done[it.id] ? 'opacity-50' : ''}`}>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="font-bold text-sm">{it.title}</p>
                  {done[it.id] === 'ok' && <span className="text-xs font-bold text-ks-gold shrink-0">登録済</span>}
                  {done[it.id] === 'skip' && <span className="text-xs text-ks-sub shrink-0">あとで</span>}
                </div>
                {!it.candidates.length && <p className="text-xs text-ks-sub">候補が見つかりませんでした。曲の編集画面でURLを直接貼ってください。</p>}
                {!done[it.id] && it.candidates.map((c) => (
                  <div key={c.videoId} className="flex items-center gap-2 py-1.5 border-t border-ks-border first:border-t-0">
                    <img src={`https://i.ytimg.com/vi/${c.videoId}/default.jpg`} alt="" className="w-16 h-12 object-cover rounded shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{c.title}</p>
                      <a className="text-xs underline text-ks-sub" href={url(c.videoId)} target="_blank" rel="noreferrer">YouTubeで聴いて確認</a>
                      {c.score === 100 && <span className="text-[10px] font-bold text-ks-gold ml-2">曲名一致</span>}
                    </div>
                    <button className="btn btn-primary btn-sm shrink-0" onClick={() => choose(it, c)}>これに決定</button>
                  </div>
                ))}
                {!done[it.id] && <button className="text-xs text-ks-sub underline mt-1" onClick={() => setDone((d) => ({ ...d, [it.id]: 'skip' }))}>あとで</button>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="border-t border-ks-border mt-6 pt-4">
        <p className="text-sm font-bold mb-1">門弟アプリに未登録の曲を取り込む</p>
        <p className="text-xs text-ks-sub mb-3">YouTubeにあって、まだ登録されていない曲を探します。取り込んだ曲は「準備中」になり、楽曲検索とショーケースには出ません。楽曲URL・音域・タグ・歌詞PDFを整えたら、編集画面で「準備中」のチェックを外してください。</p>
        <button className="btn btn-ghost w-full mb-3" disabled={!!busy} onClick={findUnregistered}>{busy === 'extra' ? '探しています…' : '未登録の曲を探す'}</button>
        {extra && !extra.length && <p className="text-sm text-ks-sub text-center py-2">未登録の曲はありません。</p>}
        {extra && extra.length > 0 && (
          <div>
            <button className="btn btn-dark btn-sm w-full mb-3" disabled={!!busy} onClick={addAll}>{busy === 'addall' ? '登録中…' : `${extra.filter((v) => !added[v.videoId]).length}曲をまとめて「準備中」で登録`}</button>
            <ul className="card divide-y divide-ks-border">
              {extra.map((v) => (
                <li key={v.videoId} className={`flex items-center gap-2 p-2 ${added[v.videoId] ? 'opacity-50' : ''}`}>
                  <img src={`https://i.ytimg.com/vi/${v.videoId}/default.jpg`} alt="" className="w-16 h-12 object-cover rounded shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{v.title}</p>
                    <a className="text-xs underline text-ks-sub" href={url(v.videoId)} target="_blank" rel="noreferrer">YouTubeで聴いて確認</a>
                  </div>
                  {added[v.videoId] ? <span className="text-xs font-bold text-ks-gold shrink-0">登録済</span>
                    : <button className="btn btn-primary btn-sm shrink-0" disabled={!!busy} onClick={() => addSong(v)}>登録</button>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  );
}
