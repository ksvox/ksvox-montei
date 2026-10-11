// レッスン予約の受付口(予約・キャンセル・先生の予約・予約不可の枠)
// 予約の重なりを防ぐため、書き込みはすべてここ(サーバー)で行う
import admin from 'firebase-admin';
import { adminDb, getOrigin, handle, verifyRequest } from '../../lib/firebaseAdmin';
import { sendMail, SIGNATURE } from '../../lib/mailer';
import { calendarFor, gcalCreate, gcalDelete } from '../../lib/gcal';
import {
  ALL_SLOTS, LESSON_SLOTS, PRO_CLASS, KIND_LABEL, jstToday, firstBookableDay, isLessonDay,
  lessonKoma, isFree, isOffDay, rangeLabel, minutesLabel, fmtYmd,
} from '../../lib/reserve';

const fail = (status, message) => Object.assign(new Error(message), { status });
const FieldPath = admin.firestore.FieldPath;

function checkDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) throw fail(400, '日付が正しくありません。');
  return String(date);
}
function cleanSlots(slots) {
  const list = [...new Set((Array.isArray(slots) ? slots : []).map(String))].filter((s) => ALL_SLOTS.includes(s)).sort();
  if (!list.length) throw fail(400, '時間を選んでください。');
  return list;
}
async function offDay(db, date) {
  const s = await db.collection('dojoEvents').where('type', '==', 'off').get();
  return isOffDay(s.docs.map((d) => d.data()), date);
}
const monthRef = (db, date) => db.collection('reserveMonths').doc(date.slice(0, 7));
const setDay = (tx, ref, field, date, map) => tx.set(ref, { [field]: { [date]: map } }, { mergeFields: [new FieldPath(field, date)] });

async function mailBooked(req, b) {
  await sendMail({
    to: b.email,
    subject: `【K's VOX】${KIND_LABEL[b.kind]}のご予約を承りました`,
    text: `${b.name}さん\n\n以下の内容でご予約を承りました。\n\n日時:${fmtYmd(b.date)} ${rangeLabel(b.slots)}\n内容:${KIND_LABEL[b.kind]}(${minutesLabel(b.slots)})\n\nキャンセルは前日まで、門弟アプリの予約画面から行えます。当日のキャンセルは先生へ直接ご連絡ください。\n\n${getOrigin(req)}/reserve${SIGNATURE}`,
  });
}
async function mailCanceled(req, b, byTeacher) {
  await sendMail({
    to: b.email,
    subject: `【K's VOX】${KIND_LABEL[b.kind]}のご予約を${byTeacher ? '取り消しました' : 'キャンセルしました'}`,
    text: `${b.name}さん\n\n以下のご予約を${byTeacher ? '先生が取り消しました。ご不明な点は先生へお問い合わせください' : 'キャンセルしました'}。\n\n日時:${fmtYmd(b.date)} ${rangeLabel(b.slots)}\n内容:${KIND_LABEL[b.kind]}(${minutesLabel(b.slots)})\n\n${getOrigin(req)}/reserve${SIGNATURE}`,
  });
}

// 生徒の予約
async function book(req, ctx) {
  const db = adminDb();
  const date = checkDate(req.body.date);
  const kind = req.body.kind;
  const [rosterSnap, userSnap] = await Promise.all([
    db.collection('roster').doc(ctx.email).get(),
    db.collection('users').doc(ctx.uid).get(),
  ]);
  const cls = rosterSnap.data()?.className || '';
  const u = userSnap.data() || {};
  if (date < firstBookableDay()) throw fail(400, 'この日の予約受付は終了しました(予約はレッスン日の2日前まで)。');
  if (await offDay(db, date)) throw fail(400, 'この日はお休みのため予約できません。');

  let slots;
  if (kind === 'lesson') {
    if (!isLessonDay(date)) throw fail(400, 'この曜日はレッスンがありません。');
    const koma = lessonKoma(cls);
    const i = LESSON_SLOTS.indexOf(String((req.body.slots || [])[0] || ''));
    if (i < 0 || i + koma > LESSON_SLOTS.length) throw fail(400, 'この時間からは予約できません。');
    slots = LESSON_SLOTS.slice(i, i + koma);
  } else if (kind === 'practice') {
    if (cls !== PRO_CLASS) throw fail(403, '個人練習は正門下生のみ予約できます。');
    slots = cleanSlots(req.body.slots);
  } else throw fail(400, '予約の種類が正しくありません。');

  const ref = monthRef(db, date);
  const bref = db.collection('bookings').doc();
  const b = {
    date, slots, kind, uid: ctx.uid, email: ctx.email,
    name: (u.realName || u.nickname || ctx.email).trim(), className: cls,
    label: '', createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const m = snap.exists ? snap.data() : {};
    if (!slots.every((s) => isFree(m, date, s, kind))) throw fail(409, '選んだ時間に先に予約が入りました。もう一度選び直してください。');
    const map = { ...(m.taken?.[date] || {}) };
    slots.forEach((s) => { map[s] = bref.id; });
    setDay(tx, ref, 'taken', date, map);
    tx.set(bref, b);
  });

  const out = { ok: true, id: bref.id };
  try {
    const calendarId = calendarFor(kind);
    const ev = await gcalCreate({ calendarId, date, slots, summary: `${KIND_LABEL[kind]} ${b.name}`, description: `${cls || ''} 門弟アプリからの予約` });
    if (ev) await bref.update({ gcalEventId: ev, gcalCalendarId: calendarId });
  } catch (e) { console.error(e); await bref.update({ gcalError: e.message }).catch(() => {}); }
  try { await mailBooked(req, b); } catch (e) { console.error(e); out.mailError = '予約は完了しましたが、確認メールを送れませんでした。'; }
  return out;
}

