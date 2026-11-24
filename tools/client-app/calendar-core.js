/* ===== PBV client space: calendar core (one file for every client) =====
   Used twice: pasted into the PBV Client Spaces Apps Script (Code.gs) and run by
   publish.py's preview. Reads one month tab of a client's content calendar Sheet:
   row 4 date, 5 post idea, 6 time, 7 platform, 8 format, 9 pillar, 10 status,
   11 tag, 12 asset source, 13 brief (internal), 14 copy.
   One column group per day (the date is merged across the day's columns). */

var ROW = { date: 0, idea: 1, time: 2, platform: 3, format: 4, pillar: 5, status: 6, tag: 7, source: 8, brief: 9, copy: 10 };
var FIRST_ROW = 4;   // sheet row of the date line
var FIRST_COL = 3;   // column D
var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
var MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// What the client sees for each of Pauline's statuses
var CLIENT_STATUS = {
  'Idea': 'production', 'To shoot': 'production', 'Awaiting content': 'production', 'In editing': 'production',
  'To validate': 'review', 'Rework': 'changes', 'Approved': 'approved', 'Scheduled': 'scheduled', 'Posted': 'live'
};

function colLetter(i) { var s = ''; i += 1; while (i > 0) { var r = (i - 1) % 26; s = String.fromCharCode(65 + r) + s; i = Math.floor((i - 1) / 26); } return s; }
function clean(s) { return String(s == null ? '' : s).replace(/\r/g, '').trim(); }
function stripEmoji(s) { return clean(s).replace(/^[^A-Za-z0-9]+/, '').trim(); }

function tabInfo(title) {
  var m = /(\d{4}).*-\s*([A-Za-z]{3})[a-z]*\s*$/.exec(title || '');
  if (!m) return null;
  var mi = MONTHS.indexOf(m[2].slice(0, 1).toUpperCase() + m[2].slice(1, 3).toLowerCase());
  if (mi < 0) return null;
  return { year: +m[1], month: mi + 1, key: m[1] + '-' + ('0' + (mi + 1)).slice(-2), label: MONTH_NAMES[mi] + ' ' + m[1], short: MONTHS[mi] };
}

function platformKey(p) {
  p = clean(p).toLowerCase();
  if (p.indexOf('stories') >= 0) return 'story';
  if (p.indexOf('instagram') >= 0) return 'ig';
  if (p.indexOf('facebook') >= 0) return 'fb';
  if (p.indexOf('tiktok') >= 0) return 'tt';
  return '';
}

function kindOf(format, platform) {
  var f = stripEmoji(format).toLowerCase();
  if (f.indexOf('trial') >= 0) return 'trial';
  if (f.indexOf('reel') >= 0) return 'reel';
  if (f.indexOf('carousel') >= 0) return 'carousel';
  if (f.indexOf('multi') >= 0 || platformKey(platform) === 'story') return 'story';
  if (f.indexOf('photo') >= 0) return 'photo';
  return f || 'post';
}

function isAttachment(format) {
  var f = stripEmoji(format).toLowerCase();
  return f.indexOf('repost') === 0 || f.indexOf('share in stories') === 0;
}

function hideUrls(s) { return s.replace(/https?:\/\/\S+/g, '').replace(/\s{2,}/g, ' ').trim(); }

/* Copy cell -> structured copy the client can read */
function parseCopy(text) {
  var out = { onVideo: '', options: [], slides: [], hashtags: '', cover: '', highlight: '', notes: [] };
  var lines = clean(text).split('\n');
  var mode = '', cur = null;
  for (var i = 0; i < lines.length; i++) {
    var raw = lines[i], line = raw.trim(), m;
    if (!line) { mode = ''; cur = null; continue; }
    if (/^on video:?$/i.test(line)) { mode = 'video'; continue; }
    if (/^one copy per slide:?$/i.test(line)) { mode = 'slides'; continue; }
    if ((m = /^opt(?:ion)?\s*(\d+)\s*[.:]\s*(.*)$/i.exec(line))) { cur = { n: +m[1], text: m[2] }; out.options.push(cur); mode = 'opt'; continue; }
    if ((m = /^slides?\s+([\d\s]+(?:to\s+\d+)?)\s*:\s*(.*)$/i.exec(line))) { out.slides.push({ n: clean(m[1]), text: hideUrls(m[2]) }); mode = 'slide'; continue; }
    if ((m = /^cover title:\s*(.*)$/i.exec(line))) { out.cover = m[1]; continue; }
    if ((m = /^highlight cover:\s*(.*)$/i.exec(line))) { out.highlight = m[1]; continue; }
    if (line.charAt(0) === '#') { out.hashtags = line; mode = ''; continue; }
    if (mode === 'video') { out.onVideo += (out.onVideo ? '\n' : '') + line; continue; }
    if (mode === 'opt' && cur) { cur.text += '\n' + line; continue; }
    if (mode === 'slide' && out.slides.length) { var u = hideUrls(line); if (u) out.slides[out.slides.length - 1].text += ' ' + u; continue; }
    if (mode === 'slides') { out.slides.push({ n: '', text: hideUrls(line) }); continue; }
    if (/^add link to book direct/i.test(line)) continue;
    out.notes.push(hideUrls(line));
  }
  if (!out.options.length && !out.slides.length && out.notes.length) { out.options.push({ n: 1, text: out.notes.join('\n') }); out.notes = []; }
  return out;
}

