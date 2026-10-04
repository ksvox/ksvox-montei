// 朗読見本音声(初恋2種+朗読課題20篇)
import { collection, doc, getDocs, setDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from './firebaseClient';
import { base64ToBlob } from './utils';

import { SAMPLE_TASKS } from './sampleTasks';

export { SAMPLE_TASKS };

// 音声の種類
export const SLOT_LABEL = { main: '音声', ondoku: '音読', roudoku: '朗読' };

// 枠の一覧(初恋2枠+20課題)
export const SAMPLE_SLOTS = [
  { id: 't00a', intro: true, no: 0, title: '初恋', sub: 'テンポ120', slots: ['main'] },
  { id: 't00b', intro: true, no: 0, title: '初恋', sub: 'テンポ90', slots: ['main'] },
  ...SAMPLE_TASKS.map(([title, author], i) => ({
    id: 't' + String(i + 1).padStart(2, '0'), intro: false, no: i + 1, title, author, slots: ['ondoku', 'roudoku'],
  })),
];

export function slotLabel(s) {
  return s.intro ? `${s.title}(${s.sub})` : `${s.no}. ${s.title}`;
}

const CHUNK = 700000;
const sub = (slot) => `audio_${slot}`;

// ファイル名「1-1夢十夜0.mp3」などから行き先を読み取る
export function parseSampleFileName(name) {
  const z2h = String(name).replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)).replace(/[－ー―‐]/g, '-');
  const m = z2h.match(/^\s*(\d{1,2})\s*-\s*(\d)/);
  if (!m) return null;
  const n = Number(m[1]); const k = Number(m[2]);
  if (n === 0 && (k === 1 || k === 2)) return { id: k === 1 ? 't00a' : 't00b', slot: 'main' };
  if (n >= 1 && n <= 20 && (k === 1 || k === 2)) return { id: 't' + String(n).padStart(2, '0'), slot: k === 1 ? 'ondoku' : 'roudoku' };
  return null;
}

// 管理者: 音声を保存(分割して保存)
export async function saveSampleAudio(id, slot, b64, mime) {
  const old = await getDocs(collection(db, 'samples', id, sub(slot)));
  const del = writeBatch(db);
  old.forEach((d) => del.delete(d.ref));
  await del.commit();
  const n = Math.ceil(b64.length / CHUNK);
  for (let i = 0; i < n; i++) {
    await setDoc(doc(db, 'samples', id, sub(slot), String(i).padStart(3, '0')), { i, data: b64.slice(i * CHUNK, (i + 1) * CHUNK) });
  }
  await setDoc(doc(db, 'samples', id), { audio: { [slot]: true }, mime: { [slot]: mime || 'audio/mpeg' }, updatedAt: serverTimestamp() }, { merge: true });
}

// 管理者: 音声を削除
export async function deleteSampleAudio(id, slot) {
  const old = await getDocs(collection(db, 'samples', id, sub(slot)));
  const b = writeBatch(db);
  old.forEach((d) => b.delete(d.ref));
  await b.commit();
  await setDoc(doc(db, 'samples', id), { audio: { [slot]: false }, updatedAt: serverTimestamp() }, { merge: true });
}

// 管理者: ジャケット画像を保存
export async function saveSampleImage(id, dataUrl) {
  await setDoc(doc(db, 'samples', id), { image: dataUrl, updatedAt: serverTimestamp() }, { merge: true });
}

// 登録状況の読み込み
export async function loadSampleDocs() {
  const s = await getDocs(collection(db, 'samples'));
  return Object.fromEntries(s.docs.map((d) => [d.id, d.data()]));
}

// 再生用に音声を取り出す
export async function loadSampleAudio(id, slot, mime) {
  const s = await getDocs(collection(db, 'samples', id, sub(slot)));
  if (s.empty) throw new Error('この音声はまだ登録されていません。');
  const b64 = s.docs.map((d) => d.data()).sort((a, b) => a.i - b.i).map((d) => d.data).join('');
  return base64ToBlob(b64, mime || 'audio/mpeg');
}
