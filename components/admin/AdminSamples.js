import { useEffect, useState } from 'react';
import { SAMPLE_SLOTS, SLOT_LABEL, slotLabel, parseSampleFileName, saveSampleAudio, deleteSampleAudio, saveSampleImage, loadSampleDocs } from '../../lib/samples';
import { compressImage, fileToBase64 } from '../../lib/utils';
import { Spinner } from '../ui';

const byId = Object.fromEntries(SAMPLE_SLOTS.map((s) => [s.id, s]));
const MAX_MB = 8;

export default function AdminSamples() {
  const [docs, setDocs] = useState(null);
  const [plan, setPlan] = useState(null); // 一括登録の確認
  const [busy, setBusy] = useState('');
  const [progress, setProgress] = useState('');

  const load = async () => setDocs(await loadSampleDocs());
  useEffect(() => { load().catch((e) => alert(e.message)); }, []);

  // 一括登録: ファイル名の番号から振り分ける
  function pickBulk(e) {
    const files = [...(e.target.files || [])];
    e.target.value = '';
    if (!files.length) return;
    const ok = []; const ng = [];
    files.forEach((f) => {
      const dest = parseSampleFileName(f.name);
      if (!dest) ng.push(`${f.name}(番号を読み取れません)`);
      else if (f.size > MAX_MB * 1024 * 1024) ng.push(`${f.name}(${MAX_MB}MBを超えています)`);
      else ok.push({ file: f, ...dest });
    });
    ok.sort((a, b) => (a.id + a.slot).localeCompare(b.id + b.slot));
    setPlan({ ok, ng });
  }

  async function runBulk() {
    const items = plan.ok;
    setBusy('bulk');
    const fails = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      setProgress(`登録中… ${i + 1} / ${items.length}`);
      try { await saveSampleAudio(it.id, it.slot, await fileToBase64(it.file), it.file.type || 'audio/mpeg'); }
      catch (err) { fails.push(`${it.file.name}: ${err.message}`); }
    }
    setProgress(''); setBusy(''); setPlan(null);
    await load();
    alert(fails.length ? `${items.length - fails.length}件を登録しました。\n登録できなかったもの:\n${fails.join('\n')}` : `${items.length}件を登録しました。`);
  }

  async function pickImage(id, e) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setBusy(id + '_img');
    try { await saveSampleImage(id, await compressImage(f, { maxSize: 400, maxBytes: 60000 })); await load(); }
    catch (err) { alert('保存できませんでした:' + err.message); }
    setBusy('');
  }

  async function pickAudio(id, slot, e) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > MAX_MB * 1024 * 1024) { alert(`${MAX_MB}MB以下のファイルにしてください。`); return; }
    setBusy(`${id}_${slot}`);
    try { await saveSampleAudio(id, slot, await fileToBase64(f), f.type || 'audio/mpeg'); await load(); }
    catch (err) { alert('保存できませんでした:' + err.message); }
    setBusy('');
  }

  async function removeAudio(id, slot) {
    if (!confirm(`「${slotLabel(byId[id])}」の${SLOT_LABEL[slot]}を削除しますか?`)) return;
    setBusy(`${id}_${slot}`);
    try { await deleteSampleAudio(id, slot); await load(); } catch (err) { alert(err.message); }
    setBusy('');
  }

  if (!docs) return <Spinner />;
  const audioCount = SAMPLE_SLOTS.reduce((n, s) => n + s.slots.filter((sl) => docs[s.id]?.audio?.[sl]).length, 0);
  const imageCount = SAMPLE_SLOTS.filter((s) => docs[s.id]?.image).length;

  return (
    <div>
      <p className="text-xs text-ks-sub mb-3 leading-relaxed">
        朗読見本音声のページ(/samples)と、朗読AIコーチの「見本音声を聴く」で使う音声です。
        登録状況: 音声 {audioCount}/42・ジャケット {imageCount}/22
      </p>

      <div className="card p-4 mb-4">
        <p className="font-bold text-sm mb-1">音声をまとめて登録</p>
        <p className="text-xs text-ks-sub mb-3 leading-relaxed">
          ファイル名の先頭の番号で自動的に振り分けます。「0-1」→初恋テンポ120、「0-2」→初恋テンポ90、「○-1」→その課題の音読、「○-2」→その課題の朗読。登録済みのものは差し替わります。
        </p>
        <label className={`btn btn-primary w-full ${busy ? 'opacity-50 pointer-events-none' : ''}`}>
          {busy === 'bulk' ? progress : 'MP3ファイルをまとめて選ぶ'}
          <input type="file" accept="audio/mpeg,audio/mp3,.mp3,audio/*" multiple className="hidden" onChange={pickBulk} disabled={!!busy} />
        </label>

        {plan && (
          <div className="mt-4 rounded-xl border-2 border-ks-gold bg-ks-goldlight/40 p-3">
            <p className="font-bold text-sm">登録内容の確認</p>
            <p className="text-xs text-ks-sub mt-0.5 mb-3">
              {plan.ok.length}件を登録できます{plan.ng.length ? `(登録しないファイル ${plan.ng.length}件)` : ''}。内容を確認して「この内容で登録する」を押してください。
            </p>
            <div className="flex gap-2 mb-3">
              <button className="btn btn-primary flex-1" disabled={!!busy || !plan.ok.length} onClick={runBulk}>{busy === 'bulk' ? progress : 'この内容で登録する'}</button>
              <button className="btn btn-ghost" disabled={!!busy} onClick={() => setPlan(null)}>やめる</button>
            </div>
            {plan.ok.length > 0 && (
              <ul className="text-xs bg-white border border-ks-border rounded-lg divide-y divide-ks-border max-h-64 overflow-y-auto">
                {plan.ok.map((it) => (
                  <li key={it.file.name} className="px-3 py-1.5 flex justify-between gap-2">
                    <span className="truncate">{it.file.name}</span>
                    <span className="shrink-0 font-bold">→ {slotLabel(byId[it.id])}{byId[it.id].intro ? '' : ` ${SLOT_LABEL[it.slot]}`}</span>
                  </li>
                ))}
              </ul>
            )}
            {plan.ng.length > 0 && (
              <div className="text-xs text-ks-red mt-3 max-h-40 overflow-y-auto">
                <p className="font-bold mb-1">登録しないファイル</p>
                {plan.ng.map((n) => <p key={n}>{n}</p>)}
              </div>
            )}
          </div>
        )}
      </div>

      <ul className="card divide-y divide-ks-border">
        {SAMPLE_SLOTS.map((s) => {
          const d = docs[s.id] || {};
          return (
            <li key={s.id} className="p-3 flex gap-3">
              <label className="shrink-0 cursor-pointer text-center">
                {d.image
                  ? <img src={d.image} alt="" className="w-16 h-16 rounded-lg object-cover border border-ks-border" />
                  : <span className="w-16 h-16 rounded-lg border border-dashed border-ks-border flex items-center justify-center text-[10px] text-ks-sub">画像なし</span>}
                <span className="block text-[10px] text-ks-red mt-0.5">{busy === s.id + '_img' ? '保存中…' : d.image ? '画像を変更' : '画像を選ぶ'}</span>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => pickImage(s.id, e)} disabled={!!busy} />
              </label>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate">{slotLabel(s)}</p>
                <div className="mt-1.5 space-y-1.5">
                  {s.slots.map((sl) => {
                    const has = !!d.audio?.[sl];
                    const key = `${s.id}_${sl}`;
                    return (
                      <div key={sl} className="flex items-center gap-2 text-xs">
                        <span className={`w-14 shrink-0 font-bold ${has ? 'text-emerald-700' : 'text-ks-sub'}`}>{has ? '✓' : '—'} {SLOT_LABEL[sl]}</span>
                        <label className="link cursor-pointer">
                          {busy === key ? '保存中…' : has ? '差し替え' : '登録'}
                          <input type="file" accept="audio/mpeg,audio/mp3,.mp3,audio/*" className="hidden" onChange={(e) => pickAudio(s.id, sl, e)} disabled={!!busy} />
                        </label>
                        {has && <button className="text-ks-sub underline" onClick={() => removeAudio(s.id, sl)} disabled={!!busy}>削除</button>}
                      </div>
                    );
                  })}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-ks-sub mt-2 px-1">※ジャケットはカラー版を登録してください(音読の再生時は自動でモノクロになります)。</p>

    </div>
  );
}
