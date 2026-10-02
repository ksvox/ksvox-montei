import { useEffect } from 'react';
import { computeRank } from '../lib/rank';

export function Avatar({ user, size = 40, name }) {
  const label = (user?.nickname || name || '?').slice(0, 1);
  if (user?.icon) {
    return <img src={user.icon} alt="" className="rounded-full object-cover shrink-0 border border-ks-border" style={{ width: size, height: size }} />;
  }
  return (
    <div className="rounded-full shrink-0 flex items-center justify-center bg-ks-goldlight text-ks-gold font-serif font-bold border border-ks-border"
      style={{ width: size, height: size, fontSize: size * 0.42 }}>{label}</div>
  );
}

export function displayName(user, fallback) {
  return user?.nickname || fallback || '名前未登録';
}

export function RankSeal({ user }) {
  const r = computeRank(user?.className, user?.joinYm);
  if (!r) return null;
  return <span className="seal">{r}</span>;
}

export function Modal({ open, onClose, title, children, wide }) {
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
      <div className={`bg-ks-bg w-full ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'} max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl shadow-xl`}
        onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-ks-bg/95 backdrop-blur border-b border-ks-border px-5 py-3 flex items-center justify-between z-10">
          <h3 className="font-serif font-bold text-lg">{title}</h3>
          <button onClick={onClose} className="w-9 h-9 rounded-full hover:bg-stone-200 text-xl leading-none" aria-label="閉じる">×</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Section({ title, right, children, className = '' }) {
  return (
    <section className={`mb-7 ${className}`}>
      {(title || right) && (
        <div className="flex items-end justify-between mb-3 px-1">
          {title && <h2 className="font-serif font-bold text-lg text-ks-text">{title}</h2>}
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

export function Chip({ active, onClick, children }) {
  return (
    <button type="button" onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${active ? 'bg-ks-text text-white border-ks-text' : 'bg-white text-ks-text border-ks-border hover:border-ks-gold'}`}>
      {children}
    </button>
  );
}

export function Field({ label, children, note }) {
  return (
    <label className="block mb-4">
      <span className="block text-sm font-bold text-ks-sub mb-1.5">{label}</span>
      {children}
      {note && <span className="block text-xs text-ks-sub mt-1">{note}</span>}
    </label>
  );
}

export function Empty({ children }) {
  return <p className="text-sm text-ks-sub text-center py-6">{children}</p>;
}

export function Stars({ value, onChange }) {
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" disabled={!onChange} onClick={() => onChange && onChange(n)}
          className={`${n <= value ? 'text-ks-gold' : 'text-stone-300'} ${onChange ? 'text-2xl' : 'text-base cursor-default'}`}>★</button>
      ))}
    </span>
  );
}

export function Spinner({ label = '読み込み中…' }) {
  return <div className="py-16 text-center text-ks-sub text-sm">{label}</div>;
}
