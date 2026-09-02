# Populating the SAAO / Union / Block / Monitoring Officer directory

Four CSVs, one script. Fill in real data, run the script, commit the
result — no hand-written TypeScript needed.

## Order matters

Fill these in **top to bottom** — each file references the one above it
by name, not by ID (you never invent an ID yourself; the script
generates stable ones from the names):

1. **unions.csv** — every Union + Municipality, per upazila
2. **blocks.csv** — every Block (3 per Union, 1 per Municipality),
   referencing its Union/Municipality by exact name
3. **saao.csv** — one SAAO per Block, referencing Upazila+Union+Block by
   exact name
4. **monitoring_officers.csv** — up to 4 per upazila (1 UAO, 2 AEO, 1 AAO)

Delete the `[উদাহরণ]` example rows as you replace them — a leftover
example row is auto-skipped with a warning, but don't rely on that,
double check.

**Names must match exactly** between files (e.g. `blocks.csv`'s
`union_name` has to be spelled identically to that union's `name` in
`unions.csv`) — the script errors out immediately with the exact row
and reason if something doesn't line up, rather than silently dropping
a record.

## Running it

```bash
# Validate only, don't write anything yet:
node scripts/directory-import/generate.mjs --check

# Once --check passes clean, actually write the file:
node scripts/directory-import/generate.mjs

# Then confirm nothing broke:
npx tsc --noEmit
```

This only ever rewrites the 4 arrays (`PARENT_UNITS`, `BLOCKS`,
`SAAO_DIRECTORY`, `MONITORING_OFFICER_DIRECTORY`) inside
`src/data/administrativeDirectory.ts` — every lookup helper function
below them, and everything else in the app, is untouched. Re-run it any
time the underlying CSVs change (a new SAAO posting, a reassignment,
etc.) — it's fully regenerated from the CSVs each time, not
incrementally patched, so the CSVs are the actual source of truth going
forward, not the generated file.

## Why CSVs instead of a spreadsheet link

Keeping this offline (plain CSV files in the repo, edited locally or
via GitHub's editor) means no live Google Sheet dependency for
something that changes rarely — an officer transfer or a new posting is
a deliberate, occasional edit + a commit, not something that needs to
sync in real time.
