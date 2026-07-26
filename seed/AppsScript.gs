/**
 * Google Apps Script — App_Entry + User_Profile + Growth_Log +
 * Custom_Upazila sheet backend.
 *
 * This file is NOT deployed by Vercel/git. Copy its contents into the
 * Apps Script project bound to the Tree Plantation Reporting Workbook
 * (Extensions -> Apps Script), replacing the existing Code.gs, then
 * Deploy -> Manage deployments -> Edit -> New version. The deployment's
 * /exec URL is what you set as GAS_WEBHOOK_URL on Vercel -- the app never
 * calls this URL directly (browsers can't POST JSON to GAS without CORS
 * failing), it always goes through the /api/gas-sync proxy in this repo.
 *
 * Responsibilities:
 *   doPost(e)  -- entryType="user_profile"    -> User_Profile sheet
 *               -- entryType="growth_reading" -> Growth_Log sheet
 *               -- entryType="custom_upazila" -> Custom_Upazila sheet
 *               -- otherwise                  -> App_Entry sheet (seedling row)
 *   doGet(e)   -- ?mobile=01XXXXXXXXX       -> User_Profile lookup by mobile
 *               -- ?list=1[&district=..]    -> every App_Entry row, grouped
 *               -- ?directory=1[&role=..]   -> personnel directory (deduped
 *                                              from User_Profile by mobile,
 *                                              most recent submission wins)
 *                                              -- powers SAAO/officer
 *                                              autocomplete; no separate
 *                                              directory sheet needed
 *               -- ?customUpazila=1[&district=..] -> all custom upazila
 *                                              names added across every
 *                                              device, so one officer's
 *                                              addition is visible to all
 *
 * IMPORTANT — one-time manual steps after deploying this version:
 *   1. Add a 'ব্লক' header in the App_Entry sheet's LAST column (after
 *      'সিঙ্কের সময়'), if not already done from a previous update.
 *   2. Growth_Log and Custom_Upazila sheets are created automatically on
 *      first write (same pattern as User_Profile) -- no manual sheet setup
 *      needed for those two.
 */

var SHEET_NAME = 'App_Entry';
var PROFILE_SHEET_NAME = 'User_Profile';
var GROWTH_SHEET_NAME = 'Growth_Log';
var CUSTOM_UPAZILA_SHEET_NAME = 'Custom_Upazila';

var COLUMNS = [
  'জমার সময়', 'অ্যাপ জমা আইডি', 'বিভাগ', 'অঞ্চল', 'জেলা', 'উপজেলা',
  'ইউনিয়ন', 'গ্রাম', 'অবস্থানের ধরন', 'চারার উৎস', 'সুনির্দিষ্ট ঠিকানা',
  'অক্ষাংশ', 'দ্রাঘিমাংশ', 'রোপণের তারিখ', 'বৃক্ষের প্রজাতি/জাত',
  'বৃক্ষের শ্রেণী', 'সংখ্যা', 'প্রাথমিক NDVI', 'ছবি (ইনলাইন)',
  'ছবি SHA-256', 'কৃষকের নাম', 'কৃষকের মোবাইল', 'SAAO-এর নাম',
  'SAAO-এর মোবাইল', 'মনিটরিং অফিসারের নাম', 'মনিটরিং অফিসারের মোবাইল',
  'মন্তব্য', 'সত্যায়ন হ্যাশ', 'সিঙ্কের সময়',
  'ব্লক' // Appended at the end (not inserted mid-schema) so existing rows
         // in the live sheet keep their column positions. Needed for the
         // government 17-column report, which is the only place ব্লক is
         // required — App_Entry never captured it before.
];

/**
 * Normalizes a raw lat/lng pair before it's ever written to the sheet.
 * The live "17 column report" / "ministry report" data contains several
 * malformed coordinates that break report generation and map rendering:
 *   - comma used as decimal separator: "25,477083" -> should be "25.477083"
 *   - missing decimal point entirely: "2547209" -> should be "25.47209"
 *   - double decimal points: "25.521270.89.822017" (lat/lng ran together)
 * This performs best-effort cleanup and flags anything it can't confidently
 * fix, rather than silently writing bad data into the sheet.
 */
