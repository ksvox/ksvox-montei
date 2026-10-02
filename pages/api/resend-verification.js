import { adminAuth, handle, verifyRequest } from '../../lib/firebaseAdmin';
import { sendMail } from '../../lib/mailer';
import { verifyMailText } from './register';

export default handle(async (req) => {
  const { email } = await verifyRequest(req, { requireMember: false });
  const link = await adminAuth().generateEmailVerificationLink(email);
  await sendMail({ to: email, subject: "【K's VOX 門弟アプリ】ご登録の確認", text: verifyMailText(link) });
  return { ok: true };
});
