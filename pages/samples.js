import { useEffect, useRef, useState } from 'react';
import Layout from '../components/Layout';
import { Spinner } from '../components/ui';
import { SAMPLE_SLOTS, loadSampleDocs, loadSampleAudio } from '../lib/samples';

function Jacket({ src, mono, title }) {
  return src
    ? <img src={src} alt="" className="w-20 h-20 rounded-xl object-cover shrink-0 border border-ks-border transition" style={{ filter: mono ? 'grayscale(1)' : 'none' }} />
    : <div className="w-20 h-20 rounded-xl shrink-0 border border-ks-border bg-ks-goldlight flex items-center justify-center font-serif font-bold text-ks-gold text-sm text-center leading-tight p-1">{title}</div>;
}

function PlayBtn({ s, d, slot, label, current, busy, play }) {
  const has = !!d.audio?.[slot];
  const key = `${s.id}_${slot}`;
  const on = current?.id === s.id && current?.slot === slot;
  return (
    <button disabled={!has || busy === key} onClick={() => play(s, slot)}
      className={`btn btn-sm flex-1 ${on ? 'btn-primary' : 'btn-ghost'} disabled:opacity-40`}>
      {busy === key ? '準備中…' : has ? `▶ ${label}` : `${label}(準備中)`}
    </button>
  );
}

function Card({ s, d, current, busy, play }) {
  const isCur = current?.id === s.id;
  const p = { s, d, current, busy, play };
  return (
    <article className="card p-3.5">
      <div className="flex gap-3">
        <Jacket src={d.image} mono={isCur && current.slot === 'ondoku'} title={s.title} />
        <div className="flex-1 min-w-0 flex flex-col">
          <h3 className="font-bold text-[16px] leading-snug">{s.intro ? s.title : `${s.no}. ${s.title}`}</h3>
          <p className="text-xs text-ks-sub mt-0.5">{s.intro ? s.sub : s.author}</p>
          <div className="flex gap-2 mt-auto pt-2">
            {s.intro
              ? <PlayBtn {...p} slot="main" label="聴く" />
              : <><PlayBtn {...p} slot="ondoku" label="音読" /><PlayBtn {...p} slot="roudoku" label="朗読" /></>}
          </div>
        </div>
      </div>
      {isCur && (
        <div className="mt-3">
          <audio key={current.url} src={current.url} controls autoPlay className="w-full" />
          {!s.intro && <p className="text-[11px] text-ks-sub mt-1 text-right">{current.slot === 'ondoku' ? '音読' : '朗読'}を再生中</p>}
        </div>
      )}
    </article>
  );
}

function Samples() {
  const [docs, setDocs] = useState(null);
  const [current, setCurrent] = useState(null); // { id, slot, url }
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const cache = useRef({});

  useEffect(() => { loadSampleDocs().then(setDocs).catch((e) => { setDocs({}); setErr(e.message); }); }, []);
  useEffect(() => () => Object.values(cache.current).forEach((u) => URL.revokeObjectURL(u)), []);

  async function play(s, slot) {
    const key = `${s.id}_${slot}`;
    setErr('');
    if (cache.current[key]) { setCurrent({ id: s.id, slot, url: cache.current[key] }); return; }
    setBusy(key);
    try {
      const blob = await loadSampleAudio(s.id, slot, docs[s.id]?.mime?.[slot]);
      cache.current[key] = URL.createObjectURL(blob);
      setCurrent({ id: s.id, slot, url: cache.current[key] });
    } catch (e) { setErr(e.message); }
    setBusy('');
  }

  if (!docs) return <Spinner />;
  const intro = SAMPLE_SLOTS.filter((s) => s.intro);
  const tasks = SAMPLE_SLOTS.filter((s) => !s.intro);

  return (
    <>
      <p className="text-sm text-ks-sub mb-4 px-1 leading-relaxed">NOBU先生による朗読課題の見本音声です。音読と朗読、それぞれ聴き比べてみましょう。</p>
      {err && <p className="text-sm text-ks-red mb-3">{err}</p>}
      <h2 className="font-serif font-bold text-lg mb-2 px-1">イントロダクション</h2>
      <div className="space-y-3 mb-6">{intro.map((s) => <Card key={s.id} s={s} d={docs[s.id] || {}} current={current} busy={busy} play={play} />)}</div>
      <h2 className="font-serif font-bold text-lg mb-2 px-1">朗読課題 20篇</h2>
      <div className="space-y-3">{tasks.map((s) => <Card key={s.id} s={s} d={docs[s.id] || {}} current={current} busy={busy} play={play} />)}</div>
    </>
  );
}

export default function Page() { return <Layout title="朗読見本音声"><Samples /></Layout>; }
