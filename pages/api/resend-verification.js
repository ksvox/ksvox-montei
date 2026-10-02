import { handle, verifyRequest } from '../../lib/firebaseAdmin';
import { sendMail } from '../../lib/mailer';
import { makeVerifyLink, verifyMailText } from './register';

export default handle(async (req) => {
  const { email } = await verifyRequest(req, { requireMember: false });
  const link = await makeVerifyLink(req, email);
  await sendMail({ to: email, subject: "【K's VOX 門弟アプリ】ご登録の確認", text: verifyMailText(link) });
  return { ok: true };
});
