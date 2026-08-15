import { subscribeFavorites, saveFavorites, mountAuthWidgetIfAvailable } from "./favorites-store.js";

var authContainer = document.querySelector(".top-actions");
mountAuthWidgetIfAvailable(authContainer);

var targets = document.querySelectorAll(".card, .featured");
if (targets.length) {
  var currentFavorites = {};
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

  function commit(nextFavorites) {
    currentFavorites = nextFavorites;
    controllers.forEach(function (c) { c.syncFromData(currentFavorites); });
    saveFavorites(nextFavorites).catch(function (e) {
      console.error("お気に入りの保存に失敗しました", e);
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

    function syncFromData(data) {
      var entry = data[url];
      var isFav = !!entry;
      btn.classList.toggle("is-fav", isFav);
      btn.setAttribute("aria-pressed", isFav ? "true" : "false");
      star.textContent = isFav ? "★" : "☆";
      label.textContent = isFav ? "お気に入り済み" : "お気に入り";
      textarea.hidden = !isFav;
      // Don't clobber the textarea while the user is actively typing in it -
      // remote updates (e.g. another device) can arrive mid-edit.
      if (isFav && document.activeElement !== textarea) {
        textarea.value = entry.comment || "";
      }
    }

    btn.addEventListener("click", function () {
      var next = Object.assign({}, currentFavorites);
      if (next[url]) {
        delete next[url];
      } else {
        next[url] = {
          title: title,
          badge: badge,
          meta: meta,
          comment: "",
          pageTitle: document.title,
          pageUrl: location.pathname + location.search,
          savedAt: Date.now(),
        };
      }
      commit(next);
      if (next[url]) textarea.focus();
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

    var linkRow = el.querySelector(".link-row");
    if (linkRow && linkRow.parentNode) {
      linkRow.parentNode.insertBefore(row, linkRow.nextSibling);
    } else {
      el.appendChild(row);
    }

    controllers.push({ url: url, syncFromData: syncFromData });
  });

  subscribeFavorites(function (data) {
    currentFavorites = data;
    controllers.forEach(function (c) { c.syncFromData(data); });
  });
}
