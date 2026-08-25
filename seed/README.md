# Seed Data Folder

This folder contains the **authoritative seed data source** for the NDVI
simulator and canopy growth tracker on the Map page.

## Live sheet sync (recommended)

`AppsScript.gs` is the backend bound to the Tree Plantation Reporting
Workbook's App_Entry sheet. Deployed as a web app and pointed to via the
`GAS_WEBHOOK_URL` environment variable, it powers `/api/sheet/list`
(server.ts) which `src/hooks/useSheetPlantations.ts` polls to plot every
field submission on the ম্যাপ tab — not just the 36-row snapshot below.

1. Open the workbook -> Extensions -> Apps Script, paste in `AppsScript.gs`
   (replacing the existing Code.gs), and Deploy -> Manage deployments ->
   New version (or a fresh Web app deployment: Execute as **Me**, Who has
   access **Anyone**).
2. Copy the deployment's `/exec` URL into `GAS_WEBHOOK_URL` (`.env` locally,
   or the Vercel/host's environment variables in production).
3. Reload the ম্যাপ tab. If the fetch succeeds, live sheet markers replace
   the static seed markers automatically (🔴 লাইভ শীট থেকে in the popup vs
   📦 অফলাইন সিড স্ন্যাপশট for the fallback). If `GAS_WEBHOOK_URL` is unset
   or the sheet is briefly unreachable, the map falls back to the frozen
   snapshot below so it's never empty.

The `map_view` sheet inside the same workbook was evaluated as an
alternative source but isn't used here — it mirrors App_Entry but with more
rows carrying blank/invalid coordinates (e.g. literal "Invalid Latitude
range" placeholder text) and no dedup, since `listEntries_()` in
`AppsScript.gs` already computes a cleaner, deduplicated version straight
from App_Entry (the actual source of truth).

## Files

- `Tree_Plantation_Reporting_Workbook.xlsx` — the original workbook uploaded
  by the DAE (Department of Agricultural Extension) field team. The
  **`process data`** sheet inside this workbook is the single source of truth
  for plantation entries shown on the Map page and used as the carbon-baseline
  for the NDVI simulator's year-by-year projection (2026 → 2031).

## How to update the seed data

1. Replace `Tree_Plantation_Reporting_Workbook.xlsx` with the new version
   (keep the same filename, or update the path in `scripts/build_seed_data.py`).
2. Re-run the builder:
   ```bash
   python3 ../../scripts/build_seed_data.py
   ```
   (run from the project root if your working directory differs)
3. The builder regenerates:
   - `src/data/seedPlantations.ts` — typed module consumed by the app
   - `src/data/seedPlantations.json` — JSON mirror for inspection / debugging
4. Commit all three files (the `.xlsx` and both generated `src/data/` files)
   so the app stays in sync with the workbook.

## Workbook schema (expected columns on `process data` sheet)

| Column | Bangla header | Type | Notes |
|--------|---------------|------|-------|
| A | SL | int | Serial number |
| B | জেলা | string | District name |
| C | উপজেলা | string | Upazila name |
| D | চারা/জাতের নাম | string | Species + variety (e.g. "পেয়ারা থাই-৭") |
| E | সংখ্যা (টি) | int | Seedling count (Bengali or ASCII digits accepted) |
| F | রোপণ তারিখ | date | Planting date (ISO or DD/MM/YYYY) |
| G | Latitude | float | WGS84 latitude |
| H | Longitude | float | WGS84 longitude |
| I | পরিচর্যাকারীর নাম ও ফোন | string | Caretaker name + phone |
| J | এসএএও নাম ও ফোন | string | SAAO name + phone |
| K | মনিটরিং অফিসারের নাম ও ফোন | string | Monitoring officer name + phone |

Summary / total rows (rows where both জেলা and চারা/জাতের নাম are empty)
are automatically filtered out by the builder.

## What consumes this data

- `src/utils/canopyProjection.ts` — `predictCarbon()` uses the seed entries
  as the year-0 (চারা) regional carbon baseline via `calculateCarbonV2()`.
- `src/utils/realtimeNdvi.ts` — `sampleRegionNDVI()` samples NASA GIBS MODIS
  Terra NDVI 8-day raster tiles at each plantation coordinate.
- `src/components/plantation/MapTab.tsx` — renders a `<CircleMarker>` per
  plantation on the Leaflet map, with tooltip + popup showing species, count,
  district, planting date, caretaker, and GPS coordinates.
- `src/components/plantation/NDVISimulatorPanel.tsx` — shows aggregate seed
  stats (total entries, total seedlings) and per-site realtime sample results.
