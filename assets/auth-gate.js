// Hides <main> behind a "please sign in" overlay until Google sign-in
// resolves. This is a client-side UX gate, not real access control - the
// underlying HTML is still fetchable directly (view-source, curl) since
// this is a static site with no backend. If Firebase can't be loaded at
// all (offline, ad-blocker, etc.) this fails OPEN and shows the content,
// rather than locking the page over a network hiccup.
import { subscribeAuthState, signIn } from "./favorites-store.js";

var main = document.querySelector("main.gated");
if (main) {
  var overlay = document.createElement("div");
  overlay.className = "auth-gate";
  overlay.innerHTML =
    '<div class="auth-gate-card">' +
      '<p class="auth-gate-title">読み込み中…</p>' +
    "</div>";
  document.body.appendChild(overlay);

  function showLoading() {
    overlay.hidden = false;
    overlay.innerHTML =
      '<div class="auth-gate-card">' +
        '<p class="auth-gate-title">読み込み中…</p>' +
      "</div>";
  }

  function showPrompt(err) {
    overlay.hidden = false;
    overlay.innerHTML =
      '<div class="auth-gate-card">' +
        '<p class="auth-gate-title">ログインしてください</p>' +
        '<p class="auth-gate-desc">このブリーフィングはGoogleアカウントでログインすると読めます。</p>' +
        (err
          ? '<p class="auth-gate-error">前回のログインでエラーが発生しました：' +
            (err.code || err.message || String(err)) +
            "</p>"
          : "") +
        '<button type="button" class="auth-gate-btn">Googleでログイン</button>' +
      "</div>";
    overlay.querySelector(".auth-gate-btn").addEventListener("click", function (e) {
      var btn = e.currentTarget;
      btn.disabled = true;
      btn.textContent = "ログイン中…";
      signIn();
    });
  }

  function unlock() {
    overlay.hidden = true;
    main.classList.remove("gated");
  }

  showLoading();

  subscribeAuthState(function (state) {
    if (!state.available || state.signedIn) {
      unlock();
    } else {
      showPrompt(state.redirectError);
    }
  });

  // If this page is restored from the back-forward cache (common right
  // after a signInWithRedirect() round trip on some mobile browsers), its
  // module scripts don't re-run and the gate can be left showing stale
  // pre-login state. Force a real reload so it re-evaluates fresh.
  window.addEventListener("pageshow", function (event) {
    if (event.persisted) {
      location.reload();
    }
  });
}
