import { collection, doc, getDocs, writeBatch, query, orderBy } from 'firebase/firestore';
import { db } from './firebaseClient';
import { base64ToBlob } from './utils';

export const CHUNK = 700000;

// 管理者が歌詞PDFを保存(チャンクに分割)
export async function savePdf(songId, b64) {
  const old = await getDocs(collection(db, 'songs', songId, 'pdf'));
  const batch = writeBatch(db);
  old.forEach((d) => batch.delete(d.ref));
  const n = Math.ceil(b64.length / CHUNK);
  for (let i = 0; i < n; i++) {
    batch.set(doc(db, 'songs', songId, 'pdf', String(i).padStart(3, '0')), { i, data: b64.slice(i * CHUNK, (i + 1) * CHUNK) });
  }
  await batch.commit();
  return n;
}

export async function loadPdfBlob(songId) {
  const snap = await getDocs(query(collection(db, 'songs', songId, 'pdf'), orderBy('i')));
  if (snap.empty) throw new Error('この曲の歌詞PDFはまだ登録されていません。');
  const b64 = snap.docs.map((d) => d.data().data).join('');
  return base64ToBlob(b64, 'application/pdf');
}
