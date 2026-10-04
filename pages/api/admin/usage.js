import { adminDb, handle, verifyRequest } from '../../../lib/firebaseAdmin';

// データベース使用量のおおよその計測
function size(obj) {
  try { return Buffer.byteLength(JSON.stringify(obj)) + 32; } catch (e) { return 0; }
}

export default handle(async (req) => {
  await verifyRequest(req, { requireAdmin: true });
  const db = adminDb();
  const parts = { songs: 0, samples: 0, vault: 0, members: 0, posts: 0, other: 0 };
  const add = (key, snap) => snap.forEach((d) => { parts[key] += size(d.data()) + d.id.length; });
  add('songs', await db.collection('songs').get());
  add('songs', await db.collectionGroup('pdf').get());
  add('samples', await db.collection('samples').get());
  for (const c of ['audio_main', 'audio_ondoku', 'audio_roudoku']) add('samples', await db.collectionGroup(c).get());
  add('vault', await db.collectionGroup('vault').get());
  add('members', await db.collection('users').get());
  add('members', await db.collectionGroup('events').get());
  add('members', await db.collection('roster').get());
  for (const c of ['announcements', 'forumPosts', 'archive', 'messages', 'reviews']) add('posts', await db.collection(c).get());
  add('posts', await db.collectionGroup('replies').get());
  for (const c of ['settings', 'appLinks', 'videos']) add('other', await db.collection(c).get());
  const total = Object.values(parts).reduce((a, b) => a + b, 0);
  return { total, parts, limit: 1024 * 1024 * 1024 };
});
