import { useEffect, useState } from 'react';
import Link from 'next/link';
import { collection, getDocs, orderBy, query, limit, where } from 'firebase/firestore';
import { db } from '../lib/firebaseClient';
import Layout from '../components/Layout';
import { useApp } from '../components/AppContext';
import AnnouncementList from '../components/Announcements';
import { Section, Avatar, displayName, Empty } from '../components/ui';
import { AI_NOTES } from '../lib/constants';
import { fmtDate, youtubeId } from '../lib/utils';

function Home() {
  const app = useApp();
  const { settings, priv, me, memberMap, memberByEmail } = app;
  const [news, setNews] = useState([]);
  const [apps, setApps] = useState([]);
  const [videos, setVideos] = useState([]);
  const [archive, setArchive] = useState([]);
  const [forum, setForum] = useState([]);
  const [unread, setUnread] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const load = async (q, set) => { try { const s = await getDocs(q); set(s.docs.map((d) => ({ id: d.id, ...d.data() }))); } catch (e) { console.error(e); } };
    load(collection(db, 'announcements'), setNews);
    load(query(collection(db, 'appLinks'), orderBy('order')), setApps);
    load(query(collection(db, 'videos'), orderBy('order')), setVideos);
    load(query(collection(db, 'archive'), orderBy('createdAt', 'desc'), limit(3)), setArchive);
    load(query(collection(db, 'forumPosts'), orderBy('createdAt', 'desc'), limit(3)), setForum);
    getDocs(query(collection(db, 'messages'), where('to', '==', app.user.uid)))
      .then((s) => setUnread(s.docs.filter((d) => !d.data().read && !(d.data().hiddenFor || []).includes(app.user.uid)).length))
      .catch(console.error);
  }, [app.user.uid]);

  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const day = now.getDate();
  const showReserve = day >= 15 && !priv.reminders[`${ym}-reserve`];
  const showPay = day >= 20 && !priv.reminders[`${ym}-pay`];
  const done = (key) => app.updatePriv({ reminders: { [`${ym}-${key}`]: true } });

  const copyId = async () => {
    try { await navigator.clipboard.writeText(settings.paypayId); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch (e) { /* noop */ }
  };

  const archiveAuthor = (p) => memberMap[p.authorUid] || memberByEmail[(p.authorEmail || '').toLowerCase()] || null;

  return (
    <>
      <div className="relative -mx-4 -mt-4 mb-6 overflow-hidden" style={{ minHeight: 170 }}>
        {settings.bannerImage
          ? <img src={settings.bannerImage} alt="" className="absolute inset-0 w-full h-full object-cover" />
          : <div className="absolute inset-0 bg-gradient-to-br from-[#3A2A22] via-[#6B3A26] to-[#C5A059]" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
        <div className="relative px-5 pt-16 pb-5 text-white">
          <p className="font-serif font-bold text-2xl leading-snug drop-shadow">{me?.nickname ? `${me.nickname}さん、こんにちは!` : 'ようこそ、門弟アプリへ'}</p>
          {!me?.nickname && <Link href="/mypage" className="inline-block mt-2 text-xs bg-white/90 text-ks-text font-bold rounded-full px-3 py-1">マイページでプロフィールを登録してください</Link>}
        </div>
      </div>

      {unread > 0 && (
        <Link href="/mypage#messages" className="block card px-4 py-3 mb-5 text-sm font-bold border-ks-gold">
          未読のメッセージが{unread}件あります
        </Link>
      )}

      {(showReserve || showPay) && (
        <div className="space-y-3 mb-7">
          {showReserve && (
            <div className="rounded-2xl bg-ks-goldlight border border-[#EBDDBE] p-4">
              <p className="font-bold mb-3">今月のレッスン予約はしましたか?</p>
              <div className="flex gap-2">
                <button className="btn btn-dark btn-sm flex-1" onClick={() => done('reserve')}>しました👍</button>
                <a className="btn btn-ghost btn-sm flex-1" href={settings.reserveUrl} target="_blank" rel="noreferrer">まだです😓</a>
              </div>
            </div>
          )}
          {showPay && (
            <div className="rounded-2xl bg-ks-goldlight border border-[#EBDDBE] p-4">
              <p className="font-bold mb-3">お月謝のお支払いは25日までです。お済みですか?</p>
              <div className="flex gap-2">
                <button className="btn btn-dark btn-sm flex-1" onClick={() => done('pay')}>済みました👍</button>
                <a className="btn btn-ghost btn-sm flex-1" href={settings.paypayUrl}>まだです😓</a>
              </div>
            </div>
          )}
        </div>
      )}

      <Section title="お知らせ" right={<Link href="/news" className="link">過去の投稿</Link>}>
        <AnnouncementList items={news} limit={3} />
      </Section>

      <div className="space-y-4 mb-8">
        <a href={settings.reserveUrl} target="_blank" rel="noreferrer" className="block rounded-[22px] bg-ks-red text-white p-5 shadow-md hover:bg-ks-redhover transition-colors">
          <p className="font-serif font-bold text-xl">レッスン/個人練習を予約する</p>
          <p className="text-sm text-white/85 mt-1.5">予約はLINEから行います。押すと予約ページが開きます。</p>
          <span className="inline-block mt-4 bg-white text-ks-red font-bold text-sm rounded-full px-5 py-2">予約ページを開く</span>
        </a>
        <div className="rounded-[22px] bg-white border-2 border-ks-red p-5">
          <p className="font-serif font-bold text-xl">月謝をPayPayで送金する</p>
          <div className="flex items-center gap-2 mt-3 bg-ks-bg rounded-xl px-3 py-2.5">
            <span className="text-xs text-ks-sub">送金先ID</span>
            <span className="font-bold tracking-wide flex-1">{settings.paypayId}</span>
            <button onClick={copyId} className="btn btn-ghost btn-sm">{copied ? 'コピーしました' : 'コピー'}</button>
          </div>
          <a href={settings.paypayUrl} className="btn w-full mt-3 text-white" style={{ background: '#FF0033' }}>PayPayアプリを開く</a>
          <p className="text-[11px] text-ks-sub mt-2">アプリが開かない場合は、IDをコピーしてPayPayで送金してください。</p>
        </div>
      </div>

      {apps.length > 0 && (
        <Section title="K's VOXのアプリ">
          <div className="grid grid-cols-2 gap-3">
            {apps.map((a) => (
              <a key={a.id} href={a.url || '#'} target="_blank" rel="noreferrer" className="card p-3.5 flex flex-col" style={{ borderTop: `4px solid ${a.color || '#C5A059'}` }}>
                <div className="flex items-center gap-2 mb-2">
                  {a.icon ? <img src={a.icon} alt="" className="w-9 h-9 rounded-full object-cover" /> : <span className="w-9 h-9 rounded-full" style={{ background: a.color }} />}
                  <span className="font-bold text-sm leading-tight">{a.name}</span>
                </div>
                <p className="text-xs text-ks-sub leading-relaxed flex-1">{a.desc}</p>
              </a>
            ))}
          </div>
          <div className="mt-4 rounded-2xl bg-white/60 border border-ks-border px-4 py-3">
            <p className="text-xs font-bold mb-1.5">AIアプリ利用時の注意事項</p>
            <ul className="text-xs text-ks-sub space-y-1 list-disc pl-4">{AI_NOTES.map((n) => <li key={n}>{n}</li>)}</ul>
          </div>
        </Section>
      )}

      <Link href="/songs" className="block card p-5 mb-7">
        <p className="font-serif font-bold text-lg">楽曲検索</p>
        <p className="text-sm text-ks-sub mt-1">K's VOX RECORDのオリジナル英語曲をジャンル・雰囲気で検索し、歌詞をダウンロードできます。</p>
      </Link>

      <Section title="最新の課題曲" right={<Link href="/archive" className="link">すべて見る</Link>}>
        {archive.length ? (
          <ul className="card divide-y divide-ks-border">
            {archive.map((p) => { const u = archiveAuthor(p); return (
              <li key={p.id}><Link href={`/archive?post=${p.id}`} className="flex gap-3 items-center px-4 py-3">
                <Avatar user={u} name={p.authorName} size={38} />
                <span className="min-w-0">
                  <span className="block text-xs text-ks-sub">{displayName(u, p.authorName)}</span>
                  <span className="block font-bold truncate">{p.title}</span>
                  <span className="block text-xs text-ks-sub truncate">{p.artist}</span>
                </span>
              </Link></li>
            ); })}
          </ul>
        ) : <Empty>まだ投稿がありません。</Empty>}
      </Section>

      <Section title="生徒フォーラム" right={<Link href="/forum" className="link">過去の投稿</Link>}>
        {forum.length ? (
          <ul className="card divide-y divide-ks-border">
            {forum.map((p) => { const u = memberMap[p.authorUid]; return (
              <li key={p.id}><Link href={`/forum?post=${p.id}`} className="flex gap-3 items-center px-4 py-3">
                <Avatar user={u} size={38} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-xs text-ks-sub"><span className="badge">{p.category}</span>{displayName(u)}・{fmtDate(p.createdAt)}</span>
                  <span className="block font-bold truncate mt-0.5">{p.title}</span>
                </span>
              </Link></li>
            ); })}
          </ul>
        ) : <Empty>まだ投稿がありません。</Empty>}
      </Section>

      {videos.length > 0 && (
        <Section title="レッスン備忘録">
          <p className="text-xs text-ks-sub mb-3 px-1">限定公開動画です。復習に役立ててください。</p>
          <div className="space-y-5">
            {videos.map((v) => { const id = youtubeId(v.url); return (
              <div key={v.id}>
                {id ? (
                  <div className="relative w-full overflow-hidden rounded-2xl bg-black" style={{ paddingTop: '56.25%' }}>
                    <iframe className="absolute inset-0 w-full h-full" src={`https://www.youtube.com/embed/${id}`} title={v.title} allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowFullScreen loading="lazy" />
                  </div>
                ) : null}
                <div className="flex items-center justify-between mt-2 px-1">
                  <p className="text-sm font-bold">{v.title}</p>
                  <a href={v.url} target="_blank" rel="noreferrer" className="link shrink-0 ml-2">全画面で観る</a>
                </div>
              </div>
            ); })}
          </div>
        </Section>
      )}
    </>
  );
}

export default function Page() {
  return <Layout><Home /></Layout>;
}
