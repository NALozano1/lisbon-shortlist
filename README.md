# Lisbon progress portal (Alex Lozano)

Living shortlist, outreach tracker, and **ROI calculator (draft — pending audit)** for tourist-core apartments.

**Live:** https://nalozano1.github.io/lisbon-shortlist/

## Pages
- `index.html` — shortlist + map (`data/listings.json`) — filter chips include **≤€170k** / **≤€240k**
- `pipeline.html` — outreach + **ROI status** (`data/pipeline.json`, `data/updates.json`, `data/roi-drafts.json`)
- `roi.html` — labelled STR ROI calculator (`data/roi-model.json`, `roi.js`), explicitly pre-tax and pending full audit

## How to append (no HTML rewrites)

### Add / edit a listing
Edit `data/listings.json` — append an object (or bump `rank`). Useful fields:

| Field | Notes |
|-------|--------|
| `rank` | Sort order (int) |
| `title`, `price_eur`, `area_m2`, `typology` | Display |
| `area_parish`, `parish_filter` | Filter chips |
| `agency`, `phone`, `url` | Contact |
| `notes` | One short line |
| `status_chips` | e.g. `["NEW"]`, `["price-cut"]`, `["170k"]` |
| `band` | `"170k"` or `"240k"` (filter chips) |
| `roi_status` | `roi_pending` \| `roi_draft` \| `roi_audited` |
| `al` | `true` if AL licence |
| `lat`, `lng` | Map pin |
| `portals` | `[{ "name": "Imovirtual", "url": "..." }]` |
| `photos` | Optional CDN URLs |

### Update outreach / ROI pipeline
Edit `data/pipeline.json` — append a thread object:

```json
{
  "id": "unique-slug",
  "agency": "Agency — Contact",
  "contact": { "email": "…", "phone": "…" },
  "related": "What it's about",
  "stage": "waiting|chased|reserved|notcontacted|dead|replied|roi_pending|roi_draft|roi_audited",
  "stage_label": "Short badge text",
  "roi_status": "roi_pending|roi_draft|roi_audited",
  "last_action": "YYYY-MM-DD",
  "last_action_note": "One-line status",
  "bullets": ["Optional detail", "Max 2–3"],
  "listing_ranks": [1]
}
```

Outreach stages and ROI stages can share the same list; use `roi_*` stages (or `roi_status`) for calculator workflow.

### Log a progress update
Prepend to `data/updates.json` (newest first):

```json
{ "date": "YYYY-MM-DD", "title": "Short title", "body": "One or two sentences." }
```

### ROI model versioning (auditable)
File: `data/roi-model.json`

| Field | Meaning |
|-------|---------|
| `model_version` | Semver string, e.g. `0.1.0-draft` — **bump when any default assumption changes** |
| `audit_status` | `pending` \| `changes_applied_awaiting_reaudit` \| `audited` \| `rejected` |
| `audited_by` | Array of final reviewer names (empty until re-audit) |
| `assumptions[]` | Every input: `id`, `label`, `value`, `unit`, `source`, `note` |
| `outputs[]` | Labelled metric ids the UI must show |
| `reviewers` | Review outcomes; changes can be applied while awaiting re-audit |

Rules:
1. Never silently change a default — bump `model_version` and note why in `data/updates.json`.
2. Record each review in `reviewers`; apply requested changes and keep `audit_status` at `changes_applied_awaiting_reaudit` until the reviewers re-audit.
3. Only after re-audit, set `audit_status: "audited"` and append to `audited_by`.
4. Draft per-listing stubs live in `data/roi-drafts.json` (keyed ids like `170k-1`). Load via `roi.html?draft=170k-1`.
5. Calculator persists last inputs in **browser localStorage only** — no personal mortgage data in the repo.

Formula sketch (see `roi.js`):
- Gross = ADR × 365 × occupancy
- NOI = Gross − platform fees − cleaning − condo − IMI − utilities − insurance − management fee − maintenance%
- Mortgage = standard amortising monthly payment
- Cash flow = NOI − mortgage annual
- Cash-on-cash = pre-tax cash flow / (down payment + itemised closing stack or explicit stress override + fit-out)
- Cap rate = NOI / purchase price
- Break-even occupancy solves cash flow = 0

**Disclaimer:** illustrative STR model — not legal, tax, or mortgage advice. Closing-cost % is illustrative; IMT depends on value/regime.

Then commit + push to `main` — GitHub Pages will refresh.
