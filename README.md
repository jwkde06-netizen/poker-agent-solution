# Poker Agent Solution

Dynamic poker agency / rakeback settlement MVP.

## Current MVP

- Agency Code CRUD-style editing
- Flexible code rename (example: `KOREA2 -> HOUSE2`)
- Flexible rakeback rate editing
- Player registration with assigned Agency
- Game entry with automatic rakeback calculation
- Historical rate snapshot
- Daily settlement by agency and player
- Browser localStorage persistence

## Important accounting rule

The UI never uses an Agency Code string as the relational key.

Each agency owns an immutable internal `id`. Players reference that ID.

When a game is recorded, these values are snapshotted:

- `agencyId`
- `agencyCodeSnapshot`
- `rateSnapshot`
- `rakeback`

Therefore:

1. Renaming `KOREA2` to `HOUSE2` does not break player relationships.
2. Changing a rate from 25% to 30% does not rewrite historical settlements.
3. New entries use the current agency rate.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Next phase

Replace localStorage with Supabase:

- authentication
- PostgreSQL tables
- administrator permissions
- persistent players / agencies / game entries
- daily and weekly settlement views
- audit log
- optional Google Sheets import / export
