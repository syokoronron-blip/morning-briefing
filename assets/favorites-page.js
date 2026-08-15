(function () {
  var STORAGE_KEY = 'mb-favorites-v1';
  var grid = document.getElementById('fav-grid');
  var emptyEl = document.getElementById('fav-empty');
  if (!grid) return;

  var BADGE_CLASS_MAP = {
    '知らない地域の変化': 'badge-axis1',
    '感性を刺激する表現': 'badge-axis2',
    '異分野を掛け合わせる開拓者': 'badge-axis3',
    '人を動かす人': 'badge-axis4',
    '生命・生物の発見': 'badge-axis5',
    '労務・法改正': 'badge-labor',
    'HRtech': 'badge-hrtech',
    'Fintech': 'badge-fintech',
    'バックオフィスSaaS': 'badge-backoffice'
  };

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
      // ignore
    }
  }

  function render() {
    var favorites = loadFavorites();
    var entries = Object.keys(favorites).map(function (url) {
      var entry = favorites[url];
      entry.url = url;
      return entry;
    });
    entries.sort(function (a, b) { return (b.savedAt || 0) - (a.savedAt || 0); });

    grid.innerHTML = '';

    if (!entries.length) {
      emptyEl.hidden = false;
      return;
    }
    emptyEl.hidden = true;

    entries.forEach(function (entry) {
      var card = document.createElement('div');
      card.className = 'card';

      if (entry.badge) {
        var badge = document.createElement('span');
        var cls = BADGE_CLASS_MAP[entry.badge];
        badge.className = 'badge' + (cls ? ' ' + cls : '');
        badge.textContent = entry.badge;
        card.appendChild(badge);
      }

      var h3 = document.createElement('h3');
      var titleLink = document.createElement('a');
      titleLink.href = entry.url;
      titleLink.target = '_blank';
      titleLink.rel = 'noopener';
      titleLink.textContent = entry.title || entry.url;
      h3.appendChild(titleLink);
      card.appendChild(h3);

      if (entry.meta) {
        var meta = document.createElement('div');
        meta.className = 'meta';
        var span = document.createElement('span');
        span.textContent = entry.meta;
        meta.appendChild(span);
        card.appendChild(meta);
      }

      var textarea = document.createElement('textarea');
      textarea.className = 'fav-comment';
      textarea.rows = 2;
      textarea.placeholder = 'メモ（任意）';
      textarea.value = entry.comment || '';
      textarea.addEventListener('input', function () {
        var data = loadFavorites();
        if (!data[entry.url]) return;
        data[entry.url].comment = textarea.value;
        saveFavorites(data);
      });
      card.appendChild(textarea);

      var actions = document.createElement('div');
      actions.className = 'link-row fav-actions-row';

      var readLink = document.createElement('a');
      readLink.href = entry.url;
      readLink.target = '_blank';
      readLink.rel = 'noopener';
      readLink.textContent = '元記事を読む ↗';
      actions.appendChild(readLink);

      var removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'fav-remove';
      removeBtn.textContent = '削除';
      removeBtn.addEventListener('click', function () {
        var data = loadFavorites();
        delete data[entry.url];
        saveFavorites(data);
        render();
      });
      actions.appendChild(removeBtn);

      card.appendChild(actions);
      grid.appendChild(card);
    });
  }

  render();
})();
