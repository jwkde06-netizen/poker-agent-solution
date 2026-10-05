alter table public.game_sessions
  add column if not exists game_no text;

create index if not exists idx_game_sessions_game_no
  on public.game_sessions(game_no);
