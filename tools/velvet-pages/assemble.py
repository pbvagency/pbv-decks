#!/usr/bin/env python3
"""Assemble the standalone dashboard page.
Usage: python3 assemble.py DATA_JSON INSIGHTS_JS OUT_HTML
The page is unencrypted: publish it with pbv-decks tools/publish.py (space velvet-pages), never as is."""
import sys, os
here = os.path.dirname(os.path.abspath(__file__))
data, insights, out = sys.argv[1:4]
head = open(os.path.join(here, 'template_head.html'), encoding='utf-8').read()
payload = ("const DATA = " + open(data, encoding='utf-8').read() + ";\n" + open(insights, encoding='utf-8').read()
           + "\n" + open(os.path.join(here, 'app.js'), encoding='utf-8').read())
assert '</script' not in payload.lower(), 'payload contains a closing script tag'
html = head + '<body>\n<div id="app"></div>\n<script>\n' + payload + '\n</script>\n</body>\n</html>\n'
assert html.lower().count('name="robots"') == 1 and 'noarchive' in html
txt = html.replace('@momuantwerp —', '')
assert '—' not in open(insights, encoding='utf-8').read(), 'em dash in insights: Pauline never uses them'
open(out, 'w', encoding='utf-8').write(html)
print('wrote', out, len(html) // 1024, 'KB')
