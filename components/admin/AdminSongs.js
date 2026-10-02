import { useEffect, useMemo, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, getDocs, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebaseClient';
import { Chip, Field, Modal, Empty } from '../ui';
import { GENRES, VOCALS, MOODS } from '../../lib/constants';
import { savePdf } from '../../lib/songPdf';
import { fileToBase64, normKey } from '../../lib/utils';

const blank = { title: '', recommended: false, easy: false, songUrl: '', genres: [], vocal: '', moods: [], range: '' };
const tg = (l, v) => (l.includes(v) ? l.filter((x) => x !== v) : [...l, v]);

export default function AdminSongs() {
  const [songs, setSongs] = useState([]);
  const [q, setQ] = useState('');
  const [form, setForm] = useState(null);
  const [pdf, setPdf] = useState(null);
  const [busy, setBusy] = useState('');
  const [report, setReport] = useState('');

  const load = async () => { const s = await getDocs(collection(db, 'songs')); setSongs(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.title.localeCompare(b.title))); };
  useEffect(() => { load(); }, []);
  const list = useMemo(() => songs.filter((s) => !q || s.title.toLowerCase().includes(q.toLowerCase())), [songs, q]);

  async function save() {
    setBusy('save');
    const data = { title: form.title.trim(), recommended: form.recommended, easy: form.easy, songUrl: form.songUrl.trim(), genres: form.genres, vocal: form.vocal, moods: form.moods, range: form.range.trim() };
    try {
      let id = form.id;
      if (id) await updateDoc(doc(db, 'songs', id), data);
      else { const r = await addDoc(collection(db, 'songs'), { ...data, hasPdf: false, createdAt: serverTimestamp() }); id = r.id; }
      if (pdf) { await savePdf(id, await fileToBase64(pdf)); await updateDoc(doc(db, 'songs', id), { hasPdf: true }); }
      setForm(null); setPdf(null); await load();
    } catch (e) { alert('保存できませんでした:' + e.message); }
    setBusy('');
  }
  async function remove(s) {
    if (!confirm(`「${s.title}」を削除しますか?(歌詞PDFも消えます)`)) return;
    const c = await getDocs(collection(db, 'songs', s.id, 'pdf'));
    for (const d of c.docs) await deleteDoc(d.ref);
    await deleteDoc(doc(db, 'songs', s.id)); setForm(null); await load();
  }
  async function bulk(e) {
    const files = [...(e.target.files || [])]; if (!files.length) return;
    setBusy('bulk'); setReport('');
    let ok = 0; const miss = [];
    for (const f of files) {
      const k = normKey(f.name);
      const hit = songs.find((s) => normKey(s.title) === k) || songs.find((s) => k && normKey(s.title).startsWith(k)) || songs.find((s) => k && k.startsWith(normKey(s.title).slice(0, 8)) && normKey(s.title).length >= 8);
      if (!hit) { miss.push(f.name); continue; }
      try { await savePdf(hit.id, await fileToBase64(f)); await updateDoc(doc(db, 'songs', hit.id), { hasPdf: true }); ok++; }
      catch (ex) { miss.push(`${f.name}(${ex.message})`); }
    }
    setReport(`${ok}件を登録しました。${miss.length ? `\n曲と結びつけられなかったファイル:\n${miss.join('\n')}` : ''}`);
    e.target.value = ''; setBusy(''); await load();
  }

  return (
    <div>
      <div className="flex gap-2 mb-3">
        <input className="input" placeholder="曲名で探す" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn btn-primary btn-sm shrink-0" onClick={() => { setForm({ ...blank }); setPdf(null); }}>新規登録</button>
      </div>
      <label className="btn btn-ghost btn-sm w-full mb-2 cursor-pointer">{busy === 'bulk' ? '登録中…' : '歌詞PDFをまとめて登録(ファイル名で曲と自動結びつけ)'}
        <input type="file" accept="application/pdf" multiple className="hidden" onChange={bulk} disabled={!!busy} />
      </label>
      {report && <p className="text-xs whitespace-pre-wrap bg-white border border-ks-border rounded-xl p-3 mb-3">{report}</p>}
      <p className="text-xs text-ks-sub mb-2">{songs.length}曲(PDFなし:{songs.filter((s) => !s.hasPdf).length}曲)</p>
      {!list.length ? <Empty>曲がありません。</Empty> : (
        <ul className="card divide-y divide-ks-border">
          {list.map((s) => (
            <li key={s.id}><button className="w-full text-left px-4 py-2.5 flex items-center gap-2" onClick={() => { setForm({ ...blank, ...s }); setPdf(null); }}>
              <span className="flex-1 text-sm font-bold">{s.title}</span>
              {!s.hasPdf && <span className="text-[10px] text-ks-red font-bold">PDFなし</span>}
            </button></li>
          ))}
        </ul>
      )}
      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? '曲を編集' : '曲を登録'}>
        {form && (
          <div>
            <Field label="曲名"><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
            <div className="flex gap-5 mb-4 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" className="w-5 h-5 accent-[#E54D26]" checked={form.recommended} onChange={(e) => setForm({ ...form, recommended: e.target.checked })} />おすすめ</label>
              <label className="flex items-center gap-2"><input type="checkbox" className="w-5 h-5 accent-[#E54D26]" checked={form.easy} onChange={(e) => setForm({ ...form, easy: e.target.checked })} />歌いやすい</label>
            </div>
            <Field label="楽曲URL(外部リンク)"><input className="input" value={form.songUrl} onChange={(e) => setForm({ ...form, songUrl: e.target.value })} /></Field>
            <Field label="ジャンル(複数選択可)"><div className="flex flex-wrap gap-2">{GENRES.map((g) => <Chip key={g} active={form.genres.includes(g)} onClick={() => setForm({ ...form, genres: tg(form.genres, g) })}>{g}</Chip>)}</div></Field>
            <Field label="ボーカル"><div className="flex gap-2">{VOCALS.map((v) => <Chip key={v} active={form.vocal === v} onClick={() => setForm({ ...form, vocal: v })}>{v}</Chip>)}</div></Field>
            <Field label="雰囲気(複数選択可)"><div className="flex flex-wrap gap-2">{MOODS.map((m) => <Chip key={m} active={form.moods.includes(m)} onClick={() => setForm({ ...form, moods: tg(form.moods, m) })}>{m}</Chip>)}</div></Field>
            <Field label="音域レンジ"><input className="input" placeholder="例:A2-A4" value={form.range} onChange={(e) => setForm({ ...form, range: e.target.value })} /></Field>
            <Field label="歌詞PDF" note={form.hasPdf ? '登録済み。選び直すと差し替えます。' : '未登録'}><input type="file" accept="application/pdf" className="block w-full text-sm" onChange={(e) => setPdf(e.target.files?.[0] || null)} /></Field>
            <div className="flex gap-2">
              {form.id && <button className="btn btn-ghost text-ks-red" onClick={() => remove(form)}>削除</button>}
              <button className="btn btn-primary flex-1" disabled={!!busy || !form.title.trim()} onClick={save}>{busy === 'save' ? '保存中…' : '保存する'}</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
