// Showcase・コエシルのトップに出すバナー(画像とリンク先)
import { useEffect, useState } from 'react';
import { api } from '../../lib/firebaseClient';
import { compressImage } from '../../lib/utils';
import { BANNER_SLOTS } from '../../lib/constants';

function Slot({ slot, initial, onSaved }) {
  const [f, setF] = useState({ link: initial?.link || '', active: initial ? initial.active : true, image: undefined });
  const [busy, setBusy] = useState('');
  const [note, setNote] = useState('');
  const preview = f.image !== undefined ? f.image : initial?.image || '';

  async function pick(e) {
    const file = e.target.files?.[0]; if (!file) return;
    setBusy('img'); setNote('');
    try { setF({ ...f, image: await compressImage(file, { maxSize: 1200, maxBytes: 450000, quality: 0.9 }) }); }
    catch (ex) { alert(ex.message); }
    setBusy('');
  }
  async function save() {
    if (!preview) { setNote('画像を選んでください。'); return; }
    if (!/^https?:\/\//.test(f.link.trim())) { setNote('リンク先は https:// から始まるアドレスを入れてください。'); return; }
    setBusy('save'); setNote('');
    try {
      await api('/api/admin/banners', { slot: slot.key, link: f.link.trim(), active: f.active, ...(f.image !== undefined ? { image: f.image } : {}) });
      setNote('保存しました。各アプリには1〜2分ほどで反映されます。');
      onSaved && onSaved();
    } catch (e) { setNote('保存できませんでした:' + e.message); }
    setBusy('');
  }

  return (
    <div className="card p-4 mb-4">
      <p className="font-bold mb-1">{slot.label}</p>
      <p className="text-xs text-ks-sub mb-3">{slot.hint}。横長3:1(1200×400など)の画像がきれいに表示されます。</p>
      {preview
        ? <img src={preview} alt="" className="w-full rounded-lg mb-2 border border-ks-border" style={{ aspectRatio: '3 / 1', objectFit: 'cover' }} />
        : <div className="w-full rounded-lg mb-2 border border-dashed border-ks-border grid place-items-center text-xs text-ks-sub" style={{ aspectRatio: '3 / 1' }}>画像が未登録です(各アプリに最初から入っているバナーが表示されます)</div>}
      <input type="file" accept="image/*" className="text-sm w-full mb-3" onChange={pick} disabled={!!busy} />
      <label className="block text-sm font-bold text-ks-sub mb-1">リンク先(タップすると別の窓で開きます)</label>
      <input className="input mb-3" placeholder="https://…" value={f.link} onChange={(e) => setF({ ...f, link: e.target.value })} />
      <label className="flex items-center gap-2 text-sm mb-3">
        <input type="checkbox" className="w-5 h-5 accent-[#E54D26]" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />
        表示する(チェックを外すと、最初から入っているバナーに戻ります)
      </label>
      <button className="btn btn-primary w-full" disabled={!!busy} onClick={save}>{busy === 'save' ? '保存中…' : busy === 'img' ? '画像を準備中…' : '保存する'}</button>
      {note && <p className="text-xs mt-2 text-ks-sub">{note}</p>}
    </div>
  );
}

export default function AdminBanners() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  function load() { api('/api/admin/banners', { mode: 'list' }).then((r) => setData(r.banners || {})).catch((e) => setErr(e.message)); }
  useEffect(load, []);
  return (
    <div>
      <p className="text-sm mb-4">一般公開アプリ(Showcase・コエシル)のトップ画面の下に出すバナーです。お互いのアプリの宣伝に使います。</p>
      {err && <p className="text-sm text-ks-red mb-3">{err}</p>}
      {!data && !err && <p className="text-sm text-ks-sub">読み込み中…</p>}
      {data && BANNER_SLOTS.map((s) => <Slot key={s.key} slot={s} initial={data[s.key]} onSaved={load} />)}
    </div>
  );
}
