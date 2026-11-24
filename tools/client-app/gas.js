/* ===== PBV Client Spaces: one Google web app for every client =====
   A standalone Apps Script project ("PBV Client Spaces"), deployed once as a web app
   (Execute as: Pauline, Who has access: Anyone). Every client space calls the same URL
   with its own client id and token. Adding a client = one entry in the CLIENTS property.

   Script property CLIENTS (Project settings > Script properties), one JSON object:
   {
     "hotel-albatros": {
       "token":  "<long random string, the same one as in the client's token file>",
       "sheet":  "<id of the client's content calendar Sheet>",
       "folder": "<id of the Drive folder that holds the month folders: 12 - December/Dec 04 reel>",
       "notify": "pauline@pbvagency.com"
     }
   }
   Services: Drive API (v3) is not needed; DriveApp does the work. */

var FEEDBACK_TAB = 'Client feedback';
var LIVE_TAB = 'Live posts';
var MONTH_TAB = /calendar\s*-\s*[a-z]{3}/i;

function prop_(k) { return PropertiesService.getScriptProperties().getProperty(k) || ''; }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function client_(id, token) {
  var all = {}; try { all = JSON.parse(prop_('CLIENTS') || '{}'); } catch (x) { throw new Error('CLIENTS property is not valid JSON'); }
  var c = all[id];
  if (!c || !token || c.token !== token) throw new Error('unauthorised');
  c.id = id; return c;
}

function doGet(e) {
  var p = (e && e.parameter) || {};
  try {
    var c = client_(p.client, p.token), ss = SpreadsheetApp.openById(c.sheet);
    if (p.action === 'months') return json_({ months: listMonths_(ss) });
    if (p.action === 'month') return json_(readMonth_(c, ss, p.tab));
    return json_({ error: 'unknown action' });
  } catch (err) { return json_({ error: String(err && err.message || err) }); }
}

function doPost(e) {
  var b = {};
  try { b = JSON.parse(e.postData.contents); } catch (x) { return json_({ error: 'bad request' }); }
  try {
    var c = client_(b.client, b.token), lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try { return json_(decide_(c, SpreadsheetApp.openById(c.sheet), b)); } finally { lock.releaseLock(); }
  } catch (err) { return json_({ error: String(err && err.message || err) }); }
}

/* ---------- reading ---------- */

function listMonths_(ss) {
  return ss.getSheets()
    .filter(function (s) { return MONTH_TAB.test(s.getName()) && !s.isSheetHidden(); })
    .map(function (s) { var i = tabInfo(s.getName()); return i ? { tab: s.getName(), key: i.key, label: i.label } : null; })
    .filter(Boolean).sort(function (a, b) { return a.key < b.key ? -1 : 1; });
}

function readMonth_(c, ss, tabName) {
  var sh = ss.getSheetByName(tabName);
  if (!sh || !MONTH_TAB.test(tabName)) throw new Error('No such month');
  var lastCol = sh.getLastColumn();
  var values = sh.getRange(FIRST_ROW, 1, 11, lastCol).getDisplayValues();
  var merges = sh.getRange(FIRST_ROW, 1, 1, lastCol).getMergedRanges().map(function (r) {
    return { startRowIndex: r.getRow() - 1, endRowIndex: r.getLastRow(), startColumnIndex: r.getColumn() - 1, endColumnIndex: r.getLastColumn() };
  });
  var parsed = parseTab(tabName, sh.getSheetId(), values, merges);
  matchVisuals(parsed.items, monthFolder_(c, parsed.info));
  var fb = feedbackByItem_(ss);
  return {
    month: { tab: tabName, key: parsed.info.key, label: parsed.info.label },
    // Briefs (row 13) and asset sources (row 12) never leave the Sheet; the copy of a post in production neither
    items: attachLive(parsed.items.map(function (it) { return toClientItem(it, fb[tabName + '!' + it.cols[0]]); }), liveRows_(ss))
  };
}

function monthFolder_(c, info) {
  if (!c.folder || !info) return [];
  var cache = CacheService.getScriptCache(), key = c.id + ':folder:' + info.key, hit = cache.get(key);
  if (hit) return JSON.parse(hit);
  var root = DriveApp.getFolderById(c.folder), month = null, it = root.getFolders();
  var re = new RegExp('^\\s*0?' + info.month + '\\s*-\\s*' + MONTH_NAMES[info.month - 1], 'i');
  while (it.hasNext()) { var f = it.next(); if (re.test(f.getName())) { month = f; break; } }
  if (!month) return [];
  var entries = [], sub = month.getFolders();
  while (sub.hasNext()) {
    var d = sub.next(), files = [], fi = d.getFiles();
    while (fi.hasNext()) { var v = visual_(fi.next()); if (v) files.push(v); }
    files.sort(function (a, b) { return a.name.localeCompare(b.name, 'en', { numeric: true }); });
    entries.push({ name: d.getName(), files: files });
  }
  var loose = month.getFiles();   // a single file named like "Nov 3 post.jpg" counts as its own folder
  while (loose.hasNext()) { var lf = loose.next(), lv = visual_(lf); if (lv && folderDay(lf.getName())) entries.push({ name: lf.getName(), files: [lv] }); }
  try { cache.put(key, JSON.stringify(entries), 300); } catch (x) {}
  return entries;
}

/* Visuals open for anyone who has the exact file link (and only from inside the encrypted space),
   so the client sees photos in full size and plays videos without a Google account. */
