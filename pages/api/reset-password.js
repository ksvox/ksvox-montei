import { adminAuth, getOrigin, handle } from '../../lib/firebaseAdmin';
import { sendMail, SIGNATURE } from '../../lib/mailer';

// パスワード再設定メール(門弟アプリ内の日本語ページへ案内)
export default handle(async (req) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Object.assign(new Error('メールアドレスの形式が正しくありません。'), { status: 400 });
  let raw;
  try { raw = await adminAuth().generatePasswordResetLink(email); }
  catch (e) {
    if (e.code === 'auth/user-not-found' || e.code === 'auth/email-not-found') return { ok: true }; // 登録の有無は知らせない
    throw e;
  }
  const code = new URL(raw).searchParams.get('oobCode');
  const link = `${getOrigin(req)}/reset?oobCode=${encodeURIComponent(code)}`;
  await sendMail({
    to: email,
    subject: "【K's VOX 門弟アプリ】パスワードの再設定",
    text: `門弟アプリのパスワード再設定のご依頼を受け付けました。
以下のリンクを開いて、新しいパスワードを設定してください。

${link}

※リンクの有効期限は約1時間です。
※お心当たりがない場合は、このメールは破棄してください。パスワードは変更されません。${SIGNATURE}`,
  });
  return { ok: true };
});
