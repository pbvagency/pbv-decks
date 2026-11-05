(function (D) {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const M = D.months;
  const MS = Object.fromEntries(M.map(m => [m, D.monthLabels[m].slice(0, 3)]));
  const Y = D.year, PREV = (Y - 1) + '-12';
  const PARTIAL = D.partial ? D.partial.month : null;
  const PDAYS = D.partial ? D.partial.days : 0;
  const FULL = M.filter(m => m !== PARTIAL).length || 1;
  const longDate = s => new Date(s + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const PDF = !!window.__VP_PDF;
  const fmt = v => v == null ? '–' : Math.round(v).toLocaleString('en-US');
  const pct = (v, d = 1) => v == null ? '–' : v.toFixed(d) + '%';
  const short = v => v >= 10000 ? (v / 1000).toFixed(v >= 100000 ? 0 : 1).replace(/\.0$/, '') + 'K' : fmt(v);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const state = { platform: 'ig', period: 'ytd', trend: 'views', exTopic: 'all', exFormat: 'all', exVerdict: 'all', exSort: 'date', exShow: 12 };
  try { const s = JSON.parse(sessionStorage.getItem('vp-dash-state') || '{}'); Object.assign(state, s); } catch (e) {}
  if (window.__VP_STATE) Object.assign(state, window.__VP_STATE);
  if (state.period !== 'ytd' && !M.includes(state.period)) state.period = 'ytd';
  if (PDF && state.period !== 'ytd') state.exShow = 200;
  const save = () => { try { sessionStorage.setItem('vp-dash-state', JSON.stringify({ platform: state.platform, period: state.period })); } catch (e) {} };

  // ---------- tooltip ----------
  const tip = document.createElement('div'); tip.className = 'tip'; document.body.appendChild(tip);
  const showTip = (e, html) => { tip.innerHTML = html; tip.classList.add('on'); moveTip(e); };
  const moveTip = e => { const x = e.clientX, y = e.clientY, w = tip.offsetWidth; tip.style.left = Math.min(window.innerWidth - w - 12, Math.max(12, x - w / 2)) + 'px'; tip.style.top = (y - tip.offsetHeight - 14) + 'px'; };
  const hideTip = () => tip.classList.remove('on');
  const bindTip = (el, html) => { el.addEventListener('mouseenter', e => showTip(e, html)); el.addEventListener('mousemove', moveTip); el.addEventListener('mouseleave', hideTip); };

  // ---------- count up ----------
  function countUp(el, to, f) {
    const from = +el.dataset.v || 0; el.dataset.v = to;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || from === to) { el.textContent = f(to); return; }
    const t0 = performance.now(), dur = 900;
    const step = t => { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); el.textContent = f(from + (to - from) * e); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }

  // ---------- period helpers ----------
  const periodMonths = () => state.period === 'ytd' ? M : [state.period];
  const label = p => p === 'ytd' ? 'Year to date ' + Y : D.monthLabels[p] + ' ' + Y;
  const prevMonth = p => { const i = M.indexOf(p); return i > 0 ? M[i - 1] : null; };
  const sumIg = (k, ms) => ms.reduce((a, m) => a + D.ig[m][k], 0);
  const postsIn = ms => D.posts.filter(p => ms.includes(p.month));
  const erOf = ps => { const r = ps.reduce((a, p) => a + p.reach, 0); return r ? ps.reduce((a, p) => a + p.interactions, 0) / r * 100 : null; };

  // ---------- layout ----------
  const app = $('#app');
  app.innerHTML = `
  <header class="mast"><span>Velvet Pages &middot; Performance</span><span>Data to ${longDate(D.dataThrough)} &middot; Prepared by PBV Agency</span></header>
  <section class="hero">
    <p class="kicker" id="heroKicker"></p>
    <h1 id="heroTitle"></h1>
    <p class="standfirst" id="heroLede"></p>
  </section>
  <nav class="controls" id="controls">
    <div class="tabs" role="tablist">
      <button role="tab" data-p="ig">Instagram</button>
      <button role="tab" data-p="sub">Substack</button>
      <button role="tab" data-p="tt">TikTok</button>
    </div>
    <div class="periods">
      <button class="arrow" id="prevP" aria-label="Previous month">&#8592;</button>
      <div class="pills" id="pills"></div>
      <button class="arrow" id="nextP" aria-label="Next month">&#8594;</button>
    </div>
  </nav>
  <main id="views"></main>
  <footer class="foot"><span>Velvet Pages &middot; Performance dashboard</span><span>Sources: Meta Business Suite exports, Metricool, Substack</span></footer>`;

  const pills = $('#pills');
  pills.innerHTML = `<button data-m="ytd">YTD</button>` + M.map(m => `<button data-m="${m}">${MS[m]}${m === PARTIAL ? '<sup>*</sup>' : ''}</button>`).join('');
  pills.addEventListener('click', e => { const b = e.target.closest('button'); if (b) setPeriod(b.dataset.m); });
  $('#prevP').onclick = () => { const i = M.indexOf(state.period); setPeriod(state.period === 'ytd' ? M[M.length - 1] : (i > 0 ? M[i - 1] : 'ytd')); };
  $('#nextP').onclick = () => { const i = M.indexOf(state.period); setPeriod(state.period === 'ytd' ? M[0] : (i < M.length - 1 ? M[i + 1] : 'ytd')); };
  $$('.tabs button').forEach(b => b.onclick = () => { state.platform = b.dataset.p; save(); render(true); });
  document.addEventListener('keydown', e => { if (e.target.matches('input,select,textarea')) return; if (e.key === 'ArrowLeft') $('#prevP').click(); if (e.key === 'ArrowRight') $('#nextP').click(); });

  function setPeriod(p) { state.period = p; state.exShow = 12; save(); render(false); }

  // ---------- generic charts ----------
  // vertical bars, single series, selected month highlighted; click selects month
  function vbars(el, items, opt = {}) {
    // items: [{key,label,value,tip,muted}]
    const max = Math.max(...items.map(i => i.value), 1) * 1.12;
    el.classList.add('vbars');
    if (!el.dataset.built || el.children.length !== items.length) {
      el.innerHTML = items.map(i => `<button class="vb" data-k="${i.key}"><span class="vb-val"></span><span class="vb-col"><span class="vb-bar"></span></span><span class="vb-lab">${i.label}</span></button>`).join('');
      el.dataset.built = 1;
      $$('.vb', el).forEach((b, ix) => {
        b.addEventListener('mouseenter', e => showTip(e, b._tip)); b.addEventListener('mousemove', moveTip); b.addEventListener('mouseleave', hideTip);
        if (opt.onClick) b.addEventListener('click', () => opt.onClick(b.dataset.k));
      });
    }
    $$('.vb', el).forEach((b, ix) => {
      const i = items[ix];
      b._tip = i.tip;
      const bar = $('.vb-bar', b);
      requestAnimationFrame(() => { bar.style.height = (i.value / max * 100) + '%'; });
      b.classList.toggle('sel', !!i.sel); b.classList.toggle('muted', !!i.muted);
      $('.vb-val', b).textContent = i.show ? i.show : '';
      b.setAttribute('aria-label', `${i.label}: ${i.tipText || ''}`);
    });
  }
  // horizontal bars (div based)
  function hbars(el, rows, opt = {}) {
    const max = opt.max || Math.max(...rows.map(r => r.value), 1);
    el.innerHTML = rows.map(r => `<div class="hb${r.sel ? ' sel' : ''}"><span class="hb-lab">${r.label}</span><span class="hb-track"><span class="hb-bar" style="width:0" data-w="${r.value / max * 100}"></span></span><span class="hb-val">${r.show}</span></div>`).join('');
    requestAnimationFrame(() => requestAnimationFrame(() => $$('.hb-bar', el).forEach(b => b.style.width = b.dataset.w + '%')));
    $$('.hb', el).forEach((h, i) => rows[i].tip && bindTip(h, rows[i].tip));
  }
  // line chart, up to 2 series, direct labelled, same scale
  function lines(el, labels, series, opt = {}) {
    const W = 640, H = 250, pl = 36, pr = 100, pt = 26, pb = 28;
    const all = series.flatMap(s => s.values);
    const lo = Math.floor(Math.min(...all) / 20) * 20, hi = Math.ceil(Math.max(...all) * 1.08 / 20) * 20;
    const x = i => pl + i * (W - pl - pr) / (labels.length - 1);
    const y = v => pt + (1 - (v - lo) / (hi - lo)) * (H - pt - pb);
    const ticks = []; for (let v = lo; v <= hi; v += (hi - lo) / 4) ticks.push(Math.round(v));
    let svg = `<svg viewBox="0 0 ${W} ${H}" class="lc" role="img" aria-label="${esc(opt.aria || '')}">`;
    svg += ticks.map(t => `<line x1="${pl}" x2="${W - pr}" y1="${y(t)}" y2="${y(t)}" class="grid"/><text x="${pl - 8}" y="${y(t) + 4}" class="axl" text-anchor="end">${t}</text>`).join('');
    svg += labels.map((l, i) => `<text x="${x(i)}" y="${H - 8}" class="axl" text-anchor="middle">${l}</text>`).join('');
    series.forEach((s, si) => {
      const d = s.values.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join(' ');
      svg += `<path d="${d}" class="ln" style="stroke:${s.color}" ${s.dash ? 'stroke-dasharray="6 5"' : ''} pathLength="1"/>`;
      const li = s.values.length - 1;
      svg += `<circle cx="${x(li)}" cy="${y(s.values[li])}" r="4.5" fill="${s.color}" stroke="var(--ground)" stroke-width="2"/>`;
      svg += `<text x="${x(li) + 10}" y="${y(s.values[li]) + 4 + (si ? 10 : -4)}" class="dl">${s.name} ${s.values[li]}</text>`;
    });
    svg += `<line class="xh" x1="0" x2="0" y1="${pt}" y2="${H - pb}" style="opacity:0"/>`;
    labels.forEach((l, i) => { svg += `<rect class="hit" data-i="${i}" x="${x(i) - (W - pl - pr) / (labels.length - 1) / 2}" y="${pt}" width="${(W - pl - pr) / (labels.length - 1)}" height="${H - pt - pb}" fill="transparent"/>`; });
    svg += '</svg>';
    el.innerHTML = svg;
    const xh = $('.xh', el);
    $$('.hit', el).forEach(r => {
      const i = +r.dataset.i;
      const html = `<b>${opt.tipLabels ? opt.tipLabels[i] : labels[i]}</b>` + series.map(s => `<div><i style="background:${s.color}"></i>${s.name}: ${fmt(s.values[i])}</div>`).join('');
      r.addEventListener('mouseenter', e => { xh.setAttribute('x1', x(i)); xh.setAttribute('x2', x(i)); xh.style.opacity = 1; showTip(e, html); });
      r.addEventListener('mousemove', moveTip);
      r.addEventListener('mouseleave', () => { xh.style.opacity = 0; hideTip(); });
    });
  }

  // ---------- reveal on scroll ----------
  const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .08 }) : null;
  const reveal = root => $$('.rv', root).forEach(el => io ? io.observe(el) : el.classList.add('in'));

  // ---------- insight block ----------
  function insightBlock(src) {
    const i = src[state.period] || src.ytd;
    return `<div class="insights rv">
      <div class="ins-col ins-good"><h4>What worked</h4><ul>${i.worked.map(t => `<li>${t}</li>`).join('')}</ul></div>
      <div class="ins-col ins-bad"><h4>What didn't</h4><ul>${i.didnt.map(t => `<li>${t}</li>`).join('')}</ul></div>
      <div class="ins-col ins-trend"><h4>${state.period === 'ytd' ? 'Trends this year' : 'The pattern'}</h4><ul>${i.trend.map(t => `<li>${t}</li>`).join('')}</ul></div>
    </div>`;
  }

  // ---------- KPI ----------
  function kpi(id, labelTxt, value, f, sub, delta) {
    let d = '';
    if (delta != null && isFinite(delta)) { const up = delta >= 0; d = `<span class="delta ${up ? 'up' : 'down'}">${up ? '&#9650;' : '&#9660;'} ${Math.abs(delta).toFixed(0)}%</span>`; }
    return `<div class="kpi rv"><span class="kpi-l">${labelTxt}</span><span class="kpi-v" id="${id}" data-to="${value}" data-f="${f}">0</span><span class="kpi-s">${d}${sub || ''}</span></div>`;
  }
  const F = { n: fmt, p: v => pct(v), s: short };
  function runCounts(root) { $$('.kpi-v', root).forEach(el => { const prev = window.__kv && window.__kv[el.id]; if (prev != null) el.dataset.v = prev; countUp(el, +el.dataset.to, F[el.dataset.f]); (window.__kv = window.__kv || {})[el.id] = +el.dataset.to; }); }
  const deltaOf = (k, getter) => { if (state.period === 'ytd' || state.period === PARTIAL) return null; const pm = prevMonth(state.period); if (!pm) return null; const a = getter(state.period), b = getter(pm); return b ? (a - b) / b * 100 : null; };

  // =============== INSTAGRAM =================
  function renderIG(root) {
    const ms = periodMonths(), ytd = state.period === 'ytd';
    const ps = postsIn(ms), own = ps.filter(p => !p.collab);
    const g = k => sumIg(k, ms);
    const er = erOf(ps);
    const vsTxt = ytd ? 'per month on average' : (prevMonth(state.period) ? 'vs ' + D.monthLabels[prevMonth(state.period)] : '');
    const avgTxt = (k) => ytd ? `${short(sumIg(k, M.filter(m => m !== PARTIAL)) / FULL)} a month on average` : vsTxt;
    const st = g('stories');
    root.innerHTML = `
    <section class="sec">
      <div class="kpis">
        ${kpi('k-fol', 'New followers', g('follows'), 'n', ytd ? `${fmt(D.followersNow)} followers today` : `${vsTxt} &middot; ${fmt(D.followersNow)} today`, deltaOf('f', m => D.ig[m].follows))}
        ${kpi('k-views', 'Views', g('views'), 's', avgTxt('views'), deltaOf('v', m => D.ig[m].views))}
        ${kpi('k-reach', 'Reach', g('reach'), 's', ytd ? 'accounts, summed daily' : vsTxt, deltaOf('r', m => D.ig[m].reach))}
        ${kpi('k-story', 'Story reach', g('storyReach'), 's', `${fmt(st)} stories &middot; ${fmt(st ? g('storyReach') / st : 0)} each`, deltaOf('s', m => D.ig[m].storyReach))}
        ${kpi('k-er', 'Engagement rate', er || 0, 'p', `on ${ps.length} posts &middot; interactions / reach`, null)}
        ${kpi('k-pv', 'Profile visits', g('profileVisits'), 'n', avgTxt('profileVisits'), deltaOf('pv', m => D.ig[m].profileVisits))}
      </div>
      ${insightBlock(INSIGHTS.ig)}
    </section>

    <section class="sec rv">
      <div class="sec-head"><span class="kicker">Month by month</span><h2>The trend</h2><p class="note">Click a month to open it. ${ytd ? '' : 'The selected month is highlighted.'}</p></div>
      <div class="metric-pills" id="trendPills">
        ${[['views', 'Views'], ['reach', 'Reach'], ['follows', 'New followers'], ['profileVisits', 'Profile visits'], ['storyReach', 'Story reach'], ['er', 'Engagement rate'], ['posts', 'Posts']].map(([k, l]) => `<button data-k="${k}" class="${state.trend === k ? 'on' : ''}">${l}</button>`).join('')}
      </div>
      <div id="trendChart" class="chart-box"></div>
      <p class="note" id="trendNote"></p>
    </section>

    <section class="sec rv">
      <div class="sec-head"><span class="kicker">Engagement totals</span><h2>How people engaged</h2><p class="note">Totals for posts published ${ytd ? 'this year' : 'in ' + D.monthLabels[state.period]}, lifetime numbers.</p></div>
      <div class="eng" id="eng"></div>
    </section>

    <section class="sec rv">
      <div class="sec-head"><span class="kicker">Stories</span><h2>Story performance</h2><p class="note">Average reach per story by month: fewer, better stories are paying off.</p></div>
      <div class="split">
        <div class="mini-kpis" id="storyKpis"></div>
        <div id="storyChart" class="chart-box small"></div>
      </div>
    </section>

    <section class="sec rv">
      <div class="sec-head"><span class="kicker">Post ranking</span><h2>Best and weakest posts</h2><p class="note">Ranked on a performance score: reach and engagement rate, each compared with the year's median post (${fmt(D.medReach)} reach, ${pct(D.medER)} engagement). Partner collabs are excluded from the ranking.</p></div>
      <div class="rank">
        <div><h3 class="rank-h good">Top 3</h3><div id="topPosts" class="cards"></div></div>
        <div><h3 class="rank-h bad">Lowest 3</h3><div id="lowPosts" class="cards"></div></div>
      </div>
    </section>

    <section class="sec rv">
      <div class="sec-head"><span class="kicker">Content analysis</span><h2>What topics work</h2><p class="note">Every post is tagged with one editorial topic. Average reach per post, engagement rate and follows gained, ${ytd ? 'year to date' : 'for ' + D.monthLabels[state.period]}.</p></div>
      <div id="topics" class="topics"></div>
      <div class="split two">
        <div><h3 class="h3">By format</h3><div id="formats"></div></div>
        <div><h3 class="h3">By day of the week</h3><div id="days"></div></div>
      </div>
    </section>

    <section class="sec rv">
      <div class="sec-head"><span class="kicker">Community</span><h2>Who follows Velvet Pages</h2><p class="note">Follower snapshot from Meta, ${esc(D.audience.date || '')}.</p></div>
      <div class="community">
        <div><h3 class="h3">Top countries</h3><div id="countries"></div></div>
        <div><h3 class="h3">Top cities</h3><div id="cities"></div></div>
        <div><h3 class="h3">Age and gender</h3><div class="gender"><div><span class="g-v">${D.audience.women}%</span><span class="g-l">women</span></div><div><span class="g-v">${D.audience.men}%</span><span class="g-l">men</span></div></div><div id="pyramid"></div></div>
      </div>
    </section>

    <section class="sec rv" id="explorer">
      <div class="sec-head"><span class="kicker">Post by post</span><h2>Did it work?</h2><p class="note"><b class="vd Strong">Strong</b> beats the median clearly (score 1.3+), <b class="vd Steady">Steady</b> is in line, <b class="vd Weak">Weak</b> falls well short (under 0.75). Showing ${ytd ? 'the whole year' : D.monthLabels[state.period]}.</p></div>
      <div class="filters">
        <label>Topic<select id="fTopic"><option value="all">All topics</option>${Object.entries(D.topics).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
        <label>Format<select id="fFormat"><option value="all">All formats</option><option>Carousel</option><option>Image</option><option>Reel</option></select></label>
        <label>Verdict<select id="fVerdict"><option value="all">All</option><option>Strong</option><option>Steady</option><option>Weak</option></select></label>
        <label>Sort by<select id="fSort"><option value="date">Newest</option><option value="score">Score</option><option value="reach">Reach</option><option value="er">Engagement rate</option><option value="saves">Saves</option><option value="follows">Follows</option></select></label>
      </div>
      <div id="postList" class="plist"></div>
      <button id="more" class="more">Show more</button>
    </section>`;

    runCounts(root);
    // trend
    const drawTrend = () => {
      const k = state.trend;
      const val = m => k === 'er' ? (erOf(postsIn([m])) || 0) : D.ig[m][k];
      const f = k === 'er' ? (v => pct(v)) : fmt;
      vbars($('#trendChart'), M.map(m => ({ key: m, label: MS[m] + (m === PARTIAL ? '*' : ''), value: val(m), sel: m === state.period, muted: m === PARTIAL, show: k === 'er' ? pct(val(m)) : short(val(m)), tip: `<b>${D.monthLabels[m]}${m === PARTIAL ? ` (${PDAYS} days)` : ''}</b><div>${f(val(m))}</div>`, tipText: f(val(m)) })), { onClick: m => setPeriod(m) });
      const notes = { reach: 'Reach is summed per day, so someone seen on several days counts more than once.', storyReach: 'Story reach adds up the reach of each story.', er: 'Engagement rate = likes, comments, saves and shares divided by reach, for posts published that month.', follows: 'New followers is gross follows per day as reported by Meta, before unfollows.' };
      $('#trendNote').textContent = (notes[k] || '') + (PARTIAL ? ` * ${D.monthLabels[PARTIAL]} covers ${PDAYS} day${PDAYS === 1 ? '' : 's'} so far.` : '');
    };
    $('#trendPills').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; state.trend = b.dataset.k; $$('#trendPills button').forEach(x => x.classList.toggle('on', x === b)); drawTrend(); });
    drawTrend();

    // engagement tiles with spark bars
    $('#eng').innerHTML = [['likes', 'Likes'], ['comments', 'Comments'], ['saves', 'Saves'], ['shares', 'Shares']].map(([k, l]) => `
      <div class="eng-t"><span class="kpi-l">${l}</span><span class="kpi-v" id="e-${k}" data-to="${g(k)}" data-f="n">0</span><div class="spark" id="sp-${k}"></div></div>`).join('');
    runCounts($('#eng'));
    ['likes', 'comments', 'saves', 'shares'].forEach(k => vbars($('#sp-' + k), M.filter(m => m !== PARTIAL).map(m => ({ key: m, label: MS[m][0], value: D.ig[m][k], sel: m === state.period, tip: `<b>${D.monthLabels[m]}</b><div>${fmt(D.ig[m][k])} ${k}</div>` })), { onClick: m => setPeriod(m) }));

    // stories
    const sk = [['Stories', g('stories')], ['Avg reach', st ? g('storyReach') / st : 0], ['Replies', g('storyReplies')], ['Profile visits', g('storyProfileVisits')], ['Link clicks', g('storyLinkClicks')], ['Story views', g('storyViews')]];
    $('#storyKpis').innerHTML = sk.map(([l, v], i) => `<div class="mk"><span class="kpi-l">${l}</span><span class="kpi-v sm" id="sk${i}" data-to="${v}" data-f="n">0</span></div>`).join('');
    runCounts($('#storyKpis'));
    vbars($('#storyChart'), M.map(m => { const v = D.ig[m].stories ? D.ig[m].storyReach / D.ig[m].stories : 0; return { key: m, label: MS[m] + (m === PARTIAL ? '*' : ''), value: v, sel: m === state.period, muted: m === PARTIAL, show: fmt(v), tip: `<b>${D.monthLabels[m]}</b><div>${fmt(v)} avg reach per story</div><div>${D.ig[m].stories} stories</div>` }; }), { onClick: m => setPeriod(m) });

    // ranking
    const ranked = own.slice().sort((a, b) => b.score - a.score);
    const card = p => `<a class="pc rv" href="${p.url}" target="_blank" rel="noopener">
      <span class="pc-top"><span class="chip">${esc(D.topics[p.topic])}</span><span class="vd ${p.verdict}">${p.verdict}</span></span>
      <span class="pc-t">${esc(p.title)}</span>
      <span class="pc-m"><span><b>${fmt(p.reach)}</b> reach</span><span><b>${pct(p.er)}</b> eng.</span><span><b>${fmt(p.saves)}</b> saves</span><span><b>${fmt(p.follows)}</b> follows</span></span>
      <span class="pc-d">${new Date(p.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} &middot; ${p.format} &middot; score ${p.score.toFixed(2)} &#8599;</span></a>`;
    $('#topPosts').innerHTML = ranked.length ? ranked.slice(0, 3).map(card).join('') : '<p class="empty">No posts published yet in this period.</p>';
    $('#lowPosts').innerHTML = ranked.length ? ranked.slice(-3).reverse().map(card).join('') : '<p class="empty">No posts published yet in this period.</p>';

    // topics
    const tstats = Object.entries(D.topics).filter(([k]) => k !== 'PRESS').map(([k, name]) => {
      const tp = own.filter(p => p.topic === k); if (!tp.length) return null;
      const r = tp.reduce((a, p) => a + p.reach, 0), it = tp.reduce((a, p) => a + p.interactions, 0);
      const avgR = r / tp.length, e = it / r * 100;
      const sc = 0.5 * avgR / D.medReach + 0.5 * e / D.medER;
      return { k, name, n: tp.length, avgR, e, fol: tp.reduce((a, p) => a + p.follows, 0), saves: tp.reduce((a, p) => a + p.saves, 0) / tp.length, sc, strong: tp.filter(p => p.verdict === 'Strong').length };
    }).filter(Boolean).sort((a, b) => b.sc - a.sc);
    const maxR = Math.max(...tstats.map(t => t.avgR), 1);
    const call = t => t.sc >= 1.3 ? ['Scale up', 'Strong'] : t.sc >= 0.9 ? ['Keep', 'Steady'] : ['Rethink', 'Weak'];
    $('#topics').innerHTML = tstats.length ? `<div class="t-row t-head"><span>Topic</span><span>Avg reach per post</span><span>Eng.</span><span>Follows</span><span>Posts</span><span>Call</span></div>` + tstats.map(t => `
      <div class="t-row" data-k="${t.k}"><span class="t-name">${t.name}</span><span class="t-bar"><span class="hb-track"><span class="hb-bar" data-w="${t.avgR / maxR * 100}" style="width:0"></span></span><b>${fmt(t.avgR)}</b></span><span>${pct(t.e)}</span><span>${t.fol}</span><span>${t.n}</span><span><span class="vd ${call(t)[1]}">${call(t)[0]}</span></span></div>`).join('') : '<p class="empty">No posts published yet in this period.</p>';
    requestAnimationFrame(() => requestAnimationFrame(() => $$('#topics .hb-bar').forEach(b => b.style.width = b.dataset.w + '%')));
    $$('#topics .t-row[data-k]').forEach(r => { r.onclick = () => { state.exTopic = r.dataset.k; $('#fTopic').value = r.dataset.k; drawList(); $('#explorer').scrollIntoView({ behavior: 'smooth' }); }; const t = tstats.find(x => x.k === r.dataset.k); bindTip(r, `<b>${t.name}</b><div>${t.n} posts, ${t.strong} strong</div><div>${t.saves.toFixed(1)} saves per post</div><div>Click to see the posts</div>`); });

    // formats & days
    const grp = (keyf, keys) => keys.map(k => { const tp = own.filter(p => keyf(p) === k); const r = tp.reduce((a, p) => a + p.reach, 0); return { k, n: tp.length, avgR: tp.length ? r / tp.length : 0, e: r ? tp.reduce((a, p) => a + p.interactions, 0) / r * 100 : 0 }; });
    const fm = grp(p => p.format, ['Carousel', 'Image', 'Reel']);
    hbars($('#formats'), fm.map(f => ({ label: `${f.k} <em>${f.n}</em>`, value: f.avgR, show: `${fmt(f.avgR)} <em>${pct(f.e)}</em>`, tip: `<b>${f.k}</b><div>${f.n} posts</div><div>${fmt(f.avgR)} avg reach, ${pct(f.e)} engagement</div>` })));
    const dy = grp(p => p.dow, ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
    const bestDay = dy.reduce((a, b) => b.avgR > a.avgR ? b : a, dy[0]);
    hbars($('#days'), dy.map(d => ({ label: `${d.k} <em>${d.n}</em>`, value: d.avgR, sel: d === bestDay && d.n > 0, show: `${fmt(d.avgR)} <em>${pct(d.e)}</em>`, tip: `<b>${d.k}</b><div>${d.n} posts</div><div>${fmt(d.avgR)} avg reach, ${pct(d.e)} engagement</div>` })));

    // community
    const A = D.audience;
    hbars($('#countries'), A.countries.map(c => ({ label: c[0], value: c[1], show: c[1] + '%', sel: c === A.countries[0] })));
    hbars($('#cities'), A.cities.map(c => ({ label: c[0], value: c[1], show: c[1] + '%', sel: c === A.cities[0] })));
    const pm = Math.max(...A.age.map(a => a[1]));
    $('#pyramid').innerHTML = `<div class="pyr-leg"><span><i class="sw w"></i>Women</span><span><i class="sw m"></i>Men</span></div>` + A.age.map(a => `<div class="pyr"><span class="pyr-l"><span class="pyr-v">${a[1]}%</span><span class="pyr-b w" data-w="${a[1] / pm * 100}"></span></span><span class="pyr-age">${a[0]}</span><span class="pyr-r"><span class="pyr-b m" data-w="${a[2] / pm * 100}"></span><span class="pyr-v">${a[2]}%</span></span></div>`).join('');
    requestAnimationFrame(() => requestAnimationFrame(() => $$('#pyramid .pyr-b').forEach(b => b.style.width = b.dataset.w + '%')));

    // explorer
    $('#fTopic').value = state.exTopic; $('#fFormat').value = state.exFormat; $('#fVerdict').value = state.exVerdict; $('#fSort').value = state.exSort;
    const drawList = () => {
      let list = ps.filter(p => (state.exTopic === 'all' || p.topic === state.exTopic) && (state.exFormat === 'all' || p.format === state.exFormat) && (state.exVerdict === 'all' || p.verdict === state.exVerdict));
      const s = state.exSort;
      list.sort((a, b) => s === 'date' ? (b.date + b.time).localeCompare(a.date + a.time) : b[s] - a[s]);
      const shown = list.slice(0, state.exShow);
      $('#postList').innerHTML = list.length ? `<div class="pl-row pl-head"><span>Date</span><span>Post</span><span>Reach</span><span>Eng.</span><span>Likes</span><span>Saves</span><span>Shares</span><span>Follows</span><span>Verdict</span></div>` + shown.map(p => `
        <details class="pl-row">
          <summary><span class="pl-date">${new Date(p.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
          <span class="pl-post"><span class="chip">${esc(D.topics[p.topic])}</span>${p.collab ? '<span class="chip ghost">Collab</span>' : ''}<span class="pl-t">${esc(p.title)}</span></span>
          <span data-l="Reach">${fmt(p.reach)}</span><span data-l="Eng.">${pct(p.er)}</span><span data-l="Likes">${fmt(p.likes)}</span><span data-l="Saves">${fmt(p.saves)}</span><span data-l="Shares">${fmt(p.shares)}</span><span data-l="Follows">${fmt(p.follows)}</span>
          <span><span class="vd ${p.verdict}">${p.verdict}</span></span></summary>
          <div class="pl-more"><p>${esc(p.caption).replace(/\n/g, '<br>')}</p>
          <p class="pl-meta">${p.format} &middot; ${p.dow} ${p.time} &middot; ${fmt(p.views)} views &middot; ${fmt(p.comments)} comments &middot; score ${p.score.toFixed(2)}${p.collab ? ' &middot; collab post: reach includes the partner account, saves not reported' : ''} &middot; <a href="${p.url}" target="_blank" rel="noopener">Open on Instagram &#8599;</a></p></div>
        </details>`).join('') : '<p class="empty">No posts match these filters.</p>';
      $('#more').style.display = list.length > state.exShow ? '' : 'none';
      $('#more').textContent = `Show more (${list.length - shown.length} left)`;
    };
    $('#fTopic').onchange = e => { state.exTopic = e.target.value; state.exShow = 12; drawList(); };
    $('#fFormat').onchange = e => { state.exFormat = e.target.value; state.exShow = 12; drawList(); };
    $('#fVerdict').onchange = e => { state.exVerdict = e.target.value; state.exShow = 12; drawList(); };
    $('#fSort').onchange = e => { state.exSort = e.target.value; drawList(); };
    $('#more').onclick = () => { state.exShow += 24; drawList(); };
    drawList();
  }

  // =============== SUBSTACK =================
  function renderSub(root) {
    const S = D.substack, ms = periodMonths(), ytd = state.period === 'ytd';
    const end = S.monthly[ms[ms.length - 1]];
    const startSubs = ytd ? S.subscribersStart : (prevMonth(state.period) ? S.monthly[prevMonth(state.period)].subscribers : S.subscribersStart);
    const startFol = ytd ? S.followersStart : (prevMonth(state.period) ? S.monthly[prevMonth(state.period)].followers : S.followersStart);
    const pubs = S.posts.filter(p => ms.includes(p.date.slice(0, 7)));
    const views = ms.reduce((a, m) => a + S.monthly[m].views, 0);
    const opened = pubs.reduce((a, p) => a + p.opened, 0), deliv = pubs.reduce((a, p) => a + p.delivered, 0);
    const likes = pubs.reduce((a, p) => a + p.likes, 0);
    const dv = (g) => { if (ytd || state.period === PARTIAL) return null; const pm = prevMonth(state.period); if (!pm) return null; const a = g(state.period), b = g(pm); return b ? (a - b) / b * 100 : null; };
    root.innerHTML = `
    <section class="sec">
      <div class="kpis">
        ${kpi('s-subs', 'Subscribers', end.subscribers, 'n', `${end.subscribers - startSubs >= 0 ? '+' : ''}${end.subscribers - startSubs} ${ytd ? 'since 1 January' : 'this month'}`, null)}
        ${kpi('s-fol', 'Substack followers', end.followers, 'n', `+${end.followers - startFol} ${ytd ? 'since 1 January' : 'this month'}`, null)}
        ${kpi('s-views', 'Views', views, 'n', ytd ? `${fmt(M.filter(m => m !== PARTIAL).reduce((a, m) => a + S.monthly[m].views, 0) / FULL)} a month on average` : (prevMonth(state.period) ? 'vs ' + D.monthLabels[prevMonth(state.period)] : ''), dv(m => S.monthly[m].views))}
        ${kpi('s-open', 'Open rate', deliv ? opened / deliv * 100 : 0, 'p', deliv ? `${fmt(opened)} of ${fmt(deliv)} delivered` : 'no publication this period', null)}
        ${kpi('s-likes', 'Likes', likes, 'n', `on ${pubs.length} publication${pubs.length === 1 ? '' : 's'}`, null)}
        ${kpi('s-pubs', 'Publications', pubs.length, 'n', ytd ? Y + ' so far' : '', null)}
      </div>
      ${insightBlock(INSIGHTS.sub)}
    </section>
    <section class="sec rv">
      <div class="sec-head"><span class="kicker">Audience growth</span><h2>Subscribers and followers</h2><p class="note">Month-end totals. Followers follow the Substack profile; subscribers receive the email.</p></div>
      <div id="subLines" class="chart-box"></div>
    </section>
    <section class="sec rv">
      <div class="sec-head"><span class="kicker">Traffic</span><h2>Views by month</h2><p class="note">Months with a publication are marked with a dot. Click a month to open it.</p></div>
      <div id="subViews" class="chart-box"></div>
    </section>
    <section class="sec rv">
      <div class="sec-head"><span class="kicker">Publications</span><h2>Top publications</h2><p class="note">All publications since launch, ${ytd ? Y + ' highlighted' : D.monthLabels[state.period] + ' highlighted'}. Click a column to sort.</p></div>
      <div class="ptable" id="subTable"></div>
    </section>
    <section class="sec rv">
      <div class="split two">
        <div><div class="sec-head"><span class="kicker">Content analysis</span><h2>What subjects work</h2><p class="note">All publications since launch, grouped by subject.</p></div><div id="subTopics"></div></div>
        <div><div class="sec-head"><span class="kicker">Growth sources</span><h2>Where subscribers come from</h2><p class="note">${esc(S.sourcesNote || '')}</p></div><div id="subSources"></div></div>
      </div>
    </section>`;
    runCounts(root);
    const lm = [PREV, ...M];
    lines($('#subLines'), lm.map(m => m === PREV ? 'Dec' : MS[m]), [
      { name: 'Followers', values: lm.map(m => m === PREV ? S.followersStart : S.monthly[m].followers), color: 'var(--c2)', dash: true },
      { name: 'Subscribers', values: lm.map(m => m === PREV ? S.subscribersStart : S.monthly[m].subscribers), color: 'var(--c1)' }
    ], { aria: 'Substack subscribers and followers by month', tipLabels: lm.map(m => m === PREV ? 'End of ' + (Y - 1) : D.monthLabels[m] + (m === PARTIAL ? ` (${PDAYS} days)` : '')) });
    vbars($('#subViews'), M.map(m => { const pb = S.posts.filter(p => p.date.slice(0, 7) === m); return { key: m, label: MS[m] + (m === PARTIAL ? '*' : '') + (pb.length ? ' &bull;' : ''), value: S.monthly[m].views, sel: m === state.period, muted: m === PARTIAL, show: fmt(S.monthly[m].views), tip: `<b>${D.monthLabels[m]}</b><div>${fmt(S.monthly[m].views)} views</div><div>+${S.monthly[m].newSubscribers} subscribers</div>${pb.map(p => `<div>&bull; ${esc(p.title)}</div>`).join('')}` }; }), { onClick: m => setPeriod(m) });
    // table
    let sortK = 'views';
    const drawTable = () => {
      const rows = S.posts.slice().sort((a, b) => sortK === 'date' ? b.date.localeCompare(a.date) : b[sortK] - a[sortK]);
      const maxV = Math.max(...rows.map(r => r.views));
      const cols = [['date', 'Date'], ['title', 'Publication'], ['views', 'Views'], ['openRate', 'Open rate'], ['likes', 'Likes'], ['signups', 'Sign-ups'], ['shares', 'Shares']];
      $('#subTable').innerHTML = `<div class="st-row st-head">${cols.map(([k, l]) => `<button data-k="${k}" class="${sortK === k ? 'on' : ''}" ${k === 'title' ? 'disabled' : ''}>${l}</button>`).join('')}</div>` + rows.map(r => {
        const hl = ytd ? r.date.startsWith(String(Y)) : r.date.slice(0, 7) === state.period;
        return `<div class="st-row${hl ? ' hl' : ''}"><span>${new Date(r.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}</span><span class="st-t">${esc(r.title)}<em>${r.topic}</em></span><span data-l="Views" class="st-v"><span class="st-bar" style="width:${r.views / maxV * 100}%"></span>${r.views}</span><span data-l="Open rate">${pct(r.openRate)}</span><span data-l="Likes">${r.likes}</span><span data-l="Sign-ups">${r.signups}</span><span data-l="Shares">${r.shares}</span></div>`;
      }).join('');
      $$('#subTable .st-head button').forEach(b => b.onclick = () => { sortK = b.dataset.k; drawTable(); });
    };
    drawTable();
    const maxTV = Math.max(...S.topics.map(t => t.avgViews));
    $('#subTopics').innerHTML = `<div class="tt-row tt-head"><span>Subject</span><span>Avg views</span><span>Open rate</span><span>Likes</span></div>` + S.topics.slice().sort((a, b) => b.openRate - a.openRate).map(t => `<div class="tt-row"><span>${t.topic} <em>${t.posts}</em></span><span class="t-bar"><span class="hb-track"><span class="hb-bar" data-w="${t.avgViews / maxTV * 100}" style="width:0"></span></span><b>${t.avgViews}</b></span><span>${pct(t.openRate)}</span><span>${t.avgLikes}</span></div>`).join('');
    requestAnimationFrame(() => requestAnimationFrame(() => $$('#subTopics .hb-bar').forEach(b => b.style.width = b.dataset.w + '%')));
    const srcTot = S.sources.reduce((a, s) => a + s[1], 0) || 1;
    hbars($('#subSources'), S.sources.map(s => ({ label: s[0], value: s[1], show: `${s[1]} <em>${Math.round(s[1] / srcTot * 100)}%</em>`, sel: s[0] === 'Instagram' })));
  }

  // =============== TIKTOK =================
  function renderTT(root) {
    root.innerHTML = `
    <section class="sec">
      <div class="tt-hero rv">
        <span class="kicker">Not active yet</span>
        <h2>TikTok is ready when you are</h2>
        <p>The account is not connected to Metricool yet, so there is no data to show. This page is set up so that the numbers appear in the same layout as Instagram as soon as the channel starts.</p>
      </div>
      <div class="kpis ghosted">
        ${['Followers', 'Views', 'Total view time', 'Engagement rate', 'Avg watch time', 'Profile views'].map(l => `<div class="kpi rv"><span class="kpi-l">${l}</span><span class="kpi-v">&ndash;</span><span class="kpi-s">awaiting data</span></div>`).join('')}
      </div>
      <div class="split two">
        <div class="rv"><h3 class="h3">What we will track</h3><ul class="plain">
          <li><b>Followers</b> and net growth per month</li><li><b>Views</b> and <b>total view time</b></li><li><b>Engagement rate</b>: likes, comments, shares and saves over views</li><li><b>Community insights</b>: country, city, age and gender</li><li><b>Video by video</b> verdicts, using the same scoring as Instagram</li></ul></div>
        <div class="rv"><h3 class="h3">To switch it on</h3><ul class="plain">
          <li>Connect the Velvet Pages TikTok account to the Velvet Pages brand in Metricool</li><li>Post consistently for 4 to 6 weeks to build a baseline</li><li>Start with what already works on Instagram: Girls Who Read portraits and merch moments, filmed for vertical video</li></ul></div>
      </div>
    </section>`;
  }

  // =============== RENDER =================
  function render(platformChanged) {
    const ytd = state.period === 'ytd';
    $$('.tabs button').forEach(b => { b.classList.toggle('on', b.dataset.p === state.platform); b.setAttribute('aria-selected', b.dataset.p === state.platform); });
    $$('#pills button').forEach(b => b.classList.toggle('on', b.dataset.m === state.period));
    $('.periods').style.visibility = state.platform === 'tt' ? 'hidden' : '';
    const plat = { ig: 'Instagram', sub: 'Substack', tt: 'TikTok' }[state.platform];
    $('#heroKicker').textContent = `${plat} · ${state.platform === 'tt' ? 'Coming soon' : label(state.period)}${state.period === PARTIAL && state.platform !== 'tt' ? ` · ${PDAYS} day${PDAYS === 1 ? '' : 's'} of data` : ''}`;
    $('#heroTitle').textContent = state.platform === 'tt' ? 'TikTok' : (ytd ? 'The year so far' : D.monthLabels[state.period]);
    const src = state.platform === 'ig' ? INSIGHTS.ig : state.platform === 'sub' ? INSIGHTS.sub : null;
    $('#heroLede').innerHTML = src ? (src[state.period] || src.ytd).headline : 'Not active yet. The structure is in place for when the channel starts.';
    const v = $('#views');
    const scrollY = window.scrollY;
    v.classList.remove('fade'); void v.offsetWidth; v.classList.add('fade');
    if (state.platform === 'ig') renderIG(v); else if (state.platform === 'sub') renderSub(v); else renderTT(v);
    reveal(v);
    if (!platformChanged) window.scrollTo({ top: scrollY });
    const cur = $('#pills button.on'); if (cur) cur.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }
  render(true);
})(DATA);
