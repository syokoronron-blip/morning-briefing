import {
  subscribeFavorites,
  saveFavorites,
  mountAuthWidgetIfAvailable,
  uploadFavoriteImage,
  removeFavoriteImage,
} from "./favorites-store.js";

var authContainer = document.querySelector(".top-actions");
mountAuthWidgetIfAvailable(authContainer);

var targets = document.querySelectorAll(".card, .featured");
if (targets.length) {
  var currentFavorites = {};
  var currentStatus = {};
  var controllers = [];

  function extractMeta(el) {
    var metaEl = el.querySelector(".meta");
    if (metaEl) {
      return Array.prototype.slice
        .call(metaEl.querySelectorAll("span"))
        .map(function (s) { return s.textContent.trim(); })
        .join(" ・ ");
    }
    var srcEl = el.querySelector(".featured-source");
    return srcEl ? srcEl.textContent.trim() : "";
  }

  var syncErrorEl = null;
  function reportSyncError(e) {
    if (!syncErrorEl) {
      syncErrorEl = document.createElement("div");
      syncErrorEl.className = "fav-sync-error";
      syncErrorEl.setAttribute("role", "alert");
      var topInner = document.querySelector(".top-inner");
      (topInner || document.body).appendChild(syncErrorEl);
    }
    var code = e && (e.code || e.message);
    syncErrorEl.textContent =
      "お気に入りの同期に失敗しました" + (code ? "（" + code + "）" : "") +
      "。この端末にも保存されていない可能性があります。";
    syncErrorEl.hidden = false;
  }

  function commit(nextFavorites) {
    currentFavorites = nextFavorites;
    controllers.forEach(function (c) { c.syncFromData(currentFavorites); });
    saveFavorites(nextFavorites).catch(function (e) {
      console.error("お気に入りの保存に失敗しました", e);
      reportSyncError(e);
    });
  }

  targets.forEach(function (el) {
    var linkEl = el.querySelector("h2 a, h3 a");
    if (!linkEl) return;
    var url = linkEl.href;
    var title = linkEl.textContent.trim();
    var badgeEl = el.querySelector(".badge");
    var badge = badgeEl ? badgeEl.textContent.trim() : "";
    var meta = extractMeta(el);

    var row = document.createElement("div");
    row.className = "fav-toggle-row";

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "fav-btn";

    var star = document.createElement("span");
    star.className = "fav-star";
    star.setAttribute("aria-hidden", "true");

    var label = document.createElement("span");
    label.className = "fav-label";

    btn.appendChild(star);
    btn.appendChild(label);

    var textarea = document.createElement("textarea");
    textarea.className = "fav-comment";
    textarea.placeholder = "メモ（任意）";
    textarea.rows = 2;
    textarea.hidden = true;

    var image = document.createElement("img");
    image.className = "fav-image";
    image.alt = "";
    image.hidden = true;

    var imageRow = document.createElement("div");
    imageRow.className = "fav-image-row";
    imageRow.hidden = true;

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
          imageStatus.textContent = "";
          commit(next);
          if (oldPath && oldPath !== result.path) removeFavoriteImage(oldPath);
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
      commit(next);
      if (oldPath) removeFavoriteImage(oldPath);
    });

    imageRow.appendChild(addImageBtn);
    imageRow.appendChild(removeImageBtn);
    imageRow.appendChild(imageStatus);
    imageRow.appendChild(fileInput);

    function syncFromData(data) {
      var entry = data[url];
      var isFav = !!entry;
      btn.classList.toggle("is-fav", isFav);
      btn.setAttribute("aria-pressed", isFav ? "true" : "false");
      star.textContent = isFav ? "★" : "☆";
      label.textContent = isFav ? "お気に入り済み" : "お気に入り";
      // Don't touch the textarea while the user is actively typing in it -
      // remote updates (e.g. another device) can arrive mid-edit, and
      // toggling `hidden` on a focused element blurs it even when this
      // specific entry's favorited state hasn't actually changed.
      if (document.activeElement !== textarea) {
        textarea.hidden = !isFav;
        if (isFav) textarea.value = entry.comment || "";
      }

      imageRow.hidden = !isFav;
      if (isFav && entry.imageUrl) {
        if (image.src !== entry.imageUrl) image.src = entry.imageUrl;
        image.hidden = false;
        removeImageBtn.hidden = false;
        addImageBtn.textContent = "画像を変更";
      } else {
        image.hidden = true;
        image.removeAttribute("src");
        removeImageBtn.hidden = true;
        addImageBtn.textContent = "画像を追加";
      }
      addImageBtn.disabled = !currentStatus.signedIn;
      addImageBtn.title = currentStatus.signedIn ? "" : "ログインすると画像を添付できます";
    }

    btn.addEventListener("click", function () {
      var next = Object.assign({}, currentFavorites);
      var oldImagePath = null;
      if (next[url]) {
        oldImagePath = next[url].imagePath;
        delete next[url];
      } else {
        next[url] = {
          title: title,
          badge: badge,
          meta: meta,
          // The CSS [hidden] fix aside, keep this defensive: preserve
          // whatever's already in the box rather than hardcoding "", so a
          // note typed before hitting the star isn't discarded.
          comment: textarea.value || "",
          pageTitle: document.title,
          pageUrl: location.pathname + location.search,
          savedAt: Date.now(),
        };
      }
      commit(next);
      if (next[url]) {
        textarea.focus();
      } else if (oldImagePath) {
        removeFavoriteImage(oldImagePath);
      }
    });

    var saveTimer = null;
    function persistComment() {
      if (!currentFavorites[url]) return;
      var next = Object.assign({}, currentFavorites);
      next[url] = Object.assign({}, next[url], { comment: textarea.value });
      commit(next);
    }
    textarea.addEventListener("input", function () {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(persistComment, 400);
    });
    textarea.addEventListener("blur", function () {
      clearTimeout(saveTimer);
      persistComment();
    });

    row.appendChild(btn);
    row.appendChild(textarea);
    row.appendChild(image);
    row.appendChild(imageRow);

    var linkRow = el.querySelector(".link-row");
    if (linkRow && linkRow.parentNode) {
      linkRow.parentNode.insertBefore(row, linkRow.nextSibling);
    } else {
      el.appendChild(row);
    }

    controllers.push({ url: url, syncFromData: syncFromData });
  });

  subscribeFavorites(function (data, status) {
    currentFavorites = data;
    currentStatus = status || {};
    controllers.forEach(function (c) { c.syncFromData(data); });
    if (status && status.error) reportSyncError(status.error);
  });
}
