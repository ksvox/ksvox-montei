import { useEffect, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, getDocs, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebaseClient';
import { useApp } from './AppContext';
import { Empty, Field, Modal } from './ui';
import { base64ToBlob, compressImage, downloadBlob, safeFileName, ymd } from '../lib/utils';

const blank = () => ({ title: '', artist: '', doneDate: ymd(new Date()), image: '' });

export default function Vault() {
  const app = useApp();
  const uid = app.user.uid;
  const [items, setItems] = useState([]);
  const [sel, setSel] = useState({});
  const [form, setForm] = useState(null);
  const [view, setView] = useState(null);
  const [busy, setBusy] = useState('');

  const load = async () => {
    const s = await getDocs(collection(db, 'users', uid, 'vault'));
    setItems(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (b.doneDate || '').localeCompare(a.doneDate || '')));
  };
  useEffect(() => { load(); }, []);

  async function pick(e) {
    const f = e.target.files?.[0]; if (!f) return;
    setBusy('image');
    try { setForm({ ...form, image: await compressImage(f, { maxSize: 2000, maxBytes: 600000, quality: 0.85 }) }); }
    catch (ex) { alert(ex.message); }
    setBusy('');
  }
  async function save() {
    setBusy('save');
    const data = { title: form.title.trim(), artist: form.artist.trim(), doneDate: form.doneDate, image: form.image };
    try {
      if (form.id) await updateDoc(doc(db, 'users', uid, 'vault', form.id), data);
      else await addDoc(collection(db, 'users', uid, 'vault'), { ...data, createdAt: serverTimestamp() });
      setForm(null); await load();
    } catch (e) { alert('保存できませんでした:' + e.message); }
    setBusy('');
  }
  async function remove(it) {
    if (!confirm(`「${it.title}」を保管庫から削除しますか?`)) return;
    await deleteDoc(doc(db, 'users', uid, 'vault', it.id)); setView(null); await load();
  }
  const fname = (it) => `${it.doneDate || 'no-date'}_${safeFileName(it.title)}.jpg`;
  const blobOf = (it) => base64ToBlob(it.image.split(',')[1], 'image/jpeg');

  async function download(list) {
    if (!list.length) return;
    setBusy('dl');
    try {
      if (list.length === 1) downloadBlob(blobOf(list[0]), fname(list[0]));
      else {
        const JSZip = (await import('jszip')).default;
        const zip = new JSZip();
        const used = {};
        list.forEach((it) => {
          const base = fname(it);
          used[base] = (used[base] || 0) + 1;
          const n = used[base] > 1 ? base.replace(/\.jpg$/, `_${used[base]}.jpg`) : base;
          zip.file(n, it.image.split(',')[1], { base64: true });
        });
        downloadBlob(await zip.generateAsync({ type: 'blob' }), `歌詞カード保管庫_${ymd(new Date())}.zip`);
      }
    } catch (e) { alert('ダウンロードできませんでした:' + e.message); }
    setBusy('');
  }

  const chosen = items.filter((it) => sel[it.id]);
  const allOn = items.length > 0 && chosen.length === items.length;
  return (
    <section className="mb-7">
      <div className="flex items-end justify-between mb-1 px-1">
        <h2 className="font-serif font-bold text-lg">歌詞カード保管庫</h2>
        <button className="btn btn-primary btn-sm" onClick={() => setForm(blank())}>追加</button>
      </div>
      <p className="text-xs text-ks-sub mb-3 px-1">仕上げた課題曲の歌詞カードを写真で保存できます。自分だけが見られます。</p>
      {!items.length ? <Empty>まだ保存された歌詞カードはありません。</Empty> : (
        <>
          <div className="flex items-center justify-between mb-2 px-1 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" className="w-5 h-5 accent-[#E54D26]" checked={allOn} onChange={() => setSel(allOn ? {} : Object.fromEntries(items.map((i) => [i.id, true])))} />すべて選択</label>
            <button className="btn btn-dark btn-sm" disabled={!chosen.length || busy === 'dl'} onClick={() => download(chosen)}>{busy === 'dl' ? '準備中…' : `ダウンロード(${chosen.length})`}</button>
          </div>
          <ul className="card divide-y divide-ks-border">
            {items.map((it) => (
              <li key={it.id} className="flex items-center gap-3 px-3 py-2.5">
                <input type="checkbox" className="w-5 h-5 accent-[#E54D26] shrink-0" checked={!!sel[it.id]} onChange={() => setSel({ ...sel, [it.id]: !sel[it.id] })} aria-label={it.title} />
                <button className="flex items-center gap-3 flex-1 min-w-0 text-left" onClick={() => setView(it)}>
                  {it.image ? <img src={it.image} alt="" className="w-12 h-14 object-cover rounded-md border border-ks-border" /> : <span className="w-12 h-14 rounded-md bg-stone-100" />}
                  <span className="min-w-0"><span className="block font-bold truncate">{it.title}</span><span className="block text-xs text-ks-sub truncate">{it.artist}</span><span className="block text-xs text-ks-sub">仕上げ:{it.doneDate}</span></span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <Modal open={!!view} onClose={() => setView(null)} title={view?.title || ''} wide>
        {view && (
          <div>
            <p className="text-sm text-ks-sub mb-3">{view.artist}・仕上げ:{view.doneDate}</p>
            {view.image && <img src={view.image} alt={view.title} className="w-full rounded-lg border border-ks-border" style={{ touchAction: 'pinch-zoom' }} />}
            <div className="flex gap-2 mt-4">
              <button className="btn btn-ghost text-ks-red" onClick={() => remove(view)}>削除</button>
              <button className="btn btn-ghost" onClick={() => { setForm({ ...view }); setView(null); }}>編集</button>
              <button className="btn btn-dark flex-1" onClick={() => download([view])}>ダウンロード</button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? '歌詞カードを編集' : '歌詞カードを追加'}>
        {form && (
          <div>
            <Field label="曲名"><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
            <Field label="アーティスト名"><input className="input" value={form.artist} onChange={(e) => setForm({ ...form, artist: e.target.value })} /></Field>
            <Field label="仕上げた年月日"><input type="date" className="input" value={form.doneDate} onChange={(e) => setForm({ ...form, doneDate: e.target.value })} /></Field>
            <Field label="写真(1枚)" note="手書きの文字が読める画質のまま、自動で軽くして保存します。">
              <input type="file" accept="image/*" className="block w-full text-sm" onChange={pick} />
            </Field>
            {busy === 'image' && <p className="text-sm text-ks-sub mb-3">画像を準備中…</p>}
            {form.image && <img src={form.image} alt="" className="w-full rounded-lg border border-ks-border mb-4" />}
            <button className="btn btn-primary w-full" disabled={!!busy || !form.title.trim() || !form.image} onClick={save}>{busy === 'save' ? '保存中…' : '保存する'}</button>
          </div>
        )}
      </Modal>
    </section>
  );
}
