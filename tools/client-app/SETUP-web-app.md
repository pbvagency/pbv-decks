# One-time setup: the PBV Client Spaces web app

Done once for all clients. After this, a new client is one line in the `CLIENTS` setting.

1. Go to script.google.com while signed in as the PBV Google account that owns the calendars and the Drive folders. New project, name it **PBV Client Spaces**.
2. Delete the sample code, paste the whole of `Code.gs`, save.
3. Project settings (gear icon), Script properties, Add property:
   - Name: `CLIENTS`
   - Value (one line, Hotel Albatros first):
     `{"hotel-albatros": {"token": "<Albatros token from the password manager>", "sheet": "1TlR70PdtYVKuAqVmCr4Y54IAGvLhRV-5u0skEyBumKQ", "folder": "<ID of 12. Hotel Albatros / Content Calendar>", "notify": "<the PBV email that gets the alerts>"}}`
4. Back in the editor, pick `checkSetup` in the function menu and click Run. Google asks for permission (Sheets, Drive, email): accept. The log lists the months and day folders it found for each client.
5. Deploy, New deployment, type Web app. Execute as: **Me**. Who has access: **Anyone**. Deploy and copy the URL that ends in `/exec`.
6. Put that URL in `tools/spaces/<client>.json` under `"app": {"endpoint": "..."}`. It is the same URL for every client.

The token is what stops anyone else from reading the calendar: it lives in the `CLIENTS` setting and inside the encrypted client page, never in the repo or in a message.

When `Code.gs` changes later: paste the new version, then Deploy, Manage deployments, pencil icon, Version: New version, Deploy. The URL stays the same, so no client page needs rebuilding.
