// 公開用:バナー画像そのもの
import { adminDb } from '../../../lib/firebaseAdmin';
import { BANNER_SLOTS } from '../../../lib/constants';

export default async function handler(req, res) {
  const slot = String(req.query.slot || '');
  if (!BANNER_SLOTS.some((s) => s.key === slot)) return res.status(404).end();
  try {
    const d = await adminDb().collection('adBanners').doc(slot).get();
    const m = /^data:(image\/[a-z]+);base64,(.+)$/.exec(d.exists ? d.data().image || '' : '');
    if (!m) return res.status(404).end();
    res.setHeader('Content-Type', m[1]);
    res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.send(Buffer.from(m[2], 'base64'));
  } catch (e) {
    console.error(e);
    return res.status(500).end();
  }
}
