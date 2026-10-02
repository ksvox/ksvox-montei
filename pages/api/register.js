import { adminAuth, adminDb, ADMIN_EMAIL, handle, FieldValue, getOrigin } from '../../lib/firebaseAdmin';
import { sendMail, SIGNATURE } from '../../lib/mailer';

// Firebase標準の確認画面ではなく、門弟アプリ内の日本語ページへ案内するリンクを作る
export async function makeVerifyLink(req, email) {
  const raw = await adminAuth().generateEmailVerificationLink(email);
  const code = new URL(raw).searchParams.get('oobCode');
  return `${getOrigin(req)}/verify?oobCode=${encodeURIComponent(code)}`;
}

export function verifyMailText(link) {
  return `門弟アプリへのご登録ありがとうございます。
以下のリンクを押すと登録が完了します。

${link}

登録完了後、アプリにログインしてマイページを開き、アイコン・名前(本名)・ニックネーム(アプリ内で表示される名前)・メールアドレス・電話番号・生年月日の登録を行ってください。
本名・電話番号・生年月日は、門弟の皆さんの連絡網として共有されます。${SIGNATURE}`;
}

export default handle(async (req) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Object.assign(new Error('メールアドレスの形式が正しくありません。'), { status: 400 });
  if (password.length < 8) throw Object.assign(new Error('パスワードは8文字以上にしてください。'), { status: 400 });

  const db = adminDb();
  const rosterRef = db.collection('roster').doc(email);
  let roster = await rosterRef.get();
  if (!roster.exists) {
    if (email !== ADMIN_EMAIL) throw Object.assign(new Error('このメールアドレスは登録されていません。NOBU先生にお問い合わせください。'), { status: 403 });
    await rosterRef.set({ email, className: '', joinYm: '', memo: '管理者', createdAt: FieldValue.serverTimestamp() });
    roster = await rosterRef.get();
  }
  if (roster.data().uid) throw Object.assign(new Error('このメールアドレスは登録済みです。「ログイン」からお入りください。'), { status: 409 });

  const auth = adminAuth();
  let user;
  try {
    user = await auth.getUserByEmail(email);
    throw Object.assign(new Error('このメールアドレスは登録済みです。「ログイン」からお入りください。'), { status: 409 });
  } catch (e) {
    if (e.status) throw e;
    if (e.code !== 'auth/user-not-found') throw e;
  }
  user = await auth.createUser({ email, password, emailVerified: false });
  const r = roster.data();
  await db.collection('users').doc(user.uid).set({
    email, realName: '', nickname: '', phone: '', birthday: '', icon: '',
    className: r.className || '', joinYm: r.joinYm || '', createdAt: FieldValue.serverTimestamp(),
  });
  await rosterRef.update({ uid: user.uid, registeredAt: FieldValue.serverTimestamp() });
  if (email === ADMIN_EMAIL) await db.collection('admins').doc(user.uid).set({ email });

  const link = await makeVerifyLink(req, email);
  await sendMail({ to: email, subject: "【K's VOX 門弟アプリ】ご登録の確認", text: verifyMailText(link) });
  return { ok: true };
});
