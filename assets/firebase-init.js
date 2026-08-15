// Shared Firebase setup + favorites storage abstraction.
// No bundler in this repo, so we load the Firebase Web SDK straight from
// Google's CDN as ES modules (the "<script> タグを使用する" option in the
// Firebase console), not the npm package.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithRedirect,
  getRedirectResult,
  signOut as fbSignOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDIN5gGiOxvfHzHVAm01PsB-vN_N-SB2mY",
  authDomain: "morning-briefing-6b554.firebaseapp.com",
  projectId: "morning-briefing-6b554",
  storageBucket: "morning-briefing-6b554.firebasestorage.app",
  messagingSenderId: "806406822566",
  appId: "1:806406822566:web:e93330c78b757d80aaf267",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
const provider = new GoogleAuthProvider();

const LOCAL_KEY = "mb-favorites-v1";

function readLocal() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) || "{}");
  } catch (e) {
    return {};
  }
}

function writeLocal(data) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(data));
  } catch (e) {
    // localStorage unavailable (private mode, quota, etc.) - fail silently
  }
}

export function signIn() {
  // Redirect (not popup) flow: popups are unreliable in mobile browsers and
  // in-app browsers. This navigates to Google and back to this same page.
  return signInWithRedirect(auth, provider);
}

export function signOutUser() {
  return fbSignOut(auth);
}

export function onAuthChange(cb) {
  return onAuthStateChanged(auth, cb);
}

// Surface redirect sign-in failures (e.g. unauthorized domain) to the
// console instead of failing silently.
getRedirectResult(auth).catch(function (e) {
  console.error("Googleログインに失敗しました", e);
});

let migratedForUid = null;

// One-time, best-effort: if this browser has local (pre-login) favorites
// and the signed-in account has no cloud data yet, copy the local ones up.
// Existing cloud data always wins on a URL conflict.
async function migrateLocalIfNeeded(uid) {
  if (migratedForUid === uid) return;
  migratedForUid = uid;
  const local = readLocal();
  if (!Object.keys(local).length) return;
  try {
    const ref = doc(db, "favorites", uid);
    const snap = await getDoc(ref);
    const remote = snap.exists() ? snap.data().items || {} : {};
    const merged = Object.assign({}, local, remote);
    await setDoc(ref, { items: merged }, { merge: true });
  } catch (e) {
    console.error("お気に入りの移行に失敗しました", e);
  }
}

// Subscribes to the favorites data for whichever mode is active
// (signed-in -> Firestore, signed-out -> localStorage). cb is called with
// (favoritesObject, { signedIn, user }) on load and on every change.
// Returns an unsubscribe function.
export function subscribeFavorites(cb) {
  let unsubFirestore = null;

  const unsubAuth = onAuthChange(async (user) => {
    if (unsubFirestore) {
      unsubFirestore();
      unsubFirestore = null;
    }
    if (user) {
      await migrateLocalIfNeeded(user.uid);
      const ref = doc(db, "favorites", user.uid);
      unsubFirestore = onSnapshot(
        ref,
        (snap) => {
          const items = snap.exists() ? snap.data().items || {} : {};
          cb(items, { signedIn: true, user: user });
        },
        (err) => {
          console.error("お気に入りの同期に失敗しました", err);
          cb(readLocal(), { signedIn: true, user: user, error: err });
        }
      );
    } else {
      cb(readLocal(), { signedIn: false, user: null });
    }
  });

  return function unsubscribe() {
    unsubAuth();
    if (unsubFirestore) unsubFirestore();
  };
}

export async function saveFavorites(data) {
  const user = auth.currentUser;
  if (user) {
    const ref = doc(db, "favorites", user.uid);
    await setDoc(ref, { items: data });
  } else {
    writeLocal(data);
  }
}

export function isSignedIn() {
  return !!auth.currentUser;
}