function normalizeCoord_(raw) {
  var s = String(raw == null ? '' : raw).trim();
  if (!s) return { value: '', ok: true };
  s = s.replace(',', '.'); // comma-as-decimal-separator typo
  var dotCount = (s.match(/\./g) || []).length;
  if (dotCount > 1) return { value: s, ok: false }; // e.g. two numbers ran together
  if (dotCount === 0 && /^\d{5,}$/.test(s)) {
    // Missing decimal point on a plain digit string, e.g. "2547209" for a
    // Bangladesh latitude (always 2 integer digits) -> "25.47209".
    s = s.slice(0, 2) + '.' + s.slice(2);
  }
  var n = parseFloat(s);
  if (isNaN(n)) return { value: raw, ok: false };
  return { value: n, ok: true };
}

var PROFILE_COLUMNS = [
  'জমার সময়', 'অ্যাপ জমা আইডি', 'সংক্ষিপ্ত পদবি', 'পদবি',
  'নাম', 'মোবাইল', 'ইমেইল', 'ডিভাইস আইডি',
  'জেলা', 'উপজেলা', 'ইউনিয়ন', 'ব্লক'
];

var GROWTH_COLUMNS = [
  'জমার সময়', 'এন্ট্রি আইডি', 'পর্যবেক্ষণের তারিখ', 'NDVI',
  'উচ্চতা (cm)', 'অবস্থা', 'মন্তব্য', 'রেকর্ডকারী', 'ডিভাইস আইডি'
];

var CUSTOM_UPAZILA_COLUMNS = [
  'জমার সময়', 'জেলা', 'উপজেলার নাম', 'যোগকারী', 'ডিভাইস আইডি'
];

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error('Sheet "' + SHEET_NAME + '" not found');
  return sheet;
}

function getProfileSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(PROFILE_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(PROFILE_SHEET_NAME);
    sheet.appendRow(PROFILE_COLUMNS);
    sheet.getRange(1, 1, 1, PROFILE_COLUMNS.length).setFontWeight('bold');
  }
  return sheet;
}

function getGrowthSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(GROWTH_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(GROWTH_SHEET_NAME);
    sheet.appendRow(GROWTH_COLUMNS);
    sheet.getRange(1, 1, 1, GROWTH_COLUMNS.length).setFontWeight('bold');
  }
  return sheet;
}

function getCustomUpazilaSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CUSTOM_UPAZILA_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(CUSTOM_UPAZILA_SHEET_NAME);
    sheet.appendRow(CUSTOM_UPAZILA_COLUMNS);
    sheet.getRange(1, 1, 1, CUSTOM_UPAZILA_COLUMNS.length).setFontWeight('bold');
  }
  return sheet;
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var raw = JSON.parse(e.postData.contents);

    if (raw.entryType === 'user_profile') {
      var ps = getProfileSheet_();
      var now = new Date();
      ps.appendRow([
        now.toISOString(),
        raw.submissionId || '',
        raw.shortRole || '',
        raw.roleLabel || '',
        raw.name || '',
        raw.mobile || '',
        raw.email || '',
        raw.deviceId || '',
        raw.district || '',
        raw.upazila || '',
        raw.union || '',
        raw.block || ''
      ]);
      return jsonOut_({ ok: true });
    }

    if (raw.entryType === 'growth_reading') {
      var gs = getGrowthSheet_();
      gs.appendRow([
        new Date().toISOString(),
        raw.entryId || '',
        raw.readingDate || '',
        raw.ndvi != null ? raw.ndvi : '',
        raw.heightCm != null ? raw.heightCm : '',
        raw.healthStatus || '',
        raw.note || '',
        raw.recordedBy || '',
        raw.deviceId || ''
      ]);
      return jsonOut_({ ok: true });
    }

    if (raw.entryType === 'custom_upazila') {
      var cus = getCustomUpazilaSheet_();
      cus.appendRow([
        new Date().toISOString(),
        raw.district || '',
        raw.upazilaName || '',
        raw.addedBy || '',
        raw.deviceId || ''
      ]);
      return jsonOut_({ ok: true });
    }

    var sheet = getSheet_();
    var now = new Date();
    var lat = normalizeCoord_(raw.latitude);
    var lng = normalizeCoord_(raw.longitude);
    var row = [
      now.toISOString(),
      raw.submissionId || '',
      raw.division || '',
      raw.region || '',
      raw.district || '',
      raw.upazila || '',
      raw.union || '',
      raw.village || '',
      raw.locationType || '',
      raw.sourceType || '',
      raw.address || '',
      lat.value,
      lng.value,
      raw.plantingDate || '',
      raw.speciesName || '',
      raw.category || '',
      raw.quantity || 0,
      raw.ndvi || '',
      '',
      raw.photoSha256 || '',
      raw.farmerName || '',
      raw.farmerMobile || '',
      raw.saaoName || '',
      raw.saaoMobile || '',
      raw.officerName || '',
      raw.officerMobile || '',
      raw.remarks ? (raw.remarks + (lat.ok && lng.ok ? '' : ' ⚠️ স্থানাঙ্ক যাচাই প্রয়োজন')) : (lat.ok && lng.ok ? '' : '⚠️ স্থানাঙ্ক যাচাই প্রয়োজন'),
      raw.authHash || '',
      now.toISOString(),
      raw.block || ''
    ];
    sheet.appendRow(row);
    return jsonOut_({ ok: true, coordWarning: (!lat.ok || !lng.ok) });
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err) });
  }
}

