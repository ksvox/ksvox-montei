import { adminDb, getOrigin, handle, verifyRequest } from '../../lib/firebaseAdmin';
import { sendMail, SIGNATURE } from '../../lib/mailer';

export default handle(async (req) => {
  const { uid, isAdmin } = await verifyRequest(req);
  const { type, id } = req.body;
  const db = adminDb();
  const origin = getOrigin(req);
  if (type === 'announcement') {
    if (!isAdmin) throw Object.assign(new Error('管理者のみの操作です。'), { status: 403 });
    const a = await db.collection('announcements').doc(String(id)).get();
    if (!a.exists) throw new Error('お知らせが見つかりません。');
    const roster = await db.collection('roster').get();
    const bcc = roster.docs.filter((d) => d.data().uid).map((d) => d.id);
    if (!bcc.length) return { ok: true, sent: 0 };
    await sendMail({
      bcc,
      subject: "【K's VOX 門弟アプリ】新しいお知らせが届いています",
      text: `門弟アプリから新しいお知らせが届いています。アプリを開いて確認してください。\n\n「${a.data().title}」\n\n${origin}${SIGNATURE}`,
    });
    return { ok: true, sent: bcc.length };
  }
  if (type === 'message') {
    const m = await db.collection('messages').doc(String(id)).get();
    if (!m.exists || m.data().from !== uid) throw Object.assign(new Error('メッセージが見つかりません。'), { status: 403 });
    const [toUser, fromUser] = await Promise.all([
      db.collection('users').doc(m.data().to).get(),
      db.collection('users').doc(uid).get(),
    ]);
    if (!toUser.exists) throw new Error('送り先が見つかりません。');
    const fromName = fromUser.data()?.nickname || '門弟の仲間';
    await sendMail({
      to: toUser.data().email,
      subject: "【K's VOX 門弟アプリ】新しいメッセージが届いています",
      text: `門弟アプリに、${fromName}さんから新しいメッセージが届いています。アプリを開いて確認してください。\n\n${origin}/mypage${SIGNATURE}`,
    });
    return { ok: true, sent: 1 };
  }
  throw Object.assign(new Error('種類が正しくありません。'), { status: 400 });
});
