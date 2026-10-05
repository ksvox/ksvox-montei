// 楽曲検索はShowcaseアプリへ移りました(ブックマークから来た人も、生徒モードで自動的に開く)
import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { api } from '../lib/firebaseClient';
import { Spinner } from '../components/ui';

const SHOWCASE_URL = 'https://showcase.ksvox.net/';

function MoveToShowcase() {
  const [err, setErr] = useState('');
  useEffect(() => {
    (async () => {
      try {
        const { pass } = await api('/api/app-pass');
        const u = new URL(SHOWCASE_URL);
        u.searchParams.set('kspass', pass);
        window.location.replace(u.toString());
      } catch (e) { setErr(e.message); }
    })();
  }, []);
  return (
    <div className="text-center py-10">
      {!err && <><Spinner /><p className="text-sm text-ks-sub mt-3">Showcaseアプリを開いています…</p></>}
      {err && (
        <>
          <p className="text-sm text-ks-red mb-3">{err}</p>
          <a className="btn btn-primary" href="/">トップに戻る</a>
        </>
      )}
    </div>
  );
}

export default function Page() { return <Layout title="楽曲検索"><MoveToShowcase /></Layout>; }
