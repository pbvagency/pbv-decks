# PBV decks

Hosted decks for PBV Agency. Two Netlify projects read from this repository:

| Folder | Address | Netlify project | For |
|---|---|---|---|
| `proposals/` | proposals.pbvagency.com | pbv-proposals | Pitches and proposals for prospects: `proposals/<client>/`, e.g. `proposals/kind-patches/` |
| `clients/` | clients.pbvagency.com | pbv-clients | One private space per client: `clients/<client>/` lists all their documents, each in its own folder, e.g. `clients/les-elfes/q3-2026/` |

Client spaces today: `les-elfes`, `me-and-all-hotels`. Les Jardins de Chivrageon will be `j-d-c`.

## How a page is protected

Every page is a PBV password page holding the deck **encrypted** (AES-256-GCM, PBKDF2-SHA256 600,000 iterations). Nothing is readable without the password, not even in the page source. A client space uses **one password per client**: the space page and every document in it open with it, and within the same browser tab it is only asked once.

On top of that: `noindex` in every page, an `X-Robots-Tag` header, `no-store` and `no-referrer` (each folder's `netlify.toml`). Crawling stays allowed so Google can read the noindex.

## Publishing (tools/publish.py)

```
pip install cryptography
python3 tools/publish.py newpassword > pw.txt            # once per client, or per proposal
python3 tools/publish.py proposal Deck.html kind-patches --client "Kind Patches" --contact Ivana --password-file pw.txt
python3 tools/publish.py space tools/spaces/les-elfes.json --password-file pw.txt --src q4-2026=/path/Les_Elfes_Q4_Review_2026.html
git add -A && git commit -m "..." && git push           # live about a minute later
```

To add a document to a client space, add it at the top of the `documents` list in `tools/spaces/<client>.json` and run `space` with its `--src`. The others stay as they are.

## Rules

- Never commit an unencrypted deck or a password. Passwords live in Pauline's password manager.
- Every deck keeps `<meta name="robots" content="noindex, nofollow, noarchive">` first in `<head>` (the tool refuses a deck without it).
- No internal documents (handovers, anything about a person). Those are shared from Drive, never published.
- Taking a deck down: delete its folder (and its line in the space config). The link returns 404 and Google drops it for good.
- The bare subdomains redirect to pbvagency.com.
- Older decks on their own subdomains (for example the Kind Patches proposal) stay where they are until the engagement closes.