function parseDate(label, info) {
  var m = /(\d{1,2})[.\/](\d{1,2})/.exec(label || '');
  if (!m) return null;
  var day = +m[1], month = +m[2];
  if (info && month !== info.month) month = info.month;   // tolerate typos like "Thu 12.12" in the November tab
  return { day: day, month: month, year: info ? info.year : 0 };
}

/* values: rows 4..14 of the tab (2D array of displayed values), merges: grid merges touching row 4 */
function parseTab(title, sheetId, values, merges) {
  var info = tabInfo(title);
  var width = 0; values.forEach(function (r) { width = Math.max(width, r.length); });
  var v = function (r, c) { return clean((values[r] || [])[c]); };
  var spanAt = {};
  (merges || []).forEach(function (m) { if (m.startRowIndex <= FIRST_ROW - 1 && m.endRowIndex > FIRST_ROW - 1) spanAt[m.startColumnIndex] = m.endColumnIndex; });
  var items = [], lastEnd = -1;
  for (var c = FIRST_COL; c < width; ) {
    var end = spanAt[c] || c + 1, dateLabel = v(ROW.date, c);
    var hasContent = false;
    for (var k = c; k < end; k++) if (v(ROW.platform, k)) hasContent = true;
    if (!hasContent) { c = end; continue; }
    var continuing = !dateLabel && items.length && lastEnd === c;
    if (!dateLabel && !continuing) { c = end; continue; }
    var d = continuing ? null : parseDate(dateLabel, info), item = continuing ? items[items.length - 1] : null;
    for (var col = c; col < end; col++) {
      var platform = v(ROW.platform, col), format = v(ROW.format, col);
      if (!platform) continue;
      if (item && isAttachment(format)) {
        var pk = platformKey(platform);
        if (pk && item.platforms.indexOf(pk) < 0) item.platforms.push(pk);
        item.cols.push(colLetter(col));
        continue;
      }
      var status = v(ROW.status, col);
      item = {
        id: sheetId + ':' + colLetter(col),
        tab: title, sheetId: sheetId, cols: [colLetter(col)],
        dateLabel: dateLabel, day: d ? d.day : 0, month: d ? d.month : 0, year: d ? d.year : 0,
        title: v(ROW.idea, c), time: v(ROW.time, col),
        platforms: [platformKey(platform)].filter(Boolean),
        format: stripEmoji(format), kind: kindOf(format, platform),
        pillar: stripEmoji(v(ROW.pillar, col)),
        status: status, clientStatus: CLIENT_STATUS[status] || 'production',
        tag: v(ROW.tag, col),
        copy: parseCopy(v(ROW.copy, col))
      };
      items.push(item);
    }
    lastEnd = end;
    c = end;
  }
  return { tab: title, sheetId: sheetId, info: info, items: items };
}

/* Visual folders: "Dec 04 reel", "Nov 5 post", "Nov 3 post.jpg" -> which item they belong to */
function folderDay(name) {
  var m = /^([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2})\b\s*(.*)$/.exec(clean(name));
  if (!m) return null;
  return { mon: m[1].toLowerCase(), day: +m[2], rest: m[3].toLowerCase() };
}

function matchVisuals(items, entries) {
  // entries: [{name, files:[...]}] for the month folder. Stories folders go to story items, the others to feed items.
  items.forEach(function (it) {
    var isStory = it.kind === 'story';
    var cands = entries.filter(function (e) {
      var fd = folderDay(e.name); if (!fd || fd.day !== it.day) return false;
      var storyFolder = fd.rest.indexOf('stor') >= 0;
      return isStory ? storyFolder : !storyFolder;
    });
    it.visuals = cands.length ? cands[0].files : [];
  });
  return items;
}

