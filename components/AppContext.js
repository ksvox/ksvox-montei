import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, onSnapshot, setDoc } from 'firebase/firestore';
import { auth, db, api } from '../lib/firebaseClient';
import { DEFAULT_SETTINGS } from '../lib/constants';

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

export function AppProvider({ children }) {
  const [state, setState] = useState({ loading: true, user: null, status: 'out', isAdmin: false, error: '' });
  const [members, setMembers] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [priv, setPriv] = useState({ downloaded: {}, reminders: {} });

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (!user) { setState({ loading: false, user: null, status: 'out', isAdmin: false, error: '' }); return; }
      setState((s) => ({ ...s, loading: true }));
      try {
        await user.reload();
        if (!user.emailVerified) { setState({ loading: false, user, status: 'unverified', isAdmin: false, error: '' }); return; }
        await user.getIdToken(true);
        const r = await api('/api/sync');
        if (!r.member) { setState({ loading: false, user, status: 'notmember', isAdmin: false, error: '' }); return; }
        setState({ loading: false, user, status: 'member', isAdmin: !!r.isAdmin, error: '' });
      } catch (e) {
        setState({ loading: false, user, status: 'error', isAdmin: false, error: e.message });
      }
    });
  }, []);

  const reloadMembers = useCallback(async () => {
    const snap = await getDocs(collection(db, 'users'));
    setMembers(snap.docs.map((d) => ({ uid: d.id, ...d.data() })));
  }, []);

  useEffect(() => {
    if (state.status !== 'member') return undefined;
    reloadMembers().catch(console.error);
    getDoc(doc(db, 'settings', 'app')).then((d) => d.exists() && setSettings({ ...DEFAULT_SETTINGS, ...d.data() })).catch(console.error);
    const unsub = onSnapshot(doc(db, 'users', state.user.uid, 'private', 'state'), (d) => {
      const v = d.exists() ? d.data() : {};
      setPriv({ downloaded: v.downloaded || {}, reminders: v.reminders || {} });
    });
    return unsub;
  }, [state.status, state.user, reloadMembers]);

  const updatePriv = useCallback(async (patch) => {
    await setDoc(doc(db, 'users', state.user.uid, 'private', 'state'), patch, { merge: true });
  }, [state.user]);

  const me = members.find((m) => m.uid === state.user?.uid) || null;
  const memberMap = Object.fromEntries(members.map((m) => [m.uid, m]));
  const memberByEmail = Object.fromEntries(members.map((m) => [(m.email || '').toLowerCase(), m]));

  const value = {
    ...state, members, memberMap, memberByEmail, me, reloadMembers,
    settings, setSettings, priv, updatePriv,
    logout: () => signOut(auth),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
