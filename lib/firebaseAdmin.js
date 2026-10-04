import admin from 'firebase-admin';
import { FIREBASE_CONFIG } from './constants';

function init() {
  // 門弟アプリ本来の接続(名前なし)があるかを確認する(稽古帳の確認用の接続とは区別する)
  const existing = admin.apps.find((a) => a && a.name === '[DEFAULT]');
  if (existing) return existing;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY || '';
  privateKey = privateKey.replace(/^"|"$/g, '').replace(/\\n/g, '\n');
  if (!clientEmail || !privateKey) throw new Error('サーバーの設定(FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY)が未登録です。');
  return admin.initializeApp({
    credential: admin.credential.cert({ projectId: FIREBASE_CONFIG.projectId, clientEmail, privateKey }),
  });
}

export function adminAuth() { init(); return admin.auth(); }
export function adminDb() { init(); return admin.firestore(); }
export const FieldValue = admin.firestore.FieldValue;

export const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'info@ksvox.net').toLowerCase();

export function getOrigin(req) {
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
}

// APIの呼び出し元を確認する
export async function verifyRequest(req, { requireMember = true, requireAdmin = false } = {}) {
  const h = req.headers.authorization || '';
  const token = (h.startsWith('Bearer ') ? h.slice(7) : '') || req.headers['x-id-token'] || (req.body && req.body._idToken) || '';
  if (!token) throw Object.assign(new Error('ログインが必要です。'), { status: 401 });
  const decoded = await adminAuth().verifyIdToken(token);
  const email = (decoded.email || '').toLowerCase();
  const db = adminDb();
  const isAdmin = (await db.collection('admins').doc(decoded.uid).get()).exists;
  if (requireAdmin && !isAdmin) throw Object.assign(new Error('管理者のみの操作です。'), { status: 403 });
  if (requireMember) {
    if (!decoded.email_verified) throw Object.assign(new Error('メールアドレスの確認が済んでいません。'), { status: 403 });
    const r = await db.collection('roster').doc(email).get();
    if (!r.exists) throw Object.assign(new Error('名簿に登録されていません。'), { status: 403 });
  }
  return { uid: decoded.uid, email, isAdmin, decoded };
}

export function handle(fn) {
  return async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POSTのみ対応しています。' });
    try {
      const out = await fn(req, res);
      if (!res.headersSent) res.status(200).json(out || { ok: true });
    } catch (e) {
      console.error(e);
      if (!res.headersSent) res.status(e.status || 500).json({ error: e.message || 'エラーが発生しました。' });
    }
  };
}
