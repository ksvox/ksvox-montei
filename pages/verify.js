import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { applyActionCode } from 'firebase/auth';
import { auth } from '../lib/firebaseClient';
import AuthCard from '../components/AuthCard';

// 確認メールのリンク先:ここを開いて初めて登録が完了する
export default function Verify() {
  const router = useRouter();
  const [state, setState] = useState('loading');

  useEffect(() => {
    if (!router.isReady) return;
    const code = router.query.oobCode;
    if (!code) { setState('error'); return; }
    applyActionCode(auth, String(code))
      .then(async () => { setState('done'); try { if (auth.currentUser) await auth.currentUser.reload(); } catch (e) { /* noop */ } })
      .catch(() => setState('error'));
  }, [router.isReady, router.query.oobCode]);

  return (
    <AuthCard>
      {state === 'loading' && <p className="text-ks-sub py-6">登録を確認しています…</p>}
      {state === 'done' && (
        <>
          <div className="w-14 h-14 mx-auto rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-3xl mb-4">✓</div>
          <p className="font-serif font-bold text-xl mb-3">登録が完了しました</p>
          <p className="text-sm text-ks-sub mb-6">下のボタンからログインして、マイページでプロフィール(アイコン・名前・ニックネーム・電話番号・生年月日)を登録してください。</p>
          <a href="/login?mode=login" className="btn btn-primary w-full py-3.5">ログインへ進む</a>
        </>
      )}
      {state === 'error' && (
        <>
          <p className="font-serif font-bold text-xl mb-3">このリンクは使えません</p>
          <p className="text-sm text-ks-sub mb-6">すでに登録が完了しているか、リンクの期限が切れています。まずはログインしてみてください。確認がまだの場合は、ログイン後の画面から確認メールを送り直せます。</p>
          <a href="/login?mode=login" className="btn btn-primary w-full py-3.5">ログインへ進む</a>
        </>
      )}
    </AuthCard>
  );
}
