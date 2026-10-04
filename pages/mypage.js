import { useState } from 'react';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { verifyBeforeUpdateEmail } from 'firebase/auth';
import { auth, db, api } from '../lib/firebaseClient';
import Layout from '../components/Layout';
import { useApp } from '../components/AppContext';
import Calendar from '../components/Calendar';
import Messages from '../components/Messages';
import Vault from '../components/Vault';
import Reviews from '../components/Reviews';
import { Avatar, Field, Modal, RankSeal, displayName } from '../components/ui';
import { compressImage } from '../lib/utils';

function ProfileEditor({ onClose }) {
  const app = useApp();
  const me = app.me || {};
  const [f, setF] = useState({ icon: me.icon || '', realName: me.realName || '', nickname: me.nickname || '', phone: me.phone || '', birthday: me.birthday || '' });
  const [newEmail, setNewEmail] = useState('');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  async function pickIcon(e) {
    const file = e.target.files?.[0]; if (!file) return;
    try { setF({ ...f, icon: await compressImage(file, { maxSize: 320, maxBytes: 60000, quality: 0.85 }) }); } catch (ex) { setErr(ex.message); }
  }
  async function save() {
    setBusy('save'); setErr('');
    try {
      await updateDoc(doc(db, 'users', app.user.uid), { ...f, realName: f.realName.trim(), nickname: f.nickname.trim(), phone: f.phone.trim(), updatedAt: serverTimestamp() });
      await app.reloadMembers(); onClose();
    } catch (e) { setErr('保存できませんでした:' + e.message); }
    setBusy('');
  }
  async function changeEmail() {
    setBusy('email'); setErr(''); setMsg('');
    try {
      await api('/api/prepare-email-change', { newEmail: newEmail.trim() });
      await verifyBeforeUpdateEmail(auth.currentUser, newEmail.trim());
      setMsg(`${newEmail.trim()} に確認メールを送りました。メールのリンクを押すと切り替わります。その後、新しいメールアドレスでログインし直してください。`);
      setNewEmail('');
    } catch (e) { setErr(e.code === 'auth/requires-recent-login' ? '安全のため、一度ログアウトしてログインし直してから変更してください。' : e.message); }
    setBusy('');
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-5">
        <Avatar user={{ ...me, icon: f.icon, nickname: f.nickname }} size={76} />
        <label className="btn btn-ghost btn-sm cursor-pointer">アイコンを選ぶ<input type="file" accept="image/*" className="hidden" onChange={pickIcon} /></label>
      </div>
      <Field label="名前(本名)"><input className="input" value={f.realName} onChange={(e) => setF({ ...f, realName: e.target.value })} /></Field>
      <Field label="ニックネーム" note="アプリ内で表示される名前です。"><input className="input" value={f.nickname} onChange={(e) => setF({ ...f, nickname: e.target.value })} /></Field>
      <Field label="電話番号"><input className="input" type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
      <Field label="生年月日"><input className="input" type="date" value={f.birthday} onChange={(e) => setF({ ...f, birthday: e.target.value })} /></Field>
      <p className="text-xs text-ks-sub leading-relaxed mb-4 bg-ks-goldlight rounded-xl p-3">本名・電話番号・生年月日は、門弟の皆さんの連絡網として共有されます。</p>
      {err && <p className="text-sm text-ks-red mb-3">{err}</p>}
      <button className="btn btn-primary w-full" disabled={!!busy} onClick={save}>{busy === 'save' ? '保存中…' : '保存する'}</button>

      <div className="border-t border-ks-border mt-7 pt-5">
        <Field label="メールアドレス" note={`現在:${app.user.email}`}>
          <input className="input" type="email" placeholder="新しいメールアドレス" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
        </Field>
        {msg && <p className="text-sm text-emerald-700 mb-3">{msg}</p>}
        <button className="btn btn-ghost w-full" disabled={!!busy || !newEmail.trim()} onClick={changeEmail}>{busy === 'email' ? '送信中…' : 'メールアドレスを変更する'}</button>
      </div>
    </div>
  );
}

function MyPage() {
  const app = useApp();
  const me = app.me;
  const [edit, setEdit] = useState(false);
  return (
    <>
      <div className="card p-5 mb-7 flex items-center gap-4">
        <Avatar user={me} size={72} />
        <div className="flex-1 min-w-0">
          <p className="font-serif font-bold text-xl truncate">{displayName(me)}</p>
          <div className="mt-1"><RankSeal user={me} /></div>
          <button className="link mt-2" onClick={() => setEdit(true)}>プロフィールを編集</button>
        </div>
      </div>
      {!me?.nickname && <p className="text-sm bg-ks-goldlight border border-[#EBDDBE] rounded-xl px-4 py-3 mb-6">はじめに「プロフィールを編集」から、アイコン・名前・ニックネーム・電話番号・生年月日を登録してください。</p>}
      <Reviews />
      <Calendar />
      <Messages />
      <Vault />
      <button className="btn btn-ghost w-full mt-4" onClick={app.logout}>ログアウト</button>
      <Modal open={edit} onClose={() => setEdit(false)} title="プロフィールを編集">
        {edit && <ProfileEditor onClose={() => setEdit(false)} />}
      </Modal>
    </>
  );
}
export default function Page() { return <Layout title="マイページ"><MyPage /></Layout>; }
