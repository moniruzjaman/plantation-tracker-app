#!/usr/bin/env node
/**
 * Reads the 4 CSVs in this folder (unions.csv, blocks.csv, saao.csv,
 * monitoring_officers.csv) and regenerates the 4 placeholder arrays in
 * src/data/administrativeDirectory.ts (PARENT_UNITS, BLOCKS,
 * SAAO_DIRECTORY, MONITORING_OFFICER_DIRECTORY) -- everything else in
 * that file is left untouched.
 *
 * Usage:  node scripts/directory-import/generate.mjs
 * Dry run (validate only, don't write): node scripts/directory-import/generate.mjs --check
 *
 * Fill the CSVs with real data first (delete the placeholder [উদাহরণ]
 * rows -- they're skipped automatically if you forget, with a warning,
 * but don't rely on that). Names are the join keys between files, so a
 * block's union_name must exactly match a name in unions.csv, etc. --
 * this script validates that and reports exactly which row is wrong
 * rather than silently dropping it.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const TARGET_FILE = path.join(REPO_ROOT, 'src/data/administrativeDirectory.ts');
const CHECK_ONLY = process.argv.includes('--check');

const KURIGRAM_UPAZILAS = [
  'কুড়িগ্রাম সদর', 'নাগেশ্বরী', 'ভুরুঙ্গামারী', 'ফুলবাড়ী',
  'রাজারহাট', 'উলিপুর', 'চিলমারী', 'রৌমারী', 'রাজিবপুর',
];

const PLACEHOLDER_MARK = '[উদাহরণ]';

/** Minimal RFC4180-ish CSV parser: handles quoted fields with embedded
 *  commas/newlines. Good enough for hand-maintained admin data without
 *  pulling in a dependency for a one-off script. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((f) => f.trim() !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  const [header, ...data] = rows;
  return data.map((r) => Object.fromEntries(header.map((h, idx) => [h.trim(), (r[idx] ?? '').trim()])));
}

function loadCsv(name) {
  const p = path.join(__dirname, name);
  if (!fs.existsSync(p)) { console.error(`Missing ${name}`); process.exit(1); }
  return parseCsv(fs.readFileSync(p, 'utf-8'));
}

function isPlaceholder(row) {
  return Object.values(row).some((v) => v.includes(PLACEHOLDER_MARK));
}

function slugId(prefix, ...parts) {
  const base = parts.join('-').toLowerCase().replace(/\s+/g, '-').replace(/[^\w\u0980-\u09FF-]/g, '');
  return `${prefix}-${base}`;
}

const errors = [];
const warnings = [];

// ---- Unions ----
const unionRows = loadCsv('unions.csv').filter((r) => {
  if (isPlaceholder(r)) { warnings.push(`unions.csv: skipped placeholder row (${r.name})`); return false; }
  return true;
});
const unions = [];
const unionIndex = new Map(); // "upazila|name" -> id
unionRows.forEach((r, i) => {
  if (!KURIGRAM_UPAZILAS.includes(r.upazila)) errors.push(`unions.csv row ${i + 2}: unknown upazila "${r.upazila}"`);
  if (!['union', 'municipality'].includes(r.type)) errors.push(`unions.csv row ${i + 2}: type must be 'union' or 'municipality', got "${r.type}"`);
  if (!r.name) errors.push(`unions.csv row ${i + 2}: missing name`);
  const id = slugId('u', r.upazila, r.name);
  unions.push({ id, name: r.name, type: r.type, upazila: r.upazila, district: 'কুড়িগ্রাম' });
  unionIndex.set(`${r.upazila}|${r.name}`, id);
});

// ---- Blocks ----
const blockRows = loadCsv('blocks.csv').filter((r) => {
  if (isPlaceholder(r)) { warnings.push(`blocks.csv: skipped placeholder row (${r.block_name})`); return false; }
  return true;
});
const blocks = [];
const blockIndex = new Map(); // "upazila|union|block" -> id
blockRows.forEach((r, i) => {
  const key = `${r.upazila}|${r.union_name}`;
  const parentUnitId = unionIndex.get(key);
  if (!parentUnitId) { errors.push(`blocks.csv row ${i + 2}: union "${r.union_name}" (upazila "${r.upazila}") not found in unions.csv`); return; }
  const id = slugId('b', r.upazila, r.union_name, r.block_name);
  blocks.push({ id, name: r.block_name, parentUnitId });
  blockIndex.set(`${r.upazila}|${r.union_name}|${r.block_name}`, id);
});

// ---- SAAO ----
const saaoRows = loadCsv('saao.csv').filter((r) => {
  if (isPlaceholder(r)) { warnings.push(`saao.csv: skipped placeholder row (${r.saao_name})`); return false; }
  return true;
});
const saaos = [];
saaoRows.forEach((r, i) => {
  const key = `${r.upazila}|${r.union_name}|${r.block_name}`;
  const blockId = blockIndex.get(key);
  if (!blockId) { errors.push(`saao.csv row ${i + 2}: block "${r.block_name}" (union "${r.union_name}", upazila "${r.upazila}") not found in blocks.csv`); return; }
  if (!/^01[3-9]\d{8}$/.test(r.mobile)) warnings.push(`saao.csv row ${i + 2}: mobile "${r.mobile}" doesn't look like a valid BD number (01XXXXXXXXX)`);
  saaos.push({ id: slugId('saao', r.upazila, r.saao_name), name: r.saao_name, mobile: r.mobile, blockId });
});

// ---- Monitoring Officers ----
const moRows = loadCsv('monitoring_officers.csv').filter((r) => {
  if (isPlaceholder(r)) { warnings.push(`monitoring_officers.csv: skipped placeholder row (${r.name})`); return false; }
  return true;
});
const monitoringOfficers = [];
moRows.forEach((r, i) => {
  if (!KURIGRAM_UPAZILAS.includes(r.upazila)) errors.push(`monitoring_officers.csv row ${i + 2}: unknown upazila "${r.upazila}"`);
  if (!['UAO', 'AEO', 'AAO'].includes(r.designation)) errors.push(`monitoring_officers.csv row ${i + 2}: designation must be UAO/AEO/AAO, got "${r.designation}"`);
  if (!/^01[3-9]\d{8}$/.test(r.mobile)) warnings.push(`monitoring_officers.csv row ${i + 2}: mobile "${r.mobile}" doesn't look like a valid BD number (01XXXXXXXXX)`);
  monitoringOfficers.push({ id: slugId('mo', r.upazila, r.designation, r.name), name: r.name, mobile: r.mobile, designation: r.designation, upazila: r.upazila, district: 'কুড়িগ্রাম' });
});

// ---- Report ----
console.log(`Unions: ${unions.length}, Blocks: ${blocks.length}, SAAO: ${saaos.length}, Monitoring Officers: ${monitoringOfficers.length}`);
if (warnings.length) { console.log('\nWarnings:'); warnings.forEach((w) => console.log('  ⚠', w)); }
if (errors.length) {
  console.log('\nErrors (must fix before generating):');
  errors.forEach((e) => console.log('  ✗', e));
  process.exit(1);
}
if (unions.length === 0) {
  console.log('\nNothing to generate yet -- all CSVs are still just placeholder rows. Fill them in first.');
  process.exit(0);
}
if (CHECK_ONLY) { console.log('\n--check passed, no file written.'); process.exit(0); }

// ---- Splice into administrativeDirectory.ts ----
const ts = (obj) => JSON.stringify(obj, null, 2).replace(/"([a-zA-Z_]+)":/g, '$1:');
const arraysBlock = (name, arr) => `export const ${name} = ${arr.length ? `[\n${arr.map((o) => '  ' + ts(o).replace(/\n/g, '\n  ')).join(',\n')},\n]` : '[]'};`;

let content = fs.readFileSync(TARGET_FILE, 'utf-8');
const replace = (name, arr, typeAnnotation) => {
  const re = new RegExp(`export const ${name}[^=]*=\\s*\\[[\\s\\S]*?\\];`);
  if (!re.test(content)) { console.error(`Could not find ${name} in ${TARGET_FILE} -- has the file structure changed?`); process.exit(1); }
  const block = `export const ${name}: ${typeAnnotation} = ${arr.length ? `[\n${arr.map((o) => '  ' + ts(o).replace(/\n/g, '\n  ')).join(',\n')},\n]` : '[]'};`;
  content = content.replace(re, block);
};
replace('PARENT_UNITS', unions, 'AdministrativeParentUnit[]');
replace('BLOCKS', blocks, 'Block[]');
replace('SAAO_DIRECTORY', saaos, 'SaaoDirectoryEntry[]');
replace('MONITORING_OFFICER_DIRECTORY', monitoringOfficers, 'MonitoringOfficerDirectoryEntry[]');

fs.writeFileSync(TARGET_FILE, content, 'utf-8');
console.log(`\n✓ Wrote ${TARGET_FILE}`);
console.log('Run `npx tsc --noEmit` to confirm the types still check out.');
