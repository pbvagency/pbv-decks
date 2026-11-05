// Velvet Pages Substack figures, read from Substack's own dashboard API while signed in.
// Run it with the Chrome javascript tool on https://velvetpagesmag.substack.com/publish/home
// Paste the whole file, then call:   await vpSubstack(2026, '2026-10-31')
// (year of the dashboard, last day of the data). It stores the result in window.__vpsub and returns its length.
// Read it back in slices, since tool output is cut around 1,500 characters:
//   window.__vpsub.slice(0, 1400)   then   window.__vpsub.slice(1400, 2800)   and so on.
// Result: {"subscribersEnd":{"YYYY-12 of previous year":n, "YYYY-MM":n...}, "followersEnd":{...}, "views":{"YYYY-MM":n},
//          "posts":[[title, date, views, delivered, opened, openRate, likes, comments, signups, shares], ...]}
// Merge it into substack.json: keep each existing post's "topic", give new posts a topic from
// Fashion criticism / Culture & nostalgia essays / Exhibitions / Visual stories / Food / Edits & newsletters.
async function vpSubstack(year, through) {
  const day = 86400000, today = new Date(), end = new Date(through + 'T23:59:59');
  const monthEnds = [new Date(year - 1, 11, 31)];
  for (let m = 0; m < 12; m++) { const d = new Date(year, m + 1, 0); if (d <= end) monthEnds.push(d); }
  const key = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  const utc = d => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  if (utc(monthEnds[monthEnds.length - 1]) < utc(end)) monthEnds.push(end); // partial month
  const range = d => Math.max(1, Math.round((utc(today) - utc(d)) / day)); // whole calendar days back to the end of that day
  const subs = {}, viewsSince = {};
  for (const d of monthEnds) {
    const j = await (await fetch('/api/v1/publish-dashboard/summary-v2?range=' + range(d))).json();
    subs[key(d)] = j.totalSubscribersStart; viewsSince[key(d)] = j.totalViewsEnd;
  }
  const views = {};
  for (let i = 1; i < monthEnds.length; i++) views[key(monthEnds[i])] = viewsSince[key(monthEnds[i - 1])] - viewsSince[key(monthEnds[i])];
  const f = Object.values(await (await fetch('/api/v1/publication/stats/followers/timeseries?from=' + (year - 1) + '-12-30T00:00:00.000Z')).json());
  const followers = {};
  f.forEach(r => { const k = String(r[0]).slice(0, 7).replace('/', '-'); const dt = new Date(String(r[0]).replace(/\//g, '-') + 'T12:00:00'); if (dt <= end) followers[k] = r[1]; });
  const posts = [];
  for (let off = 0; off < 500; off += 50) {
    const p = await (await fetch(`/api/v1/post_management/published?offset=${off}&limit=50&order_by=post_date&order_direction=desc`)).json();
    const arr = p.posts || p; if (!arr.length) break;
    arr.forEach(x => posts.push([x.title, (x.post_date || '').slice(0, 10), x.stats.views, x.stats.delivered, x.stats.opened,
      Math.round((x.stats.open_rate || 0) * 1000) / 10, x.reaction_count || 0, x.comment_count || 0, x.stats.signups || 0, x.stats.shares || 0]));
    if (arr.length < 50) break;
  }
  window.__vpsub = JSON.stringify({ subscribersEnd: subs, followersEnd: followers, views, posts });
  return window.__vpsub.length;
}
