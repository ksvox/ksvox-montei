import { Html, Head, Main, NextScript } from 'next/document';

const tw = `tailwind.config = { theme: { extend: {
  colors: { ks: { red: '#E54D26', redhover: '#C93C18', gold: '#C5A059', goldlight: '#F8F3E8', bg: '#FAF8F5', text: '#2C2825', sub: '#78716C', border: '#EDE8E1', paypay: '#FF0033' } },
  fontFamily: { serif: ['"Shippori Mincho"', 'serif'], sans: ['"Zen Kaku Gothic New"', 'sans-serif'] }
} } };`;

export default function Document() {
  return (
    <Html lang="ja">
      <Head>
        <meta name="robots" content="noindex, nofollow" />
        <meta name="theme-color" content="#FAF8F5" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="門弟アプリ" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/favicon.png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@500;700;800&family=Zen+Kaku+Gothic+New:wght@400;500;700&display=swap" rel="stylesheet" />
        <script src="https://cdn.tailwindcss.com"></script>
        <script dangerouslySetInnerHTML={{ __html: tw }} />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
