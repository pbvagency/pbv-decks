# PBV decks

Hosted client decks for PBV Agency. Two Netlify sites read from this repository:

| Folder | Address | Netlify site | For |
|---|---|---|---|
| `proposals/` | proposals.pbvagency.com | pbv-proposals | Pitches and proposals for prospects. Clean, readable paths: `proposals/kind-patches/` |
| `clients/` | clients.pbvagency.com | pbv-clients | Quarterly reviews and reports for clients. **Randomized** paths: `clients/les-elfes-q3-7f3k9x/`, so nobody can guess another client's deck |

## Rules

- One deck = one folder with an `index.html`. The link is `https://<subdomain>.pbvagency.com/<folder>/`.
- Every deck keeps `<meta name="robots" content="noindex, nofollow, noarchive">` first in `<head>`. The sites also send an `X-Robots-Tag` header as a second layer.
- Password-gated decks are committed already encrypted (the bundle the proposal skill produces), never the readable version.
- No internal documents (handovers, anything about a person). Those are shared from Drive, never published.
- Updating a deck: replace its `index.html`. The link does not change.
- Taking a deck down: delete its folder. The link returns 404 and Google drops it for good.
- The bare subdomains redirect to pbvagency.com.
- Older decks on their own subdomains (for example the Kind Patches proposal) stay where they are until the engagement closes.
