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
let resolvedFirebaseModule = null;

function loadFirebase() {
  if (!firebaseLoadPromise) {
    firebaseLoadPromise = import("./firebase-init.js")
      .then(function (mod) {
        resolvedFirebaseModule = mod;
        return mod;
      })
      .catch(function (e) {
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

// Calls straight into the already-loaded module when possible, rather than
// through an extra .then() - signInWithPopup must be invoked synchronously
// within the click handler's call stack, or browsers can treat the popup as
// not user-initiated and block it. By the time a sign-in button is visible
// and clickable, Firebase has already loaded successfully (that's why the
// button exists), so this is the common path; the async fallback only
// covers the unlikely case of a click landing before that.
export function signIn() {
  if (resolvedFirebaseModule) {
    return resolvedFirebaseModule.signIn();
  }
  return loadFirebase().then(function (mod) {
    if (!mod) {
      throw new Error("Firebaseを読み込めませんでした。通信環境を確認してください。");
    }
    return mod.signIn();
  });
}

// Reports auth state for gating content behind login. `available: false`
// means Firebase couldn't be loaded at all - callers should fail open
// (treat as unlocked) rather than lock users out over a network hiccup.
export function subscribeAuthState(cb) {
  var cancelled = false;
  var unsub = null;
  loadFirebase().then(function (mod) {
    if (cancelled) return;
    if (!mod) {
      cb({ available: false, signedIn: false });
      return;
    }
    unsub = mod.onAuthChange(function (user) {
      cb({ available: true, signedIn: !!user, user: user });
    });
  });
  return function unsubscribe() {
    cancelled = true;
    if (unsub) unsub();
  };
}
