# Branch Analysis & Smart Merge Plan

## Repository: plantation-tracker-app

---

## 1. Branch Audit Summary

### Already Merged / Redundant (no action needed)
| Branch | Reason |
|--------|--------|
| `260810-feat-validation-workflow` | HEAD is same as `main` (aab0b6a) |
| `fix-dashboard-empty-state-gate` | Core fix (c1b9ea0) already in `main` |
| `pr-22` | CI/test fixes already in `main` |
| `rebuild/react-vite-merge` | No unique commits vs `main` |
| `report` | No unique commits |
| `master` | Single sync commit |
| `production` | Older than `main` |
| `neon-reconnect` | API infra already in `main` |
| `feat/indexeddb-postgres-sync` | Sync endpoint already in `main` |
| `feat/brand-og-share-v3-icons-prod` | Production branding already in `main` |
| `feature/header-dae-logo-status-hub` | No unique commits vs `main` |

---

## 2. Valuable Unmerged Feature Branches

### Priority 1: Core UX Enhancements (High Impact, Moderate Conflicts)

#### A. `feature/form-geofence-collapsible-plant-save`
**Unique commits:** 4
**Feature:** Form page overhaul with collapsible sections, GPS paste support, plant-type save buttons, duplicate submission detection, revisit reminders, NDVI/growth trend tracking, 7-digit GPS precision.
**Files changed:**
- `src/modules/plantationSubmission/` (PlantationSubmission.tsx, CollapsibleSection.tsx, DuplicateWarningBanner.tsx, GPSCapture.tsx, MapPicker.tsx, PlantCard.tsx, PlantTypeSaveBar.tsx, useGeofenceMode.ts, steps/*, types/*, utils/*)
- `src/components/OfflinePlantationDashboard.tsx`
- `src/components/plantation/MonitoringRevisit.tsx`
- `src/components/plantation/RevisitDueList.tsx` (new)
- `src/lib/db.ts`
- `src/services/revisitSchedule.ts` (new)
**Conflicts:** MapTab.tsx, PlantStep.tsx, SiteStep.tsx

#### B. `feature/new-submission-wizard-phase1`
**Unique commits:** 5
**Feature:** Complete multi-site submission wizard (Phases 1-4): GeoFenceStep with polygon drawing, PersonnelStep, ReviewStep, validation router, geofence validator, flatten-to-legacy submit.
**Files changed:**
- `src/modules/plantationSubmission/` (PlantationSubmission.tsx, PolygonDrawer.tsx, PhotoUploader.tsx, GPSCapture.tsx, MapPicker.tsx, PlantCard.tsx, useGeofenceMode.ts, useOfflineDraft.ts, services/*, steps/*, types/*, validation/*)
- `src/components/plantation/MapEditModal.tsx`
- `src/components/plantation/MapFilterBar.tsx`
- `src/components/plantation/MapTab.tsx`
- `src/utils/upazilaColors.ts`
**Conflicts:** App.tsx (with `offline-mapping-and-registry-dashboard`)

### Priority 2: Dashboard & Map Enhancements (High Impact, Low-Moderate Conflicts)

#### C. `feature/offline-mapping-and-registry-dashboard`
**Unique commits:** 2
**Feature:** Registry-style search/filter/drill-down dashboard tab with MapEditModal, MapFilterBar enhancements.
**Files changed:**
- `src/components/OfflinePlantationDashboard.tsx`
- `src/components/RegistryDetailModal.tsx` (new)
- `src/components/RegistryTab.tsx` (new)
- `src/components/plantation/MapEditModal.tsx`
- `src/components/plantation/MapFilterBar.tsx`
- `src/components/plantation/MapTab.tsx`
- `src/utils/upazilaColors.ts`
**Conflicts:** App.tsx (with `new-submission-wizard-phase1`)

#### D. `feat/map-category-color-gps-capture`
**Unique commits:** 1
**Feature:** Map marker color-coding by category/upazila, click-to-edit, GPS capture, unified filter bar.
**Files changed:**
- `src/components/plantation/MapTab.tsx`
- `src/components/plantation/MapFilterBar.tsx`
- `src/components/plantation/MapEditModal.tsx`
- `src/data/seedPlantations.ts`
- `src/utils/upazilaColors.ts`
**Conflicts:** MapTab.tsx (with `form-geofence-collapsible-plant-save`)

### Priority 3: Fixes & Polish (Low Impact, Low Conflicts)

#### E. `fix/nfc-bengali-color-mapping`
**Unique commits:** 1
**Feature:** NFC-normalize Bengali text so all App_Entry rows get correct upazila/species colors.
**Files changed:**
- `src/data/seedPlantations.ts`
- `src/utils/upazilaColors.ts`
- `src/components/plantation/MapFilterBar.tsx`
- `src/components/plantation/MapTab.tsx`

#### F. `feat/brand-og-share-v3-icons`
**Unique commits:** 2
**Feature:** Update OG share image and favicons with new campaign branding (v3).
**Files changed:**
- `public/og-share-v3.png`
- `public/favicon-*.png`
- `public/pwa-*.png`
- `public/manifest.webmanifest`
- `index.html`

#### G. `moniruzjaman-studious-enigma`
**Unique commits:** 3
**Feature:** GPS input fields with display and token points, improve plantation submission UX for rural users.
**Files changed:**
- `src/modules/plantationSubmission/steps/PlantSpot.tsx`
- `src/modules/plantationSubmission/steps/PlantStep.tsx`
- `src/modules/plantationSubmission/steps/SiteStep.tsx`

---

## 3. Merge Conflict Analysis

| Conflict Zone | Branches Involved | Severity | Resolution Strategy |
|---------------|-------------------|----------|---------------------|
| `src/App.tsx` tab routing | `new-submission-wizard-phase1` vs `offline-mapping-and-registry-dashboard` | Medium | Keep both: wizard replaces form tab, registry becomes new dashboard tab |
| `src/components/plantation/MapTab.tsx` | `map-category-color-gps-capture` vs `form-geofence-collapsible-plant-save` | Medium | Cherry-pick color logic from map-color, keep form-geofence GPS precision fixes |
| `src/modules/plantationSubmission/steps/*` | `form-geofence` vs `new-submission-wizard` vs `moniruzjaman-studious-enigma` | High | Wizard phases supersede form-geofence steps; keep GPS input improvements from studious-enigma |
| `src/lib/db.ts` | `form-geofence` vs `new-submission-wizard` | Low | Wizard's db.ts changes are superset; merge carefully |
| `src/utils/upazilaColors.ts` | Multiple branches | Low | Take NFC-normalized version from `fix/nfc-bengali-color-mapping`, merge color additions |

---

## 4. Required Skills & Libraries

### No new npm dependencies required
All features use existing libraries already in `package.json`:
- `react-leaflet` + `leaflet` (maps, polygon drawing, GPS)
- `lucide-react` (icons)
- `motion` (animations)
- `dexie` (IndexedDB)
- `@prisma/client` + `@neondatabase/serverless` (PostgreSQL)
- `@capacitor/geolocation` (GPS)
- `qrcode` (QR tags)
- `vite` + `vitest` (build/test)

### External Skills Needed
| Skill | Purpose | Source |
|-------|---------|--------|
| Leaflet PolygonDrawer | Custom polygon geofence drawing | GitHub: `leaflet-draw` or custom `react-leaflet-draw` |
| Turf.js | Geospatial validation (point-in-polygon, area calc) | npm: `@turf/turf` — **already installable, no extra cost** |
| Zod | Runtime schema validation for submission wizard | npm: `zod` — **already installable, no extra cost** |

### Recommended GitHub Libraries to Evaluate
| Library | Purpose | Why |
|---------|---------|-----|
| `@turf/turf` | Geofence validation, area calculation | Industry-standard geospatial analysis; validates polygon areas and point-in-polygon for GPS accuracy gating |
| `react-hook-form` + `zod-resolver` | Form state management for wizard | Reduces boilerplate in multi-step wizard; better validation UX |
| `leaflet-draw` | Polygon drawing on map | More robust than custom PolygonDrawer; actively maintained |

---

## 5. Smart Merge Plan with Task Delegations

### Phase 1: Foundation (Low-risk, high-value) — Delegate to Agent A

**Agent A: Fixes & Branding Merge**
- Task 1.1: Merge `fix/nfc-bengali-color-mapping` → `main`
  - Apply NFC normalization to `seedPlantations.ts` and `upazilaColors.ts`
  - Resolve minor MapTab.tsx/MapFilterBar.tsx conflicts by keeping NFC fix as base
- Task 1.2: Merge `feat/brand-og-share-v3-icons` → `main`
  - Update favicon, OG image, PWA icons, manifest
  - No code conflicts expected
- **Deliverable:** Clean `main` with Bengali fix + branding applied

### Phase 2: Map Enhancements — Delegate to Agent B

**Agent B: Map Feature Merge**
- Task 2.1: Cherry-pick `feat/map-category-color-gps-capture` changes
  - Merge `upazilaColors.ts` additions (keep NFC-normalized keys)
  - Merge `MapTab.tsx` color logic, click-to-edit, GPS capture
  - Merge `MapFilterBar.tsx` unified filter
  - Resolve PlantStep.tsx/SiteStep.tsx conflicts by keeping GPS precision fixes from form-geofence
- Task 2.2: Integrate map enhancements with existing `main` MapTab
  - Verify marker color fallback chain: upazila → species → default
- **Deliverable:** Enhanced MapTab with color coding, GPS capture, unified filter

### Phase 3: Form UX Improvements — Delegate to Agent C

**Agent C: Form & Geofence UX Merge**
- Task 3.1: Merge `feature/form-geofence-collapsible-plant-save` into `main`
  - Apply collapsible sections to PlantationForm
  - Integrate GPSCapture improvements (7-digit precision, paste support)
  - Add PlantTypeSaveBar
  - Add DuplicateWarningBanner
  - Merge `RevisitDueList.tsx` and `revisitSchedule.ts`
- Task 3.2: Merge `moniruzjaman-studious-enigma` GPS input fields
  - Apply PlantSpot.tsx, PlantStep.tsx, SiteStep.tsx GPS input improvements
  - Keep token points display logic
- Task 3.3: Resolve `src/modules/plantationSubmission/steps/*` conflicts
  - Wizard phases will supersede these; keep reusable GPS/validation utilities
- **Deliverable:** Improved form UX with collapsible sections, GPS enhancements, duplicate detection

### Phase 4: New Submission Wizard — Delegate to Agent D

**Agent D: Wizard Architecture Merge**
- Task 4.1: Merge `feature/new-submission-wizard-phase1` into `main`
  - This is the largest branch; integrate as the new primary submission flow
  - Add GeoFenceStep with PolygonDrawer
  - Add PersonnelStep, ReviewStep
  - Integrate validationRouter and geofenceValidator
  - Add `flattenToLegacySubmission.ts` for backward compatibility
- Task 4.2: Resolve App.tsx conflict with `offline-mapping-and-registry-dashboard`
  - Keep wizard as Form tab (`ফর্ম`)
  - Keep Registry as Dashboard tab (new tab)
  - Ensure tab navigation renders both correctly
- Task 4.3: Add `@turf/turf` for polygon validation
  - Install: `npm install @turf/turf`
  - Use in `geofenceValidator.ts` for point-in-polygon + area calculation
- **Deliverable:** Complete multi-site wizard with geofence drawing, validation, backward-compatible legacy submit

### Phase 5: Registry Dashboard — Delegate to Agent E

**Agent E: Dashboard & Registry Merge**
- Task 5.1: Merge `feature/offline-mapping-and-registry-dashboard` into `main`
  - Add RegistryTab component
  - Add RegistryDetailModal
  - Enhance MapEditModal and MapFilterBar
  - Update App.tsx to include Registry tab in navigation
- Task 5.2: Resolve App.tsx conflict with wizard branch
  - Finalize tab structure: Form | Map | Profile | Dashboard (Registry)
- **Deliverable:** Registry dashboard with search, filter, drill-down

### Phase 6: Integration Testing & CI — Delegate to Agent F

**Agent F: Validation & CI**
- Task 6.1: Run `npm run lint` and `npm run test`
- Task 6.2: Fix any TypeScript errors from merged branches
- Task 6.3: Update `.github/workflows/check.yml` if needed
- Task 6.4: Verify `vite.config.ts` and `vitest.config.ts` are consistent
- **Deliverable:** Green CI, passing tests, clean build

---

## 6. Execution Order & Dependencies

```
Phase 1 (A) → Phase 2 (B) → Phase 3 (C) → Phase 4 (D) → Phase 5 (E) → Phase 6 (F)
     ↓               ↓               ↓               ↓               ↓
   Branding       Map UX         Form UX        Wizard         Registry       CI
   Bengali fix    Colors         Geofence       Phases 1-4     Dashboard      Tests
```

**Rationale:**
1. Phase 1 fixes foundational data issues (Bengali normalization) and branding — no conflicts
2. Phase 2 builds on map colors from Phase 1
3. Phase 3 builds on form structure, adds GPS improvements
4. Phase 4 (wizard) is the biggest change and depends on form UX being stable
5. Phase 5 (registry) depends on dashboard and map being stable
6. Phase 6 validates everything

---

## 7. Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Merge conflicts in `src/modules/plantationSubmission/` | Agent D (wizard) is the authority; other branches' utilities are cherry-picked, not fully merged |
| App.tsx tab routing conflicts | Agents D and E coordinate via shared App.tsx merge plan |
| Breaking existing form flow | Keep `PlantationForm.tsx` as fallback; wizard uses `flattenToLegacySubmission.ts` |
| Test failures from merged branches | Agent F runs full test suite after each phase |
| New library (`@turf/turf`) bundle size | Tree-shakeable; only import used functions |

---

## 8. Success Criteria

- [ ] All 7 valuable branches merged without conflicts
- [ ] `npm run lint` passes (web + API)
- [ ] `npm run test` passes
- [ ] `npm run build` succeeds
- [ ] No regressions in existing Form, Map, Profile, Dashboard tabs
- [ ] New wizard flow functional with polygon geofence drawing
- [ ] Registry dashboard searchable and filterable
- [ ] Bengali text displays correct colors across all markers