function visual_(file) {
  var mt = file.getMimeType(), video = mt.indexOf('video/') === 0;
  if (mt.indexOf('image/') !== 0 && !video) return null;
  try { if (file.getSharingAccess() !== DriveApp.Access.ANYONE_WITH_LINK) file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (x) {}
  var id = file.getId();
  return {
    id: id, name: file.getName(), kind: video ? 'video' : 'image',
    src: 'https://drive.google.com/thumbnail?id=' + id + '&sz=w1600',
    embed: video ? 'https://drive.google.com/file/d/' + id + '/preview' : ''
  };
}

// "Live posts" tab, one row per published post: Date (YYYY-MM-DD) | Network | Type | Link
function liveRows_(ss) {
  var sh = ss.getSheetByName(LIVE_TAB);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, 4).getDisplayValues().map(function (r) { return { date: r[0], network: r[1], type: r[2], link: r[3] }; });
}

function feedbackByItem_(ss) {
  var sh = ss.getSheetByName(FEEDBACK_TAB), out = {};
  if (!sh || sh.getLastRow() < 2) return out;
  sh.getRange(2, 1, sh.getLastRow() - 1, 10).getDisplayValues().forEach(function (r) {
    var k = r[9]; if (!k) return;
    (out[k] = out[k] || []).push({ when: r[0], who: r[1], decision: r[5], option: r[6], change: r[7], comment: r[8] });
  });
  return out;
}

/* ---------- writing ---------- */

var DECISION = { approve: 'Approved', changes: 'Rework', reopen: 'To validate' };
var CHANGE = { copy: 'the copy', visual: 'the visual', both: 'the copy and the visual' };

function decide_(c, ss, b) {
  var status = DECISION[b.decision]; if (!status) throw new Error('Unknown decision');
  var sh = ss.getSheetByName(b.tab);
  if (!sh || !MONTH_TAB.test(b.tab)) throw new Error('No such month');
  var cols = (b.cols || []).filter(function (x) { return /^[A-Z]{1,3}$/.test(x); });
  if (!cols.length) throw new Error('No columns');
  var first = cols[0];

  // The post must still be where the page saw it: Pauline may have moved columns since.
  var ideaCell = sh.getRange(first + (FIRST_ROW + ROW.idea)), merged = ideaCell.getMergedRanges()[0];
  var ideaText = clean((merged || ideaCell).getDisplayValue());
  if (b.title && clean(b.title) !== ideaText) throw new Error('moved');
  var now = clean(sh.getRange(first + (FIRST_ROW + ROW.status)).getDisplayValue());
  if (['To validate', 'Rework', 'Approved'].indexOf(now) < 0) throw new Error('not open for review');

  var who = clean(b.who) || c.id, when = Utilities.formatDate(new Date(), 'Europe/Zurich', 'd MMM yyyy HH:mm');
  var option = b.option ? String(b.option) : '', change = CHANGE[b.change] ? b.change : '', comment = clean(b.comment).slice(0, 2000);

  cols.forEach(function (x) { var cell = sh.getRange(x + (FIRST_ROW + ROW.status)); if (clean(cell.getDisplayValue())) cell.setValue(status); });
  var copyCell = sh.getRange(first + (FIRST_ROW + ROW.copy));
  var line = when + ' · ' + who + ': ' + (b.decision === 'approve' ? 'approved' : b.decision === 'reopen' ? 'reopened' : 'asked to change ' + (CHANGE[change] || 'it')) +
    (option ? ' (option ' + option + ')' : '') + (comment ? '\n"' + comment + '"' : '');
  var note = copyCell.getNote(); copyCell.setNote(note ? note + '\n\n' + line : line);

  var log = ss.getSheetByName(FEEDBACK_TAB) || ss.insertSheet(FEEDBACK_TAB);
  if (log.getLastRow() === 0) log.appendRow(['When', 'Who', 'Month', 'Date', 'Post', 'Decision', 'Copy option', 'Change', 'Comment', 'Item']);
  log.appendRow([when, who, b.tab, clean(b.dateLabel), ideaText, status === 'To validate' ? 'Reopened' : status, option, change, comment, b.tab + '!' + first]);

  if (c.notify && b.decision !== 'reopen') {
    MailApp.sendEmail(c.notify, c.id + ' · ' + ideaText + ' · ' + (b.decision === 'approve' ? 'approved' : 'changes requested'),
      who + (b.decision === 'approve' ? ' approved "' : ' asked to change ' + (CHANGE[change] || 'it') + ' on "') + ideaText + '" (' + clean(b.dateLabel) + ').\n' +
      (option ? 'Copy option: ' + option + '\n' : '') + (comment ? 'Comment: ' + comment + '\n' : '') +
      '\n' + ss.getUrl() + '#gid=' + sh.getSheetId() + '&range=' + first + (FIRST_ROW + ROW.copy));
  }
  return { ok: true, status: status };
}

/* Run from the editor after adding a client (View > Logs): checks every client in CLIENTS */
function checkSetup() {
  var all = JSON.parse(prop_('CLIENTS') || '{}');
  Object.keys(all).forEach(function (id) {
    var c = all[id]; c.id = id;
    try {
      var ss = SpreadsheetApp.openById(c.sheet), m = listMonths_(ss);
      Logger.log(id + ': months ' + m.map(function (x) { return x.label; }).join(', '));
      if (m.length) { var r = readMonth_(c, ss, m[m.length - 1].tab); Logger.log(id + ': ' + r.items.length + ' posts in ' + r.month.label + ', ' + r.items.filter(function (i) { return i.visuals.length; }).length + ' with visuals'); }
    } catch (err) { Logger.log(id + ': PROBLEM ' + err.message); }
  });
}
