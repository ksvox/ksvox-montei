import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { collection, getDocs, orderBy, query, limit, where } from 'firebase/firestore';
import { db } from '../lib/firebaseClient';
import Layout from '../components/Layout';
import { useApp } from '../components/AppContext';
import AnnouncementList from '../components/Announcements';
import { Section, Avatar, displayName, Empty } from '../components/ui';
import { AI_NOTES } from '../lib/constants';
import { fmtDate, youtubeId } from '../lib/utils';
import { loadStats, topSongs } from '../lib/songStats';

const ICONS = {
  music: 'M9 18V5l12-2v13M9 18a3 3 0 11-6 0 3 3 0 016 0zm12-2a3 3 0 11-6 0 3 3 0 016 0z',
  mic: 'M12 15a3 3 0 003-3V6a3 3 0 10-6 0v6a3 3 0 003 3zm6-3a6 6 0 01-12 0m6 6v3m-3 0h6',
  chat: 'M21 12a8 8 0 01-11.6 7.1L4 20l1.1-4.6A8 8 0 1121 12z',
};

function CardHead({ icon, title, link, tint, color }) {
  return (
    <div className="flex items-center gap-2.5 px-4 py-3 border-b" style={{ background: tint, borderColor: 'rgba(44,40,37,.06)' }}>
      <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: color }}>
        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d={ICONS[icon]} /></svg>
      </span>
      <p className="font-serif font-bold text-lg flex-1">{title}</p>
      <span className="link shrink-0">{link}</span>
    </div>
  );
}

