import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { FIREBASE_CONFIG } from './constants';

const app = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
export const auth = getAuth(app);
auth.languageCode = 'ja';
export const db = getFirestore(app);

export async function api(path, body) {
  const user = auth.currentUser;
  const headers = { 'Content-Type': 'application/json' };
  const payload = { ...(body || {}) };
  if (user) {
    const token = await user.getIdToken();
    headers.Authorization = 'Bearer ' + token;
    headers['X-Id-Token'] = token;
    payload._idToken = token; // サーバーの手前で認証ヘッダーが外される環境への備え
  }
  const res = await fetch(path, { method: 'POST', headers, body: JSON.stringify(payload) });
  let data = {};
  try { data = await res.json(); } catch (e) { /* noop */ }
  if (!res.ok) throw new Error(data.error || '通信に失敗しました。時間を置いてもう一度お試しください。');
  return data;
}
