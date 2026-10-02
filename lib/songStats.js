import { collection, doc, getDoc, getDocs, setDoc, serverTimestamp, increment, arrayUnion } from 'firebase/firestore';
import { db } from './firebaseClient';

// メールアドレスをそのまま残さず、照合用の暗号化した値にする
export async function hashEmail(email) {
  const data = new TextEncoder().encode(String(email || '').trim().toLowerCase());
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function loadStats() {
  const s = await getDocs(collection(db, 'songStats'));
  return s.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ダウンロードの記録(同じ人は1回と数える)
export async function recordDownload(song, email) {
  const h = await hashEmail(email);
  const ref = doc(db, 'songStats', song.id);
  const cur = await getDoc(ref);
  const users = cur.exists() ? cur.data().users || [] : [];
  if (users.includes(h)) await setDoc(ref, { last: serverTimestamp(), title: song.title }, { merge: true });
  else await setDoc(ref, { count: increment(1), users: arrayUnion(h), last: serverTimestamp(), title: song.title }, { merge: true });
}

export function topSongs(stats, n = 3) {
  return stats.filter((s) => (s.count || 0) > 0)
    .sort((a, b) => (b.count || 0) - (a.count || 0) || (b.last?.seconds || 0) - (a.last?.seconds || 0))
    .slice(0, n);
}
