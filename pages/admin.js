import { useState } from 'react';
import Layout from '../components/Layout';
import { Chip } from '../components/ui';
import AdminNews from '../components/admin/AdminNews';
import AdminSongs from '../components/admin/AdminSongs';
import AdminPosts from '../components/admin/AdminPosts';
import AdminRoster from '../components/admin/AdminRoster';
import AdminLinks from '../components/admin/AdminLinks';
import AdminSettings from '../components/admin/AdminSettings';
import AdminImport from '../components/admin/AdminImport';

const TABS = [
  ['news', 'お知らせ'], ['roster', '会員名簿'], ['songs', '楽曲管理'], ['posts', '投稿管理'],
  ['videos', '動画'], ['apps', 'アプリ'], ['settings', '設定'], ['import', '引っ越し'],
];

function Admin() {
  const [tab, setTab] = useState('news');
  return (
    <>
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-4 px-4">
        {TABS.map(([k, l]) => <span key={k} className="shrink-0"><Chip active={tab === k} onClick={() => setTab(k)}>{l}</Chip></span>)}
      </div>
      {tab === 'news' && <AdminNews />}
      {tab === 'roster' && <AdminRoster />}
      {tab === 'songs' && <AdminSongs />}
      {tab === 'posts' && <AdminPosts />}
      {tab === 'videos' && <AdminLinks kind="videos" />}
      {tab === 'apps' && <AdminLinks kind="appLinks" />}
      {tab === 'settings' && <AdminSettings />}
      {tab === 'import' && <AdminImport />}
    </>
  );
}
export default function Page() { return <Layout adminOnly title="管理画面"><Admin /></Layout>; }
