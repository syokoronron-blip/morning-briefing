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
