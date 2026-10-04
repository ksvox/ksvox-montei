import { useEffect, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, getDocs, orderBy, query, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../../lib/firebaseClient';
import { Field, Modal, Empty } from '../ui';
import { DEFAULT_APPS } from '../../lib/constants';
import { compressImage } from '../../lib/utils';

// kind: 'videos'(レッスン備忘録)| 'appLinks'(アプリのカード)
export default function AdminLinks({ kind }) {
  const isApp = kind === 'appLinks';
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => { const s = await getDocs(query(collection(db, kind), orderBy('order'))); setItems(s.docs.map((d) => ({ id: d.id, ...d.data() }))); };
  useEffect(() => { load(); }, [kind]);

  async function save() {
    setBusy(true);
    const data = isApp
      ? { name: form.name.trim(), desc: form.desc.trim(), url: form.url.trim(), color: form.color, icon: form.icon || '', restricted: !!form.restricted }
      : { title: form.title.trim(), url: form.url.trim() };
    try {
      if (form.id) await updateDoc(doc(db, kind, form.id), data);
      else await addDoc(collection(db, kind), { ...data, order: items.length ? Math.max(...items.map((i) => i.order || 0)) + 1 : 1 });
      setForm(null); await load();
    } catch (e) { alert('保存できませんでした:' + e.message); }
    setBusy(false);
  }
  async function remove(it) {
    if (!confirm(`「${it.name || it.title}」を削除しますか?`)) return;
    await deleteDoc(doc(db, kind, it.id)); setForm(null); await load();
  }
  async function move(i, dir) {
    const j = i + dir; if (j < 0 || j >= items.length) return;
    const b = writeBatch(db);
    const arr = [...items]; [arr[i], arr[j]] = [arr[j], arr[i]];
    arr.forEach((it, k) => b.update(doc(db, kind, it.id), { order: k + 1 }));
    await b.commit(); await load();
  }
  async function seed() {
    const b = writeBatch(db);
    DEFAULT_APPS.forEach((a, k) => b.set(doc(collection(db, kind)), { ...a, url: '', icon: '', order: k + 1 }));
    await b.commit(); await load();
  }
  async function pickIcon(e) {
    const f = e.target.files?.[0]; if (!f) return;
    setForm({ ...form, icon: await compressImage(f, { maxSize: 200, maxBytes: 40000 }) });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-ks-sub">{isApp ? 'トップに並ぶアプリのカードです。' : 'YouTubeの限定公開動画のURLを登録します。'}</p>
        <button className="btn btn-primary btn-sm shrink-0" onClick={() => setForm(isApp ? { name: '', desc: '', url: '', color: '#C5A059', icon: '', restricted: false } : { title: '', url: '' })}>追加</button>
      </div>
      {!items.length ? (
        <div>
          <Empty>まだ登録がありません。</Empty>
          {isApp && <button className="btn btn-ghost w-full" onClick={seed}>K's VOXの6アプリを初期登録する(リンク先は後で入力)</button>}
        </div>
      ) : (
        <ul className="card divide-y divide-ks-border">
          {items.map((it, i) => (
            <li key={it.id} className="px-3 py-2.5 flex items-center gap-2">
              <div className="flex flex-col">
                <button className="text-xs px-2 text-ks-sub disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)} aria-label="上へ">▲</button>
                <button className="text-xs px-2 text-ks-sub disabled:opacity-30" disabled={i === items.length - 1} onClick={() => move(i, 1)} aria-label="下へ">▼</button>
              </div>
              {isApp && (it.icon ? <img src={it.icon} alt="" className="w-8 h-8 rounded-full" /> : <span className="w-8 h-8 rounded-full" style={{ background: it.color }} />)}
              <button className="flex-1 min-w-0 text-left" onClick={() => setForm({ ...it })}>
                <span className="block text-sm font-bold truncate">{it.name || it.title}{isApp && it.restricted && <span className="ml-1.5 text-[10px] font-bold text-white bg-ks-red rounded-full px-1.5 py-0.5 align-middle">生徒限定</span>}</span>
                <span className={`block text-xs truncate ${it.url ? 'text-ks-sub' : 'text-ks-red'}`}>{it.url || 'リンク先が未入力です'}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? '編集' : '追加'}>
        {form && (
          <div>
            {isApp ? (
              <>
                <Field label="アプリ名"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
                <Field label="説明文"><input className="input" value={form.desc} onChange={(e) => setForm({ ...form, desc: e.target.value })} /></Field>
                <Field label="リンク先" note="門弟アプリ内のページは /samples(朗読見本音声)のように「/」から入力します。"><input className="input" placeholder="https://..." value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} /></Field>
                <Field label="カードの色"><input type="color" className="w-16 h-10 rounded border border-ks-border" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} /></Field>
                <Field label="生徒限定">
                  <label className="flex items-start gap-2 text-sm">
                    <input type="checkbox" className="mt-1" checked={!!form.restricted} onChange={(e) => setForm({ ...form, restricted: e.target.checked })} />
                    <span>門弟アプリ経由でのみ開けるようにする<span className="block text-xs text-ks-sub">課題曲AIソムリエ・朗読AIコーチ・Song Ripple用。ブックマークからは開けなくなります。</span></span>
                  </label>
                </Field>
                <Field label="アイコン画像">
                  <div className="flex items-center gap-3">
                    {form.icon ? <img src={form.icon} alt="" className="w-12 h-12 rounded-full" /> : <span className="w-12 h-12 rounded-full" style={{ background: form.color }} />}
                    <input type="file" accept="image/*" className="text-sm" onChange={pickIcon} />
                  </div>
                </Field>
              </>
            ) : (
              <>
                <Field label="タイトル"><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
                <Field label="YouTubeのURL"><input className="input" placeholder="https://youtu.be/..." value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} /></Field>
              </>
            )}
            <div className="flex gap-2">
              {form.id && <button className="btn btn-ghost text-ks-red" onClick={() => remove(form)}>削除</button>}
              <button className="btn btn-primary flex-1" disabled={busy || !(form.name || form.title || '').trim()} onClick={save}>{busy ? '保存中…' : '保存する'}</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
