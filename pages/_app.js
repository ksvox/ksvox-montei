import { useEffect } from 'react';
import Head from 'next/head';
import '../styles/globals.css';
import { AppProvider } from '../components/AppContext';
import { applyFontSize, getFontSize } from '../lib/fontSize';

export default function App({ Component, pageProps }) {
  useEffect(() => { applyFontSize(getFontSize()); }, []);
  return (
    <AppProvider>
      <Head>
        <title>K's VOX 門弟アプリ</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>
      <Component {...pageProps} />
    </AppProvider>
  );
}
