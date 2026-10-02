import { adminAuth, adminDb, handle, verifyRequest } from '../../../lib/firebaseAdmin';

// 名簿から削除:ログイン・プロフィール・カレンダー・保管庫・メッセージをまとめて削除
export default handle(async (req) => {
  const me = await verifyRequest(req, { requireAdmin: true });
  const email = String(req.body.email || '').toLowerCase();
  if (!email) throw Object.assign(new Error('メールアドレスが指定されていません。'), { status: 400 });
  const db = adminDb();
  const rosterRef = db.collection('roster').doc(email);
  const roster = await rosterRef.get();
  const uid = roster.exists ? roster.data().uid : null;
  if (uid && uid === me.uid) throw Object.assign(new Error('自分自身は削除できません。'), { status: 400 });
  if (uid) {
    await db.recursiveDelete(db.collection('users').doc(uid));
    for (const field of ['from', 'to']) {
      const ms = await db.collection('messages').where(field, '==', uid).get();
      for (const d of ms.docs) await d.ref.delete();
    }
    const others = await db.collection('roster').where('uid', '==', uid).get();
    for (const d of others.docs) await d.ref.delete();
    try { await adminAuth().deleteUser(uid); } catch (e) { if (e.code !== 'auth/user-not-found') throw e; }
  }
  await rosterRef.delete();
  return { ok: true };
});
