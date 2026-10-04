// 連続タグ付けモード:曲を聴きながらタグを押して、次の曲へ
import { useMemo, useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebaseClient';
import { Modal } from '../ui';
import ShowcaseFields, { YoutubePreview } from './ShowcaseFields';
import { isTagged, youtubeFields, releaseList, releaseFromTitle } from '../../lib/showcaseTags';

const pick = (s) => ({ vocal: s.vocal || '', sounds: s.sounds || [], vibes: s.vibes || [], tempo: s.tempo || '', youtubeUrl: s.youtubeUrl || '', release: s.release || releaseFromTitle(s.title) });

export default function SongTagger({ open, onClose, songs, onSaved }) {
  const [onlyTodo, setOnlyTodo] = useState(true);
  // 開いた時点の並びを固定(保存しても順番がずれないように)
  const queue = useMemo(() => (open ? songs.filter((s) => !onlyTodo || !isTagged(s)).map((s) => s.id) : []), [open, onlyTodo]); // eslint-disable-line react-hooks/exhaustive-deps
  const [i, setI] = useState(0);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);

  const song = songs.find((s) => s.id === queue[i]);
  const cur = form && form.id === song?.id ? form : song ? { id: song.id, ...pick(song) } : null;
  const setCur = (f) => setForm({ ...f, id: song.id });

  function go(n) { setForm(null); setI(Math.max(0, Math.min(queue.length, n))); }

  async function saveNext() {
    if (!song || !cur) return;
    setBusy(true);
    try {
      const data = { vocal: cur.vocal, sounds: cur.sounds, vibes: cur.vibes, tempo: cur.tempo, release: (cur.release || '').trim(), ...youtubeFields(cur.youtubeUrl) };
      await updateDoc(doc(db, 'songs', song.id), data);
      onSaved && onSaved(song.id, data);
      go(i + 1);
    } catch (e) { alert('保存できませんでした:' + e.message); }
    setBusy(false);
  }

  function close() { setI(0); setForm(null); onClose(); }

  return (
    <Modal open={open} onClose={close} title="連続タグ付けモード" wide>
      <div className="flex items-center justify-between mb-3 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" className="w-5 h-5 accent-[#E54D26]" checked={onlyTodo} onChange={(e) => { setOnlyTodo(e.target.checked); go(0); }} />
          タグ未完了の曲だけ
        </label>
        <span className="text-ks-sub">{queue.length ? `${Math.min(i + 1, queue.length)} / ${queue.length}曲` : ''}</span>
      </div>

      {!queue.length && <p className="text-center text-sm text-ks-sub py-8">タグ付けが必要な曲はありません。</p>}
      {queue.length > 0 && i >= queue.length && (
        <div className="text-center py-8">
          <p className="font-bold mb-3">最後の曲まで終わりました。</p>
          <button className="btn btn-ghost btn-sm" onClick={close}>閉じる</button>
        </div>
      )}

      {song && cur && (
        <div>
          <h3 className="font-bold text-lg mb-1">{song.title}</h3>
          <p className="text-xs text-ks-sub mb-3">
            参考(今までの登録):{[...(song.genres || []), ...(song.moods || [])].join('・') || 'なし'}{song.range ? ` / 音域 ${song.range}` : ''}
          </p>
          {cur.youtubeUrl ? <YoutubePreview url={cur.youtubeUrl} /> : (
            <div className="rounded-xl border border-dashed border-ks-border p-3 mb-3 text-sm text-ks-sub">
              YouTube URLが未登録です。{song.songUrl && <a className="underline text-ks-text ml-1" href={song.songUrl} target="_blank" rel="noreferrer">楽曲ページで聴く</a>}
            </div>
          )}
          <ShowcaseFields form={cur} setForm={setCur} showVocal showYoutube={!song.youtubeId} releases={releaseList(songs)} />
          <div className="flex gap-2 sticky bottom-0 bg-ks-bg pt-2">
            <button className="btn btn-ghost btn-sm" disabled={i === 0 || busy} onClick={() => go(i - 1)}>← 前へ</button>
            <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => go(i + 1)}>スキップ</button>
            <button className="btn btn-primary flex-1" disabled={busy} onClick={saveNext}>{busy ? '保存中…' : '保存して次へ →'}</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
