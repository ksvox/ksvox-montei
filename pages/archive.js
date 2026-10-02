import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { addDoc, collection, deleteDoc, doc, getDocs, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebaseClient';
import Layout from '../components/Layout';
import { useApp } from '../components/AppContext';
import { Avatar, Chip, Empty, Field, Modal, Spinner, Stars, displayName } from '../components/ui';
import { SINGERS, TONES } from '../lib/constants';
import { fmtDate, youtubeId } from '../lib/utils';

const blank = { title: '', artist: '', singer: '女性', moods: [], rating: 3, releaseYear: '', lessonPeriod: '', youtubeUrl: '', memo: '' };

function Archive() {
  const app = useApp();
  const router = useRouter();
  const [posts, setPosts] = useState(null);
  const [singer, setSinger] = useState('');
  const [tones, setTones] = useState([]);
  const [sort, setSort] = useState('new');
  const [author, setAuthor] = useState(null);
  const [searched, setSearched] = useState(false);
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const s = await getDocs(collection(db, 'archive'));
    setPosts(s.docs.map((d) => ({ id: d.id, ...d.data() })));
  };
  useEffect(() => { load(); }, []);

  const authorOf = (p) => app.memberMap[p.authorUid] || app.memberByEmail[(p.authorEmail || '').toLowerCase()] || null;
  const authorKey = (p) => authorOf(p)?.uid || 'legacy:' + (p.authorName || '');

  useEffect(() => {
    if (posts && router.query.post) { const p = posts.find((x) => x.id === router.query.post); if (p) setDetail(p); }
  }, [posts, router.query.post]);

  const authors = useMemo(() => {
    if (!posts) return [];
    const map = {};
    posts.forEach((p) => {
      const k = authorKey(p);
      if (!map[k]) map[k] = { key: k, user: authorOf(p), name: p.authorName, count: 0, last: 0 };
      map[k].count++; map[k].last = Math.max(map[k].last, p.createdAt?.seconds || 0);
    });
    return Object.values(map).sort((a, b) => b.last - a.last);
  }, [posts, app.members]);

  const results = useMemo(() => {
    if (!posts) return [];
    let r = posts.filter((p) => (!singer || p.singer === singer) && (!tones.length || tones.some((t) => (p.moods || []).includes(t))) && (!author || authorKey(p) === author.key));
    r = r.sort((a, b) => sort === 'rating' ? (b.rating || 0) - (a.rating || 0) || (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0) : (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    return r;
  }, [posts, singer, tones, sort, author, app.members]);

  const showResults = searched || author;

  async function save() {
    if (!form.title.trim()) return;
    setBusy(true);
    const data = { title: form.title.trim(), artist: form.artist.trim(), singer: form.singer, moods: form.moods, rating: form.rating, releaseYear: form.releaseYear.trim(), lessonPeriod: form.lessonPeriod.trim(), youtubeUrl: form.youtubeUrl.trim(), memo: form.memo };
    try {
      if (form.id) await updateDoc(doc(db, 'archive', form.id), { ...data, updatedAt: serverTimestamp() });
      else await addDoc(collection(db, 'archive'), { ...data, authorUid: app.user.uid, createdAt: serverTimestamp() });
      setForm(null); setDetail(null); await load();
    } catch (e) { alert('保存できませんでした:' + e.message); }
    setBusy(false);
  }
  async function remove(p) {
    if (!confirm(`「${p.title}」の投稿を削除しますか?`)) return;
    await deleteDoc(doc(db, 'archive', p.id)); setDetail(null); await load();
  }

  if (!posts) return <Spinner />;
  const canEdit = (p) => p.authorUid === app.user.uid || app.isAdmin || (authorOf(p)?.uid === app.user.uid);

  return (
    <>
      <div className="flex items-start justify-between gap-3 mb-4 px-1">
        <p className="text-sm text-ks-sub leading-relaxed">当門下生が過去に課題曲として練習した曲をシェア</p>
        <button className="btn btn-primary btn-sm shrink-0" onClick={() => setForm({ ...blank })}>新規投稿</button>
      </div>

      <div className="card p-4 mb-5 space-y-4">
        <div><p className="text-xs font-bold text-ks-sub mb-2">歌唱者</p><div className="flex gap-2">{SINGERS.map((s) => <Chip key={s} active={singer === s} onClick={() => setSinger(singer === s ? '' : s)}>{s}</Chip>)}</div></div>
        <div><p className="text-xs font-bold text-ks-sub mb-2">曲調(複数選択可)</p><div className="flex flex-wrap gap-2">{TONES.map((t) => <Chip key={t} active={tones.includes(t)} onClick={() => setTones(tones.includes(t) ? tones.filter((x) => x !== t) : [...tones, t])}>{t}</Chip>)}</div></div>
        <div className="flex gap-2">
          <button className="btn btn-dark flex-1" onClick={() => { setAuthor(null); setSearched(true); }}>検索する</button>
          {showResults && <button className="btn btn-ghost" onClick={() => { setSearched(false); setAuthor(null); setSinger(''); setTones([]); }}>投稿者一覧へ</button>}
        </div>
      </div>

      {!showResults ? (
        <>
          <h2 className="font-serif font-bold text-lg mb-3 px-1">投稿者一覧</h2>
          {!authors.length ? <Empty>まだ投稿がありません。</Empty> : (
            <ul className="card divide-y divide-ks-border">
              {authors.map((a) => (
                <li key={a.key}><button className="w-full flex items-center gap-3 px-4 py-3 text-left" onClick={() => { setAuthor(a); setSearched(false); }}>
                  <Avatar user={a.user} name={a.name} size={42} />
                  <span className="flex-1 font-bold">{displayName(a.user, a.name)}</span>
                  <span className="text-sm text-ks-sub">{a.count}件</span>
                </button></li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <>
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className="font-serif font-bold text-lg">{author ? `${displayName(author.user, author.name)}さんの課題曲` : '検索結果'}<span className="text-sm text-ks-sub font-sans font-normal ml-2">{results.length}件</span></h2>
          </div>
          <div className="flex gap-2 mb-3">
            <Chip active={sort === 'new'} onClick={() => setSort('new')}>新しい順</Chip>
            <Chip active={sort === 'rating'} onClick={() => setSort('rating')}>おすすめ度の高い順</Chip>
          </div>
          {!results.length ? <Empty>条件に合う投稿がありません。</Empty> : (
            <ul className="space-y-3">
              {results.map((p) => { const u = authorOf(p); return (
                <li key={p.id}><button className="card w-full text-left p-4" onClick={() => setDetail(p)}>
                  <div className="flex items-center gap-2 text-xs text-ks-sub mb-1.5"><Avatar user={u} name={p.authorName} size={22} />{displayName(u, p.authorName)}</div>
                  <p className="font-bold text-[16px] leading-snug">{p.title}</p>
                  <p className="text-sm text-ks-sub">{p.artist}</p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <Stars value={p.rating || 0} />
                    <span className="text-xs px-2 py-0.5 rounded-full border border-ks-border">{p.singer}</span>
                    {(p.moods || []).map((m) => <span key={m} className="text-xs px-2 py-0.5 rounded-full bg-stone-100">{m}</span>)}
                  </div>
                </button></li>
              ); })}
            </ul>
          )}
        </>
      )}

      <Modal open={!!detail} onClose={() => { setDetail(null); if (router.query.post) router.replace('/archive', undefined, { shallow: true }); }} title="課題曲">
        {detail && (() => { const u = authorOf(detail); const yt = youtubeId(detail.youtubeUrl); return (
          <div>
            <div className="flex items-center gap-2 text-sm text-ks-sub mb-3"><Avatar user={u} name={detail.authorName} size={28} />{displayName(u, detail.authorName)}・{fmtDate(detail.createdAt)}</div>
            <h3 className="font-serif font-bold text-xl leading-snug">{detail.title}</h3>
            <p className="text-ks-sub">{detail.artist}{detail.releaseYear ? `(${detail.releaseYear})` : ''}</p>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <span className="text-xs text-ks-sub">おすすめ度</span><Stars value={detail.rating || 0} />
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              <span className="text-xs px-2 py-0.5 rounded-full border border-ks-border">歌唱者:{detail.singer}</span>
              {(detail.moods || []).map((m) => <span key={m} className="text-xs px-2 py-0.5 rounded-full bg-stone-100">{m}</span>)}
            </div>
            {detail.lessonPeriod && <p className="text-sm mt-3"><span className="text-ks-sub">レッスン期間:</span>{detail.lessonPeriod}</p>}
            {detail.memo && <p className="whitespace-pre-wrap leading-relaxed mt-4 bg-white rounded-xl border border-ks-border p-4 text-[15px]">{detail.memo}</p>}
            {yt && <div className="relative w-full overflow-hidden rounded-xl bg-black mt-4" style={{ paddingTop: '56.25%' }}><iframe className="absolute inset-0 w-full h-full" src={`https://www.youtube.com/embed/${yt}`} title={detail.title} allowFullScreen loading="lazy" /></div>}
            {canEdit(detail) && (
              <div className="flex gap-2 mt-5">
                {(detail.authorUid === app.user.uid || authorOf(detail)?.uid === app.user.uid) && <button className="btn btn-ghost flex-1" onClick={() => setForm({ ...blank, ...detail, moods: detail.moods || [] })}>編集</button>}
                <button className="btn btn-ghost flex-1 text-ks-red" onClick={() => remove(detail)}>削除</button>
              </div>
            )}
          </div>
        ); })()}
      </Modal>

      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? '投稿を編集' : '課題曲を投稿'}>
        {form && (
          <div>
            <Field label="曲名"><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
            <Field label="アーティスト"><input className="input" value={form.artist} onChange={(e) => setForm({ ...form, artist: e.target.value })} /></Field>
            <Field label="歌唱者"><div className="flex gap-2">{SINGERS.map((s) => <Chip key={s} active={form.singer === s} onClick={() => setForm({ ...form, singer: s })}>{s}</Chip>)}</div></Field>
            <Field label="曲調(複数選択可)"><div className="flex flex-wrap gap-2">{TONES.map((t) => <Chip key={t} active={form.moods.includes(t)} onClick={() => setForm({ ...form, moods: form.moods.includes(t) ? form.moods.filter((x) => x !== t) : [...form.moods, t] })}>{t}</Chip>)}</div></Field>
            <Field label="おすすめ度"><Stars value={form.rating} onChange={(n) => setForm({ ...form, rating: n })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="発売年"><input className="input" inputMode="numeric" value={form.releaseYear} onChange={(e) => setForm({ ...form, releaseYear: e.target.value })} /></Field>
              <Field label="レッスン期間"><input className="input" placeholder="例:2026年5〜6月 全5回" value={form.lessonPeriod} onChange={(e) => setForm({ ...form, lessonPeriod: e.target.value })} /></Field>
            </div>
            <Field label="YouTubeのURL"><input className="input" value={form.youtubeUrl} onChange={(e) => setForm({ ...form, youtubeUrl: e.target.value })} /></Field>
            <Field label="メモ(感想など)"><textarea className="input" value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} /></Field>
            <button className="btn btn-primary w-full" disabled={busy || !form.title.trim()} onClick={save}>{busy ? '保存中…' : form.id ? '保存する' : '投稿する'}</button>
          </div>
        )}
      </Modal>
    </>
  );
}
export default function Page() { return <Layout title="課題曲アーカイブ"><Archive /></Layout>; }
