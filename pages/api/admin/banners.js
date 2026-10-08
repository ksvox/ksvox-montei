// 他アプリ(Showcase・コエシル)のトップに出すバナーの保存(管理者専用)
import { handle, verifyRequest, adminDb, FieldValue } from '../../../lib/firebaseAdmin';
import { BANNER_SLOTS } from '../../../lib/constants';

export default handle(async (req) => {
  await verifyRequest(req, { requireAdmin: true });
  const { mode, slot, image, link, active } = req.body || {};
  const col = adminDb().collection('adBanners');
  if (mode === 'list') {
    const snap = await col.get();
    const out = {};
    snap.docs.forEach((d) => { const x = d.data(); out[d.id] = { link: x.link || '', active: x.active !== false, image: x.image || '', v: x.updatedAt?.toMillis?.() || 0 }; });
    return { banners: out };
  }
  if (!BANNER_SLOTS.some((s) => s.key === slot)) throw Object.assign(new Error('バナー枠の指定が正しくありません。'), { status: 400 });
  if (link && !/^https?:\/\//.test(String(link))) throw Object.assign(new Error('リンク先は https:// から始まるアドレスを入れてください。'), { status: 400 });
  const data = { link: String(link || '').trim(), active: active !== false, updatedAt: FieldValue.serverTimestamp() };
  if (typeof image === 'string') {
    if (image && !/^data:image\/(png|jpeg|webp|gif);base64,/.test(image)) throw Object.assign(new Error('画像の形式が正しくありません。'), { status: 400 });
    if (image.length > 900000) throw Object.assign(new Error('画像が大きすぎます。もう少し小さい画像を選んでください。'), { status: 400 });
    data.image = image;
  }
  await col.doc(slot).set(data, { merge: true });
  return { ok: true };
});
