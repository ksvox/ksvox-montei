import { reviewDate } from '../lib/reviews';

const SECTIONS = [['done', '今日やったこと'], ['next', '次回・宿題']];

// 振り返り1件分(確認済は灰色表示)
export default function ReviewCard({ r, onConfirm, busy }) {
  const gray = !!r.confirmed;
  return (
    <article className={`card p-4 ${gray ? 'bg-stone-100 border-stone-200' : 'border-ks-gold'}`} style={gray ? { filter: 'grayscale(1)', opacity: 0.75 } : undefined}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-ks-sub">{reviewDate(r.date)}</p>
          <h3 className="font-bold text-[16px] leading-snug mt-0.5">{r.songTitle || '(課題曲なし)'}</h3>
        </div>
        {gray && <span className="shrink-0 text-[11px] font-bold text-stone-500 border border-stone-300 rounded-full px-2 py-0.5">確認済</span>}
      </div>
      <div className="mt-3 rounded-xl bg-white/70 border border-ks-border p-3">
        <p className="text-xs font-bold text-ks-sub mb-2">今日の振り返り</p>
        {SECTIONS.map(([k, label]) => (
          <div key={k} className="mb-2 last:mb-0">
            <p className="text-xs font-bold" style={{ color: '#8A6B2E' }}>{label}</p>
            {(r[k] || []).length
              ? <ul className="list-disc pl-5 text-sm leading-relaxed">{r[k].map((t, i) => <li key={i}>{t}</li>)}</ul>
              : <p className="text-sm text-ks-sub">(なし)</p>}
          </div>
        ))}
      </div>
      {!gray && onConfirm && (
        <button className="btn btn-dark btn-sm w-full mt-3" disabled={busy} onClick={() => onConfirm(r)}>{busy ? '保存中…' : '確認済にする'}</button>
      )}
    </article>
  );
}
