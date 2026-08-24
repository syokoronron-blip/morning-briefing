import {
  subscribeFavorites,
  saveFavorites,
  mountAuthWidgetIfAvailable,
  uploadFavoriteImage,
  removeFavoriteImage,
} from "./favorites-store.js";

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
var currentStatus = {};
// url -> { el, textarea }. Reused across renders so an in-progress edit
// (e.g. typing a comment) never has its <textarea> torn down and rebuilt -
// on mobile that blurs the field and dismisses the keyboard mid-sentence.
// This matters especially once signed in: saving a comment round-trips
// through Firestore's realtime listener and triggers another render()
// almost immediately, echoing our own write back.
var cardsByUrl = {};

function reportSaveError(e) {
  console.error("お気に入りの保存に失敗しました", e);
  if (!syncNoteEl) return;
  var code = e && (e.code || e.message);
  syncNoteEl.textContent =
    "保存に失敗しました" + (code ? "（" + code + "）" : "") + "。もう一度お試しください。";
  syncNoteEl.classList.add("fav-sync-note-error");
}

function updateSyncNote(status) {
  if (!syncNoteEl) return;
  if (status && status.error) {
    var code = status.error.code || status.error.message || String(status.error);
    syncNoteEl.textContent =
      "同期エラーが発生しました（" + code + "）。この端末にも保存されていない可能性があります。";
    syncNoteEl.classList.add("fav-sync-note-error");
  } else {
    syncNoteEl.classList.remove("fav-sync-note-error");
    syncNoteEl.textContent = status && status.signedIn
      ? "Googleアカウントに同期されています。他の端末でも同じお気に入りが見られます。"
      : "この端末のブラウザ内にのみ保存されています。Googleでログインすると他の端末とも同期されます。";
  }
}

