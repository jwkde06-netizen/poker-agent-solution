# Daily settlement layout contract

The user repeatedly requested a compact worksheet and explicitly rejected explanatory text returning after updates (2026-10-25).

- Default view: one date toolbar, one compact totals strip, and the player table. Desktop totals stay in one row; narrow screens use two columns.
- Show the selected business day's profit before weekly salary, rakeback, total F&B and buyins. Keep the existing 3F exclusion and code payout math. Do not rename this to final profit after all expenses.
- Each player row sums their current Sheet buyins across that day, including rebuys already included in each game's cumulative count. Do not sum scan logs, use the maximum across games, or include previous days. Conflicting IDs remain separate.
- Keep player names, agency, card ID, internal game links, cumulative buyins, rake and rakeback in spreadsheet columns. Pin the header/name columns, right-align numbers, and retain an aggregate footer.
- Do not add a stepper, introductory copy, refresh explanations, calculation paragraphs, large empty metric cards, or a second game-summary table above/below the player table.
- Processing history, unassigned dates and calculation detail are available through the collapsed “확인” control. Keep actual errors discoverable and incomplete amounts visibly incomplete.
- Keep the 15-second refresh, selected date, existing access control and safe weekly confirmation checks. This view never writes ledger rows.

Validation: `NODE_PATH=<typescript installation> node tests/daily-player-totals.cjs`. Check desktop/mobile table fit, player totals against the day total, sorting, the review disclosure, and game links in the production UI.
