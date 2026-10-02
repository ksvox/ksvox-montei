import { useEffect, useState } from 'react';
import { collection, doc, getDocs, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db, api } from '../../lib/firebaseClient';
import { useApp } from '../AppContext';
import { Avatar, Chip, Field, Modal, Empty, RankSeal } from '../ui';
import { CLASSES } from '../../lib/constants';
import { computeRank } from '../../lib/rank';

const blank = { email: '', className: '門下生', joinYm: '', memo: '' };

export default function AdminRoster() {
  const app = useApp();
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = async () => {
    const s = await getDocs(collection(db, 'roster'));
    setRows(s.docs.map((d) => ({ id: d.id, ...d.data() })).filter((r) => !r.movedFrom || r.uid).sort((a, b) => (a.memo || a.id).localeCompare(b.memo || b.id, 'ja')));
  };
  useEffect(() => { load(); }, []);

  async function save() {
    setBusy(true); setErr('');
    const email = form.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setErr('メールアドレスの形式が正しくありません。'); setBusy(false); return; }
    try {
      const data = { email, className: form.className, joinYm: form.joinYm, memo: form.memo.trim() };
      if (form.id) {
        await updateDoc(doc(db, 'roster', form.id), { className: data.className, joinYm: data.joinYm, memo: data.memo, updatedAt: serverTimestamp() });
        if (form.uid) await updateDoc(doc(db, 'users', form.uid), { className: data.className, joinYm: data.joinYm });
      } else {
        if (rows.some((r) => r.id === email)) { setErr('このメールアドレスはすでに名簿にあります。'); setBusy(false); return; }
        await setDoc(doc(db, 'roster', email), { ...data, createdAt: serverTimestamp() });
      }
      setForm(null); await load(); await app.reloadMembers();
    } catch (e) { setErr('保存できませんでした:' + e.message); }
    setBusy(false);
  }
  async function remove(r) {
    const u = r.uid && app.memberMap[r.uid];
    if (!confirm(`${u?.nickname || r.memo || r.id} さんを名簿から削除しますか?\nログインできなくなり、マイページの保管庫・カレンダー・メッセージもすべて消えます。`)) return;
    setBusy(true);
    try { await api('/api/admin/delete-member', { email: r.id }); setForm(null); await load(); await app.reloadMembers(); }
    catch (e) { setErr(e.message); }
    setBusy(false);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-ks-sub leading-relaxed">名簿にあるメールアドレスだけが会員登録できます。</p>
        <button className="btn btn-primary btn-sm shrink-0" onClick={() => { setForm({ ...blank }); setErr(''); }}>名簿に追加</button>
      </div>
      {err && !form && <p className="text-sm text-ks-red mb-3">{err}</p>}
      {!rows.length ? <Empty>名簿はまだ空です。</Empty> : (
        <ul className="card divide-y divide-ks-border">
          {rows.map((r) => { const u = r.uid && app.memberMap[r.uid]; return (
            <li key={r.id}><button className="w-full text-left px-4 py-3 flex items-center gap-3" onClick={() => { setForm({ ...blank, ...r, joinYm: r.joinYm || '' }); setErr(''); }}>
              <Avatar user={u} name={r.memo || r.id} size={36} />
              <span className="flex-1 min-w-0">
                <span className="block font-bold text-sm truncate">{u?.nickname || r.memo || '(未登録)'}{u?.realName ? `(${u.realName})` : ''}</span>
                <span className="block text-xs text-ks-sub truncate">{r.id}</span>
                <span className="flex items-center gap-2 text-xs mt-0.5"><span className="text-ks-sub">{r.className || 'クラス未設定'}</span>{computeRank(r.className, r.joinYm) && <RankSeal user={r} />}</span>
              </span>
              <span className={`text-[11px] font-bold ${r.uid ? 'text-emerald-700' : 'text-ks-sub'}`}>{r.uid ? '登録済み' : '登録待ち'}</span>
            </button></li>
          ); })}
        </ul>
      )}
      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? '名簿を編集' : '名簿に追加'}>
        {form && (() => { const u = form.uid && app.memberMap[form.uid]; return (
          <div>
            <Field label="メールアドレス"><input className="input" type="email" disabled={!!form.id} value={form.email || form.id} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="名前(控え)" note="生徒さんには表示されません。登録前の確認用です。"><input className="input" value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} /></Field>
            <Field label="クラス"><div className="flex flex-wrap gap-2">{CLASSES.map((c) => <Chip key={c} active={form.className === c} onClick={() => setForm({ ...form, className: c })}>{c}</Chip>)}</div></Field>
            <Field label="入門年月" note={form.className === '門下生' ? `表示される称号:${computeRank(form.className, form.joinYm) || '—'}` : '称号は門下生クラスのみ自動で付きます。'}>
              <input className="input" type="month" value={form.joinYm} onChange={(e) => setForm({ ...form, joinYm: e.target.value })} />
            </Field>
            {u && (
              <dl className="text-sm bg-white border border-ks-border rounded-xl p-3 mb-4 space-y-1">
                <div className="flex"><dt className="w-20 text-ks-sub">本名</dt><dd>{u.realName || '未登録'}</dd></div>
                <div className="flex"><dt className="w-20 text-ks-sub">ニックネーム</dt><dd>{u.nickname || '未登録'}</dd></div>
                <div className="flex"><dt className="w-20 text-ks-sub">電話</dt><dd>{u.phone || '未登録'}</dd></div>
                <div className="flex"><dt className="w-20 text-ks-sub">生年月日</dt><dd>{u.birthday || '未登録'}</dd></div>
              </dl>
            )}
            {err && <p className="text-sm text-ks-red mb-3">{err}</p>}
            <div className="flex gap-2">
              {form.id && form.uid !== app.user.uid && <button className="btn btn-ghost text-ks-red" disabled={busy} onClick={() => remove(form)}>名簿から削除</button>}
              <button className="btn btn-primary flex-1" disabled={busy} onClick={save}>{busy ? '保存中…' : '保存する'}</button>
            </div>
          </div>
        ); })()}
      </Modal>
    </div>
  );
}
