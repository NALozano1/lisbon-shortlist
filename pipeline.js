(() => {
  const listEl = document.getElementById('pipeline-list');
  const updatesEl = document.getElementById('updates-list');
  const noteMeta = document.getElementById('pipeline-meta');

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    );
  }

  function fmtDate(iso) {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-');
    if (!y || !m || !d) return iso;
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${Number(d)} ${months[Number(m) - 1]}`;
  }

  function contactHtml(c) {
    if (!c) return '';
    const parts = [];
    if (c.email) parts.push(`<a href="mailto:${escapeHtml(c.email)}">${escapeHtml(c.email)}</a>`);
    if (c.phone) {
      const digits = String(c.phone).replace(/[^\d]/g, '');
      parts.push(`<a href="https://wa.me/${digits}">${escapeHtml(c.phone)}</a>`);
    }
    return parts.length ? `<span class="p-contact">${parts.join(' · ')}</span>` : '';
  }

  function ranksHtml(ranks) {
    if (!ranks || !ranks.length) return '';
    const links = ranks.map(r =>
      `<a class="rank-chip" href="index.html#card-${r}">#${r}</a>`
    ).join('');
    return `<span class="p-ranks">${links}</span>`;
  }

  function renderThread(t) {
    const bullets = (t.bullets || []).slice(0, 3);
    const hasExpand = bullets.length > 0;
    const dateStr = fmtDate(t.last_action);
    return `<article class="p-row${hasExpand ? ' expandable' : ''}" data-id="${escapeHtml(t.id)}">
      <button type="button" class="p-row-main" ${hasExpand ? '' : 'disabled'} aria-expanded="false">
        <span class="p-title-line">
          <span class="p-agency">${escapeHtml(t.agency)}</span>
          <span class="stage ${escapeHtml(t.stage)}">${escapeHtml(t.stage_label || t.stage)}</span>
        </span>
        <span class="p-sub">
          <span class="p-date">${dateStr}</span>
          <span class="p-note">${escapeHtml(t.last_action_note || '')}</span>
        </span>
      </button>
      ${hasExpand ? `<div class="p-detail" hidden>
        ${t.related ? `<div class="p-related">${escapeHtml(t.related)}</div>` : ''}
        ${contactHtml(t.contact)}
        ${ranksHtml(t.listing_ranks)}
        <ul class="p-bullets">${bullets.map(b => `<li>${escapeHtml(b)}</li>`).join('')}</ul>
      </div>` : ''}
    </article>`;
  }

  function renderUpdates(updates) {
    if (!updatesEl) return;
    if (!updates || !updates.length) {
      updatesEl.innerHTML = '';
      return;
    }
    const show = updates.slice(0, 4);
    updatesEl.innerHTML = show.map(u =>
      `<div class="update-item">
        <span class="update-date">${escapeHtml(fmtDate(u.date))}</span>
        <strong>${escapeHtml(u.title)}</strong>
        <span class="update-body">${escapeHtml(u.body)}</span>
      </div>`
    ).join('');
    if (noteMeta && updates[0]) {
      noteMeta.textContent = `Latest: ${fmtDate(updates[0].date)}`;
    }
  }

  listEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.p-row-main');
    if (!btn || btn.disabled) return;
    const row = btn.closest('.p-row');
    const detail = row.querySelector('.p-detail');
    if (!detail) return;
    const open = detail.hasAttribute('hidden');
    detail.toggleAttribute('hidden', !open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    row.classList.toggle('open', open);
  });

  Promise.all([
    fetch('data/pipeline.json').then(r => r.json()),
    fetch('data/updates.json').then(r => r.json()).catch(() => [])
  ])
    .then(([threads, updates]) => {
      listEl.innerHTML = threads.map(renderThread).join('');
      renderUpdates(updates);
    })
    .catch(err => {
      listEl.innerHTML = `<div class="empty">Failed to load pipeline: ${escapeHtml(err.message)}</div>`;
    });
})();
