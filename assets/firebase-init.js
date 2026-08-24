// Shared Firebase setup + favorites storage abstraction.
// No bundler in this repo, so we load the Firebase Web SDK straight from
// Google's CDN as ES modules (the "<script> タグを使用する" option in the
// Firebase console), not the npm package.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
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
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

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
export const storage = getStorage(app);
const provider = new GoogleAuthProvider();

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

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
  // Popup, not redirect: signInWithRedirect requires the pending-sign-in
  // state to survive a full navigation away to accounts.google.com and
  // back through this site's authDomain (a different eTLD from this
  // GitHub Pages site) - browsers that partition/restrict cross-site
  // storage can silently drop that state, which is what was happening
  // here. The popup flow keeps this window alive and gets the result back
  // directly, so it doesn't depend on that.
  return signInWithPopup(auth, provider);
}

export function signOutUser() {
  return fbSignOut(auth);
}

export function onAuthChange(cb) {
  return onAuthStateChanged(auth, cb);
}

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

const UPLOAD_TIMEOUT_MS = 20000;

function withTimeout(promise, message) {
  return new Promise(function (resolve, reject) {
    var timer = setTimeout(function () {
      reject(new Error(message));
    }, UPLOAD_TIMEOUT_MS);
    promise.then(
      function (v) { clearTimeout(timer); resolve(v); },
      function (e) { clearTimeout(timer); reject(e); }
    );
  });
}

// Uploads an image for a favorite's card to this user's own Storage path
// (favorite-images/{uid}/...) and returns { url, path }. `path` is kept on
// the favorite entry so the file can be deleted later (removeFavoriteImage,
// or when the favorite itself is removed). Requires sign-in - Storage rules
// key writes off request.auth.uid, so there's nowhere to put an
// unauthenticated user's upload.
//
// Wrapped in a timeout: a misconfigured/never-enabled Storage bucket or a
// blocked network path can leave the underlying request neither resolving
// nor rejecting, which would otherwise strand the UI on "アップロード中…"
// forever instead of surfacing an error.
export async function uploadFavoriteImage(file) {
  const user = auth.currentUser;
  if (!user) throw new Error("画像を添付するにはログインが必要です。");
  if (!/^image\//.test(file.type)) throw new Error("画像ファイルを選択してください。");
  if (file.size > MAX_IMAGE_BYTES) throw new Error("画像は5MB以下にしてください。");
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
  const path = "favorite-images/" + user.uid + "/" + Date.now() + "-" + safeName;
  const ref = storageRef(storage, path);
  await withTimeout(
    uploadBytes(ref, file, { contentType: file.type }),
    "アップロードがタイムアウトしました。Firebase StorageのセキュリティルールとStorageの有効化状況を確認してください。"
  );
  const url = await withTimeout(getDownloadURL(ref), "画像URLの取得がタイムアウトしました。");
  return { url: url, path: path };
}

// Best-effort: an image left behind in Storage is harmless clutter, not a
// data-loss risk, so a delete failure (e.g. already gone) is only logged.
export async function removeFavoriteImage(path) {
  if (!path) return;
  try {
    await deleteObject(storageRef(storage, path));
  } catch (e) {
    console.warn("画像の削除に失敗しました", e);
  }
}
