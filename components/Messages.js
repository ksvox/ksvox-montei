import { useEffect, useState } from 'react';
import { arrayUnion, collection, deleteDoc, doc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { db } from '../lib/firebaseClient';
import { useApp } from './AppContext';
import MessageCompose from './MessageCompose';
import { Avatar, Chip, Empty, Modal, displayName } from './ui';
import { fmtDate } from '../lib/utils';

export default function Messages() {
  const app = useApp();
  const uid = app.user.uid;
  const [box, setBox] = useState('in');
  const [msgs, setMsgs] = useState({ in: [], out: [] });
  const [open, setOpen] = useState(null);
  const [replyTo, setReplyTo] = useState(null);

  const load = async () => {
    const [a, b] = await Promise.all([
      getDocs(query(collection(db, 'messages'), where('to', '==', uid))),
      getDocs(query(collection(db, 'messages'), where('from', '==', uid))),
    ]);
    const conv = (s) => s.docs.map((d) => ({ id: d.id, ...d.data() })).filter((m) => !(m.hiddenFor || []).includes(uid)).sort((x, y) => (y.createdAt?.seconds || 0) - (x.createdAt?.seconds || 0));
    setMsgs({ in: conv(a), out: conv(b) });
  };
  useEffect(() => { load(); }, []);

  async function show(m) {
    setOpen(m);
    if (box === 'in' && !m.read) { await updateDoc(doc(db, 'messages', m.id), { read: true }); load(); }
  }
  async function hide(m) {
    if (!confirm('このメッセージを削除しますか?(相手側には残ります)')) return;
    const other = m.from === uid ? m.to : m.from;
    if ((m.hiddenFor || []).includes(other) || !app.memberMap[other]) await deleteDoc(doc(db, 'messages', m.id));
    else await updateDoc(doc(db, 'messages', m.id), { hiddenFor: arrayUnion(uid) });
    setOpen(null); load();
  }

  const list = msgs[box];
  const unread = msgs.in.filter((m) => !m.read).length;
  return (
    <section id="messages" className="mb-7">
      <div className="flex items-end justify-between mb-3 px-1">
        <h2 className="font-serif font-bold text-lg">マイメッセージ</h2>
        <a href="/members" className="link">会員一覧から送る</a>
      </div>
      <div className="flex gap-2 mb-3">
        <Chip active={box === 'in'} onClick={() => setBox('in')}>受信{unread ? `(未読${unread})` : ''}</Chip>
        <Chip active={box === 'out'} onClick={() => setBox('out')}>送信済み</Chip>
      </div>
      {!list.length ? <Empty>メッセージはありません。</Empty> : (
        <ul className="card divide-y divide-ks-border">
          {list.map((m) => { const u = app.memberMap[box === 'in' ? m.from : m.to]; return (
            <li key={m.id}><button className="w-full flex items-center gap-3 px-4 py-3 text-left" onClick={() => show(m)}>
              <Avatar user={u} size={36} />
              <span className="flex-1 min-w-0">
                <span className="flex items-center gap-2 text-xs text-ks-sub">{box === 'out' ? '宛先:' : ''}{displayName(u, '退会した会員')}・{fmtDate(m.createdAt)}</span>
                <span className={`block text-sm truncate ${box === 'in' && !m.read ? 'font-bold' : ''}`}>{m.body}</span>
              </span>
              {box === 'in' && !m.read && <span className="w-2.5 h-2.5 rounded-full bg-ks-red" />}
            </button></li>
          ); })}
        </ul>
      )}
      <Modal open={!!open} onClose={() => setOpen(null)} title="メッセージ">
        {open && (() => { const other = app.memberMap[open.from === uid ? open.to : open.from]; return (
          <div>
            <div className="flex items-center gap-2 text-sm text-ks-sub mb-3"><Avatar user={other} size={28} />{open.from === uid ? '宛先:' : ''}{displayName(other, '退会した会員')}・{fmtDate(open.createdAt, true)}</div>
            <p className="whitespace-pre-wrap leading-relaxed bg-white rounded-xl border border-ks-border p-4">{open.body}</p>
            <div className="flex gap-2 mt-4">
              <button className="btn btn-ghost text-ks-red" onClick={() => hide(open)}>削除</button>
              {open.from !== uid && other && <button className="btn btn-primary flex-1" onClick={() => { setReplyTo(other); setOpen(null); }}>返信する</button>}
            </div>
          </div>
        ); })()}
      </Modal>
      <Modal open={!!replyTo} onClose={() => setReplyTo(null)} title="返信">
        {replyTo && <MessageCompose to={replyTo} onDone={() => { setReplyTo(null); load(); }} />}
      </Modal>
    </section>
  );
}
