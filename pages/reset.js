import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth';
import { auth } from '../lib/firebaseClient';
import AuthCard from '../components/AuthCard';

// パスワード再設定メールのリンク先
export default function Reset() {
  const router = useRouter();
  const [state, setState] = useState('loading');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const code = String(router.query.oobCode || '');

  useEffect(() => {
    if (!router.isReady) return;
    if (!code) { setState('error'); return; }
    verifyPasswordResetCode(auth, code).then((m) => { setEmail(m); setState('form'); }).catch(() => setState('error'));
  }, [router.isReady, code]);

  async function submit(e) {
    e.preventDefault(); setErr('');
    if (pw.length < 8) { setErr('パスワードは8文字以上にしてください。'); return; }
    if (pw !== pw2) { setErr('確認用のパスワードが一致しません。'); return; }
    setBusy(true);
    try { await confirmPasswordReset(auth, code, pw); setState('done'); }
    catch (ex) { setErr(ex.code === 'auth/weak-password' ? 'もっと複雑なパスワードにしてください。' : 'パスワードを変更できませんでした。リンクの期限が切れている可能性があります。'); }
    setBusy(false);
  }

  return (
    <AuthCard>
      {state === 'loading' && <p className="text-ks-sub py-6">確認しています…</p>}
      {state === 'form' && (
        <form onSubmit={submit} className="text-left">
          <p className="font-serif font-bold text-xl mb-2 text-center">新しいパスワードの設定</p>
          <p className="text-xs text-ks-sub mb-5 text-center break-all">{email}</p>
          <div className="space-y-3">
            <input className="input" type="password" autoComplete="new-password" placeholder="新しいパスワード(8文字以上)" value={pw} onChange={(e) => setPw(e.target.value)} required />
            <input className="input" type="password" autoComplete="new-password" placeholder="新しいパスワード(確認用)" value={pw2} onChange={(e) => setPw2(e.target.value)} required />
          </div>
          {err && <p className="text-sm text-ks-red mt-3">{err}</p>}
          <button className="btn btn-primary w-full mt-5 py-3.5" disabled={busy}>{busy ? '変更中…' : 'パスワードを変更する'}</button>
        </form>
      )}
      {state === 'done' && (
        <>
          <div className="w-14 h-14 mx-auto rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-3xl mb-4">✓</div>
          <p className="font-serif font-bold text-xl mb-3">パスワードを変更しました</p>
          <p className="text-sm text-ks-sub mb-6">新しいパスワードでログインしてください。</p>
          <Link href="/login?mode=login" className="btn btn-primary w-full py-3.5">ログインへ進む</Link>
        </>
      )}
      {state === 'error' && (
        <>
          <p className="font-serif font-bold text-xl mb-3">このリンクは使えません</p>
          <p className="text-sm text-ks-sub mb-6">リンクの期限(約1時間)が切れているか、すでに使われています。ログイン画面の「パスワードを忘れた方」から、もう一度お試しください。</p>
          <Link href="/login?mode=login" className="btn btn-primary w-full py-3.5">ログイン画面へ</Link>
        </>
      )}
    </AuthCard>
  );
}
