# Lisbon progress portal (Alex Lozano)

Living shortlist & outreach tracker for tourist-core apartments ≤€240k.

**Live:** https://nalozano1.github.io/lisbon-shortlist/

## Pages
- `index.html` — shortlist + map (reads `data/listings.json`)
- `pipeline.html` — compact agency threads (reads `data/pipeline.json` + `data/updates.json`)

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
| `status_chips` | e.g. `["NEW"]`, `["price-cut"]`, `["still-live"]` |
| `al` | `true` if AL licence |
| `lat`, `lng` | Map pin |
| `portals` | `[{ "name": "Imovirtual", "url": "..." }]` |
| `photos` | Optional CDN URLs |

### Update outreach pipeline
Edit `data/pipeline.json` — append a thread object:

```json
{
  "id": "unique-slug",
  "agency": "Agency — Contact",
  "contact": { "email": "…", "phone": "…" },
  "related": "What it's about",
  "stage": "waiting|chased|reserved|notcontacted|dead|replied",
  "stage_label": "Short badge text",
  "last_action": "YYYY-MM-DD",
  "last_action_note": "One-line status",
  "bullets": ["Optional detail", "Max 2–3"],
  "listing_ranks": [1]
}
```

### Log a progress update
Prepend to `data/updates.json` (newest first):

```json
{ "date": "YYYY-MM-DD", "title": "Short title", "body": "One or two sentences." }
```

Shown as the “Latest” strip on the shortlist and a short section on Pipeline.

Then commit + push to `main` — GitHub Pages will refresh.
