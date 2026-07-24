# Skill: Offline-Friendly Field Mapping (source: `moniruzjaman/nursery-mapping`)

Reusable pattern for a Leaflet map that a DAE field officer can use to *see, add,
and edit* geo-tagged records on a phone, with each record color-coded and
directly editable from the map — not just a read-only marker layer.

## Core ingredients

1. **Color-coded categorical markers** — one color per administrative unit
   (upazila), driven by a single lookup map:
   ```ts
   const UPAZILA_COLORS: Record<string, string> = {
     'উলিপুর': '#2d6a4f', 'রাজারহাট': '#1d6fa4', /* ... */
   };
   ```
   A custom `L.divIcon` (SVG pin) is generated per color rather than using
   Leaflet's default marker — gives a legend-able, at-a-glance category view.

2. **Click marker → popup (summary) → "সম্পাদনা" button → edit modal.**
   The popup is *not* the end state; it's a doorway into a full edit form
   (`EditModal`) that lets the officer correct data on the spot.

3. **In-modal GPS capture button**, independent of the map's own view:
   ```ts
   navigator.geolocation.getCurrentPosition((pos) => {
     set('lat', +pos.coords.latitude.toFixed(6));
     set('lon', +pos.coords.longitude.toFixed(6));
   }, onError, { enableHighAccuracy: true, timeout: 10000 });
   ```
   This lets an officer standing at the actual nursery/plantation site
   overwrite a stale or estimated coordinate with their live position —
   distinct from "recenter map to my location."

4. **Search + upazila filter bar + pill row**, all client-side over the same
   in-memory array that feeds the map — so map markers, list view, and
   filter pills always stay in sync (single source of truth, no separate
   fetch per view).

5. **Persistence is local-first**: every edit writes straight to
   `localStorage` (via a `useNurseryDB`-style hook) with no network
   round-trip required. Good for true single-device offline use; the
   equivalent in an app that already has a sync queue (like
   `plantation-tracker-app`) is to write into the *same* offline queue/IndexedDB
   used elsewhere, so map edits and other data-entry paths share one sync
   pipeline instead of two.

6. **CSV/JSON export** from the same in-memory dataset, UTF-8 BOM-encoded so
   Bengali text opens correctly in Excel.

## What this pattern does *not* cover
- No offline basemap tile caching — it still requires network for OSM tiles.
  If true no-signal map viewing is needed, that's a separate concern
  (e.g. a tile cache via service worker / vector tiles), not something this
  source repo solved.
- No satellite/NDVI/EVI layers — `plantation-tracker-app`'s own `MapTab.tsx`
  is already more advanced here and should stay the base to build on.

## Where the gap is in `plantation-tracker-app`
`src/components/plantation/MapTab.tsx` currently renders all points as a
single emerald `CircleMarker` with a **read-only** tooltip/popup — no
category color coding, no click-to-edit, no in-map GPS capture, no
search/filter bar over the map layer. That's the concrete piece to port in,
adapted to write into the existing `useOfflineQueue` / IndexedDB path instead
of a new localStorage store.
