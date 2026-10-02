import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebaseClient';
import Layout from '../components/Layout';
import AnnouncementList from '../components/Announcements';

function News() {
  const [items, setItems] = useState(null);
  useEffect(() => { getDocs(collection(db, 'announcements')).then((s) => setItems(s.docs.map((d) => ({ id: d.id, ...d.data() })))); }, []);
  return (
    <>
      <p className="text-xs text-ks-sub mb-3 px-1">最新10件まで表示されます。</p>
      {items && <AnnouncementList items={items} />}
    </>
  );
}
export default function Page() { return <Layout title="お知らせ"><News /></Layout>; }
