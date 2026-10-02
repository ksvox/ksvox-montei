import { adminDb, handle, verifyRequest, FieldValue } from '../../../lib/firebaseAdmin';

export const config = { api: { bodyParser: { sizeLimit: '2mb' } } };
const CHUNK = 700000;

// Base44の楽曲1件を取り込む(歌詞PDFはBase44の公開アドレスから取得)
export default handle(async (req) => {
  await verifyRequest(req, { requireAdmin: true });
  const s = req.body.song || {};
  if (!s.id || !s.title) throw Object.assign(new Error('曲データが不足しています。'), { status: 400 });
  const db = adminDb();
  const ref = db.collection('songs').doc(String(s.id));
  let pdfOk = false;
  let pdfError = '';
  if (s.lyrics_pdf_url) {
    try {
      const r = await fetch(s.lyrics_pdf_url);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const b64 = Buffer.from(await r.arrayBuffer()).toString('base64');
      const old = await ref.collection('pdf').get();
      const batch = db.batch();
      old.forEach((d) => batch.delete(d.ref));
      const n = Math.ceil(b64.length / CHUNK);
      for (let i = 0; i < n; i++) batch.set(ref.collection('pdf').doc(String(i).padStart(3, '0')), { i, data: b64.slice(i * CHUNK, (i + 1) * CHUNK) });
      await batch.commit();
      pdfOk = true;
    } catch (e) { pdfError = e.message; }
  }
  await ref.set({
    title: s.title,
    recommended: s.recommended === true,
    easy: s.easy === true,
    songUrl: s.song_url || '',
    genres: s.genres || [],
    vocal: s.vocal_type || '',
    moods: s.moods || [],
    range: s.range || '',
    hasPdf: pdfOk,
    createdAt: s.created_date ? new Date(s.created_date) : FieldValue.serverTimestamp(),
    importedFrom: 'base44',
  }, { merge: true });
  return { ok: true, pdfOk, pdfError };
});
