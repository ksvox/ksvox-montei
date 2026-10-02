import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth, api } from '../lib/firebaseClient';
import { useApp } from '../components/AppContext';

const ERR = {
  'auth/invalid-credential': 'メールアドレスかパスワードが違います。',
  'auth/wrong-password': 'メールアドレスかパスワードが違います。',
  'auth/user-not-found': 'メールアドレスかパスワードが違います。',
  'auth/too-many-requests': '試行回数が多すぎます。しばらく待ってからお試しください。',
  'auth/invalid-email': 'メールアドレスの形式が正しくありません。',
};

export default function Login() {
  const app = useApp();
  const router = useRouter();
  const [mode, setMode] = useState('gate');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!app.loading && app.status === 'member') router.replace('/'); }, [app.loading, app.status, router]);
  useEffect(() => { if (router.query.mode === 'login') setMode('login'); }, [router.query.mode]);

  const go = (m) => { setMode(m); setErr(''); setMsg(''); };

  async function login(e) {
    e.preventDefault(); setErr(''); setBusy(true);
    try { await signInWithEmailAndPassword(auth, email.trim(), pw); }
    catch (ex) { setErr(ERR[ex.code] || 'ログインできませんでした。'); }
    setBusy(false);
  }
  async function register(e) {
    e.preventDefault(); setErr('');
    if (pw !== pw2) { setErr('確認用のパスワードが一致しません。'); return; }
    setBusy(true);
    try {
      await api('/api/register', { email: email.trim(), password: pw });
      go('sent');
    } catch (ex) { setErr(ex.message); }
    setBusy(false);
  }
  async function reset(e) {
    e.preventDefault(); setErr(''); setBusy(true);
    try { await api('/api/reset-password', { email: email.trim() }); setMsg('登録されているメールアドレスであれば、パスワード再設定のメールを送りました。メール内のリンクから新しいパスワードを設定してください。'); }
    catch (ex) { setErr(ex.message || '送信できませんでした。'); }
    setBusy(false);
  }
  async function resend() {
    setBusy(true); setErr('');
    try { await api('/api/resend-verification'); setMsg('確認メールを再送しました。'); } catch (ex) { setErr(ex.message); }
    setBusy(false);
  }

  const st = app.status;
  return (
    <div className="min-h-screen flex justify-center bg-ks-bg">
      <div className="w-full max-w-[420px] px-6 flex flex-col" style={{ paddingTop: 'calc(48px + env(safe-area-inset-top))', paddingBottom: 'calc(28px + env(safe-area-inset-bottom))' }}>
        <div className="text-center mb-10">
          <img src="/logo.png" alt="K's VOX MEMBER APP" className="w-32 h-32 mx-auto rounded-[28px] shadow-md" />
          <h1 className="font-serif font-extrabold text-[28px] mt-6 tracking-wide">門弟アプリ</h1>
          <p className="text-sm text-ks-sub mt-1">ボーカル道場 K's VOX</p>
        </div>

        {app.loading ? <p className="text-center text-sm text-ks-sub">確認中…</p>
          : st === 'unverified' ? (
            <div className="card p-5 text-sm leading-relaxed">
              <p className="font-bold mb-2">メールアドレスの確認がまだです</p>
              <p className="text-ks-sub mb-4">{app.user?.email} に届いた確認メールのリンクを押してから、もう一度ログインしてください。</p>
              <div className="flex gap-2">
                <button className="btn btn-primary flex-1" onClick={() => window.location.reload()}>確認しました</button>
                <button className="btn btn-ghost" disabled={busy} onClick={resend}>メールを再送</button>
              </div>
              <button className="text-xs text-ks-sub mt-4 underline" onClick={app.logout}>別のアカウントでログイン</button>
            </div>
          ) : st === 'notmember' || st === 'error' ? (
            <div className="card p-5 text-sm leading-relaxed">
              <p className="font-bold mb-2">{st === 'notmember' ? '名簿に登録されていません' : '接続に問題があります'}</p>
              <p className="text-ks-sub mb-4">{st === 'notmember' ? 'このアカウントでは門弟アプリを利用できません。NOBU先生にお問い合わせください。' : app.error}</p>
              <button className="btn btn-ghost w-full" onClick={app.logout}>ログアウト</button>
            </div>
          ) : mode === 'gate' ? (
            <div className="space-y-3">
              <button className="btn btn-primary w-full py-3.5" onClick={() => go('login')}>ログイン</button>
              <button className="btn btn-ghost w-full py-3.5" onClick={() => go('register')}>はじめての方</button>
            </div>
          ) : mode === 'sent' ? (
            <div className="card p-5 text-sm leading-relaxed">
              <p className="font-bold mb-2">確認メールを送りました</p>
              <p className="text-ks-sub mb-4">{email} に届いたメールのリンクを押すと登録が完了します。完了したら「ログイン」からお入りください。メールが見当たらない場合は迷惑メールフォルダもご確認ください。</p>
              <button className="btn btn-primary w-full" onClick={() => go('login')}>ログインへ</button>
            </div>
          ) : (
            <form onSubmit={mode === 'login' ? login : mode === 'register' ? register : reset} className="card p-5">
              <h2 className="font-serif font-bold text-lg mb-1">{mode === 'login' ? 'ログイン' : mode === 'register' ? 'はじめての方' : 'パスワードの再設定'}</h2>
              {mode === 'register' && <p className="text-xs text-ks-sub mb-4 leading-relaxed">NOBU先生に登録してもらったメールアドレスと、ご自身で決めたパスワード(8文字以上)を入力してください。</p>}
              {mode === 'reset' && <p className="text-xs text-ks-sub mb-4">登録したメールアドレスに再設定用のメールを送ります。</p>}
              <div className="space-y-3 mt-3">
                <input className="input" type="email" autoComplete="email" placeholder="メールアドレス" value={email} onChange={(e) => setEmail(e.target.value)} required />
                {mode !== 'reset' && <input className="input" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder="パスワード" value={pw} onChange={(e) => setPw(e.target.value)} required minLength={mode === 'register' ? 8 : undefined} />}
                {mode === 'register' && <input className="input" type="password" autoComplete="new-password" placeholder="パスワード(確認用)" value={pw2} onChange={(e) => setPw2(e.target.value)} required />}
              </div>
              {err && <p className="text-sm text-ks-red mt-3">{err}</p>}
              {msg && <p className="text-sm text-emerald-700 mt-3">{msg}</p>}
              <button className="btn btn-primary w-full mt-5" disabled={busy}>{busy ? '送信中…' : mode === 'login' ? 'ログイン' : mode === 'register' ? '登録する' : '再設定メールを送る'}</button>
              <div className="flex justify-between mt-4 text-xs text-ks-sub">
                <button type="button" onClick={() => go('gate')}>戻る</button>
                {mode === 'login' && <button type="button" onClick={() => go('reset')}>パスワードを忘れた方</button>}
              </div>
            </form>
          )}

        {msg && st === 'unverified' && <p className="text-sm text-emerald-700 mt-3 text-center">{msg}</p>}
        {err && st === 'unverified' && <p className="text-sm text-ks-red mt-3 text-center">{err}</p>}
        <div className="mt-auto pt-12 text-center">
          <a href="https://www.ksvox.net" className="text-xs text-ks-sub underline">K's VOX公式サイトへ</a>
        </div>
      </div>
    </div>
  );
}
