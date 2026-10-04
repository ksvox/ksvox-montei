// YouTube自動照合:候補を出して、先生が確認して決定する
import { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { api, db } from '../../lib/firebaseClient';
import { Modal } from '../ui';
import { hasYoutube } from '../../lib/showcaseTags';

const url = (id) => `https://www.youtube.com/watch?v=${id}`;

export default function YoutubeMatcher({ open, onClose, songs, onSaved }) {
  const [busy, setBusy] = useState('');
  const [res, setRes] = useState(null);
  const [done, setDone] = useState({}); // songId -> 'ok' | 'skip'

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

  function close() { setRes(null); setDone({}); onClose(); }

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
    </Modal>
  );
}
