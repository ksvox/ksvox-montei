// 稽古帳(先生専用アプリ)からの連絡口。
// 稽古帳のログイン情報を確かめ、門弟アプリの管理者と同じメールアドレスの時だけ受け付ける。
import crypto from 'crypto';
import admin from 'firebase-admin';
import { adminAuth, adminDb, FieldValue } from '../../lib/firebaseAdmin';
import { REVIEW_KEEP } from '../../lib/reviewKeep';

const KEIKOCHO_PROJECT_ID = process.env.KEIKOCHO_PROJECT_ID || 'ksvox-keikocho';

function keikochoAuth() {
  const name = 'keikocho';
  const app = admin.apps.find((a) => a && a.name === name) || admin.initializeApp({ projectId: KEIKOCHO_PROJECT_ID }, name);
  return admin.auth(app);
}

const fail = (status, message) => Object.assign(new Error(message), { status });

async function verifyTeacher(idToken) {
  if (!idToken) throw fail(401, '稽古帳にログインしてください。');
  let decoded;
  try { decoded = await keikochoAuth().verifyIdToken(idToken); } catch (e) { throw fail(401, '稽古帳のログイン情報を確認できませんでした。ログインし直してください。'); }
  const email = (decoded.email || '').toLowerCase();
  const db = adminDb();
  const admins = await db.collection('admins').get();
  for (const a of admins.docs) {
    try {
      const u = await adminAuth().getUser(a.id);
      if ((u.email || '').toLowerCase() === email) return email;
    } catch (e) { /* noop */ }
  }
  throw fail(403, `稽古帳のログイン(${email})が、門弟アプリの管理者のメールアドレスと一致しません。`);
}

const clean = (arr) => (Array.isArray(arr) ? arr : []).map((x) => String(x).trim()).filter(Boolean).slice(0, 30).map((x) => x.slice(0, 300));

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POSTのみ対応しています。' });
  try {
    const body = req.body || {};
    await verifyTeacher(body.idToken);
    const db = adminDb();

    // 門弟アプリの会員一覧(稽古帳での結びつけ用)
    if (body.action === 'members') {
      const [roster, users] = await Promise.all([db.collection('roster').get(), db.collection('users').get()]);
      const byEmail = {};
      users.forEach((d) => { const u = d.data(); if (u.email) byEmail[String(u.email).toLowerCase()] = u; });
      const members = roster.docs.map((d) => {
        const r = d.data(); const u = byEmail[d.id] || {};
        return { email: d.id, className: r.className || '', realName: u.realName || '', nickname: u.nickname || '', memo: r.memo || '', registered: !!r.uid || !!u.email };
      }).sort((a, b) => (a.realName || a.nickname || a.email).localeCompare(b.realName || b.nickname || b.email, 'ja'));
      return res.status(200).json({ members });
    }

    // 振り返りを届ける(同じお稽古を送り直した時は上書き)
    if (body.action === 'send') {
      const email = String(body.email || '').toLowerCase().trim();
      if (!email) throw fail(400, '送り先が指定されていません。');
      const r = await db.collection('roster').doc(email).get();
      if (!r.exists) throw fail(404, 'この会員は門弟アプリの名簿に見つかりません。');
      const date = String(body.date || '').slice(0, 10);
      const key = String(body.lessonKey || date);
      const id = crypto.createHash('sha1').update(`${email}|${key}`).digest('hex').slice(0, 24);
      await db.collection('reviews').doc(id).set({
        email, date, lessonKey: key,
        songTitle: String(body.songTitle || '').slice(0, 200),
        done: clean(body.done), next: clean(body.next),
        confirmed: false, confirmedAt: null, sentAt: FieldValue.serverTimestamp(),
      });
      // 13件目以降(古いもの)を削除
      const all = await db.collection('reviews').where('email', '==', email).get();
      const sorted = all.docs.map((d) => ({ ref: d.ref, ...d.data() }))
        .sort((a, b) => (a.date === b.date ? (b.sentAt?.seconds || 0) - (a.sentAt?.seconds || 0) : a.date < b.date ? 1 : -1));
      const extra = sorted.slice(REVIEW_KEEP);
      if (extra.length) { const b = db.batch(); extra.forEach((x) => b.delete(x.ref)); await b.commit(); }
      return res.status(200).json({ ok: true });
    }

    throw fail(400, '操作の種類が正しくありません。');
  } catch (e) {
    if (!e.status) console.error(e);
    return res.status(e.status || 500).json({ error: e.message || 'エラーが発生しました。' });
  }
}
