// EP管理:テーマ文・ジャケット・曲順・並び順。曲順はYouTubeの再生リストから読み込める
import { useEffect, useMemo, useState } from 'react';
import { collection, doc, getDocs, updateDoc } from 'firebase/firestore';
import { api, db } from '../../lib/firebaseClient';
import { compressImage } from '../../lib/utils';
import { Modal } from '../ui';
import { analyzePlaylist, baseTitle } from '../../lib/epMatch';

const EP_TRACKS = 5; // EPはすべて5曲

function move(list, i, d) {
  const j = i + d;
  if (j < 0 || j >= list.length) return list;
  const l = [...list];
  [l[i], l[j]] = [l[j], l[i]];
  return l;
}

export default function AdminEps() {
  const [eps, setEps] = useState([]);
  const [songs, setSongs] = useState([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');
  const [pls, setPls] = useState(null); // 読み込んだYouTube再生リスト
  const [plTotal, setPlTotal] = useState(0);
  const [names, setNames] = useState({});
  const [url, setUrl] = useState('');
  const [edit, setEdit] = useState(null);

  async function loadAll() {
    setErr('');
    try {
      const [r, s] = await Promise.all([api('/api/admin/eps', { mode: 'list' }), getDocs(collection(db, 'songs'))]);
      setEps(r.eps || []);
      setSongs(s.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) { setErr(e.message); }
  }
  useEffect(() => { loadAll(); }, []);

  const byId = useMemo(() => Object.fromEntries(songs.map((s) => [s.id, s])), [songs]);
  const regNames = useMemo(() => new Set(eps.map((e) => e.name)), [eps]);
  const regLists = useMemo(() => new Set(eps.map((e) => e.playlistId).filter(Boolean)), [eps]);

  // ---------- YouTubeの再生リストから読み込む ----------
  async function fetchPlaylists(playlistUrl) {
    setBusy('pl'); setPls(null); setNames({});
    try {
      const r = await api('/api/admin/youtube-playlists', playlistUrl ? { playlistId: playlistUrl } : {});
      setPls(r.playlists || []); setPlTotal(r.total || (r.playlists || []).length);
    } catch (e) { alert(e.message); }
    setBusy('');
  }

  const proposals = useMemo(() => (pls || []).map((p) => analyzePlaylist(p, songs))
    .filter((a) => a.matchedCount >= 2 && !regLists.has(a.id)), [pls, songs, regLists]);
  const skipped = (pls || []).length - proposals.length;

  const nameOf = (a) => (names[a.id] ?? a.name).trim();
  const warnings = (a) => {
    const w = []; const n = nameOf(a);
    if (a.tracks.length !== EP_TRACKS) w.push(`この再生リストは${a.tracks.length}曲です(EPは${EP_TRACKS}曲)`);
    const un = a.tracks.filter((t) => !t.song).length;
    if (un) w.push(`${un}曲が登録済みの曲と結びつきません。曲の編集画面でYouTube URLを確認してください`);
    if (!n) w.push('EP名を入れてください');
    const diff = a.tracks.filter((t) => t.song && (t.song.release || '').trim() && (t.song.release || '').trim() !== n);
    if (diff.length) w.push(`${diff.length}曲の「収録作品」がこのEP名と違います(曲の編集画面で直せます)`);
    if (n && regNames.has(n)) w.push('同じ名前のEPがすでに登録されています');
    return w;
  };
  const ok = (a) => warnings(a).length === 0;

  async function decide(a) {
    const n = nameOf(a);
    const ids = a.tracks.map((t) => t.song.id);
    // 収録作品が空欄の曲には、EP名を入れてそろえる(入っている曲は変えない)
    for (const t of a.tracks) {
      if (!(t.song.release || '').trim()) await updateDoc(doc(db, 'songs', t.song.id), { release: n });
    }
    await api('/api/admin/eps', { mode: 'save', name: n, tracks: ids, playlistId: a.id });
  }
  async function decideOne(a) {
    setBusy('d' + a.id);
    try { await decide(a); await loadAll(); } catch (e) { alert('登録できませんでした:' + e.message); }
    setBusy('');
  }
  async function decideAll() {
    const list = proposals.filter(ok);
    if (!list.length) return;
    if (!confirm(`問題のない${list.length}件のEPを、まとめて登録しますか?`)) return;
    setBusy('all');
    try { for (const a of list) await decide(a); await loadAll(); } catch (e) { alert('登録できませんでした:' + e.message); }
    setBusy('');
  }

  // ---------- 登録済みのEP ----------
  async function moveEp(i, d) {
    const list = move(eps, i, d);
    if (list === eps) return;
    setEps(list);
    try { await api('/api/admin/eps', { mode: 'order', ids: list.map((e) => e.id) }); } catch (e) { alert(e.message); loadAll(); }
  }

  async function openEdit(ep) {
    setEdit({ ep, theme: ep.theme, tracks: ep.tracks.filter((id) => byId[id]), jacket: undefined, preview: '', busy: '' });
    if (ep.hasJacket) {
      try { const r = await api('/api/admin/eps', { mode: 'get', id: ep.id }); setEdit((e) => (e && e.ep.id === ep.id ? { ...e, preview: r.image } : e)); } catch (e) { /* noop */ }
    }
  }
  async function pickJacket(e) {
    const file = e.target.files?.[0]; if (!file) return;
    setEdit((x) => ({ ...x, busy: 'img' }));
    try {
      const img = await compressImage(file, { maxSize: 900, maxBytes: 450000, quality: 0.9 });
      setEdit((x) => ({ ...x, jacket: img, preview: img, busy: '' }));
    } catch (ex) { alert(ex.message); setEdit((x) => ({ ...x, busy: '' })); }
  }
  async function saveEdit() {
    setEdit((x) => ({ ...x, busy: 'save' }));
    try {
      await api('/api/admin/eps', { mode: 'save', id: edit.ep.id, name: edit.ep.name, theme: edit.theme, tracks: edit.tracks, ...(edit.jacket !== undefined ? { image: edit.jacket } : {}) });
      setEdit(null); await loadAll();
    } catch (e) { alert('保存できませんでした:' + e.message); setEdit((x) => ({ ...x, busy: '' })); }
  }
  async function deleteEp() {
    if (!confirm(`「${edit.ep.name}」の登録を削除しますか?(曲そのものは消えません)`)) return;
    try { await api('/api/admin/eps', { mode: 'delete', id: edit.ep.id }); setEdit(null); await loadAll(); } catch (e) { alert(e.message); }
  }

  // ---------- 曲の「収録作品」はあるが、EPとして未登録のもの ----------
  const candidates = useMemo(() => {
    const map = {};
    songs.forEach((s) => { const r = (s.release || '').trim(); if (r && !regNames.has(r)) (map[r] = map[r] || []).push(s); });
    const created = (s) => s.createdAt?.seconds || 0;
    return Object.entries(map).filter(([, l]) => l.length >= 2).map(([name, l]) => ({ name, list: l.sort((a, b) => created(a) - created(b) || a.title.localeCompare(b.title)) }));
  }, [songs, regNames]);
  async function makeFromSongs(c) {
    setBusy('c' + c.name);
    try { await api('/api/admin/eps', { mode: 'save', name: c.name, tracks: c.list.map((s) => s.id) }); await loadAll(); } catch (e) { alert(e.message); }
    setBusy('');
  }

  return (
    <div>
      <p className="text-sm mb-3">Showcaseの「曲名またはEPで探す」に出すEPの情報です。曲順は、YouTubeの「K's VOX - Topic」の再生リストから読み込めます。</p>
      {err && <p className="text-sm text-ks-red mb-3">{err}</p>}

      <div className="card p-4 mb-4">
        <p className="font-bold mb-1">YouTubeの再生リストから読み込む</p>
        <p className="text-xs text-ks-sub mb-3">EPごとの曲順を読み込み、登録済みの曲と結びつけます。確認してから「決定」を押してください。</p>
        <button className="btn btn-primary w-full mb-3" disabled={!!busy} onClick={() => fetchPlaylists('')}>{busy === 'pl' ? '読み込み中…(少し時間がかかります)' : '再生リストを読み込む'}</button>
        <details className="text-xs text-ks-sub mb-1">
          <summary className="cursor-pointer">うまく出てこない時は、再生リストのURLを貼って1つずつ読み込む</summary>
          <div className="flex gap-2 mt-2">
            <input className="input flex-1" placeholder="https://music.youtube.com/playlist?list=…" value={url} onChange={(e) => setUrl(e.target.value)} />
            <button className="btn btn-ghost btn-sm" disabled={!!busy || !url.trim()} onClick={() => fetchPlaylists(url.trim())}>読み込む</button>
          </div>
        </details>

        {pls && (
          <div className="mt-3">
            <p className="text-xs text-ks-sub mb-2">{`再生リスト${plTotal}件のうち、曲が結びついたEPの候補:${proposals.length}件${skipped > 0 ? `(登録済みや該当なしの${skipped}件は省いています)` : ''}`}</p>
            {proposals.length > 0 && <button className="btn btn-dark btn-sm w-full mb-3" disabled={!!busy || !proposals.some(ok)} onClick={decideAll}>{busy === 'all' ? '登録中…' : `問題のない${proposals.filter(ok).length}件をまとめて決定`}</button>}
            {proposals.map((a) => {
              const w = warnings(a);
              return (
                <div key={a.id} className="card p-3 mb-3">
                  <label className="block text-xs font-bold text-ks-sub mb-1">EP名(曲の「収録作品」と同じ名前にします)</label>
                  <input className="input mb-1" value={names[a.id] ?? a.name} onChange={(e) => setNames({ ...names, [a.id]: e.target.value })} />
                  <p className="text-[11px] text-ks-sub mb-2">YouTube:{a.title || '(名前なし)'}</p>
                  <ol className="text-sm mb-2">
                    {a.tracks.map((t, i) => (
                      <li key={t.item.videoId} className="flex gap-2 py-0.5">
                        <span className="w-5 text-right text-ks-sub shrink-0">{i + 1}</span>
                        <span className="min-w-0 flex-1 truncate">{t.song ? baseTitle(t.song.title) : <span className="text-ks-red">⚠ {t.item.title}(未一致)</span>}</span>
                      </li>
                    ))}
                  </ol>
                  {w.map((x) => <p key={x} className="text-xs text-ks-red mb-1">・{x}</p>)}
                  <button className="btn btn-primary btn-sm w-full mt-1" disabled={!!busy || !ok(a)} onClick={() => decideOne(a)}>{busy === 'd' + a.id ? '登録中…' : 'このEPを決定'}</button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {candidates.length > 0 && (
        <div className="card p-4 mb-4">
          <p className="font-bold mb-1">曲の「収録作品」にあるが、EPとして未登録</p>
          <p className="text-xs text-ks-sub mb-3">再生リストから読み込めなかった時は、曲の登録順で作って、あとで編集画面で曲順を直せます。</p>
          {candidates.map((c) => (
            <div key={c.name} className="flex items-center gap-2 py-1.5 border-t border-ks-border first:border-t-0">
              <div className="flex-1 min-w-0"><p className="text-sm font-bold truncate">{c.name}</p><p className="text-xs text-ks-sub">{c.list.length}曲</p></div>
              <button className="btn btn-ghost btn-sm shrink-0" disabled={!!busy} onClick={() => makeFromSongs(c)}>登録順で作る</button>
            </div>
          ))}
        </div>
      )}

      <p className="font-bold mb-2">登録済みのEP({eps.length})</p>
      {!eps.length && <p className="text-sm text-ks-sub">まだ登録されていません。</p>}
      <ul className="card divide-y divide-ks-border mb-4">
        {eps.map((ep, i) => (
          <li key={ep.id} className="flex items-center gap-2 p-3">
            <div className="flex flex-col shrink-0">
              <button className="text-xs px-1 disabled:opacity-30" disabled={i === 0} onClick={() => moveEp(i, -1)} aria-label="上へ">▲</button>
              <button className="text-xs px-1 disabled:opacity-30" disabled={i === eps.length - 1} onClick={() => moveEp(i, 1)} aria-label="下へ">▼</button>
            </div>
            <button className="flex-1 min-w-0 text-left" onClick={() => openEdit(ep)}>
              <p className="font-bold text-sm truncate">{ep.name}</p>
              <p className="text-xs text-ks-sub truncate">{ep.tracks.length}曲 / {ep.theme ? ep.theme : 'テーマ未入力'}{ep.hasJacket ? '' : ' / ジャケット未登録'}</p>
            </button>
          </li>
        ))}
      </ul>
      {eps.length > 1 && <p className="text-xs text-ks-sub mb-6">▲▼で、Showcaseのドラムに並ぶEPの順番を変えられます。</p>}

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit ? edit.ep.name : ''} wide>
        {edit && (
          <div>
            <label className="block text-sm font-bold text-ks-sub mb-1">テーマの説明(短く。2〜3行まで)</label>
            <textarea className="input mb-3" rows={3} maxLength={400} value={edit.theme} onChange={(e) => setEdit({ ...edit, theme: e.target.value })} />

            <label className="block text-sm font-bold text-ks-sub mb-1">ジャケット(正方形の画像)</label>
            {edit.preview ? <img src={edit.preview} alt="" className="w-40 h-40 object-cover rounded-lg border border-ks-border mb-2" /> : <p className="text-xs text-ks-sub mb-2">未登録です(Showcaseでは1曲目のYouTubeの画像で代用します)</p>}
            <input type="file" accept="image/*" className="text-sm w-full mb-1" onChange={pickJacket} disabled={!!edit.busy} />
            {edit.preview && <button className="text-xs underline text-ks-sub mb-3" onClick={() => setEdit({ ...edit, jacket: '', preview: '' })}>ジャケットを外す</button>}

            <p className="text-sm font-bold text-ks-sub mt-3 mb-1">曲順</p>
            <ol className="mb-3">
              {edit.tracks.map((id, i) => (
                <li key={id} className="flex items-center gap-2 py-1 border-t border-ks-border first:border-t-0">
                  <span className="w-5 text-right text-ks-sub text-sm shrink-0">{i + 1}</span>
                  <span className="flex-1 min-w-0 truncate text-sm">{baseTitle(byId[id]?.title)}{byId[id]?.draft ? '(準備中)' : ''}</span>
                  <button className="text-xs px-2 disabled:opacity-30" disabled={i === 0} onClick={() => setEdit({ ...edit, tracks: move(edit.tracks, i, -1) })} aria-label="上へ">▲</button>
                  <button className="text-xs px-2 disabled:opacity-30" disabled={i === edit.tracks.length - 1} onClick={() => setEdit({ ...edit, tracks: move(edit.tracks, i, 1) })} aria-label="下へ">▼</button>
                </li>
              ))}
            </ol>

            <div className="flex gap-2">
              <button className="btn btn-ghost btn-sm" disabled={!!edit.busy} onClick={deleteEp}>削除</button>
              <button className="btn btn-primary flex-1" disabled={!!edit.busy} onClick={saveEdit}>{edit.busy === 'save' ? '保存中…' : edit.busy === 'img' ? '画像を準備中…' : '保存する'}</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