function Home() {
  const app = useApp();
  const { settings, priv, me, memberMap, memberByEmail } = app;
  const [news, setNews] = useState([]);
  const [apps, setApps] = useState([]);
  const [videos, setVideos] = useState([]);
  const [archive, setArchive] = useState([]);
  const [forum, setForum] = useState([]);
  const [unread, setUnread] = useState(0);
  const [popular, setPopular] = useState([]);
  const router = useRouter();

  useEffect(() => {
    const load = async (q, set) => { try { const s = await getDocs(q); set(s.docs.map((d) => ({ id: d.id, ...d.data() }))); } catch (e) { console.error(e); } };
    load(collection(db, 'announcements'), setNews);
    load(query(collection(db, 'appLinks'), orderBy('order')), setApps);
    load(query(collection(db, 'videos'), orderBy('order')), setVideos);
    load(query(collection(db, 'archive'), orderBy('createdAt', 'desc'), limit(3)), setArchive);
    load(query(collection(db, 'forumPosts'), orderBy('createdAt', 'desc'), limit(3)), setForum);
    loadStats().then((st) => setPopular(topSongs(st, 3))).catch(console.error);
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
        <Link href="/mypage#messages" className="press block card px-4 py-3 mb-5 text-sm font-bold border-ks-gold">
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
        <a href={settings.reserveUrl} target="_blank" rel="noreferrer" className="press block rounded-[22px] bg-ks-red text-white p-5 shadow-md">
          <p className="font-serif font-bold text-xl">レッスン/個人練習を予約する</p>
          <p className="text-sm text-white/90 mt-1.5">予約はLINEから行います。押すと予約ページが開きます。</p>
          <span className="inline-block mt-4 bg-white text-ks-red font-bold text-sm rounded-full px-5 py-2">予約ページを開く</span>
        </a>
        <a href={settings.paypayUrl} className="press block rounded-[22px] text-white p-5 shadow-md" style={{ background: '#A8843F' }}>
          <p className="font-serif font-bold text-xl">月謝を支払う</p>
          <p className="text-sm text-white/90 mt-1.5">月謝はPayPayを利用します。IDをコピーして送金してください。</p>
          <span className="inline-block mt-4 bg-white font-bold text-sm rounded-full px-5 py-2" style={{ color: '#8A6B2E' }}>PayPayアプリを開く</span>
        </a>
      </div>

      {apps.length > 0 && (
        <Section title="K's VOXのアプリ">
          <div className="grid grid-cols-2 gap-3">
            {apps.map((a) => (
              <a key={a.id} href={a.url || '#'} target="_blank" rel="noreferrer" className="press card p-3.5 flex flex-col" style={{ borderTop: `4px solid ${a.color || '#C5A059'}` }}>
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

      <div role="link" tabIndex={0} className="press card overflow-hidden mb-5 cursor-pointer" onClick={() => router.push('/songs')} onKeyDown={(e) => e.key === 'Enter' && router.push('/songs')}>
        <CardHead icon="music" title="オリジナル楽曲検索" link="検索する" tint="#F8F3E8" color="#C5A059" />
        <div className="px-5 pt-3 pb-4">
          <p className="text-sm text-ks-sub leading-relaxed">K's VOX RECORDのオリジナル英語曲をジャンル・雰囲気で検索し、歌詞をダウンロードできます。</p>
          {popular.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-bold text-ks-sub mb-1.5">よくダウンロードされている曲</p>
              <ul className="divide-y divide-ks-border border-t border-ks-border">
                {popular.map((p) => (
                  <li key={p.id}><Link href={`/songs?q=${encodeURIComponent(p.title || '')}`} onClick={(e) => e.stopPropagation()} className="row block py-2.5 px-1 font-bold text-[15px] truncate">{p.title}</Link></li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div role="link" tabIndex={0} className="press card overflow-hidden mb-5 cursor-pointer" onClick={() => router.push('/archive')} onKeyDown={(e) => e.key === 'Enter' && router.push('/archive')}>
        <CardHead icon="mic" title="私のおすすめ課題曲" link="すべて見る" tint="#FDF1EC" color="#E54D26" />
        <div className="px-5 pt-3 pb-4">
          <p className="text-sm text-ks-sub leading-relaxed">過去にレッスンで歌った課題曲を紹介。お互い課題曲選びの参考にしてください。</p>
          {archive.length ? (
            <ul className="mt-3 divide-y divide-ks-border border-t border-ks-border">
              {archive.map((p) => { const u = archiveAuthor(p); return (
                <li key={p.id}><Link href={`/archive?post=${p.id}`} onClick={(e) => e.stopPropagation()} className="row flex gap-3 items-center py-2.5 px-1">
                  <Avatar user={u} name={p.authorName} size={34} />
                  <span className="min-w-0">
                    <span className="block font-bold truncate">{p.title}</span>
                    <span className="block text-xs text-ks-sub truncate">{p.artist}・{displayName(u, p.authorName)}</span>
                  </span>
                </Link></li>
              ); })}
            </ul>
          ) : <Empty>まだ投稿がありません。</Empty>}
        </div>
      </div>

      <div role="link" tabIndex={0} className="press card overflow-hidden mb-7 cursor-pointer" onClick={() => router.push('/forum')} onKeyDown={(e) => e.key === 'Enter' && router.push('/forum')}>
        <CardHead icon="chat" title="生徒フォーラム" link="すべて見る" tint="#F0EEEA" color="#2C2825" />
        <div className="px-5 pt-3 pb-4">
          <p className="text-sm text-ks-sub leading-relaxed">みんなへのお知らせや質問などを自由に投稿できます。10件を超えると古い投稿から削除されます。</p>
          {forum.length ? (
            <ul className="mt-3 divide-y divide-ks-border border-t border-ks-border">
              {forum.map((p) => { const u = memberMap[p.authorUid]; return (
                <li key={p.id}><Link href={`/forum?post=${p.id}`} onClick={(e) => e.stopPropagation()} className="row flex gap-3 items-center py-2.5 px-1">
                  <Avatar user={u} size={34} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-xs text-ks-sub"><span className="badge">{p.category}</span>{displayName(u)}・{fmtDate(p.createdAt)}</span>
                    <span className="block font-bold truncate mt-0.5">{p.title}</span>
                  </span>
                </Link></li>
              ); })}
            </ul>
          ) : <Empty>まだ投稿がありません。</Empty>}
        </div>
      </div>

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
