// Resilient favorites storage: tries to load the Firebase-backed store
// (assets/firebase-init.js) so favorites can sync to a Google account, but
// degrades gracefully to plain localStorage if the Firebase SDK can't be
// loaded (offline, ad-blocker, restrictive network, etc.) so the feature
// never breaks entirely - it just stops syncing.
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

let firebaseLoadPromise = null;

function loadFirebase() {
  if (!firebaseLoadPromise) {
    firebaseLoadPromise = import("./firebase-init.js").catch(function (e) {
      console.warn(
        "Firebaseを読み込めなかったため、お気に入りはこの端末のみに保存されます。",
        e
      );
      return null;
    });
  }
  return firebaseLoadPromise;
}

// Kick off the load speculatively so it's usually ready by the time a
// consumer calls subscribeFavorites/saveFavorites, without blocking on it.
loadFirebase();

export function subscribeFavorites(cb) {
  var cancelled = false;
  var unsub = null;
  loadFirebase().then(function (mod) {
    if (cancelled) return;
    if (mod) {
      unsub = mod.subscribeFavorites(cb);
    } else {
      cb(readLocal(), { signedIn: false, offline: true });
    }
  });
  return function unsubscribe() {
    cancelled = true;
    if (unsub) unsub();
  };
}

export async function saveFavorites(data) {
  var mod = await loadFirebase();
  if (mod) {
    return mod.saveFavorites(data);
  }
  writeLocal(data);
}

// No-op if Firebase never loaded - a login button that can't actually sign
// anyone in would just be confusing.
export async function mountAuthWidgetIfAvailable(container) {
  if (!container) return;
  var mod = await loadFirebase();
  if (!mod) return;
  var authMod = await import("./auth-widget.js");
  authMod.mountAuthWidget(container);
}
