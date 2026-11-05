#!/usr/bin/env python3
"""Velvet Pages dashboard: turn a data folder into data.json.

Usage: python3 build_data.py DATA_DIR OUT_JSON

DATA_DIR must contain:
  exports/posts.csv          Meta Business Suite content export, posts and reels, lifetime, 1 Jan to month end
  exports/stories.csv        Meta Business Suite content export, stories, lifetime, same range
  exports/views.csv reach.csv interactions.csv link_clicks.csv profile_visits.csv follows.csv
                             Meta Business Suite Insights daily exports (UTF-16, "Date","Primary"), same range
  exports/audience.csv       Meta Business Suite audience export (cities, age and gender, countries)
  topics.json                {permalink: TOPIC_CODE} for every post (see TOPICS below)
  substack.json              subscribers/followers month-end, monthly views, publications, growth sources
  meta.json                  {"year", "dataThrough": "YYYY-MM-DD", "followersNow", "followersDate", "audienceDate"}

Publish times in the Meta exports are US Pacific; they are converted to Amsterdam time.
The build stops if a post has no topic, listing the ones to tag.
"""
import csv, json, os, re, statistics, sys, calendar
from zoneinfo import ZoneInfo
from datetime import datetime, date
from collections import defaultdict

TOPICS = {
 'GWR': 'Girls Who Read portraits', 'ISSUE': 'Issue launch & stockists', 'MERCH': 'Merch & pop-ups',
 'EVENTS': 'Events & community', 'BOOKS': 'Reading lists & book tips', 'FILM': 'Film, music & watchlists',
 'FASHION': 'Fashion, vintage & style', 'ART': 'Art, exhibitions & travel', 'BRAND': 'Brand partner editorials',
 'ESSAY': 'Essays & Substack teasers', 'CALL': 'Open calls & VP Digital', 'TEAM': 'Team & behind the scenes',
 'PRESS': 'Press & partner collabs'}
LA, AMS = ZoneInfo('America/Los_Angeles'), ZoneInfo('Europe/Amsterdam')

D, OUT = sys.argv[1], sys.argv[2]
X = lambda f: os.path.join(D, 'exports', f)
meta = json.load(open(os.path.join(D, 'meta.json')))
topics = json.load(open(os.path.join(D, 'topics.json')))
year = meta['year']
through = date.fromisoformat(meta['dataThrough'])
MONTHS = ['%d-%02d' % (year, m) for m in range(1, through.month + 1)] if through.year == year else ['%d-%02d' % (year, m) for m in range(1, 13)]
last = MONTHS[-1]
partial = None
if through.year == year and through.day < calendar.monthrange(year, through.month)[1]:
    partial = {'month': last, 'days': through.day}
MLABEL = {m: datetime.strptime(m, '%Y-%m').strftime('%B') for m in MONTHS}

def n(x):
    try: return int(float(x))
    except: return 0

def read_text(fn):
    raw = open(fn, 'rb').read()
    for enc in ('utf-16', 'utf-8-sig'):
        try:
            t = raw.decode(enc)
            if '"' in t: return t
        except UnicodeError: pass
    return raw.decode('utf-8', 'replace')

def daily(fn):
    out = defaultdict(int)
    for line in read_text(fn).splitlines():
        m = re.match(r'"(\d{4}-\d{2})-(\d{2})T[^"]*","(-?\d+)"', line.strip())
        if m and m.group(1) in MONTHS and date.fromisoformat(m.group(1) + '-' + m.group(2)) <= through:
            out[m.group(1)] += int(m.group(3))
    return out

acct = {k: daily(X(f)) for k, f in {'views': 'views.csv', 'reach': 'reach.csv', 'interactions': 'interactions.csv',
        'linkClicks': 'link_clicks.csv', 'profileVisits': 'profile_visits.csv', 'follows': 'follows.csv'}.items()}

def pt(s):
    for f in ('%m/%d/%Y %H:%M', '%Y-%m-%dT%H:%M:%S', '%Y-%m-%d %H:%M'):
        try: return datetime.strptime(s, f).replace(tzinfo=LA).astimezone(AMS)
        except ValueError: pass
    raise ValueError('unknown publish time format: ' + s)

