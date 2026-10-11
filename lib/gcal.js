// 先生のGoogleカレンダーへ予約を書き込む(門弟アプリのFirebaseの鍵を使う)
// 使う設定:GCAL_LESSON_CALENDAR_ID(レッスン・先生の予約を入れるカレンダー)
//           GCAL_PRACTICE_CALENDAR_ID(個人練習を入れるカレンダー)
import crypto from 'crypto';
import { SLOT_MIN, addMin } from './reserve';

let cached = { token: '', exp: 0 };

function b64url(s) { return Buffer.from(s).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_'); }

async function accessToken() {
  if (cached.token && cached.exp > Date.now() + 60000) return cached.token;
  const email = process.env.FIREBASE_CLIENT_EMAIL;
  const key = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/^"|"$/g, '').replace(/\\n/g, '\n');
  if (!email || !key) throw new Error('鍵の設定がありません。');
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64url(JSON.stringify({
    iss: email, scope: 'https://www.googleapis.com/auth/calendar.events',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  }));
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(`${head}.${claim}`);
  const sig = sign.sign(key).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${head}.${claim}.${sig}`,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.error || 'Googleの認証に失敗しました。');
  cached = { token: data.access_token, exp: Date.now() + (data.expires_in || 3600) * 1000 };
  return cached.token;
}

// 予約の種類ごとに入れるカレンダーを決める
export function calendarFor(kind) {
  const lesson = process.env.GCAL_LESSON_CALENDAR_ID || process.env.GCAL_CALENDAR_ID || '';
  if (kind === 'practice') return process.env.GCAL_PRACTICE_CALENDAR_ID || lesson;
  return lesson;
}

export async function gcalCreate({ calendarId, date, slots, summary, description }) {
  if (!calendarId) return '';
  const s = [...slots].sort();
  const body = {
    summary, description,
    start: { dateTime: `${date}T${s[0]}:00+09:00`, timeZone: 'Asia/Tokyo' },
    end: { dateTime: `${date}T${addMin(s[s.length - 1], SLOT_MIN)}:00+09:00`, timeZone: 'Asia/Tokyo' },
  };
  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + (await accessToken()), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Googleカレンダーに登録できませんでした。');
  return data.id;
}

export async function gcalDelete(calendarId, eventId) {
  if (!calendarId || !eventId) return;
  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
    method: 'DELETE',
    headers: { Authorization: 'Bearer ' + (await accessToken()) },
  });
  if (!res.ok && res.status !== 404 && res.status !== 410) throw new Error('Googleカレンダーから削除できませんでした。');
}
