// コエシルの利用状況と、研究用のタイプ別集計(男女別)
import { useEffect, useState } from 'react';
import { api } from '../../lib/firebaseClient';

const TYPES = [['ITA', 'イタリアン'], ['DEU', 'ジャーマン'], ['USA', 'アメリカン'], ['FRA', 'フレンチ'], ['GBR', 'ブリティッシュ'], ['KOR', 'コリアン'], ['JPN', 'ジャパニーズ']];
const RADAR = ['ピッチ', 'リズム', 'ロングトーン', '立ち上がり', 'つながり', '母音の響き'];
const VOWELS = ['い', 'え', 'あ', 'お'];

function jstToday() { return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10); }
const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);

function Num({ label, value, sub }) {
  return (
    <div className="card p-3 text-center">
      <p className="text-xs text-ks-sub">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      {sub ? <p className="text-xs text-ks-sub">{sub}</p> : null}
    </div>
  );
}

function GenderTable({ title, rows }) {
  const sum = rows.reduce((a, r) => a + (r.n || 0), 0);
  const cell = 'px-2 py-1.5 text-right whitespace-nowrap';
  return (
    <div className="card p-4 mb-4">
      <p className="font-bold mb-1">{title}(合計 {sum}人)</p>
      <p className="text-xs text-ks-sub mb-3">基礎力・母音の個性は0〜100、拍感覚は拍からのズレの平均(秒)。小さいほど正確です。</p>
      <div className="overflow-x-auto -mx-2">
        <table className="text-sm min-w-full">
          <thead>
            <tr className="text-xs text-ks-sub border-b border-ks-border">
              <th className="px-2 py-1.5 text-left">タイプ</th><th className={cell}>人数</th><th className={cell}>比率</th>
              {RADAR.map((r) => <th key={r} className={cell}>{r}</th>)}
              <th className={cell}>拍感覚</th>
              {VOWELS.map((v) => <th key={v} className={cell}>母音{v}</th>)}
            </tr>
          </thead>
          <tbody>
            {TYPES.map(([code, name]) => {
              const r = rows.find((x) => x.type === code) || {};
              const n = r.n || 0;
              const avg = (k, d = n) => (d ? Math.round((r[k] / d) * 100) : '—');
              return (
                <tr key={code} className="border-b border-ks-border last:border-0">
                  <td className="px-2 py-1.5 font-bold whitespace-nowrap">{name}</td>
                  <td className={cell}>{n}</td>
                  <td className={cell}>{pct(n, sum)}%</td>
                  {RADAR.map((_, i) => <td key={i} className={cell}>{avg(`r${i}`)}</td>)}
                  <td className={cell}>{r.tmN ? (r.tmSum / r.tmN / 1000).toFixed(2) : '—'}</td>
                  {VOWELS.map((_, i) => <td key={i} className={cell}>{avg(`v${i}`, r.vN)}</td>)}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AdminKoeshiru() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  function load() { setErr(''); api('/api/admin/koeshiru-stats', {}).then(setData).catch((e) => setErr(e.message)); }
  useEffect(load, []);

  async function reset() {
    setBusy(true);
    try { await api('/api/admin/koeshiru-stats', { mode: 'reset' }); setConfirm(false); load(); }
    catch (e) { alert('リセットできませんでした:' + e.message); }
    setBusy(false);
  }

  if (err) return <p className="text-sm text-ks-red">{err}</p>;
  if (!data) return <p className="text-sm text-ks-sub">読み込み中…</p>;
  const today = jstToday(), month = today.slice(0, 7);
  const t = data.days.find((d) => d.date === today) || { diag: 0, trial: 0 };
  const m = data.days.filter((d) => d.date.startsWith(month)).reduce((a, d) => ({ diag: a.diag + d.diag, trial: a.trial + d.trial }), { diag: 0, trial: 0 });
  const tot = data.total;

  return (
    <div>
      <p className="text-sm mb-4">歌声診断アプリ「コエシル」の利用状況です。一人ひとりの結果は保存せず、タイプ別の合計だけを集計しています(テスト用の ?debug=1 での診断は数えません)。</p>

      <p className="font-bold mb-2">診断回数・お試しボタン</p>
      <div className="grid grid-cols-3 gap-2 mb-2">
        <Num label="今日の診断" value={t.diag} sub={`お試し ${t.trial}`} />
        <Num label="今月の診断" value={m.diag} sub={`お試し ${m.trial}`} />
        <Num label="合計の診断" value={tot.diag} sub={`お試し ${tot.trial}`} />
      </div>
      <p className="text-xs text-ks-sub mb-5">お試しボタンのタップ率(合計):{pct(tot.trial, tot.diag)}%</p>

      <GenderTable title="女性" rows={data.types.filter((x) => x.g === 'female')} />
      <GenderTable title="男性" rows={data.types.filter((x) => x.g === 'male')} />

      {data.days.length ? (
        <div className="card p-4 mb-4">
          <p className="font-bold mb-2">日別(新しい順・最大30日)</p>
          <ul className="text-sm">
            {data.days.slice(0, 30).map((d) => (
              <li key={d.date} className="flex justify-between py-1 border-b border-ks-border last:border-0">
                <span>{d.date}</span><span>診断 {d.diag} ・ お試し {d.trial}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="card p-4">
        <p className="font-bold mb-1">集計のリセット</p>
        <p className="text-xs text-ks-sub mb-3">診断回数・お試しボタンの回数・タイプ別の集計を、すべてゼロに戻します。元には戻せません。</p>
        {!confirm ? (
          <button className="btn btn-dark w-full" onClick={() => setConfirm(true)}>集計をリセットする</button>
        ) : (
          <div className="flex gap-2">
            <button className="btn btn-primary flex-1" disabled={busy} onClick={reset}>{busy ? 'リセット中…' : '本当にリセットする'}</button>
            <button className="btn flex-1 border border-ks-border" disabled={busy} onClick={() => setConfirm(false)}>やめる</button>
          </div>
        )}
      </div>
    </div>
  );
}
