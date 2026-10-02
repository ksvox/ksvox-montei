import { adminDb, adminAuth, handle, verifyRequest, FieldValue } from '../../lib/firebaseAdmin';

// メールアドレス変更の前に、新しいアドレスを名簿に用意する
export default handle(async (req) => {
  const { uid, email } = await verifyRequest(req);
  const newEmail = String(req.body.newEmail || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) throw Object.assign(new Error('メールアドレスの形式が正しくありません。'), { status: 400 });
  if (newEmail === email) throw Object.assign(new Error('現在と同じメールアドレスです。'), { status: 400 });
  try {
    await adminAuth().getUserByEmail(newEmail);
    throw Object.assign(new Error('このメールアドレスは他の会員が使っています。'), { status: 409 });
  } catch (e) { if (e.status) throw e; }
  const db = adminDb();
  const target = await db.collection('roster').doc(newEmail).get();
  if (target.exists && target.data().uid && target.data().uid !== uid) throw Object.assign(new Error('このメールアドレスは他の会員が使っています。'), { status: 409 });
  const cur = await db.collection('roster').doc(email).get();
  await db.collection('roster').doc(newEmail).set({ ...cur.data(), email: newEmail, uid, movedFrom: email, updatedAt: FieldValue.serverTimestamp() });
  return { ok: true };
});