def trunc(t, k=84):
    if len(t) <= k: return t
    return t[:k].rsplit(' ', 1)[0].rstrip(' ,.:;!-@') + '…'

# ---------- posts ----------
rows = list(csv.DictReader(open(X('posts.csv'), encoding='utf-8-sig')))
lst = sorted(((pt(r['Publish time']), r) for r in rows), key=lambda x: x[0])
lst = [(dt, r) for dt, r in lst if dt.year == year and dt.date() <= through]
missing = [(dt.strftime('%Y-%m-%d'), r['Permalink'], re.sub(r'\s+', ' ', r['Description'])[:100]) for dt, r in lst if r['Permalink'] not in topics]
if missing:
    print('UNTAGGED POSTS: add each permalink to topics.json with one of', list(TOPICS))
    for m in missing: print(' ', *m)
    sys.exit(2)
posts = []
for i, (dt, r) in enumerate(lst):
    likes, com, sav, sh = n(r['Likes']), n(r['Comments']), n(r['Saves']), n(r['Shares'])
    reach, views = n(r['Reach']), n(r['Views'])
    inter = likes + com + sav + sh
    cap = r['Description'].strip()
    fmt = {'IG carousel': 'Carousel', 'IG image': 'Image', 'IG reel': 'Reel'}.get(r['Post type'], r['Post type'].replace('IG ', '').title())
    code = topics[r['Permalink']]
    assert code in TOPICS, f'unknown topic {code} for {r["Permalink"]}'
    posts.append(dict(id=i, date=dt.strftime('%Y-%m-%d'), time=dt.strftime('%H:%M'), dow=dt.strftime('%a'), month=dt.strftime('%Y-%m'),
        format=fmt, topic=code, url=r['Permalink'], caption=cap[:600], title=trunc(re.sub(r'\s+', ' ', cap)),
        views=views, reach=reach, likes=likes, comments=com, saves=sav, shares=sh, follows=n(r['Follows']),
        interactions=inter, er=round(inter / reach * 100, 2) if reach else 0, collab=code == 'PRESS'))
own = [p for p in posts if not p['collab']]
med_reach = statistics.median(p['reach'] for p in own)
med_er = statistics.median(p['er'] for p in own)
for p in posts:
    idx = 0.5 * p['reach'] / med_reach + 0.5 * p['er'] / med_er
    p['score'] = round(idx, 2)
    p['verdict'] = 'Strong' if idx >= 1.3 else ('Weak' if idx < 0.75 else 'Steady')

# ---------- stories ----------
stories = defaultdict(lambda: defaultdict(int))
for r in csv.DictReader(open(X('stories.csv'), encoding='utf-8-sig')):
    dt = pt(r['Publish time'])
    if dt.year != year or dt.date() > through: continue
    s = stories[dt.strftime('%Y-%m')]
    s['count'] += 1
    for k, c in [('reach', 'Reach'), ('views', 'Views'), ('replies', 'Replies'), ('profileVisits', 'Profile visits'),
                 ('linkClicks', 'Link clicks'), ('follows', 'Follows'), ('stickerTaps', 'Sticker taps')]:
        s[k] += n(r.get(c, 0))

ig = {}
for m in MONTHS:
    mp = [p for p in posts if p['month'] == m]
    st = stories.get(m, {})
    preach = sum(p['reach'] for p in mp); pint = sum(p['interactions'] for p in mp)
    ig[m] = dict(views=acct['views'][m], reach=acct['reach'][m], accountInteractions=acct['interactions'][m],
        profileVisits=acct['profileVisits'][m], linkClicks=acct['linkClicks'][m], follows=acct['follows'][m],
        posts=len(mp), reels=sum(p['format'] == 'Reel' for p in mp),
        likes=sum(p['likes'] for p in mp), comments=sum(p['comments'] for p in mp), saves=sum(p['saves'] for p in mp),
        shares=sum(p['shares'] for p in mp), postInteractions=pint, postReach=preach,
        er=round(pint / preach * 100, 2) if preach else 0, avgReach=round(preach / len(mp)) if mp else 0,
        stories=st.get('count', 0), storyReach=st.get('reach', 0), storyViews=st.get('views', 0),
        storyReplies=st.get('replies', 0), storyProfileVisits=st.get('profileVisits', 0), storyLinkClicks=st.get('linkClicks', 0),
        storyFollows=st.get('follows', 0))