/* ---------- What the client app receives: one item per post or story set ---------- */
var APP_STATUS = { production: 'prod', review: 'review', changes: 'changes', approved: 'ok', scheduled: 'ok', live: 'live' };
var APP_FMT = { carousel: 'Carousel', reel: 'Reel', trial: 'Reel', photo: 'Image', story: 'Story', post: 'Image' };

function to24(t) {
  var m = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i.exec(clean(t)); if (!m) return '';
  var h = +m[1], mi = m[2] || '00', ap = (m[3] || '').toLowerCase();
  if (ap === 'pm' && h < 12) h += 12; if (ap === 'am' && h === 12) h = 0;
  return ('0' + h).slice(-2) + ':' + mi;
}

/* feedback: rows of the "Client feedback" tab already filtered to this item, oldest first:
   {when, who, decision ('Approved'|'Rework'|'Reopened'), option, change, comment} */
function toClientItem(it, feedback) {
  var st = APP_STATUS[it.clientStatus] || 'prod', c = it.copy, fb = feedback || [];
  var out = {
    id: it.id, tab: it.tab, cols: it.cols, title: it.title, dateLabel: it.dateLabel,
    d: it.year + '-' + ('0' + it.month).slice(-2) + '-' + ('0' + it.day).slice(-2),
    time: to24(it.time), t: it.title, pil: it.pillar,
    plats: it.kind === 'story' ? ['ig'] : it.platforms.filter(function (p) { return p !== 'story'; }),
    kind: it.kind === 'story' ? 'story' : 'feed', fmt: APP_FMT[it.kind] || 'Image', trial: it.kind === 'trial',
    st: st, visuals: it.visuals || [],
    comments: fb.filter(function (f) { return f.comment || f.decision === 'Rework'; }).map(function (f) { return { who: f.who, when: f.when, text: f.comment || '', change: f.change || '' }; })
  };
  if (st === 'changes') { var last = fb.filter(function (f) { return f.decision === 'Rework'; }).pop(); out.change = last && last.change || 'copy'; }
  if (c && st !== 'prod') {
    if (c.options.length) out.opts = c.options.map(function (o) { return o.text; });
    var picked = fb.filter(function (f) { return f.option; }).pop();
    out.pick = out.opts ? (out.opts.length === 1 ? 0 : picked ? Math.min(+picked.option - 1, out.opts.length - 1) : null) : null;
    if (out.opts && out.pick != null) out.cap = out.opts[out.pick];
    if (it.kind === 'story') out.frames = c.slides.map(function (s) { return s.text; });
    else if (c.slides.length) out.slides = c.slides.map(function (s) { return s.text; });
    if (c.onVideo) out.scr = c.onVideo.split('\n').filter(Boolean);
    if (c.hashtags) out.tags = c.hashtags;
    if (c.notes.length) out.notes = c.notes;
  }
  return out;
}

/* Live posts: rows of the "Live posts" tab, filled from Metricool (date, network, type, link).
   A feed post or reel published on the date of a calendar item becomes "live" with its link.
   Matching is by date, so it keeps working when columns move in the month tab. */
function attachLive(items, rows) {
  var byDate = {};
  (rows || []).forEach(function (r) {
    var d = String(r.date || '').slice(0, 10), link = String(r.link || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !/^https:\/\//.test(link) || /story/i.test(r.type || '')) return;
    (byDate[d] = byDate[d] || []).push({ net: String(r.network || 'instagram').toLowerCase(), reel: /reel|video/i.test(r.type || ''), link: link, used: false });
  });
  items.forEach(function (c) {
    if (c.kind === 'story') return;
    var L = (byDate[c.d] || []).filter(function (x) { return !x.used && x.net === 'instagram'; });
    if (!L.length) return;
    var want = c.fmt === 'Reel', hit = L.filter(function (x) { return x.reel === want; })[0] || L[0];
    hit.used = true; c.link = hit.link;
    if (c.st !== 'review' && c.st !== 'changes') c.st = 'live';
  });
  return items;
}

if (typeof module !== 'undefined') module.exports = { attachLive: attachLive, toClientItem: toClientItem, parseTab: parseTab, parseCopy: parseCopy, matchVisuals: matchVisuals, folderDay: folderDay, tabInfo: tabInfo, CLIENT_STATUS: CLIENT_STATUS };
