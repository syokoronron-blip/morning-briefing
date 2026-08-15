import { auth, onAuthChange, signIn, signOutUser } from "./firebase-init.js";

// Renders a small "Googleでログイン" / "<name> ログアウト" control into
// `container` and keeps it in sync with auth state. Shared by the
// per-article favorite widget and the favorites list page.
export function mountAuthWidget(container) {
  if (!container) return;

  var btn = document.createElement("button");
  btn.type = "button";
  btn.className = "auth-btn";
  container.appendChild(btn);

  function render(user) {
    if (user) {
      var name = user.displayName || user.email || "ログイン中";
      btn.textContent = name + " ・ ログアウト";
      btn.title = "クリックでログアウト";
      btn.classList.add("is-signed-in");
    } else {
      btn.textContent = "Googleでログイン";
      btn.title = "お気に入りをこの端末以外とも同期します";
      btn.classList.remove("is-signed-in");
    }
  }

  btn.addEventListener("click", function () {
    if (auth.currentUser) {
      signOutUser().catch(function (e) { console.error(e); });
    } else {
      // signInWithRedirect navigates away from the page - there's nothing
      // meaningful to await here, and control returns to this code (with
      // the user signed in) via onAuthChange after the redirect back.
      btn.disabled = true;
      signIn().catch(function (e) {
        console.error("ログインに失敗しました", e);
        btn.disabled = false;
      });
    }
  });

  onAuthChange(render);
}
