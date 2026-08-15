import { subscribeFavorites, saveFavorites, mountAuthWidgetIfAvailable } from "./favorites-store.js";

var authContainer = document.querySelector(".top-actions");
mountAuthWidgetIfAvailable(authContainer);

var grid = document.getElementById("fav-grid");
var emptyEl = document.getElementById("fav-empty");
var syncNoteEl = document.getElementById("fav-sync-note");

var BADGE_CLASS_MAP = {
  '知らない地域の変化': 'badge-axis1',
  '感性を刺激する表現': 'badge-axis2',
  '異分野を掛け合わせる開拓者': 'badge-axis3',
  '人を動かす人': 'badge-axis4',
  '生命・生物の発見': 'badge-axis5',
  '労務・法改正': 'badge-labor',
  '競合動向': 'badge-competitor',
  '業界構造・市場動向': 'badge-industry',
  '中小企業・経済環境': 'badge-smb'
};

var currentFavorites = {};

function render(favorites, status) {
  currentFavorites = favorites;

  if (syncNoteEl) {
    syncNoteEl.textContent = status && status.signedIn
      ? "Googleアカウントに同期されています。他の端末でも同じお気に入りが見られます。"
      : "この端末のブラウザ内にのみ保存されています。Googleでログインすると他の端末とも同期されます。";
  }

  var entries = Object.keys(favorites).map(function (url) {
    var entry = Object.assign({}, favorites[url]);
    entry.url = url;
    return entry;
  });
  entries.sort(function (a, b) { return (b.savedAt || 0) - (a.savedAt || 0); });

  grid.innerHTML = "";

  if (!entries.length) {
    emptyEl.hidden = false;
    return;
  }
  emptyEl.hidden = true;

  entries.forEach(function (entry) {
    var card = document.createElement("div");
    card.className = "card";

    if (entry.badge) {
      var badge = document.createElement("span");
      var cls = BADGE_CLASS_MAP[entry.badge];
      badge.className = "badge" + (cls ? " " + cls : "");
      badge.textContent = entry.badge;
      card.appendChild(badge);
    }

    var h3 = document.createElement("h3");
    var titleLink = document.createElement("a");
    titleLink.href = entry.url;
    titleLink.target = "_blank";
    titleLink.rel = "noopener";
    titleLink.textContent = entry.title || entry.url;
    h3.appendChild(titleLink);
    card.appendChild(h3);

    if (entry.meta) {
      var meta = document.createElement("div");
      meta.className = "meta";
      var span = document.createElement("span");
      span.textContent = entry.meta;
      meta.appendChild(span);
      card.appendChild(meta);
    }

    var textarea = document.createElement("textarea");
    textarea.className = "fav-comment";
    textarea.rows = 2;
    textarea.placeholder = "メモ（任意）";
    textarea.value = entry.comment || "";
    var saveTimer = null;
    function persistComment() {
      if (!currentFavorites[entry.url]) return;
      var next = Object.assign({}, currentFavorites);
      next[entry.url] = Object.assign({}, next[entry.url], { comment: textarea.value });
      currentFavorites = next;
      saveFavorites(next).catch(function (e) { console.error(e); });
    }
    textarea.addEventListener("input", function () {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(persistComment, 400);
    });
    textarea.addEventListener("blur", function () {
      clearTimeout(saveTimer);
      persistComment();
    });
    card.appendChild(textarea);

    var actions = document.createElement("div");
    actions.className = "link-row fav-actions-row";

    var readLink = document.createElement("a");
    readLink.href = entry.url;
    readLink.target = "_blank";
    readLink.rel = "noopener";
    readLink.textContent = "元記事を読む ↗";
    actions.appendChild(readLink);

    var removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "fav-remove";
    removeBtn.textContent = "削除";
    removeBtn.addEventListener("click", function () {
      var next = Object.assign({}, currentFavorites);
      delete next[entry.url];
      currentFavorites = next;
      saveFavorites(next).catch(function (e) { console.error(e); });
      render(next, { signedIn: !!(status && status.signedIn) });
    });
    actions.appendChild(removeBtn);

    card.appendChild(actions);
    grid.appendChild(card);
  });
}

if (grid) {
  subscribeFavorites(function (data, status) {
    render(data, status);
  });
}