function doGet(e) {
  var params = (e && e.parameter) || {};
  try {
    if (params.list) return jsonOut_(listEntries_(params.district, params.region));
    if (params.mobile) return jsonOut_(lookupByMobile_(params.mobile));
    if (params.directory) return jsonOut_(getDirectory_(params.role, params.upazila));
    if (params.customUpazila) return jsonOut_(getCustomUpazilas_(params.district));
    return jsonOut_({ ok: false, error: 'mobile, list, directory, or customUpazila query param required' });
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err) });
  }
}

/**
 * Personnel directory, deduplicated from User_Profile by mobile number
 * (most recent submission per person wins). This is deliberately NOT a
 * separate sheet -- User_Profile already is the single source of truth
 * for "who is this officer" across every role (ADD/AAO/AEO/UAO/SAAO);
 * duplicating it into a second sheet would just create two records that
 * can drift out of sync with each other.
 */
function getDirectory_(role, upazila) {
  var ps = getProfileSheet_();
  var values = ps.getDataRange().getValues();
  if (values.length < 2) return { ok: true, count: 0, people: [] };
  var header = values[0];
  var idx = {};
  header.forEach(function(h, i) { idx[String(h).trim()] = i; });

  var byMobile = {};
  var order = [];
  for (var r = 1; r < values.length; r++) {
    var v = values[r];
    if (!v.join('')) continue;
    var get = function(col) { return idx.hasOwnProperty(col) ? v[idx[col]] : ''; };
    var mobile = String(get('মোবাইল') || '');
    if (!mobile) continue;
    // Later rows overwrite earlier ones for the same mobile -> "most recent wins"
    if (!byMobile[mobile]) order.push(mobile);
    byMobile[mobile] = {
      shortRole: String(get('সংক্ষিপ্ত পদবি') || ''),
      roleLabel: String(get('পদবি') || ''),
      name:      String(get('নাম') || ''),
      mobile:    mobile,
      district:  String(get('জেলা') || ''),
      upazila:   String(get('উপজেলা') || ''),
      union:     String(get('ইউনিয়ন') || ''),
      block:     String(get('ব্লক') || '')
    };
  }

  var people = order.map(function(m) { return byMobile[m]; });
  if (role) people = people.filter(function(p) { return p.shortRole === role; });
  if (upazila) people = people.filter(function(p) { return p.upazila === upazila; });
  return { ok: true, count: people.length, people: people };
}

/** Every custom upazila name any officer has added, across all devices. */
function getCustomUpazilas_(district) {
  var cus = getCustomUpazilaSheet_();
  var values = cus.getDataRange().getValues();
  if (values.length < 2) return { ok: true, count: 0, items: [] };
  var header = values[0];
  var idx = {};
  header.forEach(function(h, i) { idx[String(h).trim()] = i; });

  var seen = {};
  var items = [];
  for (var r = 1; r < values.length; r++) {
    var v = values[r];
    if (!v.join('')) continue;
    var get = function(col) { return idx.hasOwnProperty(col) ? v[idx[col]] : ''; };
    var d = String(get('জেলা') || '');
    var name = String(get('উপজেলার নাম') || '');
    if (!name) continue;
    if (district && d !== district) continue;
    var key = d + '|' + name;
    if (seen[key]) continue;
    seen[key] = true;
    items.push({ district: d, upazilaName: name });
  }
  return { ok: true, count: items.length, items: items };
}

