# Skill: Registry Browsing Dashboard (source: `moniruzjaman/kurigram_nursery_registry`)

Reusable pattern for a polished, read-oriented dashboard that lets someone
browse, search, and drill into a large set of geo-tagged records with rich
per-item breakdowns — distinct from a data-entry tool. This is the
"reporting/oversight" half of a field-data system, usually consumed by a
supervisor or the ministry side rather than the field officer doing entry.

## Core ingredients

1. **shadcn/ui Tabs as the primary navigation**, not a router — Overview /
   List / Map-link / Details all live as tab panels over one dataset already
   in memory. Keeps everything client-side and instant, no page reloads.

2. **Per-species / per-category pivoted inventory**, not just aggregate
   counts:
   ```ts
   pivot_inventory: {
     category: 'ফলদ' | 'বনজ' | 'ঔষধি';
     plant_name: string;
     age_group: '1-6 মাস' | '6-12 মাস' | ...;
     seedlings: number;
     grafts: number;
   }[]
   ```
   This is the single biggest structural upgrade over a flat
   "fruit_total / forest_total / medicinal_total" shape — it's what lets a
   dashboard answer "how many mango seedlings under 6 months across all of
   Kurigram Sadar" instead of only "how many fruit trees total."

3. **Global search bar** filtering across nursery name, owner, upazila, and
   species in one input — implemented as a single `.filter()` over the
   in-memory array on every keystroke (no debounce needed at this data
   size).

4. **Facet filters as pill/select rows** — GPS-present / no-GPS, mobile
   number present/absent, upazila — each just another `.filter()` predicate
   composed with the search filter.

5. **Dialog-based detail drill-down**: clicking a row/card opens a
   shadcn `Dialog` with the full record, including the pivoted inventory
   rendered as a small breakdown table — keeps the list view dense while
   still giving full detail on demand.

6. **Progress/stat cards at the top** (e.g. total nurseries, % with GPS,
   % with mobile number) — cheap derived aggregates computed once from the
   same array, rendered with shadcn `Progress`/`Card`.

## What this pattern does *not* cover
- No write path — the source repo is GET-only; there's no edit/save flow to
  copy. Any editing capability needs to come from the field-mapping pattern
  above (or a new API route) instead.
- Its map is a non-interactive embedded OSM iframe — not a real Leaflet
  layer. Don't port the map from this repo; use the field-mapping skill's
  Leaflet approach if a map tab is wanted inside the dashboard too.

## Where the gap is in `plantation-tracker-app`
`OfflinePlantationDashboard.tsx` already has CSV export and a species/
submission selector, but it's built around picking *one* submission/species
at a time rather than a searchable, filterable, drill-into-any-record browse
view. The concrete pieces to port in: a global search bar across all
submissions, upazila/GPS/mobile facet filters, a Dialog-based per-submission
detail view showing the full pivoted species breakdown, and top-line stat
cards — all layered on top of the data already in `useOfflineQueue` /
IndexedDB rather than a new data source.
