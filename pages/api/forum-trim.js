import { adminDb, handle, verifyRequest } from '../../lib/firebaseAdmin';
import { KEEP_LIMIT } from '../../lib/constants';

// フォーラムは最新10件まで。古い投稿は返信ごと削除
export default handle(async (req) => {
  await verifyRequest(req);
  const db = adminDb();
  const snap = await db.collection('forumPosts').orderBy('createdAt', 'desc').get();
  const old = snap.docs.slice(KEEP_LIMIT);
  for (const d of old) await db.recursiveDelete(d.ref);
  return { ok: true, removed: old.length };
});