function readAllRows_() {
  var sheet = getSheet_();
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  var header = values[0];
  var idx = {};
  header.forEach(function(h, i) { idx[String(h).trim()] = i; });

  var rows = [];
  for (var r = 1; r < values.length; r++) {
    var v = values[r];
    if (!v.join('')) continue;
    var get = function(col) { return idx.hasOwnProperty(col) ? v[idx[col]] : ''; };
    rows.push({
      submissionId: String(get('অ্যাপ জমা আইডি') || ''),
      division:     String(get('বিভাগ') || ''),
      region:       String(get('অঞ্চল') || ''),
      district:     String(get('জেলা') || ''),
      upazila:      String(get('উপজেলা') || ''),
      union:        String(get('ইউনিয়ন') || ''),
      village:      String(get('গ্রাম') || ''),
      locationType: String(get('অবস্থানের ধরন') || ''),
      sourceType:   String(get('চারার উৎস') || ''),
      address:      String(get('সুনির্দিষ্ট ঠিকানা') || ''),
      latitude:     get('অক্ষাংশ'),
      longitude:    get('দ্রাঘিমাংশ'),
      plantingDate: String(get('রোপণের তারিখ') || ''),
      speciesName:  String(get('বৃক্ষের প্রজাতি/জাত') || ''),
      category:     String(get('বৃক্ষের শ্রেণী') || ''),
      quantity:     Number(get('সংখ্যা')) || 0,
      ndvi:         String(get('প্রাথমিক NDVI') || ''),
      farmerName:   String(get('কৃষকের নাম') || ''),
      farmerMobile: String(get('কৃষকের মোবাইল') || ''),
      saaoName:     String(get('SAAO-এর নাম') || ''),
      saaoMobile:   String(get('SAAO-এর মোবাইল') || ''),
      officerName:  String(get('মনিটরিং অফিসারের নাম') || ''),
      officerMobile:String(get('মনিটরিং অফিসারের মোবাইল') || ''),
      remarks:      String(get('মন্তব্য') || ''),
      submittedAt:  String(get('জমার সময়') || ''),
      block:        String(get('ব্লক') || '')
    });
  }
  return rows;
}

function listEntries_(district, region) {
  var rows = readAllRows_();
  if (district) rows = rows.filter(function(r) { return r.district === district; });
  if (region) rows = rows.filter(function(r) { return r.region === region; });

  var bySubmission = {};
  var order = [];
  rows.forEach(function(r) {
    var key = r.submissionId || (r.latitude + ',' + r.longitude + '|' + r.farmerMobile + '|' + r.plantingDate);
    if (!bySubmission[key]) {
      bySubmission[key] = {
        submissionId: r.submissionId, division: r.division, region: r.region,
        district: r.district, upazila: r.upazila, union: r.union, village: r.village,
        block: r.block,
        locationType: r.locationType, sourceType: r.sourceType, address: r.address,
        latitude: r.latitude, longitude: r.longitude,
        geoLocation: (r.latitude && r.longitude) ? (r.latitude + ', ' + r.longitude) : '',
        plantingDate: r.plantingDate, ndvi: r.ndvi,
        farmerName: r.farmerName, farmerMobile: r.farmerMobile,
        saaoName: r.saaoName, saaoMobile: r.saaoMobile,
        officerName: r.officerName, officerMobile: r.officerMobile,
        remarks: r.remarks, submittedAt: r.submittedAt,
        seedlings: []
      };
      order.push(key);
    }
    if (r.speciesName) {
      bySubmission[key].seedlings.push({
        speciesName: r.speciesName, category: r.category, quantity: r.quantity
      });
    }
  });

  var entries = order.map(function(k) { return bySubmission[k]; });
  return { ok: true, count: entries.length, entries: entries };
}

function lookupByMobile_(mobile) {
  var ps = getProfileSheet_();
  var values = ps.getDataRange().getValues();
  if (values.length < 2) return { ok: false, found: false };
  var header = values[0];
  var idx = {};
  header.forEach(function(h, i) { idx[String(h).trim()] = i; });

  var match = null;
  for (var r = values.length - 1; r >= 1; r--) {
    var v = values[r];
    var mob = idx.hasOwnProperty('মোবাইল') ? String(v[idx['মোবাইল']] || '') : '';
    if (mob === mobile) {
      var get = function(col) { return idx.hasOwnProperty(col) ? v[idx[col]] : ''; };
      match = {
        shortRole: String(get('সংক্ষিপ্ত পদবি') || ''),
        roleLabel: String(get('পদবি') || ''),
        name:      String(get('নাম') || ''),
        mobile:    mob,
        email:     String(get('ইমেইল') || ''),
        deviceId:  String(get('ডিভাইস আইডি') || ''),
        district:  String(get('জেলা') || ''),
        upazila:   String(get('উপজেলা') || ''),
        union:     String(get('ইউনিয়ন') || ''),
        block:     String(get('ব্লক') || '')
      };
      break;
    }
  }
  if (!match) return { ok: false, found: false };
  return { ok: true, found: true, user: match };
}