// 先生の予約(お試しレッスンなど)。Googleカレンダーにだけ入れ、メールは送らない
async function adminBook(req) {
  const db = adminDb();
  const date = checkDate(req.body.date);
  const slots = cleanSlots(req.body.slots);
  const label = String(req.body.label || '').trim().slice(0, 60);
  if (!label) throw fail(400, 'カレンダーに表示する名前を入力してください。');
  const ref = monthRef(db, date);
  const bref = db.collection('bookings').doc();
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const m = snap.exists ? snap.data() : {};
    if (slots.some((s) => m.taken?.[date]?.[s])) throw fail(409, '選んだ時間にすでに予約が入っています。');
    const map = { ...(m.taken?.[date] || {}) };
    slots.forEach((s) => { map[s] = bref.id; });
    setDay(tx, ref, 'taken', date, map);
    tx.set(bref, { date, slots, kind: 'teacher', uid: '', email: '', name: label, label, className: '', createdAt: admin.firestore.FieldValue.serverTimestamp() });
  });
  const out = { ok: true, id: bref.id };
  try {
    const calendarId = calendarFor('teacher');
    const ev = await gcalCreate({ calendarId, date, slots, summary: label, description: '門弟アプリから先生が登録' });
    if (ev) await bref.update({ gcalEventId: ev, gcalCalendarId: calendarId });
  } catch (e) { console.error(e); out.gcalError = 'Googleカレンダーに登録できませんでした:' + e.message; }
  return out;
}

// キャンセル(生徒は自分の予約を前日まで。先生はいつでも)
async function cancel(req, ctx) {
  const db = adminDb();
  const bref = db.collection('bookings').doc(String(req.body.id || ''));
  const first = await bref.get();
  if (!first.exists) throw fail(404, '予約が見つかりません。すでに取り消されています。');
  const b = first.data();
  if (!ctx.isAdmin) {
    if (b.uid !== ctx.uid) throw fail(403, 'ご自身の予約だけキャンセルできます。');
    if (b.date <= jstToday()) throw fail(400, '当日のキャンセルはアプリからできません。先生へ直接ご連絡ください。');
  }
  const ref = monthRef(db, b.date);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const m = snap.exists ? snap.data() : {};
    const map = { ...(m.taken?.[b.date] || {}) };
    Object.keys(map).forEach((s) => { if (map[s] === bref.id) delete map[s]; });
    setDay(tx, ref, 'taken', b.date, map);
    tx.delete(bref);
  });
  const out = { ok: true };
  try { await gcalDelete(b.gcalCalendarId || calendarFor(b.kind), b.gcalEventId); } catch (e) { console.error(e); out.gcalError = e.message; }
  if (b.kind !== 'teacher' && b.email) {
    const byTeacher = ctx.isAdmin && b.uid !== ctx.uid;
    try { await mailCanceled(req, b, byTeacher); } catch (e) { console.error(e); out.mailError = 'キャンセルは完了しましたが、メールを送れませんでした。'; }
  }
  return out;
}

// 予約不可の枠を設定・解除(scope:'lesson'=レッスンのみ不可/'all'=個人練習も不可)
async function setBlocks(req, unblock) {
  const db = adminDb();
  const date = checkDate(req.body.date);
  const slots = cleanSlots(req.body.slots);
  const scope = req.body.scope === 'all' ? 'all' : 'lesson';
  const ref = monthRef(db, date);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const m = snap.exists ? snap.data() : {};
    const map = { ...(m.blocks?.[date] || {}) };
    slots.forEach((s) => { if (unblock) delete map[s]; else if (!m.taken?.[date]?.[s]) map[s] = scope; });
    setDay(tx, ref, 'blocks', date, map);
  });
  return { ok: true };
}

export default handle(async (req) => {
  const action = req.body.action;
  if (action === 'book') return book(req, await verifyRequest(req));
  if (action === 'cancel') return cancel(req, await verifyRequest(req));
  await verifyRequest(req, { requireAdmin: true });
  if (action === 'adminBook') return adminBook(req);
  if (action === 'block') return setBlocks(req, false);
  if (action === 'unblock') return setBlocks(req, true);
  throw fail(400, '操作の種類が正しくありません。');
});
