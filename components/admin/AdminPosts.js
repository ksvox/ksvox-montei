import { useEffect, useState } from 'react';
import { collection, deleteDoc, doc, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebaseClient';
import { useApp } from '../AppContext';
import { Chip, Empty, displayName } from '../ui';
import { fmtDate } from '../../lib/utils';

export default function AdminPosts() {
  const app = useApp();
  const [kind, setKind] = useState('forum');
  const [items, setItems] = useState([]);

  const load = async () => {
    const s = await getDocs(collection(db, kind === 'forum' ? 'forumPosts' : 'archive'));
    setItems(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
  };
  useEffect(() => { load(); }, [kind]);

  async function remove(p) {
    if (!confirm(`「${p.title}」を削除しますか?`)) return;
    if (kind === 'forum') {
      const r = await getDocs(collection(db, 'forumPosts', p.id, 'replies'));
      for (const d of r.docs) await deleteDoc(d.ref);
      await deleteDoc(doc(db, 'forumPosts', p.id));
    } else await deleteDoc(doc(db, 'archive', p.id));
    await load();
  }
  const author = (p) => app.memberMap[p.authorUid] || app.memberByEmail[(p.authorEmail || '').toLowerCase()];

  return (
    <div>
      <div className="flex gap-2 mb-3">
        <Chip active={kind === 'forum'} onClick={() => setKind('forum')}>生徒フォーラム</Chip>
        <Chip active={kind === 'archive'} onClick={() => setKind('archive')}>課題曲アーカイブ</Chip>
      </div>
      <p className="text-xs text-ks-sub mb-3">返信だけを消す場合は、フォーラムの投稿を開いて各返信の「削除」を押してください。</p>
      {!items.length ? <Empty>投稿はありません。</Empty> : (
        <ul className="card divide-y divide-ks-border">
          {items.map((p) => (
            <li key={p.id} className="px-4 py-3 flex items-center gap-3">
              <span className="flex-1 min-w-0">
                <span className="block font-bold text-sm truncate">{p.title}</span>
                <span className="block text-xs text-ks-sub">{displayName(author(p), p.authorName)}・{fmtDate(p.createdAt)}</span>
              </span>
              <button className="btn btn-ghost btn-sm text-ks-red" onClick={() => remove(p)}>削除</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
