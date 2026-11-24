# PBV client space app

One app for every client. The client opens clients.pbvagency.com/<client>/, types the space password once, and gets:

- **Home**: three doors (dashboard, calendar, documents).
- **Dashboard**: the client's monthly dashboard, already published in the same space.
- **Calendar**: every post and story of the month with the real photos and videos, on desktop as a month grid, a list or a phone preview, and on a phone as an app that looks like Instagram and Facebook. The client chooses a caption, approves, or asks for a change (copy, visual or both, with a comment). They can undo an approval.
- **Documents**: the space's documents plus any links (strategy, mock-ups).

Nothing is rebuilt per client. The same four files serve everyone:

| File | What it is |
|---|---|
| `app.html` | The page template (LUC client space design). |
| `app.css` | Its styles. Client colours come from the client's config. |
| `calendar-core.js` | Reads a month tab of a content calendar Sheet. Shared by the web app and the preview. |
| `gas.js` + `Code.gs` | The PBV Client Spaces web app (Google Apps Script). `Code.gs` = `calendar-core.js` + `gas.js`, the file pasted in Apps Script. |

## How the data flows

- **Copy**: from the calendar Sheet (row 14). Briefs and asset sources never leave the Sheet.
- **Visuals**: from Drive, `<client folder>/Content Calendar/<NN - Month>/<Mon DD post|stories>/`. Photos show as images, videos play in the page. The web app sets each visual to "anyone with the link can view" so it can be shown; the link only appears inside the password-protected page.
- **What the client sees**: posts set to **To validate** are open for review. Rework shows as "changes requested", Approved and Scheduled as approved, Posted as live. Everything else (Idea, To shoot, Awaiting content, In editing) shows as "in production" with no copy.
- **Decisions go back into the Sheet**: the status cells of the post change (Approved, Rework, or back to To validate), a note is added on the copy cell, a row is added to the "Client feedback" tab, and PBV gets an email.

## Add a new client (about 15 minutes, no code)

1. **Calendar Sheet**: month tabs named `<year> <anything> Calendar - <Mon>` with the standard rows (4 date to 14 copy). Visuals in Drive in month folders `NN - Month`, one folder per day (`Dec 11 post`, `Dec 12 stories`).
2. **Web app**: open the PBV Client Spaces Apps Script, Project settings, Script properties, `CLIENTS`. Add an entry:
   `"<client-id>": {"token": "<new random token>", "sheet": "<Sheet ID>", "folder": "<Content Calendar folder ID>", "notify": "<the PBV email that gets the alerts>"}`
   Generate the token with `python3 tools/publish.py newpassword` and keep it in the password manager. Run `checkSetup` once to see the months and folders it finds.
3. **Config**: copy `tools/spaces/hotel-albatros.json` to `tools/spaces/<client>.json`, change the names, bio, handle, colours, reviewers, documents and links. Put the logo and three door photos in `tools/spaces/assets/<client>/`.
4. **Preview** (optional): `python3 tools/publish.py preview tools/spaces/<client>.json --data sample.json --out /tmp/space.html`.
5. **Publish**: `python3 tools/publish.py space tools/spaces/<client>.json --password-file <pw> --token-file <token> --src <dashboard html>`. The space password is the client's existing one. Commit and push: Netlify publishes it.

## Changing the app for everyone

Edit `app.html` / `app.css`, then run the `space` command again for each client (one line each). If you change `calendar-core.js` or `gas.js`, rebuild `Code.gs` and paste it in the Apps Script, then Deploy, Manage deployments, edit, New version (the URL stays the same).

## When something fails

- **"The calendar did not load"**: the web app is down or the token in the page and in `CLIENTS` differ. Run `checkSetup` in Apps Script.
- **A post has no visual**: its day folder name does not match the date in the Sheet (for example the story of 13 November in a folder called `Nov 12 stories`). Rename the folder.
- **"This post was just updated"**: the post moved in the Sheet or is no longer To validate. The client reloads the page.
- **Manual fallback**: the client can always review the mock-ups and reply by email; Pauline updates the Sheet by hand.
