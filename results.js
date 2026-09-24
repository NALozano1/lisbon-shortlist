(() => {
  const listEl = document.getElementById('results-list');
  const sortEl = document.getElementById('sort');
  const countEl = document.getElementById('results-count');
  const asofEl = document.getElementById('results-asof');
  const metaEl = document.getElementById('results-meta');
  const methodEl = document.getElementById('method-note');

  let results = [];
  let filter = 'all';
  let sortKey = 'str_mid_coc';
  let cacheBust = '';

  const fmtEur = (n) => {
    if (n == null || Number.isNaN(Number(n))) return '—';
    return '€' + Math.round(Number(n)).toLocaleString('pt-PT');
  };
  const fmtPct = (n) => {
    if (n == null || Number.isNaN(Number(n))) return '—';
    return Number(n).toFixed(1) + '%';
  };
  const escapeHtml = (s) =>
    String(s || '').replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    );

  function covLabel(path, shortName) {
    if (!path || path.coverage_ratio == null) return '';
    const ratio = Number(path.coverage_ratio).toFixed(1);
    const flag = path.coverage_flag || '';
    let human = flag;
    if (flag === 'below') human = 'below mortgage';
    else if (flag === 'tight') human = 'tight';
    else if (flag === 'comfortable') human = 'comfortable';
    return `${shortName} covers ${ratio}× 40y mort · ${human}`;
  }

  function covClass(flag) {
    if (flag === 'below') return 'cov-below';
    if (flag === 'tight') return 'cov-tight';
    if (flag === 'comfortable') return 'cov-ok';
    return '';
  }

  function matchesFilter(r) {
    if (filter === 'all') return true;
    if (filter === '170k') return !!r.price_band_170k || r.band === '170k' || (r.price_eur != null && r.price_eur <= 170000);
    if (filter === '240k') {
      if (r.band === '240k') return true;
      return r.price_eur != null && r.price_eur > 170000 && r.price_eur <= 240000;
    }
    if (filter === 'al') return !!r.al;
    return true;
  }

  function sorted() {
    const arr = results.filter(matchesFilter);
    arr.sort((a, b) => {
      if (sortKey === 'price') return (a.price_eur || 0) - (b.price_eur || 0);
      if (sortKey === 'ltr_coc') {
        const ac = (a.ltr && a.ltr.coc_pct != null) ? a.ltr.coc_pct : -Infinity;
        const bc = (b.ltr && b.ltr.coc_pct != null) ? b.ltr.coc_pct : -Infinity;
        return bc - ac;
      }
      // default STR mid CoC
      const ar = a.rank_str_mid_coc != null ? a.rank_str_mid_coc : 999;
      const br = b.rank_str_mid_coc != null ? b.rank_str_mid_coc : 999;
      if (ar !== br) return ar - br;
      const ac = (a.str_mid && a.str_mid.coc_pct != null) ? a.str_mid.coc_pct : -Infinity;
      const bc = (b.str_mid && b.str_mid.coc_pct != null) ? b.str_mid.coc_pct : -Infinity;
      return bc - ac;
    });
    return arr;
  }

  function flagChips(r) {
    const chips = [];
    if (r.al) chips.push('<span class="badge AL">AL Y</span>');
    else chips.push('<span class="badge al-risk">AL risk</span>');
    if (r.high_uncertainty_reno) chips.push('<span class="badge reno">Reno</span>');
    if (r.str_mid_cf_negative) chips.push('<span class="badge cf-neg">STR CF−</span>');
    if (r.price_band_170k || r.band === '170k' || (r.price_eur != null && r.price_eur <= 170000)) {
      chips.push('<span class="badge band-170k">≤€170k</span>');
    } else {
      chips.push('<span class="badge band-240k">≤€240k</span>');
    }
    return chips.join('');
  }

  function renderCard(r, displayRank) {
    const mid = r.str_mid || {};
    const cons = r.str_cons || {};
    const ltr = r.ltr || {};
    const title = escapeHtml(r.title);
    const parish = escapeHtml(r.area_parish || '');
    const typ = escapeHtml(r.typology || r.typology_raw || '');
    const url = r.url || '#';
    const rankLabel = r.rank_str_mid_coc != null ? r.rank_str_mid_coc : displayRank;

    return `<article class="result-card" data-rank="${rankLabel}">
      <div class="result-card-top">
        <div class="rank" aria-label="Rank ${rankLabel}">${rankLabel}</div>
        <div class="result-card-body">
          <h2><a href="${escapeHtml(url)}" target="_blank" rel="noopener">${title}</a></h2>
          <div class="meta">
            <span class="price">${fmtEur(r.price_eur)}</span>
            <span>${typ}</span>
            <span>${parish}</span>
            <span>Cash-in ${fmtEur(r.cash_in_eur)}</span>
          </div>
          <div class="badges">${flagChips(r)}</div>
        </div>
      </div>
      <div class="result-metrics" role="list">
        <div class="metric hi" role="listitem">
          <span class="metric-label">STR mid CoC</span>
          <span class="metric-value">${fmtPct(mid.coc_pct)}</span>
        </div>
        <div class="metric" role="listitem">
          <span class="metric-label">STR cons CoC</span>
          <span class="metric-value">${fmtPct(cons.coc_pct)}</span>
        </div>
        <div class="metric" role="listitem">
          <span class="metric-label">LTR CoC</span>
          <span class="metric-value">${fmtPct(ltr.coc_pct)}</span>
        </div>
        <div class="metric${mid.cf != null && mid.cf < 0 ? ' neg' : ''}" role="listitem">
          <span class="metric-label">STR mid CF</span>
          <span class="metric-value">${fmtEur(mid.cf)}/yr</span>
        </div>
      </div>
      <div class="coverage-row">
        <span class="cov-chip ${covClass(mid.coverage_flag)}">${escapeHtml(covLabel(mid, 'STR mid') || 'STR mid coverage —')}</span>
        <span class="cov-chip ${covClass(cons.coverage_flag)}">${escapeHtml(covLabel(cons, 'STR cons') || '')}</span>
        <span class="cov-chip ${covClass(ltr.coverage_flag)}">${escapeHtml(covLabel(ltr, 'LTR') || '')}</span>
      </div>
    </article>`;
  }

  function render() {
    const arr = sorted();
    if (countEl) {
      countEl.textContent = arr.length
        ? `Showing ${arr.length} of ${results.length}`
        : 'No results match this filter.';
    }
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

  // Cache-bust so Pages picks up the latest JSON after push
  cacheBust = '20260924-40y';
  fetch(`data/roi-results.json?v=${cacheBust}`)
    .then((r) => {
      if (!r.ok) throw new Error(r.status + ' ' + r.statusText);
      return r.json();
    })
    .then((data) => {
      results = Array.isArray(data.results) ? data.results : [];
      if (asofEl && data.as_of) asofEl.textContent = 'as of ' + data.as_of;
      if (methodEl && data.method_note) {
        methodEl.textContent =
          'Parish/city comps only — no address-level AirDNA Rentalizer. Pre-tax. Loan = min(70% LTV, €170k) · term 40y. ' +
          'See batch note in data file.';
      }
      if (metaEl) {
        const mv = data.model_version || '—';
        const n = data.count != null ? data.count : results.length;
        metaEl.textContent = `Model ${mv} · ${n} listings · generated ${data.generated_at || data.as_of || ''}`;
      }
      render();
    })
    .catch((err) => {
      listEl.innerHTML = `<div class="empty">Failed to load roi-results.json: ${escapeHtml(err.message)}</div>`;
    });
})();
