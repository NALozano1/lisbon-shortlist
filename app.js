(() => {
  const cardsEl = document.getElementById('cards');
  const sortEl = document.getElementById('sort');
  let listings = [];
  let filter = 'all';
  let sortKey = 'rank';
  let map, markersLayer, markerByRank = {};

  const fmtPrice = (n) => n == null ? '—' : '€' + Number(n).toLocaleString('pt-PT');
  const fmtM2 = (n) => n == null ? '—' : (Number.isInteger(n) ? n : n) + ' m²';

  function waLink(phone, title, url) {
    if (!phone) return null;
    const digits = phone.replace(/[^\d]/g, '');
    let num = digits;
    if (num.startsWith('351')) { /* ok */ }
    else if (num.length === 9) num = '351' + num;
    const text = encodeURIComponent(`Olá, ainda está disponível? — Alex Lozano\n${title}\n${url}`);
    return `https://wa.me/${num}?text=${text}`;
  }

  function portalClass(name) {
    const n = name.toLowerCase();
    if (n.includes('imovirtual')) return 'imovirtual';
    if (n.includes('re/max') || n.includes('remax')) return 'remax';
    if (n.includes('idealista')) return 'idealista';
    return '';
  }

  function matchesFilter(d) {
    if (filter === 'all') return true;
    if (filter === 'al') return !!d.al;
    if (filter === 'price-cut') return (d.status_chips || []).includes('price-cut') || /price-cut/i.test(d.status || '');
    if (filter === 'NEW') return (d.status_chips || []).includes('NEW') || /\bNEW\b/i.test(d.status || '');
    return d.parish_filter === filter || (d.area_parish || '').includes(filter);
  }

  function sorted() {
    const arr = listings.filter(matchesFilter);
    arr.sort((a, b) => {
      if (sortKey === 'price') return (a.price_eur || 0) - (b.price_eur || 0);
      if (sortKey === 'm2') return (b.area_m2 || 0) - (a.area_m2 || 0);
      return a.rank - b.rank;
    });
    return arr;
  }

  function renderCards() {
    const arr = sorted();
    if (!arr.length) {
      cardsEl.innerHTML = '<div class="empty">No listings match this filter.</div>';
      return;
    }
    cardsEl.innerHTML = arr.map(d => {
      const badges = [];
      (d.status_chips || []).forEach(c => {
        if (c === 'still-live' && (d.status_chips || []).length > 1) return;
        badges.push(`<span class="badge ${c}">${c === 'price-cut' ? 'Price cut' : c}</span>`);
      });
      if (d.al) badges.push('<span class="badge AL">AL</span>');
      if (d.parish_filter) badges.push(`<span class="badge parish">${d.parish_filter}</span>`);
      const portals = (d.portals || [{ name: 'Open listing', url: d.url }]).map(p =>
        `<a class="portal-btn ${portalClass(p.name)}" href="${p.url}" target="_blank" rel="noopener" onclick="event.stopPropagation()">${p.name} ↗</a>`
      ).join('');
      const wa = waLink(d.phone, d.title, d.url);
      const waBtn = wa ? `<a class="portal-btn wa-btn" href="${wa}" target="_blank" rel="noopener" onclick="event.stopPropagation()">WhatsApp</a>` : '';
      const thumb = (d.photos && d.photos[0])
        ? `<img class="thumb" src="${d.photos[0]}" alt="" loading="lazy" onerror="this.style.display='none'" />`
        : '';
      return `<article class="card" id="card-${d.rank}" data-rank="${d.rank}">
        <div class="card-top">
          <div class="rank">${d.rank}</div>
          <div class="card-body">
            <h2>${escapeHtml(d.title)}</h2>
            <div class="meta">
              <span class="price">${fmtPrice(d.price_eur)}</span>
              <span>${fmtM2(d.area_m2)}</span>
              <span>${escapeHtml(d.typology || '')}</span>
              <span>${escapeHtml(d.area_parish || '')}</span>
            </div>
            <div class="badges">${badges.join('')}</div>
            ${d.notes ? `<div class="notes">${escapeHtml(d.notes)}</div>` : ''}
            <div class="portal-links">${portals}${waBtn}</div>
            ${d.agency ? `<div class="notes" style="margin-top:.45rem">${escapeHtml(d.agency)}${d.phone ? ' · ' + escapeHtml(d.phone) : ''}</div>` : ''}
          </div>
          ${thumb}
        </div>
      </article>`;
    }).join('');

    cardsEl.querySelectorAll('.card').forEach(el => {
      el.addEventListener('click', () => {
        const rank = Number(el.dataset.rank);
        highlight(rank, true);
      });
    });
  }

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function highlight(rank, pan) {
    document.querySelectorAll('.card').forEach(c => c.classList.toggle('highlight', Number(c.dataset.rank) === rank));
    const card = document.getElementById('card-' + rank);
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    const m = markerByRank[rank];
    if (m && pan) {
      map.setView(m.getLatLng(), Math.max(map.getZoom(), 16), { animate: true });
      m.openPopup();
    }
  }

  function renderMap(arr) {
    if (!map) {
      map = L.map('map', { scrollWheelZoom: true });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 19
      }).addTo(map);
      markersLayer = L.layerGroup().addTo(map);
    }
    markersLayer.clearLayers();
    markerByRank = {};
    const bounds = [];
    arr.forEach(d => {
      if (d.lat == null || d.lng == null) return;
      const icon = L.divIcon({
        className: '',
        html: `<div class="marker-label">${d.rank}</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });
      const m = L.marker([d.lat, d.lng], { icon }).addTo(markersLayer);
      const links = (d.portals || []).map(p => `<a href="${p.url}" target="_blank" rel="noopener">${p.name}</a>`).join(' · ');
      m.bindPopup(`<strong>#${d.rank}</strong> ${escapeHtml(d.title)}<br>${fmtPrice(d.price_eur)} · ${fmtM2(d.area_m2)}<br>${links}`);
      m.on('click', () => highlight(d.rank, false));
      markerByRank[d.rank] = m;
      bounds.push([d.lat, d.lng]);
    });
    if (bounds.length) map.fitBounds(bounds, { padding: [30, 30] });
  }

  function refresh() {
    const arr = sorted();
    renderCards();
    renderMap(arr);
  }

  document.getElementById('filters').addEventListener('click', (e) => {
    const btn = e.target.closest('.chip');
    if (!btn) return;
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    filter = btn.dataset.filter;
    refresh();
  });
  sortEl.addEventListener('change', () => { sortKey = sortEl.value; refresh(); });
  document.getElementById('mapToggle').addEventListener('click', () => {
    document.getElementById('mapPane').classList.toggle('collapsed');
    setTimeout(() => map && map.invalidateSize(), 200);
  });

  fetch('data/listings.json')
    .then(r => r.json())
    .then(data => {
      listings = data;
      refresh();
    })
    .catch(err => {
      cardsEl.innerHTML = `<div class="empty">Failed to load listings.json: ${escapeHtml(err.message)}</div>`;
    });
})();
