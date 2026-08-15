(function () {
  var inspireBtn = document.getElementById('tab-btn-inspire');
  var industryBtn = document.getElementById('tab-btn-industry');
  var inspirePanel = document.getElementById('panel-inspire');
  var industryPanel = document.getElementById('panel-industry');
  if (!inspireBtn || !industryBtn) return;

  function show(which) {
    var isInspire = which === 'inspire';
    inspireBtn.classList.toggle('active', isInspire);
    industryBtn.classList.toggle('active', !isInspire);
    inspireBtn.setAttribute('aria-selected', isInspire ? 'true' : 'false');
    industryBtn.setAttribute('aria-selected', isInspire ? 'false' : 'true');
    inspirePanel.classList.toggle('active', isInspire);
    industryPanel.classList.toggle('active', !isInspire);
  }

  inspireBtn.addEventListener('click', function () { show('inspire'); });
  industryBtn.addEventListener('click', function () { show('industry'); });
})();

// Favorite (お気に入り) toggle + optional comment, injected into every
// .card / .featured block. Stored client-side only (localStorage), so
// favorites are per-browser and do not sync across devices.
(function () {
  var STORAGE_KEY = 'mb-favorites-v1';
  var targets = document.querySelectorAll('.card, .featured');
  if (!targets.length) return;

  function loadFavorites() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch (e) {
      return {};
    }
  }

  function saveFavorites(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      // localStorage unavailable (private mode, quota, etc.) - fail silently
    }
  }

  function extractMeta(el) {
    var metaEl = el.querySelector('.meta');
    if (metaEl) {
      return Array.prototype.slice.call(metaEl.querySelectorAll('span'))
        .map(function (s) { return s.textContent.trim(); })
        .join(' ・ ');
    }
    var srcEl = el.querySelector('.featured-source');
    return srcEl ? srcEl.textContent.trim() : '';
  }

  var favorites = loadFavorites();

  targets.forEach(function (el) {
    var linkEl = el.querySelector('h2 a, h3 a');
    if (!linkEl) return;
    var url = linkEl.href;
    var title = linkEl.textContent.trim();
    var badgeEl = el.querySelector('.badge');
    var badge = badgeEl ? badgeEl.textContent.trim() : '';
    var meta = extractMeta(el);

    var row = document.createElement('div');
    row.className = 'fav-toggle-row';

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'fav-btn';

    var star = document.createElement('span');
    star.className = 'fav-star';
    star.setAttribute('aria-hidden', 'true');

    var label = document.createElement('span');
    label.className = 'fav-label';

    btn.appendChild(star);
    btn.appendChild(label);

    var textarea = document.createElement('textarea');
    textarea.className = 'fav-comment';
    textarea.placeholder = 'メモ（任意）';
    textarea.rows = 2;
    textarea.hidden = true;

    function render() {
      var entry = favorites[url];
      var isFav = !!entry;
      btn.classList.toggle('is-fav', isFav);
      btn.setAttribute('aria-pressed', isFav ? 'true' : 'false');
      star.textContent = isFav ? '★' : '☆';
      label.textContent = isFav ? 'お気に入り済み' : 'お気に入り';
      textarea.hidden = !isFav;
      if (isFav) {
        textarea.value = entry.comment || '';
      }
    }

    btn.addEventListener('click', function () {
      if (favorites[url]) {
        delete favorites[url];
      } else {
        favorites[url] = {
          title: title,
          badge: badge,
          meta: meta,
          comment: '',
          pageTitle: document.title,
          pageUrl: location.pathname + location.search,
          savedAt: Date.now()
        };
      }
      saveFavorites(favorites);
      render();
      if (favorites[url]) textarea.focus();
    });

    var saveTimer = null;
    function persistComment() {
      if (!favorites[url]) return;
      favorites[url].comment = textarea.value;
      saveFavorites(favorites);
    }
    textarea.addEventListener('input', function () {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(persistComment, 400);
    });
    textarea.addEventListener('blur', function () {
      clearTimeout(saveTimer);
      persistComment();
    });

    render();
    row.appendChild(btn);
    row.appendChild(textarea);

    var linkRow = el.querySelector('.link-row');
    if (linkRow && linkRow.parentNode) {
      linkRow.parentNode.insertBefore(row, linkRow.nextSibling);
    } else {
      el.appendChild(row);
    }
  });
})();
