// EP(収録作品)の情報:テーマ文・曲順・並び順・ジャケット(管理者専用)
import { handle, verifyRequest, adminDb, FieldValue } from '../../../lib/firebaseAdmin';

export const config = { api: { bodyParser: { sizeLimit: '4mb' } } };

const bad = (m, s = 400) => Object.assign(new Error(m), { status: s });
const ID = /^[A-Za-z0-9_-]{1,64}$/;

export default handle(async (req) => {
  await verifyRequest(req, { requireAdmin: true });
  const b = req.body || {};
  const db = adminDb();
  const col = db.collection('eps');
  const jackets = db.collection('epJackets');

  if (b.mode === 'list') {
    const [snap, jk] = await Promise.all([col.get(), jackets.listDocuments()]);
    const has = new Set(jk.map((d) => d.id));
    const eps = snap.docs.map((d) => {
      const x = d.data();
      return { id: d.id, name: x.name || '', theme: x.theme || '', order: Number.isFinite(x.order) ? x.order : 9999, tracks: x.tracks || [], playlistId: x.playlistId || '', hasJacket: has.has(d.id) };
    }).sort((a, c) => a.order - c.order || a.name.localeCompare(c.name));
    return { eps };
  }

  if (b.mode === 'get') {
    if (!ID.test(String(b.id || ''))) throw bad('EPの指定が正しくありません。');
    const d = await jackets.doc(String(b.id)).get();
    return { image: d.exists ? d.data().image || '' : '' };
  }

  if (b.mode === 'jacket') {
    if (!ID.test(String(b.id || ''))) throw bad('EPの指定が正しくありません。');
    const image = String(b.image || '');
    if (!image) { await jackets.doc(String(b.id)).delete(); return { ok: true }; }
    if (!/^data:image\/(png|jpeg|webp);base64,/.test(image)) throw bad('画像の形式が正しくありません。');
    if (image.length > 800000) throw bad('画像が大きすぎます。もう少し小さい画像を選んでください。');
    await jackets.doc(String(b.id)).set({ image, updatedAt: FieldValue.serverTimestamp() });
    return { ok: true };
  }

  if (b.mode === 'order') {
    const ids = (Array.isArray(b.ids) ? b.ids : []).map(String).filter((x) => ID.test(x));
    const batch = db.batch();
    ids.forEach((id, i) => batch.set(col.doc(id), { order: i }, { merge: true }));
    await batch.commit();
    return { ok: true };
  }

  if (b.mode === 'delete') {
    if (!ID.test(String(b.id || ''))) throw bad('EPの指定が正しくありません。');
    await Promise.all([col.doc(String(b.id)).delete(), jackets.doc(String(b.id)).delete()]);
    return { ok: true };
  }

  if (b.mode === 'save') {
    const name = String(b.name || '').trim();
    if (!name || name.length > 120) throw bad('EP名を入れてください。');
    const tracks = (Array.isArray(b.tracks) ? b.tracks : []).map(String);
    if (!tracks.length || tracks.length > 40 || tracks.some((t) => !ID.test(t))) throw bad('曲の指定が正しくありません。');
    const theme = String(b.theme || '').trim().slice(0, 400);
    const playlistId = /^[A-Za-z0-9_-]{0,80}$/.test(String(b.playlistId || '')) ? String(b.playlistId || '') : '';

    let ref;
    if (b.id) { if (!ID.test(String(b.id))) throw bad('EPの指定が正しくありません。'); ref = col.doc(String(b.id)); }
    else { const q = await col.where('name', '==', name).limit(1).get(); ref = q.empty ? col.doc() : q.docs[0].ref; }

    const cur = await ref.get();
    let order = Number.isFinite(b.order) ? b.order : (cur.exists && Number.isFinite(cur.data().order) ? cur.data().order : null);
    if (order === null) {
      const last = await col.orderBy('order', 'desc').limit(1).get();
      order = last.empty ? 0 : (last.docs[0].data().order || 0) + 1;
    }
    const data = { name, theme, tracks, order, updatedAt: FieldValue.serverTimestamp() };
    if (b.playlistId !== undefined) data.playlistId = playlistId;
    await ref.set(data, { merge: true });

    if (typeof b.image === 'string') {
      if (!b.image) await jackets.doc(ref.id).delete();
      else {
        if (!/^data:image\/(png|jpeg|webp);base64,/.test(b.image)) throw bad('画像の形式が正しくありません。');
        if (b.image.length > 800000) throw bad('画像が大きすぎます。もう少し小さい画像を選んでください。');
        await jackets.doc(ref.id).set({ image: b.image, updatedAt: FieldValue.serverTimestamp() });
      }
    }
    return { ok: true, id: ref.id };
  }

  throw bad('操作が正しくありません。');
});
