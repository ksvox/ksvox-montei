import { useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db, api } from '../../lib/firebaseClient';
import { useApp } from '../AppContext';
import { Field } from '../ui';
import { compressImage } from '../../lib/utils';

export default function AdminSettings() {
  const app = useApp();
  const [f, setF] = useState({ ...app.settings });
  const [busy, setBusy] = useState('');
  const [note, setNote] = useState('');
  const [usage, setUsage] = useState(null);

  async function pickBanner(e) {
    const file = e.target.files?.[0]; if (!file) return;
    setBusy('img');
    try { setF({ ...f, bannerImage: await compressImage(file, { maxSize: 1400, maxBytes: 350000 }) }); } catch (ex) { alert(ex.message); }
    setBusy('');
  }
  async function save() {
    setBusy('save'); setNote('');
    try { await setDoc(doc(db, 'settings', 'app'), f, { merge: true }); app.setSettings({ ...app.settings, ...f }); setNote('保存しました。'); }
    catch (e) { setNote('保存できませんでした:' + e.message); }
    setBusy('');
  }
  async function measure() {
    setBusy('usage');
    try { setUsage(await api('/api/admin/usage')); } catch (e) { alert(e.message); }
    setBusy('');
  }
  const mb = (n) => (n / 1024 / 1024).toFixed(1);

  return (
    <div>
      <Field label="トップバナー画像" note="スマホで撮った写真もそのまま選べます(自動で軽くします)。">
        {f.bannerImage && <img src={f.bannerImage} alt="" className="w-full h-32 object-cover rounded-xl mb-2" />}
        <div className="flex gap-2 items-center">
          <input type="file" accept="image/*" className="text-sm flex-1" onChange={pickBanner} />
          {f.bannerImage && <button className="btn btn-ghost btn-sm" onClick={() => setF({ ...f, bannerImage: '' })}>外す</button>}
        </div>
      </Field>
      <details className="mb-4 card p-4">
        <summary className="text-sm font-bold cursor-pointer">予約・PayPayのリンク先(通常は変更不要)</summary>
        <div className="mt-4">
          <Field label="LINE予約ページ"><input className="input" value={f.reserveUrl} onChange={(e) => setF({ ...f, reserveUrl: e.target.value })} /></Field>
          <Field label="PayPayを開くアドレス"><input className="input" value={f.paypayUrl} onChange={(e) => setF({ ...f, paypayUrl: e.target.value })} /></Field>
          <Field label="PayPay送金先ID"><input className="input" value={f.paypayId} onChange={(e) => setF({ ...f, paypayId: e.target.value })} /></Field>
        </div>
      </details>
      {note && <p className="text-sm text-emerald-700 mb-3">{note}</p>}
      <button className="btn btn-primary w-full" disabled={!!busy} onClick={save}>{busy === 'save' ? '保存中…' : '設定を保存する'}</button>

      <div className="card p-4 mt-7">
        <p className="font-bold mb-1">データベース使用量</p>
        <p className="text-xs text-ks-sub mb-3">無料枠は1GBです。計測には少し時間がかかります。</p>
        {usage && (
          <div className="mb-3">
            <div className="h-3 rounded-full bg-stone-200 overflow-hidden"><div className="h-full bg-ks-gold" style={{ width: `${Math.max(1, (usage.total / usage.limit) * 100)}%` }} /></div>
            <p className="text-sm mt-2 font-bold">約{mb(usage.total)}MB / 1024MB({((usage.total / usage.limit) * 100).toFixed(1)}%)</p>
            <p className="text-xs text-ks-sub mt-1">楽曲・歌詞 {mb(usage.parts.songs)}MB/朗読見本 {mb(usage.parts.samples || 0)}MB/歌詞カード保管庫 {mb(usage.parts.vault)}MB/会員・カレンダー {mb(usage.parts.members)}MB/投稿 {mb(usage.parts.posts)}MB/その他 {mb(usage.parts.other)}MB</p>
          </div>
        )}
        <button className="btn btn-ghost btn-sm" disabled={!!busy} onClick={measure}>{busy === 'usage' ? '計測中…' : '計測する'}</button>
      </div>
    </div>
  );
}
