import { useEffect, useState } from 'react';
import Link from 'next/link';
import Layout from '../components/Layout';
import { useApp } from '../components/AppContext';
import ReviewCard from '../components/ReviewCard';
import { Empty, Spinner } from '../components/ui';
import { REVIEW_KEEP, confirmReview, loadMyReviews } from '../lib/reviews';

function PastReviews() {
  const app = useApp();
  const [list, setList] = useState(null);
  const [busy, setBusy] = useState('');
  useEffect(() => { loadMyReviews(app.user.email).then(setList).catch((e) => { console.error(e); setList([]); }); }, [app.user.email]);

  async function confirm(r) {
    setBusy(r.id);
    try { await confirmReview(r.id); setList((l) => l.map((x) => (x.id === r.id ? { ...x, confirmed: true } : x))); }
    catch (e) { alert('保存できませんでした:' + e.message); }
    setBusy('');
  }

  if (!list) return <Spinner />;
  return (
    <>
      <Link href="/mypage" className="link inline-block mb-4">← マイページに戻る</Link>
      {!list.length ? <div className="card"><Empty>まだ振り返りは届いていません。</Empty></div> : (
        <div className="space-y-3">{list.slice(0, REVIEW_KEEP).map((r) => <ReviewCard key={r.id} r={r} onConfirm={confirm} busy={busy === r.id} />)}</div>
      )}
      <p className="text-[11px] text-ks-sub mt-4 text-center">※{REVIEW_KEEP}件以上は自動で削除されます。</p>
    </>
  );
}

export default function Page() { return <Layout title="過去の振り返り"><PastReviews /></Layout>; }
