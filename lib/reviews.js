// レッスンの振り返り(稽古帳から届く)
import { collection, doc, getDocs, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { db } from './firebaseClient';

export { REVIEW_KEEP } from './reviewKeep';
const WEEK = ['日', '月', '火', '水', '木', '金', '土'];

export function reviewDate(s) {
  if (!s) return '';
  const [y, m, d] = String(s).split('-').map(Number);
  if (!y || !m || !d) return String(s);
  return `${y}年${m}月${d}日(${WEEK[new Date(y, m - 1, d).getDay()]})`;
}

export async function loadMyReviews(email) {
  const s = await getDocs(query(collection(db, 'reviews'), where('email', '==', String(email || '').toLowerCase())));
  return s.docs.map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.date === b.date ? (b.sentAt?.seconds || 0) - (a.sentAt?.seconds || 0) : a.date < b.date ? 1 : -1));
}

export async function confirmReview(id) {
  await updateDoc(doc(db, 'reviews', id), { confirmed: true, confirmedAt: serverTimestamp() });
}
