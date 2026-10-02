import { handle, verifyRequest } from '../../../lib/firebaseAdmin';

// 外部の画像を取得して返す(Base44のバナー画像の引っ越し用)
export default handle(async (req) => {
  await verifyRequest(req, { requireAdmin: true });
  const url = String(req.body.url || '');
  if (!/^https:\/\//.test(url)) throw Object.assign(new Error('アドレスが正しくありません。'), { status: 400 });
  const r = await fetch(url);
  if (!r.ok) throw new Error('画像を取得できませんでした(HTTP ' + r.status + ')。');
  const type = r.headers.get('content-type') || 'image/png';
  const b64 = Buffer.from(await r.arrayBuffer()).toString('base64');
  return { dataUrl: `data:${type};base64,${b64}` };
});
