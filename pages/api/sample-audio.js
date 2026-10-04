// 朗読AIコーチから呼ばれ、課題の「朗読」見本音声を渡す(共通の合言葉で署名を確認)
import crypto from 'crypto';
import { adminDb } from '../../lib/firebaseAdmin';
import { SAMPLE_TASKS } from '../../lib/sampleTasks';

export const config = { api: { responseLimit: false } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POSTのみ対応しています。' });
  try {
    const secret = process.env.KS_APP_PASS_SECRET;
    if (!secret) return res.status(500).json({ error: '門弟アプリの設定(KS_APP_PASS_SECRET)が未登録です。' });
    const { no, exp, sig } = req.body || {};
    const n = Number(no);
    if (!Number.isInteger(n) || n < 1 || n > SAMPLE_TASKS.length) return res.status(400).json({ error: '課題の番号が正しくありません。' });
    if (!exp || Number(exp) < Math.floor(Date.now() / 1000)) return res.status(403).json({ error: '有効期限が切れています。' });
    const expect = crypto.createHmac('sha256', secret).update(`sample.${n}.${exp}`).digest('base64url');
    const a = Buffer.from(String(sig || '')); const b = Buffer.from(expect);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.status(403).json({ error: '確認できませんでした。' });

    const id = 't' + String(n).padStart(2, '0');
    const db = adminDb();
    const [d, chunks] = await Promise.all([
      db.collection('samples').doc(id).get(),
      db.collection('samples').doc(id).collection('audio_roudoku').get(),
    ]);
    if (chunks.empty) return res.status(404).json({ error: 'この課題の見本音声はまだ登録されていません。' });
    const data = chunks.docs.map((c) => c.data()).sort((x, y) => x.i - y.i).map((c) => c.data).join('');
    const [title, author] = SAMPLE_TASKS[n - 1];
    return res.status(200).json({ title, author, image: d.data()?.image || '', mime: d.data()?.mime?.roudoku || 'audio/mpeg', data });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: '見本音声を読み込めませんでした。' });
  }
}
