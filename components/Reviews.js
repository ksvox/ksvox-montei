import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useApp } from './AppContext';
import ReviewCard from './ReviewCard';
import { Section, Empty } from './ui';
import { confirmReview, loadMyReviews } from '../lib/reviews';

// マイページ: レッスンの振り返り(直近4件)
export default function Reviews() {
  const app = useApp();
  const [list, setList] = useState(null);
  const [busy, setBusy] = useState('');

  const load = () => loadMyReviews(app.user.email).then(setList).catch((e) => { console.error(e); setList([]); });
  useEffect(() => { load(); }, [app.user.email]);
  useEffect(() => {
    if (list && typeof window !== 'undefined' && window.location.hash === '#reviews') {
      setTimeout(() => document.getElementById('reviews')?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  }, [list]);

  async function confirm(r) {
    setBusy(r.id);
    try { await confirmReview(r.id); setList((l) => l.map((x) => (x.id === r.id ? { ...x, confirmed: true } : x))); }
    catch (e) { alert('保存できませんでした:' + e.message); }
    setBusy('');
  }

  return (
    <div id="reviews" style={{ scrollMarginTop: 80 }}>
    <Section title="レッスンの振り返り">
      {list === null ? <p className="text-sm text-ks-sub">読み込み中…</p>
        : !list.length ? <div className="card"><Empty>まだ振り返りは届いていません。</Empty></div>
          : (
            <div className="space-y-3">
              {list.slice(0, 4).map((r) => <ReviewCard key={r.id} r={r} onConfirm={confirm} busy={busy === r.id} />)}
              <Link href="/reviews" className="btn btn-ghost btn-sm w-full">→過去の振り返り</Link>
              <p className="text-[11px] text-ks-sub text-center">※12件以上は自動で削除されます。</p>
            </div>
          )}
    </Section>
    </div>
  );
}
