// 公開用:各アプリが「今のバナー」を読みに来る(誰でも読める。画像は別のアドレスで渡す)
import { adminDb } from '../../../lib/firebaseAdmin';
import { BANNER_SLOTS } from '../../../lib/constants';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=60');
  const slot = String(req.query.slot || '');
  if (!BANNER_SLOTS.some((s) => s.key === slot)) return res.status(400).json({ active: false });
  try {
    const d = await adminDb().collection('adBanners').doc(slot).get();
    const x = d.exists ? d.data() : null;
    if (!x || x.active === false || !x.image || !x.link) return res.status(200).json({ active: false });
    const v = x.updatedAt?.toMillis?.() || 0;
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    return res.status(200).json({ active: true, link: x.link, image: `https://${host}/api/public/banner-image?slot=${slot}&v=${v}` });
  } catch (e) {
    console.error(e);
    return res.status(200).json({ active: false });
  }
}
