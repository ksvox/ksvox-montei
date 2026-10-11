import { useState } from 'react';
import ReviewCard from './ReviewCard';
import { Modal } from './ui';
import { reviewDate } from '../lib/reviews';

const shortDate = (s) => {
  const [, m, d] = String(s || '').split('-').map(Number);
  return m && d ? `${m}月${d}日` : String(s || '');
};

// 振り返りを「◯月◯日分の振り返り」の一覧で表示し、タップで全文を開く
export default function ReviewList({ list, onConfirm, busyId }) {
  const [openId, setOpenId] = useState('');
  const open = list.find((r) => r.id === openId);

  async function confirmAndClose(r) {
    await onConfirm(r);
    setOpenId('');
  }

  return (
    <>
      <ul className="card divide-y divide-ks-border overflow-hidden">
        {list.map((r) => (
          <li key={r.id}>
            <button onClick={() => setOpenId(r.id)} className="press w-full flex items-center gap-3 px-4 py-3.5 text-left"
              style={r.confirmed ? { background: '#F5F5F4' } : undefined}>
              <span className="min-w-0 flex-1">
                <span className={`block font-bold text-[15px] ${r.confirmed ? 'text-stone-500' : ''}`}>{shortDate(r.date)}分の振り返り</span>
                <span className="block text-xs text-ks-sub truncate mt-0.5">{r.songTitle || '(課題曲なし)'}</span>
              </span>
              {r.confirmed
                ? <span className="shrink-0 text-[11px] font-bold text-stone-500 border border-stone-300 rounded-full px-2 py-0.5">確認済</span>
                : <span className="shrink-0 text-[11px] font-bold text-white bg-ks-gold rounded-full px-2 py-0.5">未確認</span>}
              <span className="shrink-0 text-ks-sub" aria-hidden="true">›</span>
            </button>
          </li>
        ))}
      </ul>
      <Modal open={!!open} onClose={() => setOpenId('')} title={open ? reviewDate(open.date) : ''}>
        {open && <ReviewCard r={open} onConfirm={onConfirm ? confirmAndClose : undefined} busy={busyId === open.id} />}
      </Modal>
    </>
  );
}