function buildCard(url) {
  var card = document.createElement("div");
  card.className = "card";

  var badge = document.createElement("span");
  badge.className = "badge";
  card.appendChild(badge);

  var h3 = document.createElement("h3");
  var titleLink = document.createElement("a");
  titleLink.href = url;
  titleLink.target = "_blank";
  titleLink.rel = "noopener";
  h3.appendChild(titleLink);
  card.appendChild(h3);

  var meta = document.createElement("div");
  meta.className = "meta";
  var metaSpan = document.createElement("span");
  meta.appendChild(metaSpan);
  card.appendChild(meta);

  var textarea = document.createElement("textarea");
  textarea.className = "fav-comment";
  textarea.rows = 2;
  textarea.placeholder = "メモ（任意）";
  var saveTimer = null;
  function persistComment() {
    if (!currentFavorites[url]) return;
    var next = Object.assign({}, currentFavorites);
    next[url] = Object.assign({}, next[url], { comment: textarea.value });
    currentFavorites = next;
    saveFavorites(next).catch(reportSaveError);
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

  var image = document.createElement("img");
  image.className = "fav-image";
  image.alt = "";
  image.hidden = true;
  card.appendChild(image);

  var imageRow = document.createElement("div");
  imageRow.className = "fav-image-row";

  var fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/*";
  fileInput.hidden = true;

  var addImageBtn = document.createElement("button");
  addImageBtn.type = "button";
  addImageBtn.className = "fav-image-btn";
  addImageBtn.textContent = "画像を追加";
  addImageBtn.addEventListener("click", function () { fileInput.click(); });

  var removeImageBtn = document.createElement("button");
  removeImageBtn.type = "button";
  removeImageBtn.className = "fav-image-btn fav-image-remove";
  removeImageBtn.textContent = "画像を削除";
  removeImageBtn.hidden = true;

  var imageStatus = document.createElement("span");
  imageStatus.className = "fav-image-status";

  fileInput.addEventListener("change", function () {
    var file = fileInput.files && fileInput.files[0];
    fileInput.value = "";
    if (!file || !currentFavorites[url]) return;
    var oldPath = currentFavorites[url].imagePath;
    addImageBtn.disabled = true;
    imageStatus.textContent = "アップロード中…";
    uploadFavoriteImage(file)
      .then(function (result) {
        if (!currentFavorites[url]) return;
        var next = Object.assign({}, currentFavorites);
        next[url] = Object.assign({}, next[url], { imageUrl: result.url, imagePath: result.path });
        currentFavorites = next;
        imageStatus.textContent = "";
        reconcile(next);
        return saveFavorites(next).then(function () {
          if (oldPath && oldPath !== result.path) removeFavoriteImage(oldPath);
        });
      })
      .catch(function (e) {
        console.error("画像のアップロードに失敗しました", e);
        imageStatus.textContent =
          "アップロードに失敗しました" + (e && e.message ? "（" + e.message + "）" : "");
      })
      .finally(function () {
        addImageBtn.disabled = false;
      });
  });

  removeImageBtn.addEventListener("click", function () {
    var current = currentFavorites[url];
    if (!current || !current.imageUrl) return;
    if (!window.confirm("画像を削除しますか？")) return;
    var oldPath = current.imagePath;
    var next = Object.assign({}, currentFavorites);
    next[url] = Object.assign({}, next[url]);
    delete next[url].imageUrl;
    delete next[url].imagePath;
    currentFavorites = next;
    saveFavorites(next).catch(reportSaveError);
    reconcile(next);
    if (oldPath) removeFavoriteImage(oldPath);
  });

  imageRow.appendChild(addImageBtn);
  imageRow.appendChild(removeImageBtn);
  imageRow.appendChild(imageStatus);
  imageRow.appendChild(fileInput);
  card.appendChild(imageRow);

  var actions = document.createElement("div");
  actions.className = "link-row fav-actions-row";

  var readLink = document.createElement("a");
  readLink.href = url;
  readLink.target = "_blank";
  readLink.rel = "noopener";
  readLink.textContent = "元記事を読む ↗";
  actions.appendChild(readLink);

  var removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "fav-remove";
  removeBtn.textContent = "削除";
  removeBtn.addEventListener("click", function () {
    var title = titleLink.textContent || url;
    if (!window.confirm("「" + title + "」をお気に入りから削除しますか？")) return;
    var oldPath = currentFavorites[url] && currentFavorites[url].imagePath;
    var next = Object.assign({}, currentFavorites);
    delete next[url];
    currentFavorites = next;
    saveFavorites(next).catch(reportSaveError);
    reconcile(next);
    if (oldPath) removeFavoriteImage(oldPath);
  });
  actions.appendChild(removeBtn);

  card.appendChild(actions);

  return {
    el: card,
    badge: badge,
    titleLink: titleLink,
    metaSpan: metaSpan,
    meta: meta,
    textarea: textarea,
    image: image,
    addImageBtn: addImageBtn,
    removeImageBtn: removeImageBtn,
  };
}

function updateCard(c, entry) {
  var cls = BADGE_CLASS_MAP[entry.badge];
  c.badge.className = "badge" + (cls ? " " + cls : "");
  c.badge.textContent = entry.badge || "";
  c.badge.hidden = !entry.badge;

  c.titleLink.textContent = entry.title || entry.url;

  c.meta.hidden = !entry.meta;
  c.metaSpan.textContent = entry.meta || "";

  // Never touch the value of a textarea the user is actively typing in -
  // this is what used to get destroyed/recreated on every render.
  if (document.activeElement !== c.textarea) {
    var val = entry.comment || "";
    if (c.textarea.value !== val) c.textarea.value = val;
  }

  if (entry.imageUrl) {
    if (c.image.src !== entry.imageUrl) c.image.src = entry.imageUrl;
    c.image.hidden = false;
    c.removeImageBtn.hidden = false;
    c.addImageBtn.textContent = "画像を変更";
  } else {
    c.image.hidden = true;
    c.image.removeAttribute("src");
    c.removeImageBtn.hidden = true;
    c.addImageBtn.textContent = "画像を追加";
  }
  c.addImageBtn.disabled = !currentStatus.signedIn;
  c.addImageBtn.title = currentStatus.signedIn ? "" : "ログインすると画像を添付できます";
}

function reconcile(favorites) {
  var entries = Object.keys(favorites).map(function (url) {
    var entry = Object.assign({}, favorites[url]);
    entry.url = url;
    return entry;
  });
  entries.sort(function (a, b) { return (b.savedAt || 0) - (a.savedAt || 0); });

  emptyEl.hidden = !!entries.length;

  var seen = {};
  var prevEl = null;
  entries.forEach(function (entry) {
    seen[entry.url] = true;
    var c = cardsByUrl[entry.url];
    if (!c) {
      c = buildCard(entry.url);
      cardsByUrl[entry.url] = c;
    }
    updateCard(c, entry);
    // Only move the card if it isn't already in the right spot. Calling
    // appendChild/insertBefore on a node that already has a parent still
    // does a real remove-then-insert per the DOM spec, even when the net
    // order doesn't change - and that blurs a focused descendant (e.g. a
    // comment textarea mid-edit). Since this reconcile runs on every
    // autosave round-trip (save -> realtime listener echo -> render), that
    // was blurring the very textarea the user was typing into.
    if (c.el.parentNode !== grid || c.el.previousSibling !== prevEl) {
      grid.insertBefore(c.el, prevEl ? prevEl.nextSibling : grid.firstChild);
    }
    prevEl = c.el;
  });

  Object.keys(cardsByUrl).forEach(function (url) {
    if (!seen[url]) {
      cardsByUrl[url].el.remove();
      delete cardsByUrl[url];
    }
  });
}

function render(favorites, status) {
  currentFavorites = favorites;
  currentStatus = status || {};
  updateSyncNote(status);
  reconcile(favorites);
}

if (grid) {
  subscribeFavorites(function (data, status) {
    render(data, status);
  });
}
