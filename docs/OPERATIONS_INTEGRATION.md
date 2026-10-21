# Integrated operations workspace

`/operations` is the new shared entry point; the original `/` application is preserved. Desktop sidebar and mobile account menu link to the new workspace.

## Reused capabilities

- Existing Supabase auth and active admin role, no new accounts or keys.
- Existing player, agency, expense, distribution and account management remain in the legacy application.
- `/operations/weekly` and `/operations/rules` run within this application's origin/session. Fixed-destination server proxy forwards the current user bearer to the existing Dream accounting service, which independently verifies the active admin role. Cookies/other headers are not forwarded. No service credential is copied.
- Reservations and exchange retain their existing operating services and are linked from the workspace.
- Google Sheets remains the Dream accounting source; legacy database entries are not combined with it or relabeled as synchronized.

## Rooms and boundaries

Dream is connected. MM, Taiwan and Philippines are setup workspaces with no financial actions or data connection. Their currency/timezone are setup defaults, not verified business configurations. Before activation: verify each room's workbook, tab/column mapping, agencies/rates, day cutoff, Telegram group and authorized administrators. The current shared global admin role is **not** a tenant membership implementation. Do not enable another room by only changing `connected` in the UI.

## Verification

Run `node tests/operations.cjs` and TypeScript checking. Test unauthenticated API access, navigation, mobile CSS and room switching. Production sign-in and finance saves need a real administrator session; no test financial rows are created for interface checks.
