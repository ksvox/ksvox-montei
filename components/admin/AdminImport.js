import { useState } from 'react';
import { collection, deleteDoc, doc, getDocs, setDoc } from 'firebase/firestore';
import { db, api } from '../../lib/firebaseClient';
import { useApp } from '../AppContext';
import { compressImage, parseCSV, parseList } from '../../lib/utils';

const readText = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsText(file, 'utf-8'); });

export default function AdminImport() {
  const app = useApp();
  const [log, setLog] = useState([]);
  const [busy, setBusy] = useState(false);
  const add = (s) => setLog((l) => [...l, s]);

  async function songs(e) {
    const f = e.target.files?.[0]; if (!f) return;
    setBusy(true); setLog([]);
    try {
      const all = parseCSV(await readText(f));
      if (!all.length || !('lyrics_pdf_url' in all[0])) throw new Error('このファイルは楽曲のCSV(Song_export.csv)ではありません。');
      const rows = all.filter((r) => r.id && r.title);
      add(`${rows.length}曲を取り込みます。画面を閉じずにお待ちください。`);
      let ok = 0; const ng = [];
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const song = {
          id: r.id, title: r.title, lyrics_pdf_url: r.lyrics_pdf_url, song_url: r.song_url, range: r.range, vocal_type: r.vocal_type,
          recommended: r.is_recommended === 'true', easy: r.is_easy_to_sing === 'true',
          genres: parseList(r.genre), moods: parseList(r.mood), created_date: r.created_date,
        };
        try { const res = await api('/api/admin/import-song', { song }); if (res.pdfOk) ok++; else ng.push(`${r.title}(PDF:${res.pdfError || 'なし'})`); }
        catch (ex) { ng.push(`${r.title}(${ex.message})`); }
        if ((i + 1) % 10 === 0) add(`…${i + 1}/${rows.length}`);
      }
      add(`完了:${rows.length}曲を登録(うち歌詞PDFつき ${ok}曲)。`);
      if (ng.length) add(`歌詞PDFを取得できなかった曲(楽曲管理から個別に登録できます):\n${ng.join('\n')}`);
    } catch (ex) { add('エラー:' + ex.message); }
    e.target.value = ''; setBusy(false);
  }

  async function archive(e) {
    const f = e.target.files?.[0]; if (!f) return;
    setBusy(true); setLog([]);
    try {
      const all = parseCSV(await readText(f));
      if (!all.length || !('author_name' in all[0])) throw new Error('このファイルは課題曲のCSV(SongArchive_export.csv)ではありません。');
      const rows = all.filter((r) => r.title);
      const exist = await getDocs(collection(db, 'archive'));
      const done = new Set(exist.docs.map((d) => d.data().importId).filter(Boolean));
      let n = 0;
      for (const r of rows) {
        if (done.has(r.id)) continue;
        await setDoc(doc(db, 'archive', 'b44_' + r.id), {
          importId: r.id, authorName: r.author_name || '', authorEmail: (r.author_email || '').toLowerCase(),
          title: r.title, artist: r.artist || '', singer: r.singer || '', moods: parseList(r.mood), rating: Number(r.rating) || 0,
          releaseYear: r.release_year || '', lessonPeriod: r.lesson_period || '', youtubeUrl: r.youtube_url || '', memo: r.memo || '',
          createdAt: r.created_date ? new Date(r.created_date) : new Date(),
        });
        n++;
      }
      add(`課題曲 ${n}件を取り込みました。`);
    } catch (ex) { add('エラー:' + ex.message); }
    e.target.value = ''; setBusy(false);
  }

  async function settings(e) {
    const f = e.target.files?.[0]; if (!f) return;
    setBusy(true); setLog([]);
    try {
      const rows = parseCSV(await readText(f));
      const banner = rows.find((r) => r.setting_key === 'top_banner');
      if (!banner?.value) add('バナー画像が見つかりませんでした。');
      else {
        const { dataUrl } = await api('/api/admin/fetch-image', { url: banner.value });
        const img = await compressImage(dataUrl, { maxSize: 1400, maxBytes: 350000 });
        await setDoc(doc(db, 'settings', 'app'), { bannerImage: img }, { merge: true });
        app.setSettings({ ...app.settings, bannerImage: img });
        add('トップバナー画像を取り込みました。');
      }
    } catch (ex) { add('エラー:' + ex.message); }
    e.target.value = ''; setBusy(false);
  }

  // ②で楽曲CSVを読み込んでしまった場合の後片付け(投稿者のない取り込みデータだけを削除)
  async function cleanup() {
    const s = await getDocs(collection(db, 'archive'));
    const wrong = s.docs.filter((d) => { const v = d.data(); return v.importId && !v.authorName && !v.authorEmail && !v.authorUid; });
    if (!wrong.length) { setLog(['誤って取り込まれたデータは見つかりませんでした。']); return; }
    if (!confirm(`課題曲アーカイブに誤って入った ${wrong.length} 件を削除します。よろしいですか?`)) return;
    setBusy(true); setLog([]);
    for (const d of wrong) await deleteDoc(d.ref);
    setLog([`${wrong.length}件を削除しました。課題曲アーカイブには本来の投稿だけが残っています。`]);
    setBusy(false);
  }

  const Btn = ({ label, onChange }) => (
    <label className={`btn btn-ghost w-full mb-3 cursor-pointer ${busy ? 'opacity-50 pointer-events-none' : ''}`}>{label}
      <input type="file" accept=".csv,text/csv" className="hidden" onChange={onChange} disabled={busy} />
    </label>
  );

  return (
    <div>
      <p className="text-sm text-ks-sub mb-4 leading-relaxed">Base44からエクスポートしたCSVファイルを選ぶと、新しいアプリに取り込みます。何度実行しても同じデータが二重になることはありません。</p>
      <Btn label="① 楽曲(Song_export.csv)を取り込む" onChange={songs} />
      <Btn label="② 課題曲(SongArchive_export.csv)を取り込む" onChange={archive} />
      <Btn label="③ バナー画像(AppSettings_export.csv)を取り込む" onChange={settings} />
      <button className="btn btn-ghost btn-sm w-full mb-4 text-ks-red" disabled={busy} onClick={cleanup}>課題曲アーカイブに誤って入った楽曲データを削除する</button>
      {busy && <p className="text-sm font-bold text-ks-red mb-2">取り込み中です。画面を閉じないでください。</p>}
      {log.length > 0 && <pre className="text-xs whitespace-pre-wrap bg-white border border-ks-border rounded-xl p-3 font-sans leading-relaxed">{log.join('\n')}</pre>}
    </div>
  );
}
