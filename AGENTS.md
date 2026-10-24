# Project guidance

When changing the daily settlement UI, read `docs/daily-settlement-ui.md` first. Its compact worksheet layout is an explicit, repeated user requirement. Keep explanatory prose and processing history out of the default view. Preserve date-scoped cumulative player totals and verify them with `tests/daily-player-totals.cjs` when aggregation changes.