# ---------- audience ----------
blocks, cur = {}, None
for row in csv.reader(read_text(X('audience.csv')).splitlines()):
    if not row or row[0].startswith('sep='): continue
    if len(row) == 1 and row[0]: cur = row[0]; blocks[cur] = []; continue
    if cur: blocks[cur].append(row)
def pairs(name):
    b = next(v for k, v in blocks.items() if name in k.lower())
    return [[re.sub(r', (Netherlands|France|South Korea|Thailand|NY, US|United Kingdom)$', '', a), float(c)] for a, c in zip(b[0], b[1]) if a]
age_rows = next(v for k, v in blocks.items() if 'age' in k.lower())
age = [[r[0], float(r[1]), float(r[2])] for r in age_rows[1:] if len(r) >= 3 and r[0]]
aud = dict(cities=pairs('cities'), countries=pairs('countries'), age=age, date=meta.get('audienceDate', ''))
aud['women'] = round(sum(a[1] for a in age), 1); aud['men'] = round(sum(a[2] for a in age), 1)

# ---------- substack ----------
S = json.load(open(os.path.join(D, 'substack.json')))
prev = '%d-12' % (year - 1)
sub = {}
for m in MONTHS:
    mp = [p for p in S['posts'] if p['date'][:7] == m]
    deliv = sum(p['delivered'] for p in mp)
    sub[m] = dict(subscribers=S['subscribersEnd'][m], newSubscribers=S['subscribersEnd'][m] - S['subscribersEnd'][prev],
                  followers=S['followersEnd'][m], views=S['views'][m], posts=len(mp), likes=sum(p['likes'] for p in mp),
                  openRate=round(sum(p['opened'] for p in mp) / deliv * 100, 1) if deliv else None)
    prev = m
sub_topics = []
for tp in sorted(set(p['topic'] for p in S['posts'] if p['delivered'])):
    tps = [p for p in S['posts'] if p['topic'] == tp and p['delivered']]
    sub_topics.append(dict(topic=tp, posts=len(tps), avgViews=round(sum(p['views'] for p in tps) / len(tps)),
        openRate=round(sum(p['opened'] for p in tps) / sum(p['delivered'] for p in tps) * 100, 1),
        avgLikes=round(sum(p['likes'] for p in tps) / len(tps), 1)))

data = dict(year=year, dataThrough=meta['dataThrough'], partial=partial, months=MONTHS, monthLabels=MLABEL,
            followersNow=meta['followersNow'], followersDate=meta['followersDate'],
            ig=ig, posts=posts, topics=TOPICS, medReach=med_reach, medER=med_er, audience=aud,
            substack=dict(monthly=sub, posts=[p for p in S['posts'] if p['delivered']], topics=sub_topics, sources=S['sources'],
                          sourcesNote=S.get('sourcesNote', ''), subscribersStart=S['subscribersEnd']['%d-12' % (year - 1)],
                          followersStart=S['followersEnd']['%d-12' % (year - 1)]))
json.dump(data, open(OUT, 'w'), ensure_ascii=False)

tot = lambda k: sum(ig[m][k] for m in MONTHS)
print(f'{len(posts)} posts, {tot("stories")} stories, months {MONTHS[0]} to {MONTHS[-1]}' + (f' ({last} partial, {partial["days"]} days)' if partial else ''))
print(f'median reach {med_reach}, median ER {med_er}')
for m in MONTHS:
    g = ig[m]
    print(m, f"views {g['views']} reach {g['reach']} follows {g['follows']} pv {g['profileVisits']} posts {g['posts']} er {g['er']} stories {g['stories']} storyReach {g['storyReach']}", '| substack', sub[m])
