// コエシルの利用状況と、研究用のタイプ別集計の読み出し・リセット(管理者専用)
import { handle, verifyRequest, adminDb } from '../../../lib/firebaseAdmin';

export default handle(async (req) => {
  await verifyRequest(req, { requireAdmin: true });
  const col = adminDb().collection('koeshiruStats');
  const { mode } = req.body || {};
  if (mode === 'reset') {
    const snap = await col.get();
    let batch = adminDb().batch(), n = 0;
    for (const d of snap.docs) {
      batch.delete(d.ref); n++;
      if (n % 400 === 0) { await batch.commit(); batch = adminDb().batch(); }
    }
    await batch.commit();
    return { ok: true, deleted: snap.size };
  }
  const snap = await col.get();
  const days = [], types = [];
  let total = { diag: 0, trial: 0 };
  snap.docs.forEach((d) => {
    const x = d.data();
    if (d.id === 'total') total = { diag: x.diag || 0, trial: x.trial || 0 };
    else if (d.id.startsWith('d_')) days.push({ date: x.date || d.id.slice(2), diag: x.diag || 0, trial: x.trial || 0 });
    else if (d.id.startsWith('t_')) types.push(x);
  });
  days.sort((a, b) => (a.date < b.date ? 1 : -1));
  return { total, days, types };
});
