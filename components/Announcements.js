import { useState } from 'react';
import { Modal, Empty } from './ui';
import { fmtDate } from '../lib/utils';

export function sortAnnouncements(list) {
  return [...list].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
}

export default function AnnouncementList({ items, limit }) {
  const [open, setOpen] = useState(null);
  const list = sortAnnouncements(items).slice(0, limit || items.length);
  if (!list.length) return <Empty>お知らせはまだありません。</Empty>;
  return (
    <>
      <ul className="card divide-y divide-ks-border">
        {list.map((a) => (
          <li key={a.id}>
            <button className="w-full text-left px-4 py-3.5 flex gap-3 items-start" onClick={() => setOpen(a)}>
              <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${a.important ? 'bg-ks-red' : 'bg-ks-gold'}`} />
              <span className="flex-1 min-w-0">
                <span className="flex flex-wrap gap-1.5 mb-1">
                  {a.pinned && <span className="badge">ピン留め</span>}
                  {a.important && <span className="badge" style={{ background: '#FDECE7', color: '#C93C18', borderColor: '#F6C9BC' }}>重要</span>}
                </span>
                <span className="block font-bold leading-snug">{a.title}</span>
                <span className="block text-xs text-ks-sub mt-1">{fmtDate(a.createdAt)}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <Modal open={!!open} onClose={() => setOpen(null)} title="お知らせ">
        {open && (
          <div>
            <p className="text-xs text-ks-sub mb-2">{fmtDate(open.createdAt, true)}</p>
            <h3 className="font-serif font-bold text-xl mb-4 leading-snug">{open.title}</h3>
            <p className="whitespace-pre-wrap leading-relaxed text-[15px]">{open.body}</p>
            {open.url && <a href={open.url} target="_blank" rel="noreferrer" className="btn btn-ghost w-full mt-5">リンクを開く</a>}
          </div>
        )}
      </Modal>
    </>
  );
}
