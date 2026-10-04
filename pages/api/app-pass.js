// 生徒限定アプリを開くための「通行証」(5分間有効)を発行する
import crypto from 'crypto';
import { handle, verifyRequest } from '../../lib/firebaseAdmin';

export default handle(async (req) => {
  try {
    await verifyRequest(req); // 名簿に登録された生徒
  } catch (e) {
    const r = await verifyRequest(req, { requireMember: false }).catch(() => null);
    if (!r?.isAdmin) throw e; // 管理者(先生)も通す
  }
  const secret = process.env.KS_APP_PASS_SECRET;
  if (!secret) throw new Error('サーバーの設定(KS_APP_PASS_SECRET)が未登録です。');
  const exp = Math.floor(Date.now() / 1000) + 5 * 60;
  const sig = crypto.createHmac('sha256', secret).update(`p.${exp}`).digest('base64url');
  return { pass: `p.${exp}.${sig}` };
});
