(() => {
  const LS_KEY = 'lisbon-roi-inputs-v015';
  const CACHE_BUST = '0.1.5b';
  const inputsEl = document.getElementById('inputs');
  const outputsEl = document.getElementById('outputs');
  const tableBody = document.querySelector('#assumptions-table tbody');
  const stampEl = document.getElementById('model-stamp');
  const auditEl = document.getElementById('audit-line');
  const draftSelect = document.getElementById('draft-select');
  const modeHint = document.getElementById('mode-hint');
  const footnoteEl = document.getElementById('roi-footnote');

  let model = null;
  let values = {};
  let drafts = null;

  const fmtEUR = (n) =>
    n == null || !Number.isFinite(n)
      ? '—'
      : '€' + Math.round(n).toLocaleString('pt-PT');
  const fmtPct = (n) =>
    n == null || !Number.isFinite(n) ? '—' : n.toFixed(1) + '%';
  const fmtNum = (n, d = 1) =>
    n == null || !Number.isFinite(n) ? '—' : n.toFixed(d);

  function currentMode() {
    return values.income_mode === 'ltr' ? 'ltr' : 'str';
  }

  function assumptionVisible(a, mode) {
    if (a.include === false) return false;
    if (a.input === false && a.id !== 'income_mode') {
      // still show non-input register rows in table; inputs panel filters input!==false
    }
    const modes = a.modes;
    if (!modes || !modes.length) return true;
    return modes.includes(mode);
  }

  function outputVisible(o, mode) {
    const modes = o.modes;
    if (!modes || !modes.length) return true;
    return modes.includes(mode);
  }

  function amortMonthly(principal, annualRatePct, years) {
    const P = Number(principal) || 0;
    const r = (Number(annualRatePct) || 0) / 100 / 12;
    const n = (Number(years) || 0) * 12;
    if (P <= 0 || n <= 0) return 0;
    if (r === 0) return P / n;
    return (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  }

  // Effective-rate interpolation of illustrative Continente secondary-habitação
  // worked checks; this is a proxy, not the official IMT calculator.
  function imtProxyPct(price) {
    const checks = [
      [0, 0],
      [155000, 1.5],
      [170000, 1.8],
      [200000, 2.3],
      [240000, 3.1],
    ];
    if (price <= 0) return 0;
    for (let i = 1; i < checks.length; i += 1) {
      const [x1, y1] = checks[i - 1];
      const [x2, y2] = checks[i];
      if (price <= x2) return y1 + ((price - x1) * (y2 - y1)) / (x2 - x1);
    }
    const [x1, y1] = checks[checks.length - 2];
    const [x2, y2] = checks[checks.length - 1];
    return y2 + ((price - x2) * (y2 - y1)) / (x2 - x1);
  }

  function compute(v) {
    const mode = v.income_mode === 'ltr' ? 'ltr' : 'str';
    const price = Number(v.purchase_price) || 0;
    const closeOverridePct = Number(v.closing_costs_override_pct) || 0;
    const imtOverridePct = Number(v.imt_purchase_pct) || 0;
    const imtPct = imtOverridePct > 0 ? imtOverridePct : imtProxyPct(price);
    const imtEur = price * (imtPct / 100);
    const stampPurchasePct = Number(v.stamp_duty_purchase_pct) || 0;
    const notaryLegal = Number(v.notary_registry_lawyer_eur) || 0;
    const mortgageStampPct = Number(v.mortgage_stamp_duty_pct) || 0;
    const fitout = Number(v.furniture_fitout) || 0;
    const condo = Number(v.condo_monthly) || 0;
    const imi = Number(v.imi_annual) || 0;
    const utils = Number(v.utilities_monthly) || 0;
    const insurance = Number(v.insurance_monthly) || 0;
    const managementPct = (Number(v.management_fee_pct) || 0) / 100;
    const irsPct = (Number(v.irs_rental_pct) || 0) / 100;
    const maintPct = (Number(v.maintenance_pct_gross) || 0) / 100;
    const loan = Number(v.loan_amount) || 0;
    const closingStack =
      imtEur +
      price * (stampPurchasePct / 100) +
      notaryLegal +
      loan * (mortgageStampPct / 100);
    const closing =
      closeOverridePct > 0 ? price * (closeOverridePct / 100) : closingStack;
    const rate = Number(v.mortgage_rate_pct) || 0;
    const term = Number(v.mortgage_term_years) || 0;

    let gross = 0;
    let platform = 0;
    let cleaningAnnual = 0;
    let turnoversMonth = 0;
    let be = null;

    if (mode === 'ltr') {
      const rent = Number(v.monthly_rent) || 0;
      const vac = Math.max(0, Math.min(12, Number(v.vacancy_months) || 0));
      gross = rent * 12 * (1 - vac / 12);
      // LTR: no platform/cleaning; maint % of annual rent (gross after vacancy)
      const maint = gross * maintPct;
      const opexOther =
        condo * 12 +
        imi +
        utils * 12 +
        insurance * 12 +
        maint +
        gross * managementPct;
      const noi = gross - opexOther;
      const mortMo = amortMonthly(loan, rate, term);
      const mortYr = mortMo * 12;
      const cashFlow = noi - mortYr;
      const cashFlowAfterIrs = cashFlow - Math.max(noi, 0) * irsPct;
      const down = Math.max(price - loan, 0);
      const cashIn = down + closing + fitout;
      const coc = cashIn > 0 ? (cashFlow / cashIn) * 100 : null;
      const cocAfterIrs =
        cashIn > 0 ? (cashFlowAfterIrs / cashIn) * 100 : null;
      const cap = price > 0 ? (noi / price) * 100 : null;

      return {
        gross_annual_revenue: gross,
        platform_fees_annual: 0,
        cleaning_annual: 0,
        opex_annual: opexOther,
        noi,
        mortgage_monthly: mortMo,
        mortgage_annual: mortYr,
        cash_flow: cashFlow,
        cash_flow_after_irs: cashFlowAfterIrs,
        cash_on_cash_pct: coc,
        cash_on_cash_after_irs_pct: cocAfterIrs,
        imt_eur: imtEur,
        cap_rate_pct: cap,
        break_even_occupancy_pct: null,
        total_cash_in: cashIn,
        turnovers_per_month: null,
      };
    }

    // STR path (current behaviour)
    const adr = Number(v.nightly_rate) || 0;
    const occ = (Number(v.occupancy_pct) || 0) / 100;
    const feePct = (Number(v.platform_fees_pct) || 0) / 100;
    const avgStay = Math.max(Number(v.avg_stay_nights) || 1, 0.5);
    const clean = Number(v.cleaning_per_turnover) || 0;

    const nightsYear = 365 * occ;
    gross = adr * nightsYear;
    platform = gross * feePct;
    turnoversMonth = (365 * occ) / avgStay / 12;
    cleaningAnnual = clean * turnoversMonth * 12;
    const maint = gross * maintPct;
    const opexOther =
      condo * 12 +
      imi +
      utils * 12 +
      insurance * 12 +
      maint +
      gross * managementPct;
    const noi = gross - platform - cleaningAnnual - opexOther;
    const mortMo = amortMonthly(loan, rate, term);
    const mortYr = mortMo * 12;
    const cashFlow = noi - mortYr;
    const cashFlowAfterIrs = cashFlow - Math.max(noi, 0) * irsPct;
    const down = Math.max(price - loan, 0);
    const cashIn = down + closing + fitout;
    const coc = cashIn > 0 ? (cashFlow / cashIn) * 100 : null;
    const cocAfterIrs =
      cashIn > 0 ? (cashFlowAfterIrs / cashIn) * 100 : null;
    const cap = price > 0 ? (noi / price) * 100 : null;

    const fixed =
      condo * 12 + imi + utils * 12 + insurance * 12 + mortYr;
    const varPerOcc =
      adr * 365 * (1 - feePct - maintPct - managementPct) -
      clean * (365 / avgStay);
    if (varPerOcc > 0) {
      be = (fixed / varPerOcc) * 100;
      if (be < 0) be = 0;
      if (be > 100) be = 100;
    }

    return {
      gross_annual_revenue: gross,
      platform_fees_annual: platform,
      cleaning_annual: cleaningAnnual,
      opex_annual: opexOther,
      noi,
      mortgage_monthly: mortMo,
      mortgage_annual: mortYr,
      cash_flow: cashFlow,
      cash_flow_after_irs: cashFlowAfterIrs,
      cash_on_cash_pct: coc,
      cash_on_cash_after_irs_pct: cocAfterIrs,
      imt_eur: imtEur,
      cap_rate_pct: cap,
      break_even_occupancy_pct: be,
      total_cash_in: cashIn,
      turnovers_per_month: turnoversMonth,
    };
  }

  function suggestedLoan(v) {
    const price = Number(v.purchase_price) || 0;
    const ltv = Number(v.ltv_pct) || 0;
    const cap = Number(v.loan_cap_eur) || 170000;
    return Math.min(price * (ltv / 100), cap);
  }

  function defaultValues() {
    const v = {};
    (model.assumptions || []).forEach((a) => {
      if (a.value != null) v[a.id] = a.value;
    });
    v.income_mode = (model.income_modes && model.income_modes.default) || 'str';
    v.loan_amount = suggestedLoan(v);
    return v;
  }

  function applyModeDefaults(mode, { preserveShared = true } = {}) {
    const md = (model.mode_defaults && model.mode_defaults[mode]) || {};
    Object.keys(md).forEach((k) => {
      if (
        preserveShared &&
        ['purchase_price', 'loan_amount', 'ltv_pct', 'furniture_fitout'].includes(k)
      ) {
        return;
      }
      values[k] = md[k];
    });
    values.income_mode = mode;
  }

  function saveLS() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(values));
    } catch (_) {}
  }

  function loadLS() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }

  function syncModeButtons() {
    const mode = currentMode();
    document.querySelectorAll('.mode-btn').forEach((btn) => {
      const on = btn.dataset.mode === mode;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    if (modeHint) {
      modeHint.textContent =
        mode === 'ltr'
          ? 'LTR: monthly rent, vacancy months. Utils default tenant-paid (€0). Condo/IMI/insurance still apply. Maint ~7% of annual rent.'
          : 'STR: nightly ADR, occupancy, platform fees, cleaning. Assumes licensed AL in RMAL zones.';
    }
    if (footnoteEl) {
      footnoteEl.textContent =
        mode === 'ltr'
          ? 'CoC equity = down payment + closing costs + fit-out. LTR gross = rent×12×(1−vacancy/12). Platform/cleaning not applied. Cash flow / CoC: pre-tax · excludes IRS.'
          : 'CoC equity = down payment + closing costs + fit-out. Cleaning is charged to the owner in this conservative STR model. Cash flow / CoC: pre-tax · excludes IRS / AL tax.';
    }
  }

  function setIncomeMode(mode, { applyDefaults = true, rerender = true } = {}) {
    const next = mode === 'ltr' ? 'ltr' : 'str';
    const prev = currentMode();
    values.income_mode = next;
    if (applyDefaults && next !== prev) {
      applyModeDefaults(next, { preserveShared: true });
    }
    syncModeButtons();
    if (rerender) {
      renderInputs();
      saveLS();
      renderOutputs();
      renderAssumptionsTable();
    }
  }

  function renderInputs() {
    const mode = currentMode();
    inputsEl.innerHTML = (model.assumptions || [])
      .filter((a) => a.input !== false && a.id !== 'income_mode')
      .filter((a) => assumptionVisible(a, mode))
      .map((a) => {
        const min = a.min != null ? `min="${a.min}"` : '';
        const max = a.max != null ? `max="${a.max}"` : '';
        const step = a.step != null ? `step="${a.step}"` : 'step="any"';
        let unit = a.unit || '';
        let label = a.label;
        if (a.id === 'maintenance_pct_gross') {
          unit = mode === 'ltr' ? '% of annual rent' : '% of gross';
          label =
            mode === 'ltr'
              ? 'Maintenance / reserves (LTR)'
              : 'Maintenance / reserves (STR)';
        }
        if (a.id === 'management_fee_pct') {
          unit = mode === 'ltr' ? '% of rent' : '% of gross';
        }
        const val =
          values[a.id] != null && values[a.id] !== ''
            ? values[a.id]
            : a.value;
        return `<label class="roi-field" data-id="${a.id}" data-modes="${(a.modes || []).join(',')}">
          <span class="roi-field-label">${escapeHtml(label)}
            <code class="assump-id">${escapeHtml(a.id)}</code>
          </span>
          <span class="roi-field-input">
            <input type="number" id="in-${a.id}" ${min} ${max} ${step}
              value="${val ?? ''}" />
            <span class="unit">${escapeHtml(unit)}</span>
          </span>
          <span class="roi-field-note">${escapeHtml(a.note || a.source || '')}</span>
        </label>`;
      })
      .join('');

    inputsEl.querySelectorAll('input').forEach((inp) => {
      inp.addEventListener('input', () => {
        const id = inp.id.replace(/^in-/, '');
        values[id] = inp.value === '' ? 0 : Number(inp.value);
        if (id === 'purchase_price' || id === 'ltv_pct') {
          const sug = suggestedLoan(values);
          const loanInp = document.getElementById('in-loan_amount');
          if (loanInp && values._loanAuto !== false) {
            values.loan_amount = sug;
            loanInp.value = sug;
          }
        }
        if (id === 'loan_amount') values._loanAuto = false;
        saveLS();
        renderOutputs();
        renderAssumptionsTable();
      });
    });
  }

  function renderOutputs() {
    const out = compute(values);
    const mode = currentMode();
    const meta = {};
    (model.outputs || []).forEach((o) => {
      meta[o.id] = o;
    });
    const order = (model.outputs || [])
      .map((o) => o.id)
      .filter((id) => outputVisible(meta[id] || {}, mode))
      .filter(
        (id) =>
          !['cash_flow_after_irs', 'cash_on_cash_after_irs_pct'].includes(id) ||
          (Number(values.irs_rental_pct) || 0) > 0
      );
    outputsEl.innerHTML = order
      .map((id) => {
        const m = meta[id] || { label: id, unit: '' };
        let display;
        if (out[id] == null) display = '—';
        else if (m.unit === '%' || id.endsWith('_pct')) display = fmtPct(out[id]);
        else if (m.unit === 'EUR/mo') display = fmtEUR(out[id]) + '/mo';
        else if (m.unit === 'count') display = fmtNum(out[id], 1);
        else display = fmtEUR(out[id]);
        const neg = typeof out[id] === 'number' && out[id] < 0 ? ' neg' : '';
        const hi = [
          'noi',
          'cash_flow',
          'cash_on_cash_pct',
          'cap_rate_pct',
          'break_even_occupancy_pct',
        ].includes(id)
          ? ' hi'
          : '';
        return `<div class="out-card${hi}${neg}">
          <div class="out-label">${escapeHtml(m.label)}
            <code class="assump-id">${escapeHtml(id)}</code>
          </div>
          <div class="out-value">${display}</div>
          <div class="out-unit">${escapeHtml(m.unit || '')}</div>
        </div>`;
      })
      .join('');
  }

  function renderAssumptionsTable() {
    const mode = currentMode();
    tableBody.innerHTML = (model.assumptions || [])
      .filter((a) => a.include !== false)
      .filter((a) => a.id === 'income_mode' || assumptionVisible(a, mode) || !a.modes)
      .map((a) => {
        const live =
          a.id === 'income_mode'
            ? values.income_mode
            : values[a.id] != null
              ? values[a.id]
              : a.value;
        return `<tr>
          <td><code>${escapeHtml(a.id)}</code></td>
          <td>${escapeHtml(a.label)}</td>
          <td>${escapeHtml(String(live ?? ''))}</td>
          <td>${escapeHtml(a.unit || '')}</td>
          <td>${escapeHtml([a.source, a.note].filter(Boolean).join(' — '))}</td>
        </tr>`;
      })
      .join('');
  }

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    );
  }

  function applyDraft(key) {
    if (!key || !drafts || !drafts.drafts[key]) return;
    const d = drafts.drafts[key];
    const mode =
      d.income_mode ||
      (d.assumptions && d.assumptions.income_mode) ||
      (d.assumptions && d.assumptions.monthly_rent != null && d.assumptions.nightly_rate == null
        ? 'ltr'
        : 'str');
    values.income_mode = mode === 'ltr' ? 'ltr' : 'str';
    // Apply mode defaults first so LTR utils/maint land correctly, then overlay draft
    applyModeDefaults(values.income_mode, { preserveShared: false });
    Object.assign(values, d.assumptions || {});
    values.income_mode = mode === 'ltr' ? 'ltr' : 'str';
    values._loanAuto = false;
    syncModeButtons();
    renderInputs();
    Object.keys(values).forEach((id) => {
      const inp = document.getElementById('in-' + id);
      if (inp) inp.value = values[id];
    });
    saveLS();
    renderOutputs();
    renderAssumptionsTable();
  }

  document.querySelectorAll('.mode-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      setIncomeMode(btn.dataset.mode, { applyDefaults: true, rerender: true });
    });
  });

  document.getElementById('btn-reset').addEventListener('click', () => {
    const mode = currentMode();
    values = defaultValues();
    values.income_mode = mode;
    applyModeDefaults(mode, { preserveShared: false });
    values.loan_amount = suggestedLoan(values);
    values._loanAuto = true;
    syncModeButtons();
    renderInputs();
    saveLS();
    renderOutputs();
    renderAssumptionsTable();
  });

  document.getElementById('btn-clear-ls').addEventListener('click', () => {
    try {
      localStorage.removeItem(LS_KEY);
    } catch (_) {}
    values = defaultValues();
    values._loanAuto = true;
    syncModeButtons();
    renderInputs();
    renderOutputs();
    renderAssumptionsTable();
  });

  draftSelect.addEventListener('change', () => applyDraft(draftSelect.value));

  Promise.all([
    fetch(`data/roi-model.json?v=${CACHE_BUST}`).then((r) => r.json()),
    fetch(`data/roi-drafts.json?v=${CACHE_BUST}`)
      .then((r) => r.json())
      .catch(() => null),
  ])
    .then(([m, d]) => {
      model = m;
      drafts = d;
      stampEl.textContent = `model_version ${m.model_version}`;
      const ab = m.audited_by || [];
      const auditors = ab.length
        ? ab
            .map((a) =>
              typeof a === 'string' ? a : `${a.agent} (${a.verdict})`
            )
            .join(', ')
        : '—';
      auditEl.textContent = `audit_status: ${m.audit_status} · audited_by: ${auditors} · updated ${m.updated || ''}`;

      const saved = loadLS();
      values = defaultValues();
      values._loanAuto = true;
      if (saved) {
        Object.keys(saved).forEach((k) => {
          if (k in values || k === '_loanAuto' || k === 'income_mode')
            values[k] = saved[k];
        });
        if (saved._loanAuto !== false) {
          values._loanAuto = true;
          values.loan_amount = suggestedLoan(values);
        }
      }
      if (values.income_mode !== 'ltr') values.income_mode = 'str';

      if (drafts && drafts.drafts) {
        draftSelect.innerHTML =
          '<option value="">— none —</option>' +
          Object.keys(drafts.drafts)
            .map((k) => {
              const dr = drafts.drafts[k];
              const tag =
                (dr.income_mode ||
                  (dr.assumptions && dr.assumptions.income_mode) ||
                  'str') === 'ltr'
                  ? 'LTR'
                  : 'STR';
              return `<option value="${escapeHtml(k)}">[${tag}] ${escapeHtml(k)} · ${escapeHtml(dr.note || dr.status || '')}</option>`;
            })
            .join('');
      }

      const q = new URLSearchParams(location.search).get('draft');
      syncModeButtons();
      renderInputs();
      if (q) {
        draftSelect.value = q;
        applyDraft(q);
      } else {
        renderOutputs();
        renderAssumptionsTable();
      }
    })
    .catch((err) => {
      inputsEl.innerHTML = `<div class="empty">Failed to load roi-model.json: ${escapeHtml(err.message)}</div>`;
    });
})();
