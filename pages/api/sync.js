import { adminDb, ADMIN_EMAIL, handle, verifyRequest } from '../../lib/firebaseAdmin';

// ログイン時の確認:名簿にあるか、メールアドレス変更の後始末、管理者の判定
export default handle(async (req) => {
  const { uid, email, decoded } = await verifyRequest(req, { requireMember: false });
  if (!decoded.email_verified) return { member: false, verified: false };
  const db = adminDb();
  const rosterRef = db.collection('roster').doc(email);
  const roster = await rosterRef.get();
  if (!roster.exists) return { member: false, verified: true };
  if (!roster.data().uid) await rosterRef.update({ uid });
  const old = await db.collection('roster').where('uid', '==', uid).get();
  for (const d of old.docs) if (d.id !== email) await d.ref.delete();
  const userRef = db.collection('users').doc(uid);
  const u = await userRef.get();
  if (u.exists && u.data().email !== email) await userRef.update({ email });
  if (email === ADMIN_EMAIL) await db.collection('admins').doc(uid).set({ email });
  const isAdmin = (await db.collection('admins').doc(uid).get()).exists;
  return { member: true, isAdmin };
});
