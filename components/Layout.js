import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { FONT_SIZES, applyFontSize, getFontSize } from '../lib/fontSize';
import { useApp } from './AppContext';
import { Spinner } from './ui';

const TABS = [
  { href: '/', label: 'トップ', icon: 'M3 11l9-7 9 7v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z' },
  { href: '/songs', label: '楽曲検索', icon: 'M9 18V5l12-2v13M9 18a3 3 0 11-6 0 3 3 0 016 0zm12-2a3 3 0 11-6 0 3 3 0 016 0z' },
  { href: '/forum', label: 'フォーラム', icon: 'M21 12a8 8 0 01-11.6 7.1L4 20l1.1-4.6A8 8 0 1121 12z' },
  { href: '/mypage', label: 'マイページ', icon: 'M12 12a4 4 0 100-8 4 4 0 000 8zm-8 9a8 8 0 0116 0' },
  { href: '/members', label: '会員一覧', icon: 'M17 20v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2m14-9a3 3 0 100-6m4 15v-2a4 4 0 00-3-3.9M10 8a3 3 0 11-6 0 3 3 0 016 0z' },
];

export default function Layout({ children, adminOnly = false, title }) {
  const app = useApp();
  const router = useRouter();

  useEffect(() => {
    if (app.loading) return;
    if (app.status !== 'member') router.replace('/login');
    else if (adminOnly && !app.isAdmin) router.replace('/');
  }, [app.loading, app.status, app.isAdmin, adminOnly, router]);

  const [fontOpen, setFontOpen] = useState(false);
  const [font, setFont] = useState('normal');
  useEffect(() => { setFont(getFontSize()); }, []);
  const pickFont = (k) => { setFont(applyFontSize(k)); setFontOpen(false); };

  const ready = !app.loading && app.status === 'member' && (!adminOnly || app.isAdmin);
  const path = router.pathname;

  return (
    <div className="min-h-screen flex justify-center">
      <div className="w-full max-w-[480px] min-h-screen bg-ks-bg relative shadow-sm">
        <header className="sticky top-0 z-30 bg-ks-bg/95 backdrop-blur border-b border-ks-border px-4 py-2.5 flex items-center justify-between" style={{ paddingTop: 'calc(10px + env(safe-area-inset-top))' }}>
          <Link href="/" className="flex items-center gap-2.5">
            <img src="/logo.png" alt="K's VOX" className="w-9 h-9 rounded-full" />
            <div>
              <div className="font-serif font-bold text-[15px] leading-tight">ボーカル道場 K's VOX</div>
              <div className="text-[10px] text-ks-sub tracking-wider">門弟アプリ</div>
            </div>
          </Link>
          <div className="flex items-center gap-3 relative">
            <button onClick={() => setFontOpen(!fontOpen)} aria-label="文字の拡大"
              className={`px-3 py-1.5 rounded-full text-xs font-bold border ${font !== 'normal' ? 'bg-ks-text text-white border-ks-text' : 'bg-white text-ks-text border-ks-border'}`}>拡大🔎</button>
            {ready && app.isAdmin && (
              <Link href="/admin" className={`px-3 py-1.5 rounded-full text-xs font-bold ${path === '/admin' ? 'bg-ks-gold text-white' : 'bg-ks-goldlight text-[#8A6B2E] border border-[#EBDDBE]'}`}>管理</Link>
            )}
            {fontOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setFontOpen(false)} />
                <div className="absolute right-0 top-full mt-2 z-50 card shadow-lg p-2 w-44">
                  <p className="text-xs text-ks-sub px-2 pt-1 pb-2">文字の大きさ</p>
                  {FONT_SIZES.map((f) => (
                    <button key={f.key} onClick={() => pickFont(f.key)}
                      className={`w-full text-left px-3 py-2 rounded-lg font-bold flex items-center justify-between ${font === f.key ? 'bg-ks-goldlight' : ''}`}>
                      <span style={{ fontSize: f.px }}>{f.label}</span>{font === f.key && <span className="text-ks-red">✓</span>}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </header>
        <main className="px-4 pt-4 pb-safe">
          {title && <h1 className="font-serif font-extrabold text-2xl mb-5 px-1">{title}</h1>}
          {ready ? children : <Spinner />}
        </main>
        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] z-30 bg-white/95 backdrop-blur border-t border-ks-border flex" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          {TABS.map((t) => {
            const active = t.href === '/' ? path === '/' : path.startsWith(t.href);
            return (
              <Link key={t.href} href={t.href} className={`flex-1 flex flex-col items-center pt-2 pb-1.5 text-[10px] font-bold ${active ? 'text-ks-red' : 'text-ks-sub'}`}>
                <svg viewBox="0 0 24 24" className="w-6 h-6 mb-0.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={t.icon} /></svg>
                {t.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
