import { useState } from 'react';
import Layout from '../components/Layout';
import { useApp } from '../components/AppContext';
import MessageCompose from '../components/MessageCompose';
import { Avatar, Modal, RankSeal, displayName } from '../components/ui';

function fmtBirthday(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
  return m ? `${Number(m[1])}年${Number(m[2])}月${Number(m[3])}日` : s;
}

function Members() {
  const app = useApp();
  const [sel, setSel] = useState(null);
  const [compose, setCompose] = useState(false);
  const list = [...app.members].sort((a, b) => (a.nickname || '~').localeCompare(b.nickname || '~', 'ja'));

  return (
    <>
      <p className="text-xs text-ks-sub mb-4 px-1">アイコンを押すと連絡先を見たり、メッセージを送ったりできます。</p>
      <div className="grid grid-cols-3 gap-x-3 gap-y-5">
        {list.map((m) => (
          <button key={m.uid} className="flex flex-col items-center text-center" onClick={() => { setSel(m); setCompose(false); }}>
            <Avatar user={m} size={68} />
            <span className="text-sm font-bold mt-2 leading-tight">{displayName(m)}</span>
            <span className="mt-1 min-h-[18px]"><RankSeal user={m} /></span>
          </button>
        ))}
      </div>
      <Modal open={!!sel} onClose={() => setSel(null)} title={compose ? 'メッセージ' : '会員の詳細'}>
        {sel && !compose && (
          <div>
            <div className="flex flex-col items-center text-center mb-5">
              <Avatar user={sel} size={88} />
              <p className="font-serif font-bold text-xl mt-3">{displayName(sel)}</p>
              <div className="mt-1.5"><RankSeal user={sel} /></div>
            </div>
            <dl className="card divide-y divide-ks-border text-sm">
              <div className="flex px-4 py-3"><dt className="w-24 text-ks-sub">本名</dt><dd className="font-bold">{sel.realName || '未登録'}</dd></div>
              <div className="flex px-4 py-3"><dt className="w-24 text-ks-sub">電話番号</dt><dd className="font-bold">{sel.phone ? <a href={`tel:${sel.phone.replace(/[^\d+]/g, '')}`} className="text-ks-red underline">{sel.phone}</a> : '未登録'}</dd></div>
              <div className="flex px-4 py-3"><dt className="w-24 text-ks-sub">生年月日</dt><dd className="font-bold">{sel.birthday ? fmtBirthday(sel.birthday) : '未登録'}</dd></div>
            </dl>
            {sel.uid !== app.user.uid && <button className="btn btn-primary w-full mt-5" onClick={() => setCompose(true)}>メッセージを送る</button>}
          </div>
        )}
        {sel && compose && <MessageCompose to={sel} onDone={() => { setSel(null); alert('メッセージを送りました。'); }} />}
      </Modal>
    </>
  );
}
export default function Page() { return <Layout title="会員一覧"><Members /></Layout>; }
