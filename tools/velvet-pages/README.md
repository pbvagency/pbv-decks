# Velvet Pages performance dashboard

Monthly Instagram, Substack (and later TikTok) dashboard for Velvet Pages, published password-protected at
**clients.pbvagency.com/velvet-pages/** (space `velvet-pages`, document `dashboard-2026`), plus a PDF for the team.

The code lives here. The data never does: inputs, insights and outputs live in Pauline's Google Drive,
`03. Velvet Pages/Dashboard/`. Never commit exports, insights, the unencrypted page or the password.

## Files

| Here (tools/velvet-pages) | What it does |
|---|---|
| `build_data.py DATA_DIR OUT_JSON` | Reads the data folder, writes `data.json`. Stops and lists any post without a topic. |
| `assemble.py DATA_JSON INSIGHTS_JS OUT_HTML` | Builds the standalone page (unencrypted, robots noindex first in head). |
| `make_pdf.js DASHBOARD_HTML YYYY-MM OUT_PDF` | A4 PDF: Instagram month, Substack month, Instagram year to date. Run `npm install` here first (brand fonts and pdf-lib). |
| `substack_fetch.js` | Paste into the Chrome javascript tool on the Substack dashboard; returns subscribers, followers, views and publications. |
| `app.js`, `template_head.html` | The page itself (VP brand: ivory, black, magenta, Anton, Inter, Cormorant). |

| In Drive, `03. Velvet Pages/Dashboard/` | |
|---|---|
| `data/meta.json` | `year`, `dataThrough` (last day of data), `followersNow`, `followersDate`, `audienceDate` |
| `data/topics.json` | `{instagram permalink: TOPIC}` for every post. Codes: GWR, ISSUE, MERCH, EVENTS, BOOKS, FILM, FASHION, ART, BRAND, ESSAY, CALL, TEAM, PRESS (PRESS = post published by a partner with Velvet Pages as collaborator) |
| `data/substack.json` | month-end subscribers and followers (from December of the previous year), monthly views, publications with a `topic`, growth sources |
| `data/insights.js` | `const INSIGHTS = {ig: {ytd, "YYYY-MM": {headline, worked[], didnt[], trend[]}}, sub: {...}}` |
| `data/exports/YYYY-MM-DD/` | the Meta exports of that run (see below), named exactly: `posts.csv stories.csv views.csv reach.csv interactions.csv link_clicks.csv profile_visits.csv follows.csv audience.csv` |
| `VP_Performance_Dashboard.html` | latest unencrypted build (Pauline's copy) |
| `PDF/VP_Dashboard_YYYY-MM.pdf` | the monthly PDFs |

## Monthly update (run on the 3rd, covering 1 January to the last day of the previous month)

1. **Meta exports (Meta Business Suite, Velvet Pages account, in Pauline's Chrome).** Date range 1 January to the last
   day of last month for all of them.
   - Insights, Results: export the daily CSVs for Views, Reach, Content interactions, Link clicks, Profile visits, Follows.
   - Insights, Audience: export (top cities, age and gender, top countries).
   - Content, Posts and reels: export lifetime metrics. Content, Stories: same.
   Rename to the file names above and put them in `data/exports/YYYY-MM-DD/` (today's date).
   If an export cannot be done, use Metricool for that part (step 2) and say so in the note to Pauline.
2. **Metricool (brand "Velvet Pages Mag", id 5808407).** Read followers today (`IGEV01`, last value) for `meta.json`.
   Cross-check last month's totals (views `IGEV05`, posts `IGPO`/`IGRE` per post) against the Meta exports; Meta wins,
   but a gap above 10% is worth a line in the note. Fallback for posts if the Meta export failed: `IGPO02,07,06,13,08,15,27,14,28,29,03`
   and reels `IGRE02,06,10,07,12,21,11,23,03` (timestamps are UTC).
3. **Substack.** Open https://velvetpagesmag.substack.com/publish/home in Chrome, run `substack_fetch.js` with
   `await vpSubstack(YEAR, 'YYYY-MM-DD last day of data')`, read `window.__vpsub` back in slices and merge into
   `substack.json` (keep topics; tag new publications). Growth sources: read the "Growth sources" table on
   /publish/growth/subscribers with 90 days selected, update `sources` and `sourcesNote`.
4. **Tag new posts.** Run `build_data.py`; it lists untagged posts. Read each caption and add it to `topics.json`.
5. **Insights.** Add an entry for the new month in `insights.js` for `ig` and `sub`, and rewrite `ytd`.
   Headline plus 2 to 3 worked, 2 to 3 didn't, 1 to 2 pattern. Every number must come from `data.json`: recompute
   each one with a short script before publishing. Pauline's rules: no em dashes or en dashes, no hype, plain and warm,
   never blame the team. If the previous run left a partial-month entry, replace it.
6. **Build and check.** `assemble.py`, open it with Playwright (all months, Instagram and Substack, no page errors),
   then `make_pdf.js` for last month and look at the pages.
7. **Publish.** In pbv-decks: `python3 tools/publish.py space tools/spaces/velvet-pages.json --password-file PW
   --src dashboard-2026=/path/VP_Performance_Dashboard.html` (update the document `meta` line in the space config
   to the new month), test locally, commit, push. The password is the client's existing one (the tool refuses another).
8. **Save** the new data files, the page and the PDF back to Drive.
9. **Email.** Gmail draft (not sent) to the team, PDF attached, link and password included; Pauline reviews and sends.

A new year: from the January run onward, set `year` to the new year, add a new document (`dashboard-2027`) at the top
of the space config and keep the previous year's dashboard listed below it.
