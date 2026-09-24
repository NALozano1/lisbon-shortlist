(() => {
  const listEl = document.getElementById('results-list');
  const sortEl = document.getElementById('sort');
  const countEl = document.getElementById('results-count');
  const asofEl = document.getElementById('results-asof');

  let results = [];
  let filter = 'all';
  let sortKey = 'str_mid_coverage';

  const fmtEur = (n) => {
    if (n == null || Number.isNaN(Number(n))) return '—';
    return '€' + Math.round(Number(n)).toLocaleString('pt-PT');
  };
  const fmtRatio = (n) => n == null || Number.isNaN(Number(n)) ? '—' : Number(n).toFixed(1) + '×';
  const fmtCash = (n) => n == null || Number.isNaN(Number(n)) ? '—' : '€' + Math.round(Number(n) / 1000) + 'k';
  const escapeHtml = (s) =>
    String(s || '').replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    );

  function coverageStatus(path) {
    const flag = path && path.coverage_flag;
    if (flag === 'comfortable') return { label: 'Covers', className: 'cov-ok' };
    if (flag === 'tight') return { label: 'Tight', className: 'cov-tight' };
    if (flag === 'below') return { label: 'Below', className: 'cov-below' };
    return { label: '—', className: '' };
  }

  function matchesFilter(r) {
    if (filter === 'all') return true;
    if (filter === '170k') return !!r.price_band_170k || r.band === '170k' || (r.price_eur != null && r.price_eur <= 170000);
    if (filter === 'al') return !!r.al;
    return true;
  }

  function coverage(path) {
    return path && path.coverage_ratio != null ? Number(path.coverage_ratio) : -Infinity;
  }

  function sorted() {
    const arr = results.filter(matchesFilter);
    arr.sort((a, b) => {
      if (sortKey === 'price') return (a.price_eur || 0) - (b.price_eur || 0);
      if (sortKey === 'ltr_coverage') return coverage(b.ltr) - coverage(a.ltr);
      return coverage(b.str_mid) - coverage(a.str_mid);
    });
    return arr;
  }

  function displayArea(r) {
    return escapeHtml((r.area_parish || '').split('/')[0].trim());
  }

  function badges(r) {
    const items = [];
    if (r.al) items.push('<span class="badge AL">AL</span>');
    if (r.high_uncertainty_reno) items.push('<span class="badge reno">Needs works</span>');
    return items.join('');
  }

  function renderCard(r, displayRank) {
    const mid = r.str_mid || {};
    const ltr = r.ltr || {};
    const shortlet = coverageStatus(mid);
    const longlet = coverageStatus(ltr);
    const title = escapeHtml(r.title);
    const typ = escapeHtml(r.typology || r.typology_raw || '');
    const url = escapeHtml(r.url || '#');
    const shortletText = shortlet.label === 'Below'
      ? `${shortlet.label} mortgage ${fmtRatio(mid.coverage_ratio)}`
      : `${shortlet.label} mortgage ${fmtRatio(mid.coverage_ratio)}`;
    const longletText = longlet.label === '—' ? '—' : longlet.label.toLowerCase();

    return `<article class="result-card">
      <div class="result-summary">
        <span class="result-rank">#${displayRank}</span>
        <span class="result-price">${fmtEur(r.price_eur)}</span>
        <span class="result-property">${typ}</span>
        <span class="result-area">${displayArea(r)}</span>
      </div>
      <h2 class="result-title">${title}</h2>
      <div class="shortlet-status ${shortlet.className}">
        <span class="shortlet-label">Short-let:</span>
        <strong>${shortletText}</strong>
      </div>
      <p class="shortlet-detail">Pays ~${fmtEur(mid.income_monthly)}/mo after all STR costs · mortgage ~${fmtEur(r.mortgage_monthly_eur || mid.mortgage_monthly_40y)}/mo (40y)</p>
      <p class="longlet-line">Long-let: <strong class="${longlet.className}">${longletText}</strong></p>
      <p class="cash-needed">Cash needed ~${fmtCash(r.cash_in_eur)}</p>
      ${badges(r) ? `<div class="badges">${badges(r)}</div>` : ''}
      <a class="result-link" href="${url}" target="_blank" rel="noopener">Open listing <span aria-hidden="true">→</span></a>
    </article>`;
  }

  function render() {
    const arr = sorted();
    if (countEl) countEl.textContent = arr.length ? `${arr.length} listings` : 'No results match this filter.';
    if (!arr.length) {
      listEl.innerHTML = '<div class="empty">No results match this filter.</div>';
      return;
    }
    listEl.innerHTML = arr.map((r, i) => renderCard(r, i + 1)).join('');
  }

  document.getElementById('filters').addEventListener('click', (e) => {
    const btn = e.target.closest('.chip');
    if (!btn) return;
    document.querySelectorAll('#filters .chip').forEach((c) => c.classList.remove('active'));
    btn.classList.add('active');
    filter = btn.dataset.filter;
    render();
  });
  sortEl.addEventListener('change', () => {
    sortKey = sortEl.value;
    render();
  });

  fetch('data/roi-results.json?v=20260924-40y')
    .then((r) => {
      if (!r.ok) throw new Error(r.status + ' ' + r.statusText);
      return r.json();
    })
    .then((data) => {
      results = Array.isArray(data.results) ? data.results : [];
      if (asofEl && data.as_of) asofEl.textContent = 'as of ' + data.as_of;
      render();
    })
    .catch((err) => {
      listEl.innerHTML = `<div class="empty">Failed to load results: ${escapeHtml(err.message)}</div>`;
    });
})();
