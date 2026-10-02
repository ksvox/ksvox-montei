import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, increment, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db, api } from '../lib/firebaseClient';
import Layout from '../components/Layout';
import { useApp } from '../components/AppContext';
import { Avatar, Chip, Empty, Field, Modal, Spinner, displayName } from '../components/ui';
import { FORUM_CATEGORIES } from '../lib/constants';
import { fmtDate } from '../lib/utils';

const blank = { title: '', category: '雑談', body: '', url: '' };

function Forum() {
  const app = useApp();
  const router = useRouter();
  const [posts, setPosts] = useState(null);
  const [cat, setCat] = useState('');
  const [thread, setThread] = useState(null);
  const [replies, setReplies] = useState([]);
  const [reply, setReply] = useState('');
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const s = await getDocs(query(collection(db, 'forumPosts'), orderBy('createdAt', 'desc')));
    setPosts(s.docs.map((d) => ({ id: d.id, ...d.data() })));
  };
  useEffect(() => { load(); }, []);

  const openThread = async (p) => {
    setThread(p); setReplies([]);
    const s = await getDocs(query(collection(db, 'forumPosts', p.id, 'replies'), orderBy('createdAt')));
    setReplies(s.docs.map((d) => ({ id: d.id, ...d.data() })));
  };
  useEffect(() => {
    if (!router.query.post) return;
    getDoc(doc(db, 'forumPosts', String(router.query.post))).then((d) => d.exists() && openThread({ id: d.id, ...d.data() }));
  }, [router.query.post]);

  const close = () => { setThread(null); if (router.query.post) router.replace('/forum', undefined, { shallow: true }); };

  async function savePost() {
    setBusy(true);
    const data = { title: form.title.trim(), category: form.category, body: form.body, url: form.url.trim() };
    try {
      if (form.id) await updateDoc(doc(db, 'forumPosts', form.id), { ...data, updatedAt: serverTimestamp() });
      else {
        await addDoc(collection(db, 'forumPosts'), { ...data, authorUid: app.user.uid, replyCount: 0, createdAt: serverTimestamp() });
        api('/api/forum-trim').catch(console.error);
      }
      setForm(null); setThread(null); await load();
    } catch (e) { alert('保存できませんでした:' + e.message); }
    setBusy(false);
  }
  async function removePost(p) {
    if (!confirm(`「${p.title}」を返信ごと削除しますか?`)) return;
    for (const r of replies) await deleteDoc(doc(db, 'forumPosts', p.id, 'replies', r.id));
    await deleteDoc(doc(db, 'forumPosts', p.id));
    close(); await load();
  }
  async function sendReply() {
    if (!reply.trim()) return;
    setBusy(true);
    try {
      await addDoc(collection(db, 'forumPosts', thread.id, 'replies'), { body: reply.trim(), authorUid: app.user.uid, createdAt: serverTimestamp() });
      await updateDoc(doc(db, 'forumPosts', thread.id), { replyCount: increment(1) });
      setReply(''); await openThread(thread); load();
    } catch (e) { alert('送信できませんでした:' + e.message); }
    setBusy(false);
  }
  async function removeReply(r) {
    if (!confirm('この返信を削除しますか?')) return;
    await deleteDoc(doc(db, 'forumPosts', thread.id, 'replies', r.id));
    await updateDoc(doc(db, 'forumPosts', thread.id), { replyCount: increment(-1) });
    await openThread(thread); load();
  }

  if (!posts) return <Spinner />;
  const list = posts.filter((p) => !cat || p.category === cat);
  const mine = (x) => x.authorUid === app.user.uid;

  return (
    <>
      <div className="rounded-xl bg-ks-goldlight border border-[#EBDDBE] px-4 py-2.5 text-xs mb-4">トップに表示されるのは最新3件まで、ここで表示されるのは10件までです。</div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          <Chip active={!cat} onClick={() => setCat('')}>すべて</Chip>
          {FORUM_CATEGORIES.map((c) => <Chip key={c} active={cat === c} onClick={() => setCat(c)}>{c}</Chip>)}
        </div>
        <button className="btn btn-primary btn-sm shrink-0 ml-2" onClick={() => setForm({ ...blank })}>投稿</button>
      </div>
      {!list.length ? <Empty>まだ投稿がありません。</Empty> : (
        <ul className="space-y-3">
          {list.map((p) => { const u = app.memberMap[p.authorUid]; return (
            <li key={p.id}><button className="card w-full text-left p-4" onClick={() => openThread(p)}>
              <div className="flex items-center gap-2 text-xs text-ks-sub mb-1.5">
                <Avatar user={u} size={24} />{displayName(u)}・{fmtDate(p.createdAt)}<span className="badge ml-auto">{p.category}</span>
              </div>
              <p className="font-bold leading-snug">{p.title}</p>
              <p className="text-sm text-ks-sub mt-1 line-clamp-2">{p.body}</p>
              <p className="text-xs text-ks-sub mt-2">返信 {p.replyCount || 0}件</p>
            </button></li>
          ); })}
        </ul>
      )}

      <Modal open={!!thread} onClose={close} title={thread?.category || ''}>
        {thread && (() => { const u = app.memberMap[thread.authorUid]; return (
          <div>
            <div className="flex items-center gap-2 text-sm text-ks-sub mb-2"><Avatar user={u} size={28} />{displayName(u)}・{fmtDate(thread.createdAt, true)}</div>
            <h3 className="font-serif font-bold text-xl leading-snug mb-3">{thread.title}</h3>
            <p className="whitespace-pre-wrap leading-relaxed text-[15px]">{thread.body}</p>
            {thread.url && <a href={thread.url} target="_blank" rel="noreferrer" className="link block mt-3 break-all">{thread.url}</a>}
            {(mine(thread) || app.isAdmin) && (
              <div className="flex gap-2 mt-4">
                {mine(thread) && <button className="btn btn-ghost btn-sm" onClick={() => setForm({ ...blank, ...thread })}>編集</button>}
                <button className="btn btn-ghost btn-sm text-ks-red" onClick={() => removePost(thread)}>削除</button>
              </div>
            )}
            <h4 className="font-bold text-sm mt-6 mb-2">返信({replies.length})</h4>
            <ul className="space-y-2.5">
              {replies.map((r) => { const ru = app.memberMap[r.authorUid]; return (
                <li key={r.id} className="bg-white rounded-xl border border-ks-border p-3">
                  <div className="flex items-center gap-2 text-xs text-ks-sub mb-1"><Avatar user={ru} size={22} />{displayName(ru)}・{fmtDate(r.createdAt, true)}
                    {(mine(r) || app.isAdmin) && <button className="ml-auto text-ks-red" onClick={() => removeReply(r)}>削除</button>}
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{r.body}</p>
                </li>
              ); })}
            </ul>
            <div className="mt-4">
              <textarea className="input" style={{ minHeight: 80 }} placeholder="返信を書く" value={reply} onChange={(e) => setReply(e.target.value)} />
              <button className="btn btn-dark w-full mt-2" disabled={busy || !reply.trim()} onClick={sendReply}>返信する</button>
            </div>
          </div>
        ); })()}
      </Modal>

      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? '投稿を編集' : '新規投稿'}>
        {form && (
          <div>
            <Field label="タイトル"><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
            <Field label="カテゴリ"><div className="flex gap-2">{FORUM_CATEGORIES.map((c) => <Chip key={c} active={form.category === c} onClick={() => setForm({ ...form, category: c })}>{c}</Chip>)}</div></Field>
            <Field label="本文"><textarea className="input" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></Field>
            <Field label="URL(任意)"><input className="input" placeholder="https://..." value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} /></Field>
            <button className="btn btn-primary w-full" disabled={busy || !form.title.trim() || !form.body.trim()} onClick={savePost}>{busy ? '保存中…' : form.id ? '保存する' : '投稿する'}</button>
          </div>
        )}
      </Modal>
    </>
  );
}
export default function Page() { return <Layout title="生徒フォーラム"><Forum /></Layout>; }
